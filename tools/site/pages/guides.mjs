// guides/ and guides/<slug>/: long-form docs on a theme, with the scripts they cover.
import fs from "node:fs";
import path from "node:path";
import { GUIDE_TOPICS } from "../../lib.mjs";
import { html, raw, join } from "../html.mjs";
import { cfg, href } from "../context.mjs";
import { markdown } from "../markdown.mjs";
import { layout } from "../layout.mjs";
import { card, discussion } from "../components.mjs";

const newGuideUrl = `https://github.com/${cfg.repo}/blob/${cfg.branch}/CONTRIBUTING.md#guides`;
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const scriptCount = (g) => g.scripts.length + g.offSite.length + g.tagged.length;

/** The h2s of rendered guide HTML, for the "on this page" list. Their text is already escaped by the renderer. */
const outline = (body) => [...body.matchAll(/<h2 id="([^"]*)">([\s\S]*?)<\/h2>/g)].map(([, id, text]) => ({ id, text: text.replace(/<[^>]+>/g, "") }));

function index(guides) {
  const topics = Object.keys(GUIDE_TOPICS).filter((t) => guides.some((g) => g.topic === t));
  return html`<section class="hero"><h1>guides</h1>
  <p>How things fit together: frameworks, mods and techniques that span many scripts, written by the community and linked to the scripts they cover. <a href="${newGuideUrl}">Write one</a>.</p>
</section>
${topics.map(
  (t) => html`<section class="guide-topic"><h2>${GUIDE_TOPICS[t]}</h2><ul class="guide-list">${guides
    .filter((g) => g.topic === t)
    .map(
      (g) => html`<li class="guide-item"><a class="guide-title" href="${href(g.path)}">${g.title}</a>
    <p>${g.summary}</p>
    <p class="guide-meta">by ${g.authors.join(", ")} · ${plural(scriptCount(g), "script")} · checked <time datetime="${g.checked}">${g.checked}</time></p></li>`,
    )}</ul></section>`,
)}
${!guides.length && html`<p class="hint">No guides yet.</p>`}`;
}

function page(g) {
  const body = markdown(g.body, { resolve: g.resolve });
  const toc = outline(body);
  const editUrl = `https://github.com/${cfg.repo}/edit/${cfg.branch}/${g.file}`;
  return html`<article class="entry guide">
  <p class="crumbs"><a class="back" href="${href("guides/")}">← all guides</a> <span class="crumb-sep">/</span> ${GUIDE_TOPICS[g.topic]}</p>
  <header class="entry-head">
    <h1>${g.title}</h1>
    <p class="lede">${g.summary}</p>
    <p class="guide-meta">by ${g.authors.join(", ")} · last checked against the code on <time datetime="${g.checked}">${g.checked}</time></p>
    ${g.changed.length > 0 && html`<p class="warn">Changed since then: ${join(g.changed.map((c) => html`<a href="${g.resolve(c.name).href}">${c.name}</a> (${c.pushed})`), ", ")}. Some details here may be out of date; check the script's README.</p>`}
  </header>
  <div class="entry-grid">
    <div class="entry-main">
      <div class="prose">${raw(body)}</div>
      ${scriptsSection(g)}
      ${discussion(g.path, "guide")}
    </div>
    <aside class="entry-side guide-side">
      ${toc.length > 0 && html`<nav class="toc" aria-label="On this page"><h2>on this page</h2><ol>${toc.map((h) => html`<li><a href="#${h.id}">${raw(h.text)}</a></li>`)}<li><a href="#scripts">scripts in this guide</a></li></ol></nav>`}
      ${g.sources.length > 0 && html`<h2>sources</h2><ul class="sources">${g.sources.map((u) => html`<li><a href="${u}">${u.replace(/^https:\/\/(www\.)?/, "")}</a></li>`)}</ul>`}
      <p class="edit">Something wrong or missing? <a href="${editUrl}">Suggest an edit</a>.</p>
    </aside>
  </div>
</article>`;
}

function scriptsSection(g) {
  // scripts on the site get their card; the others a plain link to their repo
  const cards = (list) => html`<ul class="cards">${list.map(card)}</ul>`;
  return html`<section class="guide-scripts" id="scripts"><h2>scripts in this guide</h2>
  ${g.scripts.length > 0 && cards(g.scripts)}
  ${g.offSite.length > 0 && html`<h3>not listed on ${cfg.title}</h3>
  <p class="hint">Their authors haven't opted in to the catalog yet, so here is just the repository.</p>
  <ul class="off-site">${g.offSite.map((s) => html`<li><a href="${s.repo}">${s.name}</a> <span class="fresh-by">by ${s.author}</span> · ${s.description}</li>`)}</ul>`}
  ${g.tagged.length > 0 && html`<h3>more like these</h3>${cards(g.tagged)}`}
</section>`;
}

export default function guidePages(guides, write) {
  write(
    "guides/index.html",
    layout({ title: "guides", description: `Community guides to monome norns mods, frameworks and techniques, linked to the scripts in ${cfg.title}.`, canonical: "guides/", body: index(guides) }),
  );
  for (const g of guides) {
    write(`${g.path}index.html`, layout({ title: g.title, description: g.summary, canonical: g.path, body: page(g) }));
    // images next to the guide (no SVG: it can carry scripts, and it would be served from the site's origin)
    for (const f of fs.readdirSync(g.dir)) {
      if (/\.(png|gif|jpe?g|webp)$/i.test(f)) write(path.join(g.path, f), fs.readFileSync(path.join(g.dir, f)));
    }
  }
}
