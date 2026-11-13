// Pages written in Markdown under src/ (about), the old /start/ address, and the 404 page.
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "../../lib.mjs";
import { html, raw } from "../html.mjs";
import { href, siteUrl, fillPlaceholders } from "../context.mjs";
import { markdown } from "../markdown.mjs";
import { layout } from "../layout.mjs";

// getting started is a guide now; /start/ stays as a redirect so old links (and bookmarks) keep working
export const START_GUIDE = "guides/getting-started/";

const prose = (file) =>
  html`<article class="prose about">${raw(markdown(fillPlaceholders(fs.readFileSync(path.join(ROOT, "src", file), "utf8"))))}</article>`;

const redirect = (to) => html`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>getting started</title>
<meta name="robots" content="noindex">
<meta http-equiv="refresh" content="0; url=${href(to)}">
${siteUrl && html`<link rel="canonical" href="${siteUrl}/${to}">`}
</head>
<body><p>This page moved to <a href="${href(to)}">${href(to)}</a>.</p></body>
</html>
`;

export default function prosePages(records, write) {
  write("about/index.html", layout({ title: "about & submit", canonical: "about/", body: prose("about.md") }));
  write("start/index.html", redirect(START_GUIDE));
  write(
    "404.html",
    layout({
      title: "not found",
      body: html`<section class="hero"><h1>not found</h1><p>That page isn't here. <a href="${href("")}">Back to all scripts</a>.</p></section>`,
    }),
  );
}
