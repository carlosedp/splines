// The page shell: head, header nav, footer. `body` must be safe HTML (an `html` template).
import { html } from "./html.mjs";
import { cfg, href, siteUrl, submitUrl } from "./context.mjs";

// header sections: the catalog views side by side, then the guides. [key, path, label]
const nav = [
  ["start", "guides/getting-started/", "getting started"],
  ["scripts", "", "scripts"],
  ["new", "new/", "new"],
  ["updated", "updated/", "updated"],
  ["forks", "forks/", "forks"],
  ["mods", "?kind=mod", "mods"],
  ["guides", "guides/", "guides"],
  ["about", "about/", "about"],
];

/** The header section a page belongs to, from its canonical path (`section` overrides it, e.g. a mod's page). */
function sectionOf(canonical) {
  if (canonical == null) return null;
  if (/(^|\/)forks\//.test(canonical)) return "forks"; // forks/ and each fork's page
  if (canonical === "" || canonical.startsWith("scripts/")) return "scripts";
  if (canonical === "guides/getting-started/") return "start"; // a guide, but it has its own header link
  if (canonical.startsWith("guides/")) return "guides";
  return nav.find(([, p]) => p && p === canonical)?.[0] ?? null;
}

/**
 * `section`: which header link is marked current (defaults to the one matching `canonical`). On the home page
 * app.js moves the mark between "scripts" and "mods" as the type filter changes.
 */
export function layout({
  title,
  description,
  body,
  canonical,
  section,
  noindex = false,
}) {
  const current = section ?? sectionOf(canonical);
  const fullTitle = title
    ? `${title} · ${cfg.title}`
    : `${cfg.title} · ${cfg.tagline}`;
  return html`<!doctype html>
    <html lang="en">
      <head>
        <!-- Google tag (gtag.js) -->
        <script
          async
          src="https://www.googletagmanager.com/gtag/js?id=G-W2K0HFNKCE"
        ></script>
        <script>
          window.dataLayer = window.dataLayer || [];
          function gtag() {
            dataLayer.push(arguments);
          }
          gtag("js", new Date());

          gtag("config", "G-W2K0HFNKCE");
        </script>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${fullTitle}</title>
        <meta name="description" content="${description || cfg.description}" />
        ${noindex && html`<meta name="robots" content="noindex" />`}
        ${canonical != null &&
        siteUrl &&
        html`<link rel="canonical" href="${siteUrl + "/" + canonical}" />`}
        <meta property="og:title" content="${fullTitle}" />
        <meta
          property="og:description"
          content="${description || cfg.description}"
        />
        <link
          rel="icon"
          href="${href("assets/favicon.svg")}"
          type="image/svg+xml"
        />
        <link rel="stylesheet" href="${href("assets/style.css")}" />
        ${siteUrl &&
        html`<link
            rel="alternate"
            type="application/atom+xml"
            title="${cfg.title}: new scripts"
            href="${href("feed-new.xml")}"
          />
          <link
            rel="alternate"
            type="application/atom+xml"
            title="${cfg.title}: recently updated"
            href="${href("feed-updated.xml")}"
          />`}
        <script>
          try {
            var t = localStorage.getItem("theme");
            if (t) document.documentElement.dataset.theme = t;
          } catch (e) {}
        </script>
      </head>
      <body>
        <header class="site-header">
          <a class="brand" href="${href("")}"
            ><img
              class="brand-mark"
              src="${href("assets/favicon.svg")}"
              alt=""
              width="28"
              height="28"
            />${cfg.title}</a
          >
          <nav>
            ${nav.map(
              ([key, path, label]) =>
                html`<a
                  href="${href(path)}"
                  data-nav="${key}"
                  ${current === key ? html` aria-current="page"` : ""}
                  >${label}</a
                >`,
            )}
            ${cfg.forum && html`<a href="${cfg.forum}">talk</a>`}
            <a class="nav-submit" href="${submitUrl}">+ submit</a>
            <a href="https://github.com/${cfg.repo}">github</a>
            <button
              class="theme-toggle"
              type="button"
              aria-label="Toggle dark mode"
              title="Toggle theme"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                aria-hidden="true"
              >
                <circle
                  cx="8"
                  cy="8"
                  r="6.5"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                />
                <path d="M8 1.5a6.5 6.5 0 0 1 0 13z" fill="currentColor" />
              </svg>
            </button>
          </nav>
        </header>
        <main>${body}</main>
        <footer class="site-footer">
          <p>
            Unofficial and community-run. Not affiliated with or endorsed by
            monome. Scripts belong to their authors; check each repo's license.
          </p>
          <p>
            <a href="${href("catalog.json")}">maiden catalog</a> ·
            <a href="${href("index.json")}">index.json</a> ·
            <a href="${submitUrl}">submit a script</a>${cfg.forum &&
            html` · <a href="${cfg.forum}">forum</a>`}
            ·
            <a
              href="https://github.com/${cfg.repo}/blob/${cfg.branch}/CONTRIBUTING.md"
              >contribute</a
            >
          </p>
        </footer>
        <script src="${href("assets/app.js")}" defer></script>
      </body>
    </html> `;
}
