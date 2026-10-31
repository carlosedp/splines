// The page shell: head, header nav, footer. `body` must be safe HTML (an `html` template).
import { html } from "./html.mjs";
import { cfg, href, siteUrl, submitUrl } from "./context.mjs";

export function layout({
  title,
  description,
  body,
  canonical,
  noindex = false,
}) {
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
            <a href="${href("")}">scripts</a>
            <a href="${href("start/")}">start here</a>
            <a href="${href("new/")}">new</a>
            <a href="${href("updated/")}">updated</a>
            <a href="${href("forks/")}">forks</a>
            <a href="${href("?kind=mod")}">mods</a>
            <a href="${href("about/")}">about</a>
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
