// scripts/<slug>/: one page per script, with install instructions, catalog notes and the upstream README.
import fs from "node:fs";
import path from "node:path";
import { ENTRIES_DIR, PLATFORMS, KINDS, STATUSES, githubSlug } from "../../lib.mjs";
import { html, raw, join } from "../html.mjs";
import { cfg, href, siteUrl, commentsReady, AI_LABEL } from "../context.mjs";
import { markdown } from "../markdown.mjs";
import { layout } from "../layout.mjs";
import { aiBadge, statusIcon, newBadge, listingBadge, tagLink, reqBadge, likesStat, forkList } from "../components.mjs";

function install(r) {
  if (r.kind === "library")
    return html`<section class="install"><h2>use</h2><p>This is a <strong>library</strong> for script authors, not something to run on its own. Copy it into your script as <a href="${r.repo}">its README</a> explains.</p></section>`;
  if (r.platform !== "norns")
    return html`<section class="install"><h2>install</h2><p>Get the script from <a href="${r.repo}">its repository</a> and follow its README.</p></section>`;
  return html`<section class="install">
  <h2>install</h2>
  <p>In maiden's REPL (the <code>&gt;&gt;</code> prompt at the bottom of the editor), run:</p>
  <div class="copy-row"><code class="cmd">;install ${r.install || r.repo}</code><button type="button" class="copy" data-copy=";install ${r.install || r.repo}">copy</button></div>
  <p class="hint">First time? <a href="${href("start/")}">Getting started</a> walks through maiden and loading a script.</p>
  ${!r.install && html`<p class="hint">Or add the <a href="${href("about/#installing-with-maiden")}">${cfg.title} catalog</a> to maiden and install it from the project manager. Restart norns if the script ships a new engine.</p>`}
  ${r.kind === "mod" && html`<p class="hint">This is a <strong>mod</strong>: after installing, enable it in SYSTEM &gt; MODS (select it with E2, turn E3 until it shows a +), then restart norns. <a href="https://monome.org/docs/norns/mods/">About mods</a>.</p>`}
</section>`;
}

// app.js loads Discourse's embed.js when this scrolls near the viewport, so the forum topic is only created
// when someone actually reaches the comments.
const discussion = (r) =>
  commentsReady &&
  html`<section class="discussion" id="discussion"><h2>discussion</h2>
<p class="hint">Talk about this script on the <a href="${cfg.discourse.url}">${cfg.title} forum</a>. Like the thread's first post to give it a ♥ here (counts update daily).</p>
<div id="discourse-comments" data-forum="${cfg.discourse.url.replace(/\/*$/, "/")}" data-embed-url="${siteUrl}/${r.path}"></div>
</section>`;

function sidebar(r, ghSlug) {
  const editUrl = `https://github.com/${cfg.repo}/edit/${cfg.branch}/${ENTRIES_DIR}/${r.slug}/index.md`;
  const claimUrl = `https://github.com/${cfg.repo}/issues/new?template=claim.yml&title=${encodeURIComponent(`[claim] ${r.slug}`)}&script=${encodeURIComponent(r.slug)}`;
  const optoutUrl = `https://github.com/${cfg.repo}/issues/new?template=optout.yml&title=${encodeURIComponent(`[optout] ${r.slug}`)}&script=${encodeURIComponent(r.slug)}`;
  // a "listed on" badge for the script's README: links back here and tells readers where to find more
  const badgeMd = `[![listed on ${cfg.title}](${siteUrl}/assets/badge.svg)](${siteUrl}/${r.path})`;
  const meta = [
    ["author", r.author],
    ["repository", html`<a href="${r.repo}">${ghSlug || r.repo}</a>`],
    r.license && ["license", r.license],
    r.stars != null && ["stars", `★ ${r.stars}`],
    r.forks > 0 && [
      "forks",
      html`<a href="https://github.com/${ghSlug}/forks?sort_by=last_updated">${r.forks}</a>${r.activeForks.length > 0 && html` (<a href="${href(`forks/#${encodeURIComponent(r.slug)}`)}">${r.activeForks.length} active</a>)`} · <a href="https://github.com/${ghSlug}/network">network</a>`,
    ],
    r.updated && ["last push", r.updated],
    r.docs && ["docs", html`<a href="${r.docs}">documentation</a>`],
    r.discussion && ["thread", html`<a href="${r.discussion}">external discussion</a>`],
    r.requires.length > 0 && ["requires", join(r.requires.map(reqBadge), " ")],
    ["source", r.source === "imported" ? html`imported${r.origin && html` from <code>${r.origin}</code>`}` : "submitted by the author"],
  ].filter(Boolean);

  return html`<aside class="entry-side">
      <dl>${meta.map(([k, v]) => html`<dt>${k}</dt><dd>${v}</dd>`)}</dl>
      <div class="card-tags">${r.tags.map(tagLink)}</div>
      ${r.activeForks.length > 0 && html`<section class="forks"><h2>active forks</h2>${forkList(r)}</section>`}
      ${r.source === "imported" && html`<p class="claim">Is this your script? <a href="${claimUrl}">Claim it</a> to disclose AI use and fix its details, or <a href="${optoutUrl}">take it off the site</a>. It's a short form, no git needed.</p>`}
      <p class="edit"><a href="${editUrl}">suggest an edit</a></p>
      ${siteUrl && html`<details class="badge-snippet"><summary>README badge</summary><p class="hint">Add this to your README:</p><div class="copy-row"><code class="cmd">${badgeMd}</code><button type="button" class="copy" data-copy="${badgeMd}">copy</button></div></details>`}
    </aside>`;
}

export default function entries(records, write) {
  for (const r of records) {
    const ghSlug = githubSlug(r.repo);
    write(
      `${r.path}index.html`,
      layout({
        title: r.name,
        description: r.description,
        canonical: r.path,
        body: html`
<article class="entry">
  <p class="crumbs"><a class="back" href="${href("")}" data-back>← all scripts</a> <span class="crumb-sep">/</span> ${PLATFORMS[r.platform].label}${r.kind !== "script" && html` <span class="crumb-sep">/</span> <a href="${href(`?kind=${encodeURIComponent(r.kind)}`)}">${KINDS[r.kind].plural}</a>`}</p>
  <header class="entry-head">
    <h1>${r.name}${statusIcon(r)}${newBadge(r)}${listingBadge(r)}</h1>
    <p class="lede">${r.description}</p>
    <div class="card-meta">${aiBadge(r.ai)} <span class="ai-note">${AI_LABEL[r.ai][1]}</span>${commentsReady ? html` <a class="like-link" href="#discussion" title="Like it in its forum thread">♥ ${r.likes || ""} like</a>` : likesStat(r)}</div>
    ${r.status && html`<p class="warn">⚠️ ${STATUSES[r.status]}.</p>`}
  </header>
  ${r.cover && html`<img class="cover" src="${r.cover}" alt="${r.name} screenshot" loading="lazy">`}
  <div class="entry-grid">
    <div class="entry-main">
      ${install(r)}
      ${r.body.trim() && html`<section class="notes"><h2>catalog notes</h2><div class="prose">${raw(markdown(r.body))}</div></section>`}
      ${
        r.readme
          ? html`<section class="readme"><h2>readme <span class="readme-src">from <a href="${r.repo}">${ghSlug || r.repo}</a></span></h2><div class="prose">${raw(r.readme)}</div></section>`
          : html`<section class="readme"><h2>readme</h2><p class="hint">Documentation lives in <a href="${r.repo}">the repository</a>.</p></section>`
      }
      ${discussion(r)}
    </div>
    ${sidebar(r, ghSlug)}
  </div>
</article>`,
      }),
    );

    // copy images that live next to the entry (screenshots referenced from the notes)
    for (const f of fs.readdirSync(r.dir)) {
      if (/\.(png|gif|jpe?g|webp)$/i.test(f)) write(path.join(r.path, f), fs.readFileSync(path.join(r.dir, f)));
    }
  }
}
