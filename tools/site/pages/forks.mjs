// forks/: forks people keep working on, grouped by script, most recently pushed first (data from enrich.mjs).
import { githubSlug } from "../../lib.mjs";
import { html, join } from "../html.mjs";
import { href, FORK_MIN_AHEAD } from "../context.mjs";
import { layout } from "../layout.mjs";
import { forkList } from "../components.mjs";

const group = (r) => {
  const gh = `https://github.com/${githubSlug(r.repo)}`;
  return html`<section class="fork-group" id="${r.slug}">
  <h2><a href="${href(r.path)}">${r.name}</a> <span class="fresh-by">by ${r.author}</span></h2>
  <p class="hint">upstream last push ${r.updated || "unknown"} · <a href="${gh}/network">network graph</a> · <a href="${gh}/forks?sort_by=last_updated">all ${r.forks} forks</a></p>
  ${forkList(r)}
</section>`;
};

export default function forks(records, write) {
  const forked = records
    .filter((r) => r.activeForks.length)
    .sort((a, b) => b.activeForks[0].pushed.localeCompare(a.activeForks[0].pushed) || a.name.localeCompare(b.name));
  write(
    "forks/index.html",
    layout({
      title: "active forks",
      description: "Forks of catalog scripts that people keep working on.",
      canonical: "forks/",
      body: html`
<section class="hero">
  <h1>active forks</h1>
  <p>Forks of catalog scripts with work of their own: at least ${FORK_MIN_AHEAD} commits ahead of upstream on their main branch, pushed in the last year. <strong>newer</strong> marks forks pushed after the original. Forks aren't reviewed for the catalog; read the diff before installing one (<code>;install</code> works with a fork's URL too). Counts refresh weekly.</p>
</section>
${
  forked.length
    ? html`<div class="fork-groups">${join(forked.map(group), "\n")}</div>`
    : html`<p class="empty">No fork data yet (it comes from GitHub during the deploy).</p>`
}
`,
    }),
  );
}
