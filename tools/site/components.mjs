// Pieces several pages share: cards, badges, fork lists, the "what's new" panels, filter chips.
import { githubSlug, PLATFORMS, KINDS, STATUSES, LISTINGS } from "../lib.mjs";
import { html } from "./html.mjs";
import { cfg, href, siteUrl, cache, buildDate, NEW_DAYS, FORK_MIN_AHEAD, AI_LABEL } from "./context.mjs";

export const aiBadge = (ai) => html`<span class="badge ai ai-${ai}" title="${AI_LABEL[ai][1]}">${AI_LABEL[ai][0]}</span>`;

export const statusIcon = (r) =>
  r.status && html` <span class="status-warn" title="${STATUSES[r.status]}" aria-label="${STATUSES[r.status]}" role="img">⚠️</span>`;

// only seen in a `build --all` preview: the deployed site has published entries only
export const listingBadge = (r) =>
  r.listing !== "published" && html` <span class="badge listing" title="${LISTINGS[r.listing]}">${r.listing}</span>`;

export const tagLink =(t) => html`<a class="tag" href="${href(`?tag=${encodeURIComponent(t)}`)}">${t}</a>`;

export const reqBadge = (q) => html`<span class="badge req">${q}</span>`;

const isNew = (r) => !!r.added && Date.parse(buildDate) - Date.parse(r.added) < NEW_DAYS * 864e5;
export const newBadge = (r) => isNew(r) && html` <span class="badge new" title="Added ${r.added}">new</span>`;

export const likesStat = (r) =>
  r.likes > 0 &&
  html`<span class="stat likes" title="Likes on ${cfg.title}: likes on the script's forum thread">♥ ${r.likes}</span>`;

const forksStat = (r) =>
  r.activeForks.length > 0 &&
  html`<span class="stat forks" title="Active forks: ${FORK_MIN_AHEAD}+ commits of their own, pushed in the last year">⑂ ${r.activeForks.length}</span>`;

/** GitHub's diff between the script's repo and one of its forks. */
export function forkDiffUrl(r, f) {
  const up = githubSlug(r.repo);
  const [owner, name] = f.slug.split("/");
  return `https://github.com/${up}/compare/${encodeURIComponent(cache[up]?.defaultBranch || "HEAD")}...${owner}:${name}:${encodeURIComponent(f.branch)}`;
}

/** A fork list (each fork links to its page) with ahead/behind counts linking to the diff. `except` = a fork slug to leave out. */
export function forkList(r, except) {
  return html`<ul class="fork-list">${r.activeForks.filter((f) => f.slug !== except).map((f) => {
    return html`<li><a href="${href(f.path)}" title="About this fork">${f.slug}</a>
  <span class="fork-stats"><a href="${forkDiffUrl(r, f)}" title="Commits ahead of / behind upstream: see the diff">+${f.ahead} −${f.behind}</a>${f.stars > 0 && html` <span title="GitHub stars">★ ${f.stars}</span>`} <time datetime="${f.pushed}" title="Last push">${f.pushed}</time>${f.newer && html` <span class="badge new" title="Pushed more recently than upstream">newer</span>`}</span></li>`;
  })}</ul>`;
}

export function card(r) {
  const search = [r.name, r.author, r.description, ...r.tags, ...r.requires].join(" ").toLowerCase();
  // src/assets/admin.js builds the same markup for unpublished entries: keep the two in step
  return html`<li class="card" data-listing="${r.listing}" data-platform="${r.platform}" data-kind="${r.kind}" data-ai="${r.ai}" data-tags="${r.tags.join(" ")}" data-requires="${r.requires.join(" ")}" data-name="${r.name}" data-stars="${r.stars ?? 0}" data-likes="${r.likes}" data-forks="${r.activeForks.length}" data-updated="${r.updated}" data-added="${r.added}" data-search="${search}">
  <a class="card-link" href="${href(r.path)}">
    <span class="card-title">${r.name}${statusIcon(r)}${newBadge(r)}${listingBadge(r)}</span>
    <span class="card-author">by ${r.author}</span>
  </a>
  <p class="card-desc">${r.description}</p>
  <div class="card-meta">
    ${aiBadge(r.ai)}${r.platform !== "norns" && html`<span class="badge kind">${PLATFORMS[r.platform].label}</span>`}${r.kind !== "script" && html`<span class="badge kind">${KINDS[r.kind].label}</span>`}
    ${r.requires.map(reqBadge)}
    ${likesStat(r)}
    ${r.stars != null && html`<span class="stat" title="GitHub stars">★ ${r.stars}</span>`}
    ${forksStat(r)}
    ${r.updated && html`<span class="stat" title="Last push">${r.updated}</span>`}
  </div>
  <div class="card-tags">${r.tags.filter((t) => !r.requires.includes(t)).map(tagLink)}</div>
</li>`;
}

export function freshPanel(title, page, feed, items, date) {
  if (!items.length) return "";
  return html`<div class="fresh-panel">
    <h2><a href="${href(page)}">${title}</a>${siteUrl && html` <a class="feed" href="${href(feed)}" title="Atom feed">feed</a>`}</h2>
    <ol>${items.map((r) => html`<li><a href="${href(r.path)}">${r.name}</a> <span class="fresh-by">by ${r.author}</span> <time datetime="${date(r)}">${date(r)}</time></li>`)}</ol>
    <a class="fresh-more" href="${href(page)}">see all →</a>
  </div>`;
}

/** A group of filter chips with counts; app.js wires them up by `data-group`. */
export function chipGroup(name, label, counts, { min = 1, text = (v) => v } = {}) {
  const items = [...counts].filter(([, n]) => n >= min).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  if (!items.length) return "";
  return html`<fieldset class="chips" data-group="${name}">
  <legend>${label}</legend>
  ${items.map(([v, n]) => html`<button type="button" class="chip" data-value="${v}" aria-pressed="false">${text(v)} <span class="count">${n}</span></button>`)}
</fieldset>`;
}
