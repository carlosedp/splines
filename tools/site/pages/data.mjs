// Machine-readable output: the maiden catalog, index.json, the sitemap and GitHub Pages extras.
import { PLATFORMS, KINDS } from "../../lib.mjs";
import { html, join } from "../html.mjs";
import { cfg, siteUrl, buildDate } from "../context.mjs";

/** Writes the data files; returns the maiden catalog's entry count for the build summary. */
export default function data(records, write) {
  // maiden catalog (same shape as monome's community.json)
  const catalog = {
    file_info: { version: 1, kind: "script_catalog" },
    catalog_name: cfg.catalogName,
    date: buildDate,
    entries: records
      // entries with their own install URL (a release zip) can't be installed from project_url; libraries aren't installed
      .filter((r) => PLATFORMS[r.platform].maiden && KINDS[r.kind].maiden !== false && !r.install)
      .map((r) => ({
        project_name: r.name,
        project_url: r.repo,
        author: r.author,
        description: r.description,
        ...(r.discussion ? { discussion_url: r.discussion } : {}),
        documentation_url: siteUrl ? `${siteUrl}/${r.path}` : r.docs || undefined,
        tags: r.tags,
      })),
  };
  write("catalog.json", JSON.stringify(catalog, null, 2));

  // plain index for other tools
  const entries = records.map(({ body, readme, dir, ...r }) => ({ ...r, url: siteUrl ? `${siteUrl}/${r.path}` : r.path }));
  write("index.json", JSON.stringify({ generated: buildDate, count: records.length, entries }, null, 2));

  if (siteUrl) {
    const pages = ["", "start/", "about/", "new/", "updated/", "forks/", ...records.map((r) => r.path)];
    write(
      "sitemap.xml",
      html`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${join(pages.map((p) => html`  <url><loc>${siteUrl}/${p}</loc></url>`), "\n")}
</urlset>
`,
    );
  }
  write(".nojekyll", "");
  if (cfg.cname) write("CNAME", cfg.cname + "\n");

  return catalog.entries.length;
}
