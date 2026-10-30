// index.html: the searchable, filterable list. Cards are prerendered; app.js only filters and sorts them.
// Signed-in admins (see admin.mjs) also get cards for unpublished entries, built by admin.js, and the listing filter.
import { PLATFORMS, KINDS, LISTINGS } from "../../lib.mjs";
import { html, join } from "../html.mjs";
import { cfg, href, submitUrl, AI_LABEL } from "../context.mjs";
import { latest } from "../records.mjs";
import { layout } from "../layout.mjs";
import { card, chipGroup, freshPanel } from "../components.mjs";

const countBy = (records, keys, field) =>
  new Map(keys.map((k) => [k, records.filter((r) => r[field] === k).length]).filter(([, n]) => n > 0));

export default function home(records, write) {
  const tagCounts = new Map();
  const reqCounts = new Map();
  for (const r of records) {
    for (const t of r.tags) tagCounts.set(t, (tagCounts.get(t) || 0) + 1);
    for (const q of r.requires) reqCounts.set(q, (reqCounts.get(q) || 0) + 1);
  }
  const aiCounts = countBy(records, Object.keys(AI_LABEL), "ai");

  write(
    "index.html",
    layout({
      canonical: "",
      body: html`
<section class="hero">
  <h1>${cfg.tagline}</h1>
  <div class="hero-row">
  <p>${records.length} scripts. Search, filter by tag or hardware, and install straight from maiden. Handmade or AI-assisted, always disclosed. <a href="${submitUrl}">Add your script</a> with a short form, or read <a href="${href("about/")}">how it works</a>.${cfg.forum && html` Questions, ideas or work in progress? Join the <a href="${cfg.forum}">forum</a>.`}</p>
  <div class="start-callout">
    <center>
    <a class="start-button" href="${href("start/")}">new to norns? start here →</a>
    </center>
  </div>
  </div>
</section>
<section class="fresh" aria-label="What's new">
  ${freshPanel("just added", "new/", "feed-new.xml", latest(records, "added", 5), (r) => r.added)}
  ${freshPanel("recently updated", "updated/", "feed-updated.xml", latest(records, "updated", 5), (r) => r.updated)}
</section>
<section class="controls" aria-label="Search and filters">
  <div class="search-row">
    <div class="search-box">
      <input id="q" type="search" placeholder="search scripts, authors, tags…" autocomplete="off" aria-label="Search">
      <button id="q-clear" class="search-clear" type="button" aria-label="Clear search" title="Clear search" hidden>×</button>
    </div>
    <select id="sort" aria-label="Sort">
      <option value="name">name</option>
      <option value="updated">recently updated</option>
      <option value="added">recently added</option>
      <option value="likes">most liked</option>
      <option value="stars">most GitHub stars</option>
      <option value="forks">most active forks</option>
    </select>
  </div>
  <div class="filter-row">
    ${chipGroup("platform", "platform", countBy(records, Object.keys(PLATFORMS), "platform"))}
    ${chipGroup("kind", "type", countBy(records, Object.keys(KINDS), "kind"), { text: (k) => KINDS[k].plural })}
    <fieldset class="chips" data-group="ai">
      <legend>AI disclosure</legend>
      ${[...aiCounts].map(([k, n]) => html`<button type="button" class="chip" data-value="${k}" aria-pressed="false" title="${AI_LABEL[k][1]}">${AI_LABEL[k][0]} <span class="count">${n}</span></button>`)}
    </fieldset>
    ${chipGroup("requires", "hardware", reqCounts)}
    <fieldset class="chips admin-only" data-group="listing" hidden>
      <legend>listing (admin)</legend>
      ${Object.entries(LISTINGS).map(([k, title]) => html`<button type="button" class="chip" data-value="${k}" aria-pressed="false" title="${title}">${k} <span class="count"></span></button>`)}
    </fieldset>
  </div>
  <details class="tag-panel">
    <summary>tags <span class="count">${tagCounts.size}</span></summary>
    ${chipGroup("tags", "tags (all selected must match)", tagCounts)}
  </details>
  <p class="status"><span id="count">${records.length}</span> shown <button id="clear" type="button" class="link-button" hidden>clear filters</button></p>
</section>
<ul id="results" class="cards" data-repo="${cfg.repo}" data-branch="${cfg.branch}" data-ai-labels="${JSON.stringify(AI_LABEL)}">
${join(records.map(card), "\n")}
</ul>
<p id="empty" class="empty" hidden>Nothing matches. Try fewer filters, or <a href="${submitUrl}">add the script you were looking for</a>.</p>
`,
    }),
  );
}
