// Check that every entry's repository is still where the entry says it is.
//
//   node tools/health.mjs [--dry-run]
//
// Renamed or transferred GitHub repos are fixed in place (the API redirects to the new location), and the
// old URL goes into site.config.json -> import.ignore so sources that still list it don't re-import it.
// Deleted, unreachable and archived repos get `status: gone` / `status: archived`, which the site shows as a ⚠️;
// removing an entry is a human decision. The status is cleared again when the repo is back to normal.
// The report goes to health.md, the body of the pull request opened by .github/workflows/health.yml.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, PLATFORMS, loadEntries, normalizeRepo, githubSlug, gh, updateFrontMatter } from './lib.mjs';

const dryRun = process.argv.includes('--dry-run');
const moved = [];
const gone = [];
const archived = [];
const duplicates = [];
const unchecked = [];
const statuses = new Map(); // entry -> status found by this run (undefined = fine); unchecked entries keep theirs

const entries = loadEntries();
// "platform owner/repo" -> entry, to catch two entries that now lead to the same repo
const bySlug = new Map(entries.map((e) => [`${e.platform} ${githubSlug(e.data?.repo)}`, e]));

for (const e of entries) {
  if (!e.data?.repo) continue;
  const slug = githubSlug(e.data.repo);
  if (!slug) {
    // other forges: a plain request is all we can do
    const res = await fetch(e.data.repo, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(15000) }).catch(() => null);
    if (!res || res.status >= 400) gone.push({ e, why: res ? `HTTP ${res.status}` : 'unreachable' });
    statuses.set(e, !res || res.status >= 400 ? 'gone' : undefined);
    continue;
  }
  const res = await gh(`/repos/${slug}`).catch((err) => err);
  if (res instanceof Error) {
    unchecked.push(`${e.slug}: ${res.cause?.code || res.message}`);
    continue;
  }
  if (res.status === 403 || res.status === 429) {
    console.warn('! rate limited, stopping early; the report is partial.');
    unchecked.push('(rate limited before every entry was checked)');
    break;
  }
  if (res.status === 404 || res.status === 451) {
    gone.push({ e, why: res.status === 404 ? 'not found (deleted or made private)' : 'unavailable for legal reasons' });
    statuses.set(e, 'gone');
    continue;
  }
  if (!res.ok) {
    unchecked.push(`${e.slug}: GitHub returned ${res.status}`);
    continue;
  }
  const r = await res.json();
  if (r.full_name.toLowerCase() !== slug) {
    // only owner/name change: some entries link a release zip or a subfolder on purpose
    const to = e.data.repo.replace(/^(https:\/\/(?:www\.)?github\.com\/)[^/]+\/[^/#?]+?(\.git)?(?=[/#?]|$)/i, `$1${r.full_name}`);
    const key = `${e.platform} ${r.full_name.toLowerCase()}`;
    const other = bySlug.get(key);
    if (other && other !== e) {
      duplicates.push({ e, other, to });
    } else {
      moved.push({ e, to, renamed: r.name !== e.slug && PLATFORMS[e.platform]?.luaRoot });
      bySlug.set(key, e);
    }
  }
  if (r.archived) archived.push({ e, pushed: r.pushed_at?.slice(0, 10) });
  statuses.set(e, r.archived ? 'archived' : undefined);
}

// write repo moves and status changes into the entries
const changes = new Map(moved.map((m) => [m.e, { repo: m.to }]));
const flagged = [];
const cleared = [];
for (const [e, status] of statuses) {
  if (status === e.data.status) continue;
  (status ? flagged : cleared).push({ e, from: e.data.status, to: status });
  changes.set(e, { ...changes.get(e), status });
}
if (!dryRun) {
  for (const [e, c] of changes) {
    const file = path.join(ROOT, e.file);
    fs.writeFileSync(file, updateFrontMatter(fs.readFileSync(file, 'utf8'), c));
  }
}

if (moved.length && !dryRun) {
  const file = path.join(ROOT, 'site.config.json');
  const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
  cfg.import = cfg.import || {};
  const ignore = new Set(cfg.import.ignore || []);
  const known = new Set([...ignore].map(normalizeRepo));
  for (const m of moved) if (!known.has(normalizeRepo(m.e.data.repo))) ignore.add(m.e.data.repo);
  cfg.import.ignore = [...ignore];
  fs.writeFileSync(file, `${JSON.stringify(cfg, null, 2)}\n`);
}

const link = (e) => `[${e.slug}](${e.data.repo})`;
const section = (title, items, fmt) => (items.length ? `### ${title} (${items.length})\n\n${items.map((x) => `- ${fmt(x)}`).join('\n')}\n\n` : '');
const report =
  `Weekly check of every entry's repository (${new Date().toISOString().slice(0, 10)}).\n\n` +
  section('moved', moved, (m) => `\`${m.e.slug}\`: ${m.e.data.repo} → ${m.to}${m.renamed ? ' ⚠️ the repo name changed, so the norns install folder may have too; consider renaming the entry' : ''}`) +
  section('duplicates', duplicates, (d) => `\`${d.e.slug}\`: ${d.e.data.repo} now leads to ${d.to}, which \`${d.other.slug}\` already lists. Remove one of them, and add the old URL to \`import.ignore\` in site.config.json`) +
  section('warnings added', flagged, (f) => `\`${f.e.slug}\`: \`status: ${f.to}\`${f.from ? ` (was ${f.from})` : ''}, shown as ⚠️ on the site`) +
  section('warnings cleared', cleared, (c) => `\`${c.e.slug}\`: no longer ${c.from}`) +
  section('gone', gone, (g) => `${link(g.e)}: ${g.why}. Remove the entry (and add its repo to \`import.ignore\` in site.config.json), or point it at a new home`) +
  section('archived', archived, (a) => `${link(a.e)} (last push ${a.pushed || 'unknown'}). Fine to keep if it still works`) +
  section('not checked', unchecked, (u) => u) +
  (moved.length || duplicates.length || gone.length || archived.length || cleared.length ? '' : 'Everything is where it should be. ✓\n');

fs.writeFileSync('health.md', report);
console.log(report);
console.log(`${dryRun ? '[dry run] ' : ''}moved ${moved.length}, duplicates ${duplicates.length}, gone ${gone.length}, archived ${archived.length}, warnings added ${flagged.length}, cleared ${cleared.length}.`);
