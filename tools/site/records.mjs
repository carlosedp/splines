// Entries plus cached GitHub data, as the records every page renders from (sorted by name).
import path from "node:path";
import { ROOT, ENTRIES_DIR, loadEntries, validateEntry, githubSlug, isActiveFork, PLACEHOLDER_DESCRIPTION } from "../lib.mjs";
import { cache, discussions, forksCache, buildDate } from "./context.mjs";
import { renderReadme } from "./markdown.mjs";

/** Forks worth a look, most recently pushed first; `newer` = pushed after upstream's last push.
 *  Each gets a page at <entry path>forks/<owner>/<repo>/ (pages/fork.mjs). */
function activeForks(slug, info, entryPath) {
  return (forksCache[slug]?.forks || [])
    .filter((f) => isActiveFork(f, Date.parse(buildDate)))
    .map((f) => ({
      slug: f.slug,
      branch: f.branch,
      ahead: f.ahead,
      behind: f.behind,
      stars: f.stars,
      pushed: f.pushedAt.slice(0, 10),
      newer: !!info.pushedAt && f.pushedAt > info.pushedAt,
      path: `${entryPath}forks/${f.slug}/`,
      description: f.details?.description ?? null,
      license: f.details?.license ?? null,
      readmePath: f.details?.readmePath ?? null,
      commits: f.details?.commits || [],
    }))
    .sort((a, b) => b.pushed.localeCompare(a.pushed));
}

export function collectRecords() {
  const records = [];
  for (const e of loadEntries()) {
    const errs = validateEntry(e);
    if (errs.length) {
      console.warn(`! skipping ${e.file}: ${errs[0]}`);
      continue;
    }
    const d = e.data;
    const ghSlug = githubSlug(d.repo);
    const gh = cache[ghSlug] || {};
    records.push({
      platform: e.platform,
      kind: e.kind,
      slug: e.slug,
      name: d.name,
      author: d.author,
      // imported entries may only have a placeholder; the repo's own description is better than nothing
      description: (d.description === PLACEHOLDER_DESCRIPTION && gh.description) || d.description,
      tags: d.tags.map(String),
      requires: d.requires || [],
      ai: d.ai,
      source: d.source || "submitted",
      origin: d.origin || null,
      repo: d.repo,
      discussion: d.discussion || null,
      docs: d.docs || null,
      install: d.install || null,
      license: d.license || gh.license || null,
      cover: d.cover || gh.cover || null,
      stars: gh.stars ?? null,
      forks: gh.forks ?? null,
      activeForks: activeForks(ghSlug, gh, `${ENTRIES_DIR}/${e.slug}/`),
      likes: discussions[`${ENTRIES_DIR}/${e.slug}/`]?.likes ?? 0,
      updated: gh.pushedAt ? gh.pushedAt.slice(0, 10) : null,
      // set by the weekly health check; the enrich cache catches archives between two checks
      status: d.status || (gh.archived ? "archived" : null),
      added: d.added ? String(d.added).slice(0, 10) : null,
      path: `${ENTRIES_DIR}/${e.slug}/`,
      body: e.body.replace(/<!--[\s\S]*?(-->|$)/g, ""), // the template's hint is a comment; it must not count as notes
      readme: renderReadme(ghSlug, gh),
      dir: path.join(ROOT, ENTRIES_DIR, e.slug),
    });
  }
  return records.sort((a, b) => a.name.localeCompare(b.name));
}

/** The n most recent records by a date field ("added" or "updated"), newest first. */
export const latest = (records, key, n) =>
  records
    .filter((r) => r[key])
    .sort((a, b) => b[key].localeCompare(a[key]) || a.name.localeCompare(b.name))
    .slice(0, n);
