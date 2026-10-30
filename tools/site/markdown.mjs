// Markdown for entry notes, the about/start pages and upstream READMEs. Raw HTML never passes through and
// links can't use javascript: or other non-web schemes. Returns plain strings; wrap them in raw() in templates.
import fs from "node:fs";
import path from "node:path";
import { Marked } from "marked";
import { readmeFile } from "../lib.mjs";
import { esc, safeUrl } from "./html.mjs";

// While an upstream README renders, this holds { slug, branch, dir } so relative links and images point back
// at the repo, the way GitHub resolves them. null for entry notes.
let readmeCtx = null;

/** Rewrite a README URL: relative paths → github.com blob (links) or raw.githubusercontent.com (images). */
function fromRepo(u, raw) {
  if (!readmeCtx || !u || u.startsWith("#")) return u;
  const { slug, branch, dir } = readmeCtx;
  if (/^([a-z][a-z0-9+.-]*:|\/\/)/i.test(u)) {
    // images linked to a GitHub blob page don't render; use the raw file instead
    const blob = raw && u.match(/^https:\/\/github\.com\/([^/]+\/[^/]+)\/(?:blob|raw)\/(.+?)(\?.*)?$/);
    return blob ? `https://raw.githubusercontent.com/${blob[1]}/${blob[2]}` : u;
  }
  const [, p, rest = ""] = u.match(/^([^?#]*)(.*)$/);
  const file = path.posix
    .normalize(p.startsWith("/") ? p.slice(1) : path.posix.join(dir, p))
    .replace(/^(\.\.\/)+|^\.$/g, "");
  return raw
    ? `https://raw.githubusercontent.com/${slug}/${branch}/${file}`
    : `https://github.com/${slug}/blob/${branch}/${file}${rest}`;
}

const attr = (tag, name) => {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return m && (m[1] ?? m[2] ?? m[3]);
};
const imgTag = (src, alt, title, width) =>
  `<img src="${esc(safeUrl(src))}" alt="${esc(alt)}"${title ? ` title="${esc(title)}"` : ""}${width ? ` width="${width}"` : ""} loading="lazy">`;

// Raw HTML is never passed through. In READMEs, <img> tags are rebuilt from their src/alt/width, other tags are
// dropped and their text kept (escaped, entities like &nbsp; still work). In entry notes it shows as text,
// except <!-- comments -->, which are dropped everywhere (the entry template uses one for its hint).
function rawHtml(text) {
  text = text.replace(/<!--[\s\S]*?(-->|$)/g, "");
  if (!readmeCtx) return esc(text);
  return text
    .replace(/<(script|style)\b[\s\S]*?(<\/\1>|$)/gi, "")
    .split(/(<img\b[^>]*>)/i)
    .map((part, i) => {
      if (i % 2)
        return imgTag(
          fromRepo(attr(part, "src"), true),
          attr(part, "alt") || "",
          null,
          attr(part, "width")?.match(/^\d+$/)?.[0],
        );
      return esc(part.replace(/<\/?[a-z][^>]*>/gi, "")).replace(/&amp;(#?\w+);/g, "&$1;");
    })
    .join("");
}

const md = new Marked({ gfm: true });
md.use({
  renderer: {
    html: ({ text }) => rawHtml(text),
    heading({ tokens, depth, text }) {
      // the page already has an <h1>; README headings move down one level
      if (readmeCtx) depth = Math.min(depth + 1, 6);
      const id = text
        .toLowerCase()
        .replace(/<[^>]+>/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      return `<h${depth} id="${esc(id)}">${this.parser.parseInline(tokens)}</h${depth}>\n`;
    },
    link({ href: h, title, tokens }) {
      const t = title ? ` title="${esc(title)}"` : "";
      return `<a href="${esc(safeUrl(fromRepo(h, false)))}"${t} rel="nofollow ugc">${this.parser.parseInline(tokens)}</a>`;
    },
    // marked hands over alt text already escaped
    image: ({ href: h, title, text }) =>
      imgTag(
        fromRepo(h, true),
        text.replace(/&(amp|lt|gt|quot|#39);/g, (_, e) => ({ amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'" })[e]),
        title,
      ),
  },
});

/** Entry notes and site pages as sanitized HTML. */
export const markdown = (text) => md.parse(text);

/** The repo's README as sanitized HTML, from the enrich cache ('' when not cached). */
export function renderReadme(slug, info) {
  if (!slug || !info.readmePath || !fs.existsSync(readmeFile(slug))) return "";
  readmeCtx = { slug, branch: info.defaultBranch || "HEAD", dir: path.posix.dirname(info.readmePath) };
  try {
    return md.parse(fs.readFileSync(readmeFile(slug), "utf8"));
  } finally {
    readmeCtx = null;
  }
}
