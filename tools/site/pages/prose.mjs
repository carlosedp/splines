// Pages written in Markdown under src/ (about, getting started), plus the 404 page.
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "../../lib.mjs";
import { html, raw } from "../html.mjs";
import { cfg, base, href, siteUrl } from "../context.mjs";
import { markdown } from "../markdown.mjs";
import { layout } from "../layout.mjs";

const pageMd = (file) =>
  fs
    .readFileSync(path.join(ROOT, "src", file), "utf8")
    .replaceAll("{{title}}", cfg.title)
    .replaceAll("{{base}}", base)
    .replaceAll("{{catalog}}", `${siteUrl}/catalog.json`)
    .replaceAll("{{repo}}", cfg.repo)
    .replaceAll("{{branch}}", cfg.branch)
    .replaceAll("{{forum}}", cfg.forum || `https://github.com/${cfg.repo}/discussions`);

const prose = (file) => html`<article class="prose about">${raw(markdown(pageMd(file)))}</article>`;

export default function prosePages(records, write) {
  write("about/index.html", layout({ title: "about & submit", canonical: "about/", body: prose("about.md") }));
  write(
    "start/index.html",
    layout({
      title: "getting started",
      description: `How to install your first monome norns script from ${cfg.title} with maiden, and how to pick reliable ones.`,
      canonical: "start/",
      body: prose("start.md"),
    }),
  );
  write(
    "404.html",
    layout({
      title: "not found",
      body: html`<section class="hero"><h1>not found</h1><p>That page isn't here. <a href="${href("")}">Back to all scripts</a>.</p></section>`,
    }),
  );
}
