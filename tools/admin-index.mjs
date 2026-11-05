#!/usr/bin/env node
// The admin view's index: every entry that isn't published, with stars and last push from the enrich cache, written
// to admin-data/unpublished.json. deploy.yml force-pushes it to the `admin-data` branch, never to the site: only
// published entries reach splines.cc. admin.js reads it with the admin's token in one request, instead of reading
// every scripts/*/index.md through the API (it still does that when the branch isn't there yet).
//
//   node tools/admin-index.mjs        (offline: reads scripts/ and .cache/github.json)
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, loadEntries, listingOf, githubSlug, readJSON, PLACEHOLDER_DESCRIPTION } from './lib.mjs';

const cache = readJSON(path.join(ROOT, '.cache', 'github.json'), {});
const str = (v) => (v == null || v === '' ? undefined : String(v));
const list = (v) => (Array.isArray(v) ? v.map(String) : []);

const entries = [];
for (const e of loadEntries()) {
  const d = e.data;
  const listing = listingOf(d);
  if (listing === 'published') continue;
  const gh = cache[githubSlug(d.repo || '')] || {};
  // the fields admin.js reads (card() and the quick view); undefined ones drop out of the JSON
  entries.push({
    slug: e.slug,
    name: str(d.name) || e.slug,
    author: str(d.author),
    description: str((d.description === PLACEHOLDER_DESCRIPTION && gh.description) || d.description),
    platform: e.platform,
    kind: e.kind,
    ai: str(d.ai),
    tags: list(d.tags),
    requires: list(d.requires),
    repo: str(d.repo),
    install: str(d.install),
    listing,
    origin: str(d.origin),
    invited: str(d.invited),
    status: str(d.status) || (gh.archived ? 'archived' : undefined),
    added: d.added ? String(d.added).slice(0, 10) : undefined,
    stars: gh.stars ?? undefined,
    updated: gh.pushedAt ? gh.pushedAt.slice(0, 10) : undefined,
  });
}
entries.sort((a, b) => a.slug.localeCompare(b.slug));

const out = path.join(ROOT, 'admin-data', 'unpublished.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify({ built: new Date().toISOString(), commit: process.env.GITHUB_SHA || null, entries }) + '\n');
console.log(`✓ ${entries.length} unpublished entries → ${path.relative(ROOT, out).replace(/\\/g, '/')}`);
