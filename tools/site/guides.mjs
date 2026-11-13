// Guides (guides/<slug>/index.md) as the records the guide pages render from, linked to the script records.
import path from "node:path";
import { ROOT, GUIDES_DIR, loadEntries, loadGuides, validateGuide, githubSlug, listingOf } from "../lib.mjs";
import { cache, href, fillPlaceholders } from "./context.mjs";

/**
 * Valid guides, sorted by title. Each lists the scripts it covers: `scripts` (its front matter list, in that
 * order) and `tagged` (other published scripts with one of its `tags`). Scripts not on the site (indexed or
 * declined, or left out of this build) are linked by repo only, so a guide never publishes an entry.
 * Side effect: every covered script record gets `guides` ({ slug, title, path }) for its page's backlinks.
 */
export function collectGuides(records) {
  const entries = loadEntries();
  const names = new Set(entries.map((e) => e.data?.name).filter(Boolean).map(String));
  const byName = new Map(records.map((r) => [r.name, r]));
  const entryByName = new Map(entries.filter((e) => e.data?.name).map((e) => [String(e.data.name), e]));
  for (const r of records) r.guides = [];

  const guides = [];
  for (const g of loadGuides()) {
    const errs = validateGuide(g, names);
    if (errs.length) {
      console.warn(`! skipping ${g.file}: ${errs[0]}`);
      continue;
    }
    const d = g.data;
    const listed = (d.scripts || []).map(String);
    const tags = (d.tags || []).map(String);
    // a script outside this build: name, repo and description from its entry file, no page to link to
    const offSite = listed
      .filter((n) => !byName.has(n))
      .map((n) => {
        const e = entryByName.get(n).data;
        return { name: n, repo: e.repo, author: e.author, description: e.description, listing: listingOf(e) };
      });
    const checked = String(d.checked).slice(0, 10);
    const guide = {
      slug: g.slug,
      path: `${GUIDES_DIR}/${g.slug}/`,
      title: d.title,
      summary: d.summary,
      topic: d.topic,
      authors: d.authors.map(String),
      checked,
      sources: (d.sources || []).map(String),
      body: fillPlaceholders(g.body.replace(/<!--[\s\S]*?(-->|$)/g, "")),
      file: g.file,
      dir: path.join(ROOT, GUIDES_DIR, g.slug),
      scripts: listed.filter((n) => byName.has(n)).map((n) => byName.get(n)),
      offSite,
      tagged: records
        .filter((r) => !listed.includes(r.name) && r.tags.some((t) => tags.includes(t)))
        .sort((a, b) => a.name.localeCompare(b.name)),
      // scripts pushed to after the guide was last checked: what it says may no longer hold
      changed: listed
        .map((n) => ({ name: n, pushed: cache[githubSlug(entryByName.get(n).data.repo)]?.pushedAt?.slice(0, 10) }))
        .filter((c) => c.pushed && c.pushed > checked),
    };
    // [[name]]: the script page when it's on the site, else its repo
    const entryOf = (n) => entryByName.get(n)?.data;
    guide.resolve = (n) => {
      const r = byName.get(n);
      if (r) return { href: href(r.path), title: r.description };
      const e = entryOf(n);
      return e && { href: e.repo, title: `${e.description} (repository; not listed on the site)` };
    };
    for (const r of [...guide.scripts, ...guide.tagged]) r.guides.push({ slug: guide.slug, title: guide.title, path: guide.path });
    guides.push(guide);
  }
  return guides.sort((a, b) => a.title.localeCompare(b.title));
}
