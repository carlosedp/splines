# AGENTS.md

Guidance for AI coding agents (Claude Code, Copilot, etc.) working on this repo.

## What this is

A community catalog of monome scripts (norns, iii, crow, teletype; grid and arc as hardware), published as a **static site on GitHub Pages**. People add scripts with pull requests: one Markdown file per script with YAML front matter. The build produces:

- the website (prerendered HTML, client-side search and filters),
- `catalog.json`, a **maiden-compatible** script catalog (same shape as monome's `community.json`),
- `index.json`, the full catalog for other tools, and a `sitemap.xml`.

Working name: **splines** (placeholder; see `site.config.json`). Unofficial and not affiliated with monome. Keep that disclaimer in the footer.

AI-assisted scripts are welcome, but **AI disclosure is mandatory** (`ai:` field). That is a core product rule, not a detail.

**Only with the author's OK** is the other one: the site shows `listing: published` entries only (submitted, claimed, or listed on norns.community by the author). Everything else the importer finds is `indexed`: kept and tracked, never rendered, and its author can be invited to opt in. Never publish an entry on someone else's behalf.

## Commands

```sh
npm install
npm run validate            # schema + duplicate checks (offline)
npm run validate:online     # + checks repos exist and have a root .lua (uses GITHUB_TOKEN if set)
npm run enrich              # GitHub stars/last push/license/cover → .cache/github.json, READMEs → .cache/readme/ (--only a,b)
npm run import -- --only community --limit 24   # seed/import entries; --dry-run to preview
npm run build               # → dist/
npm run serve               # → http://localhost:8080/<basePath>/
npm run dev                 # build + serve --watch: rebuilds on changes (~1s) and live-reloads open pages
npm run dev:all             # same, with indexed/declined entries too (build --all; local preview only, never deploy)
npm run invite              # invites.md: indexed entries whose authors could be invited (sends nothing; --send/--sync need a token)
npm run new -- <name> [--platform crow]   # scaffold an entry from templates/entry.md
```

Node ≥ 20. There is no test suite yet. Verify changes by running `validate` and `build`, then opening the site with `serve`. For a realistic dataset, run the importer without `--limit` in a scratch copy (≈350 entries from norns.community; all should validate).

## Layout

```
scripts/<name>/index.md   one entry per script, ANY platform (+ optional images next to it). This is catalog data, not code.
templates/entry.md        entry template used by `npm run new`
templates/invite.md       the opt-in invitation issue (title + body, {{placeholders}}) used by invite.mjs
src/assets/               style.css, app.js (client filtering), favicon.svg
src/about.md              about/submit/maiden page ({{title}}, {{catalog}}, {{repo}} placeholders)
src/start.md              /start/ getting-started guide for newcomers (same placeholders, plus {{base}} for site links)
tools/lib.mjs             config, PLATFORMS, entry loading, front matter, VALIDATION RULES (single source of truth)
tools/validate.mjs        CLI validator (GitHub Actions annotations when GITHUB_ACTIONS is set)
tools/enrich.mjs          GitHub API metadata + README cache (20h TTL); likes/comments of each page's forum thread (Discourse embed; DISCOURSE_API_KEY maps new topics) → .cache/discussions.json; forks pushed to after forking, with commits ahead/behind upstream (weekly) → .cache/forks.json
tools/import.mjs          importers: maiden catalogs, awesome lists (incl. p3r7/awesome-monome-norns tables), GitHub topics + keyword search, lines (llllllll.co) threads per source with a `platform` (norns library, iii tag; rate-limited, recent only, `--days N` to backfill)
tools/from-issue.mjs      [submit]/[claim]/[optout] issue form → entry file + pr-body.md/comment.md (issue-entry.yml); field labels must match .github/ISSUE_TEMPLATE. A claim publishes (opt in), an optout sets `listing: declined`
tools/invite.mjs          opt-in invitations for indexed entries: invites.md review list (default), --send opens issues and records `invited`, --sync marks closed invitations declined (invite.yml, gated)
tools/health.mjs          follows moved repos (rewrites `repo`), sets/clears `status` for gone/archived → health.md (health.yml)
tools/build.mjs           build entry point: collects records, runs each page module, prunes dist/
tools/site/               html.mjs (`html` escaping tag, raw, join), context.mjs (config, caches, constants), records.mjs,
                          markdown.mjs (README/notes renderer), components.mjs (card, badges, fork list), layout.mjs,
                          output.mjs (write-if-changed + prune), pages/*.mjs (one module per page or output group;
                          admin.mjs is only the sign-in: once a collaborator's token is stored, app.js loads src/assets/admin.js on the
                          home page, which builds cards for unpublished entries from the GitHub API and shows the listing filter;
                          keep its card() in step with card() in components.mjs)
tools/serve.mjs           local static server honoring basePath
tools/new-entry.mjs       scaffolder behind `npm run new`
site.config.json          title, siteUrl, basePath, cname, repo, forum, discourse (embedded comments), import sources
.github/workflows/        validate.yml (PRs), deploy.yml (push/daily → Pages), import.yml (weekly → PR), health.yml (weekly → PR), issue-entry.yml (issue forms → PR), invite.yml (weekly, needs INVITES_ENABLED + approval in the `invites` environment → PR), claude.yml (`@claude` mentions by maintainers → Claude Code)
.claude/skills/add-script/ procedure for "add <repo url> to the catalog" (used locally, on claude.ai/code and by claude.yml)
```

## Data model (entry front matter)

| field | req | notes |
|---|---|---|
| `name` | ✓ | must equal the folder name; use the repo name with its **exact case** (for norns it's the install folder `dust/code/<name>`, and Linux paths are case-sensitive). Unique across the catalog ignoring case |
| `platform` | | where the code runs, from `PLATFORMS` in `lib.mjs`: `norns` (default) \| `iii` \| `crow` \| `teletype`. Grid/arc are hardware (`requires`), not platforms |
| `kind` | | what it is, from `KINDS` in `lib.mjs`: `script` (default) \| `mod` (norns only) \| `library`. A mod loads from `lib/mod.lua` and is enabled in SYSTEM > MODS; the importer and the submit form set it when a repo has `lib/mod.lua` and no root script. Repos with both stay `script` unless curated. Mods stay in `catalog.json`. A library is code script authors copy into their own `lib/` (nothing to run): no layout check, not in `catalog.json`, set by curation only |
| `repo` | ✓ | https URL; norns repos need the main `.lua` at the root (`luaRoot` in `PLATFORMS`) |
| `author` | ✓ | display name / handle |
| `description` | ✓ | one line, ≤160 chars |
| `tags` | ✓ | lowercase kebab-case list |
| `requires` | | hardware from `KNOWN_REQUIRES` in `lib.mjs` (grid, arc, crow, midi, …) |
| `ai` | ✓ | `none` \| `assisted`; `unknown` is allowed **only** with `source: imported` |
| `source` | | `submitted` (default) \| `imported` |
| `listing` | | `published` \| `indexed` (default) \| `declined` (`LISTINGS` in `lib.mjs`). Only `published` entries are built (`collectRecords()`); `build --all` previews the rest. The importer writes `published` for maiden community catalogs and `indexed` for every other source; claim/optout issues and the submit form set it |
| `invited` | | https URL of the opt-in invitation issue on the script's repo, written by `invite.mjs --send`; one invitation per repo, ever |
| `origin` | | where an import came from, e.g. `catalog:community`, `github-topic:norns`, `github-search`, `lines` |
| `added` | ✓* | `YYYY-MM-DD`, drives `/new/` and its feed. Required unless `source: imported`; the initial seed import has none so it doesn't flood "new". `npm run new` fills it in |
| `license`, `discussion`, `docs`, `cover` | | optional; URLs must be https |
| `install` | | optional https URL for `;install` when the repo isn't what gets installed (e.g. a release zip of a compiled mod). Skips the online layout check and keeps the entry out of `catalog.json` |
| `status` | | `archived` | `gone` (`STATUSES` in `lib.mjs`). Written and cleared by `health.mjs`, not by submitters; shown as ⚠️ with a tooltip on cards and the script page |

The entry body is optional **catalog notes**, rendered above the upstream README on the script page. PRs only need front matter; the README is the documentation. HTML comments in the body are not published (the template hint is one).

READMEs are rendered by `renderReadme()` in `tools/site/markdown.mjs`: raw HTML is never passed through (only `<img>` is rebuilt from src/alt/width), relative links/images are rewritten to the repo's blob/raw URLs (`fromRepo()`), and headings shift down one level.

The URL slug is the folder name: `/scripts/<name>/`, stable even if the platform changes. Duplicate names and duplicate repos (per platform) are rejected by `validate.mjs`. Adding a platform is one line in `PLATFORMS`.

When adding a field: update `validateEntry` in `lib.mjs`, `templates/entry.md`, the issue forms (`.github/ISSUE_TEMPLATE/*.yml` + `from-issue.mjs`), the table in `README.md`/`src/about.md`, the record built in `tools/site/records.mjs`, and, if relevant, `index.json`/`catalog.json`.

## Conventions and constraints

- **No framework, no client-side dependencies.** Plain Node ESM build, vanilla JS in the browser. Keep runtime deps minimal (currently `yaml`, `marked`). Discuss before adding any.
- **Cards are prerendered.** `app.js` only filters and sorts existing DOM nodes using `data-*` attributes on each `.card` (the one exception: `admin.js` adds cards for unpublished entries, for signed-in admins only). If you add a filter, add the `data-*` attribute in `card()` in `tools/site/components.mjs` and the group in `app.js` (`PARAM` = URL param name, `MODE` = `any`/`all`). Filter state lives in the URL query (shareable links).
- **Everything user-supplied is untrusted.** Write markup with the `html` tag (`tools/site/html.mjs`): it escapes every interpolated value, so only pass trusted HTML through `raw()` (sanitized markdown output). Use `cond && html`…`` for optional parts, but not with numbers (`0` renders as "0"; compare with `> 0`). Markdown goes through the custom `marked` renderer that escapes raw HTML and neutralizes non-http(s) links. Never use `innerHTML` with entry data in `app.js`.
- **`catalog.json` shape is a contract with maiden.** Keep `file_info`, `catalog_name`, `date`, `entries[]` with `project_name`, `project_url`, `author`, `description`, `discussion_url?`, `documentation_url?`, `tags`. Only `PLATFORMS[platform].maiden === true` entries (norns) go in it.
- **Paths:** always build site URLs with `href()` (prefixes `basePath`). `basePath` is `""` now that the site is on its custom domain (`splines.cc`); a project Pages site would use `/<repo>`.
- **Declined entries stay.** An author's no is `listing: declined`, not a deletion, so the importer (which dedupes against existing entries) and `invite.mjs` leave the script alone.
- **Importer never overwrites** existing entries and dedupes by normalized repo URL. Imported entries are reviewed via the PR that `import.yml` opens. Repos in `site.config.json → import.ignore` are never imported: when you remove a dead entry or merge a duplicate, add the old URL there, or the next import brings it back.
- **Active forks** (⑂ on cards, `/forks/`, script page aside): `enrich.mjs` stores every fork pushed to after it was created, with ahead/behind from the compare API; `tools/site/context.mjs` decides what counts as active (`FORK_MIN_AHEAD` commits on its default branch, pushed within `FORK_ACTIVE_DAYS`). Tune the thresholds there; no refetch needed. Forks are not catalog entries and are not reviewed.
- **The build updates `dist/` in place**: unchanged files aren't rewritten and files no build produced are pruned at the end. Always go through `write()` so a file isn't pruned.
- **Likes, not star ratings.** The site is static, so "rating" = likes on the first post of each script's thread on the Discourse forum (talk.splines.cc), counted by `enrich.mjs`. Script pages embed the thread; Discourse creates the topic the first time someone scrolls to the comments (`app.js` loads the embed lazily), keyed by the page URL and shown as ♥ on cards plus a "most liked" sort. ★ means GitHub stars; keep the two distinct.
- **The build must work offline.** GitHub metadata and READMEs come only from `.cache/` (written by `enrich.mjs`). Missing cache just means fewer stats on cards and no README on script pages.
- Styling: CSS custom properties on `:root`, with dark mode via `prefers-color-scheme` plus a `data-theme` override (toggle in header). Keep both themes working and the layout fine at 390px width.
- The author develops on **Windows**; keep scripts cross-platform (use `path`, normalize `\` to `/` for display paths, no shell-specific npm scripts).
- Commit style: short imperative subject, e.g. `build: add author pages`.

## Known gaps / TODO

- Confirm how maiden is configured with an extra catalog URL on the device, then document the exact steps in `src/about.md` (the `## installing with maiden` section).
- Some imported "norns" entries are really crow scripts, Max patches, editor plugins or libraries (e.g. `crow-scripts`, `trio_for_crow`, `m4l-monome-norns`, `norns.el`). Re-platform or remove them during curation.

## Roadmap (under discussion, not decided)

Proposals for the open ideas. Check with the maintainer before implementing any of these.

1. **Needs vs. "better with"**: split hardware into `requires` (won't work without) and `supports` (optional, "better with grid"). The hardware filter matches either; badges are styled differently.
2. ~~**Platforms**~~: done, see `platform` above.
3. **Screenshots from norns**: document capturing the screen from maiden's REPL (`_norns.screen_export_png("/home/we/dust/<name>.png")`, verify the API on current norns), then copying it via SMB/SFTP. The 128×64 image renders crisp thanks to `image-rendering: pixelated`.
4. ~~**Upstream README**~~: done, see the data model section.
5. ~~**Minimal PRs**~~: done; the body is optional catalog notes.
6. **Author filter/pages**: clickable author on cards (`?author=` filter) plus `/authors/<author>/` pages.
7. ~~**New & updated**~~: done. `/new/` + `feed-new.xml` (by `added`), `/updated/` + `feed-updated.xml` (by upstream push date), 50 items each.
8. ~~**Dynamic description**~~: done. Entries keep their curated line; the importer's placeholder (`PLACEHOLDER_DESCRIPTION` in `lib.mjs`) is replaced at build time by the GitHub repo description.
