# splines — monome script catalog

A community catalog of scripts for monome norns, grid, iii, crow and teletype, published as a static site on GitHub Pages. Handmade and AI-assisted scripts are both welcome, and every entry discloses which it is.

- **One folder per script**: `scripts/<name>/index.md` with YAML front matter and free-form notes. A `platform` field says where it runs.
- **Submissions by issue form or pull request**: the submit and claim forms are turned into PRs by a workflow; CI validates the entry and checks the repo.
- **Search and filters run in the browser**: text, tags, hardware, AI disclosure and sort, with shareable URLs (`?tag=grid&req=crow`).
- **Maiden-compatible catalog**: `catalog.json` uses the same shape as monome's `community.json`.
- **Importer**: proposes new scripts weekly from the official community catalog, awesome lists, GitHub topics and a GitHub keyword search (recent Lua repos mentioning norns).
- **Health check**: weekly, opens a PR that follows moved repos and marks deleted or archived ones with a ⚠️ on the site.
- **Optional discussions per script** with [giscus](https://giscus.app), backed by GitHub Discussions, so there's no database.

No framework: one Node build script and two dependencies (`yaml`, `marked`).

## Quick start

```sh
npm install
npm run import -- --only community --limit 24   # seed some entries (optional)
npm run validate        # check all entries
npm run build           # → dist/
npm run serve           # → http://localhost:8080/ (plus basePath, if set)
npm run new -- my-script   # scaffold scripts/my-script/index.md (--platform iii|crow|teletype)
```

## Layout

```
scripts/<name>/index.md   one entry per script, any platform (+ optional screenshots)
templates/entry.md        entry template
src/assets/               style.css, app.js (filtering), favicon
src/about.md              about / submit / maiden page
tools/
  lib.mjs                 config, platforms, entry loading, validation rules
  validate.mjs            schema + duplicates; --online checks repos exist and have a root .lua
  enrich.mjs              stars / last push / license / cover / README → .cache/
  import.mjs              pull new entries from external sources
  from-issue.mjs          submit/claim issue form → entry (used by issue-entry.yml)
  health.mjs              follow moved repos, flag deleted/archived ones
  build.mjs               HTML pages, catalog.json, index.json, sitemap
  serve.mjs               local preview server
site.config.json          title, URLs, giscus, import sources
```

## Entry format

```yaml
---
name: my-script            # = folder name = repo name, exact case (install folder on norns); unique ignoring case
platform: norns            # norns | iii | crow | teletype (default norns; only norns goes into catalog.json)
kind: mod                  # optional: script (default) | mod (norns only; repo has lib/mod.lua) | library (code for other scripts; not in catalog.json)
repo: https://github.com/you/my-script
author: you
description: one line, ≤160 chars
tags: [sequencer, generative]
requires: [grid, midi]     # optional hardware filter
ai: assisted               # none | assisted   (unknown = imported only)
license: MIT               # optional, otherwise read from GitHub
discussion: https://...    # optional
docs: https://...          # optional
cover: https://...         # optional screenshot
---
Optional short "catalog notes", shown above the repo's README on the script page.
```

## Deploying

1. Push to GitHub and enable **Settings → Pages → Source: GitHub Actions**.
2. Set `siteUrl` and `basePath` in `site.config.json`. For a custom domain, set `cname`, use `siteUrl: https://your.domain` and `basePath: ""`.
3. `deploy.yml` builds on every push to `main` and daily, to refresh stars and last-push dates.
4. `import.yml` runs weekly (or manually) and opens a PR with newly found scripts. `health.yml` runs weekly too: a PR that follows moved repos and sets `status: gone` / `status: archived` on entries whose repo was deleted or archived (shown as ⚠️, with a tooltip). Removing an entry is decided in review.
5. `issue-entry.yml` turns `[submit]` and `[claim]` issues (forms in `.github/ISSUE_TEMPLATE`) into PRs and comments back on the issue. PRs opened by Actions don't trigger `validate.yml`, so that workflow validates the entry itself.
6. `claude.yml` (optional) lets maintainers write `@claude add https://github.com/owner/repo to the catalog` in an issue or comment; Claude Code follows `.claude/skills/add-script/SKILL.md` and opens a PR, and `@claude` comments on that PR revise it. Setup: install the [Claude GitHub app](https://github.com/apps/claude) on the repo, run `claude setup-token` and save the token as the `CLAUDE_CODE_OAUTH_TOKEN` secret. Only users with write access can trigger it. The same skill works in a local session or on claude.ai/code ("add <url> to the catalog").
7. Allow Actions to create PRs: **Settings → Actions → General → Workflow permissions → Allow GitHub Actions to create and approve pull requests**.

### Discussions (optional)

1. Enable Discussions on the repo and create a category, e.g. "Scripts" (Announcement type keeps new threads tidy).
2. Install the [giscus app](https://github.com/apps/giscus) on the repo.
3. Get `repoId` and `categoryId` from giscus.app and fill in `giscus` in `site.config.json`.

Threads are created on first comment and mapped to each page's path.

## TODO / to verify

- [ ] **Maiden catalog source config**: confirm where maiden reads extra catalog URLs on the device (its config file) and document the exact steps in `src/about.md`.
- [x] **awesome lists**: p3r7/awesome-monome-norns is imported (frozen since 2021, so it rarely adds anything new).
- [x] Name and domain: splines, at splines.cc.
- [x] Mods get `kind: mod` (same platform, own filter and badge), libraries get `kind: library` (no layout check, not in `catalog.json`).
