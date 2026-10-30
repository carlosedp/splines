// new/ and updated/: static pages plus Atom feeds (for feed readers and fediverse bots).
import { html, join } from "../html.mjs";
import { cfg, href, siteUrl, buildDate, FEED_SIZE } from "../context.mjs";
import { latest } from "../records.mjs";
import { layout } from "../layout.mjs";
import { card } from "../components.mjs";

export default function lists(records, write) {
  const newest = (key) => latest(records, key, FEED_SIZE);
  const pages = [
    {
      page: "new/",
      feed: "feed-new.xml",
      title: "new scripts",
      intro: "The latest scripts added to the catalog.",
      empty: "Nothing new yet. Scripts added from now on show up here.",
      items: newest("added"),
      date: (r) => r.added,
      // one entry per script: being added happens once
      id: (r) => `${siteUrl}/${r.path}`,
    },
    {
      page: "updated/",
      feed: "feed-updated.xml",
      title: "recently updated",
      intro: "Scripts whose repositories received pushes most recently.",
      empty: "No update data yet (it comes from GitHub during the deploy).",
      items: newest("updated"),
      date: (r) => r.updated,
      // a new entry for each update day, so feed readers show repeat updates
      id: (r) => `${siteUrl}/${r.path}#updated-${r.updated}`,
    },
  ];

  for (const l of pages) {
    write(
      `${l.page}index.html`,
      layout({
        title: l.title,
        description: l.intro,
        canonical: l.page,
        body: html`
<section class="hero">
  <h1>${l.title}</h1>
  <p>${l.intro}${siteUrl && html` <a href="${href(l.feed)}">Atom feed</a>`}</p>
</section>
${l.items.length ? html`<ul class="cards">\n${join(l.items.map(card), "\n")}\n</ul>` : html`<p class="empty">${l.empty}</p>`}
`,
      }),
    );
    if (!siteUrl) continue;
    const entries = l.items.map(
      (r) => html`  <entry>
    <title>${r.name}</title>
    <id>${l.id(r)}</id>
    <link href="${siteUrl}/${r.path}"/>
    <updated>${l.date(r)}T00:00:00Z</updated>
    <author><name>${r.author}</name></author>
    <summary>${r.description}</summary>
${join(r.tags.map((t) => html`    <category term="${t}"/>`), "\n")}
  </entry>`,
    );
    write(
      l.feed,
      html`<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${cfg.title}: ${l.title}</title>
  <subtitle>${l.intro}</subtitle>
  <id>${siteUrl}/${l.feed}</id>
  <link rel="self" href="${siteUrl}/${l.feed}"/>
  <link href="${siteUrl}/${l.page}"/>
  <updated>${l.items.length ? `${l.date(l.items[0])}T00:00:00Z` : buildDate}</updated>
${join(entries, "\n")}
</feed>
`,
    );
  }
}
