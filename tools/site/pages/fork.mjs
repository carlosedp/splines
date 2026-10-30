// scripts/<slug>/forks/<owner>/<repo>/: a page per active fork, so forks that took a script somewhere new can be
// found without becoming catalog entries. Not in catalog.json, index.json entries or the sitemap.
import { KINDS } from "../../lib.mjs";
import { html, raw } from "../html.mjs";
import { cfg, href } from "../context.mjs";
import { renderReadme } from "../markdown.mjs";
import { layout } from "../layout.mjs";
import { forkDiffUrl, forkList } from "../components.mjs";

function install(r, f) {
  const url = `https://github.com/${f.slug}`;
  const name = f.slug.split("/")[1];
  if (r.kind === "library")
    return html`<section class="install"><h2>use</h2><p>Like the original, this is a <strong>library</strong> for script authors. Copy it into your script as <a href="${url}">its README</a> explains.</p></section>`;
  if (r.platform !== "norns" || r.install)
    return html`<section class="install"><h2>install</h2><p>Get it from <a href="${url}">the fork's repository</a> and follow its README.${r.install ? " The original installs from a release build, so this fork may need building first." : ""}</p></section>`;
  // maiden installs into dust/code/<repo name>; a fork that kept the name collides with the original
  const sameFolder = name.toLowerCase() === r.name.toLowerCase();
  return html`<section class="install">
  <h2>install</h2>
  <p>In maiden's REPL (the <code>&gt;&gt;</code> prompt at the bottom of the editor), run:</p>
  <div class="copy-row"><code class="cmd">;install ${url}</code><button type="button" class="copy" data-copy=";install ${url}">copy</button></div>
  ${sameFolder && html`<p class="hint">It installs into <code>code/${name}</code>, the same folder as the original. If you have ${r.name} installed, remove it in maiden first (you can reinstall it from <a href="${href(r.path)}">its page</a> later).</p>`}
  ${r.kind === "mod" && html`<p class="hint">This is a <strong>mod</strong>: after installing, enable it in SYSTEM &gt; MODS, then restart norns.</p>`}
</section>`;
}

function changes(r, f) {
  const diff = forkDiffUrl(r, f);
  return html`<section class="changes">
  <h2>what's different</h2>
  <p>${f.ahead} commit${f.ahead === 1 ? "" : "s"} of its own, ${f.behind} behind <a href="${href(r.path)}">${r.name}</a>.${f.commits.length > 0 && " Latest:"}</p>
  ${f.commits.length > 0 && html`<ul class="commit-list">${f.commits.map((c) => html`<li><a href="https://github.com/${f.slug}/commit/${c.sha}"><code>${c.sha.slice(0, 7)}</code></a> <span class="commit-msg">${c.message}</span> <time datetime="${c.date}">${c.date}</time></li>`)}</ul>`}
  <p><a href="${diff}">full diff on GitHub →</a></p>
</section>`;
}

export default function forkPages(records, write) {
  for (const r of records) {
    for (const f of r.activeForks) {
      const readme = renderReadme(f.slug, { readmePath: f.readmePath, defaultBranch: f.branch });
      const meta = [
        ["fork of", html`<a href="${href(r.path)}">${r.name}</a> by ${r.author}`],
        ["repository", html`<a href="https://github.com/${f.slug}">${f.slug}</a>`],
        ["ahead", html`<a href="${forkDiffUrl(r, f)}">+${f.ahead} −${f.behind}</a>`],
        f.license && ["license", f.license],
        f.stars > 0 && ["stars", `★ ${f.stars}`],
        ["last push", f.pushed],
        ["original push", r.updated || "unknown"],
      ].filter(Boolean);
      write(
        `${f.path}index.html`,
        layout({
          title: `${f.slug} (fork of ${r.name})`,
          description: f.description || `A fork of ${r.name}, a monome script.`,
          canonical: f.path,
          body: html`
<article class="entry fork-page">
  <p class="crumbs"><a class="back" href="${href("")}" data-back>← all scripts</a> <span class="crumb-sep">/</span> <a href="${href(r.path)}">${r.name}</a> <span class="crumb-sep">/</span> <a href="${href(`forks/#${encodeURIComponent(r.slug)}`)}">forks</a></p>
  <header class="entry-head">
    <h1>${f.slug}${f.newer && html` <span class="badge new" title="Pushed more recently than the original">newer</span>`}</h1>
    <p class="lede">${f.description || r.description}</p>
    <div class="card-meta"><span class="badge kind">fork</span>${r.kind !== "script" && html`<span class="badge kind">${KINDS[r.kind].label}</span>`} <span class="ai-note">A fork of <a href="${href(r.path)}">${r.name}</a> by ${r.author}.</span></div>
    <p class="warn">Forks aren't reviewed or listed in the ${cfg.title} catalog, and their AI use isn't disclosed. Look at what changed before installing.</p>
  </header>
  <div class="entry-grid">
    <div class="entry-main">
      ${install(r, f)}
      ${changes(r, f)}
      ${
        readme
          ? html`<section class="readme"><h2>readme <span class="readme-src">from <a href="https://github.com/${f.slug}">${f.slug}</a></span></h2><div class="prose">${raw(readme)}</div></section>`
          : html`<section class="readme"><h2>readme</h2><p class="hint">See <a href="https://github.com/${f.slug}">the fork's repository</a>.</p></section>`
      }
    </div>
    <aside class="entry-side">
      <dl>${meta.map(([k, v]) => html`<dt>${k}</dt><dd>${v}</dd>`)}</dl>
      ${r.activeForks.length > 1 && html`<section class="forks"><h2>other active forks</h2>${forkList(r, f.slug)}</section>`}
    </aside>
  </div>
</article>`,
        }),
      );
    }
  }
}
