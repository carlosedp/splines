# splines — monome script catalog

A community catalog of scripts for monome norns, grid, iii, crow and teletype, published as a static site on GitHub Pages. Handmade and AI-assisted scripts are both welcome, and every entry discloses which it is.

- **One folder per script**: `scripts/<name>/index.md` with YAML front matter and free-form notes. A `platform` field says where it runs.
- **Only with the author's OK**: entries are `published` (submitted, claimed, or listed on norns.community by their author) or `indexed` (found by the importer, kept but not shown). Authors of indexed scripts can be invited to opt in with one issue on their repo (`npm run invite`); `/admin/` shows everything to maintainers.
- **Submissions by issue form or pull request**: the submit, claim (opt in) and opt-out forms are turned into PRs by a workflow; CI validates the entry and checks the repo.
- **Search and filters run in the browser**: text, tags, hardware, AI disclosure and sort, with shareable URLs (`?tag=grid&req=crow`).
- **Maiden-compatible catalog**: `catalog.json` uses the same shape as monome's `community.json`.
- **Importer**: proposes new scripts weekly from the official community catalog, awesome lists, GitHub topics and a GitHub keyword search (recent Lua repos mentioning norns).
- **Health check**: weekly, opens a PR that follows moved repos and marks deleted or archived ones with a ⚠️ on the site.
- **Discussion per script** embedded from the [Discourse forum](https://talk.splines.cc); likes on a thread show as ♥ on the catalog.

No framework: one Node build script and two dependencies (`yaml`, `marked`).

## Quick start

```sh
npm install
npm run import -- --only community --limit 24   # seed some entries (optional)
npm run validate        # check all entries
npm run build           # → dist/
npm run serve           # → http://localhost:8080/ (plus basePath, if set)
npm run dev:all         # local preview with indexed and declined entries too (never deploy it)
npm run invite          # review list of authors to invite → invites.md (sends nothing)
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
  from-issue.mjs          submit/claim/optout issue form → entry (used by issue-entry.yml)
  invite.mjs              invitations to opt in for indexed entries: review list, --send, --sync
  health.mjs              follow moved repos, flag deleted/archived ones
  build.mjs               HTML pages, catalog.json, index.json, sitemap (pages in tools/site/)
  serve.mjs               local preview server
site.config.json          title, URLs, forum/discourse, import sources
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
listing: published         # published (on the site) | indexed (default: kept, not shown) | declined (author said no)
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
5. `issue-entry.yml` turns `[submit]`, `[claim]` and `[optout]` issues (forms in `.github/ISSUE_TEMPLATE`) into PRs and comments back on the issue. PRs opened by Actions don't trigger `validate.yml`, so that workflow validates the entry itself.
6. `claude.yml` (optional) lets maintainers write `@claude add https://github.com/owner/repo to the catalog` in an issue or comment; Claude Code follows `.claude/skills/add-script/SKILL.md` and opens a PR, and `@claude` comments on that PR revise it. Setup: install the [Claude GitHub app](https://github.com/apps/claude) on the repo, run `claude setup-token` and save the token as the `CLAUDE_CODE_OAUTH_TOKEN` secret. Only users with write access can trigger it. The same skill works in a local session or on claude.ai/code ("add <url> to the catalog").
7. `invite.yml` (off until you enable it) asks the authors of indexed scripts to opt in, one issue per repo, text in `templates/invite.md`. It does nothing unless the repository variable `INVITES_ENABLED` is `true`. Its send job runs in the `invites` environment: give that environment required reviewers so each weekly run waits for your approval after posting who it would invite. It needs a personal access token that can open issues on public repos, saved as the `INVITE_TOKEN` secret. To invite by hand instead, run `npm run invite` and use the prefilled **open** links in `invites.md`.
8. Allow Actions to create PRs: **Settings → Actions → General → Workflow permissions → Allow GitHub Actions to create and approve pull requests**.

### Admin view

Sign in at `/admin/` with a GitHub token (a fine-grained token with public read access is enough). The page checks with GitHub that the user has write access to the repo. From then on, the catalog page in that browser also shows indexed and declined entries, with a dashed badge, their origin and invitation link, plus a **listing** filter (`?listing=indexed`). `admin.js` reads `scripts/*/index.md` from `main` through the GitHub API and builds those cards in the browser, so the deployed site itself never contains unpublished entries. Unpublished cards link to their repo, since they have no page.

- **Signing out:** use the "sign out" button next to your login in the catalog's status line, or on `/admin/`.
- **When the token expires or is revoked:** the next load gets a 401 from GitHub. The browser then forgets the token, the page shows "sign in again", and later pages are the public view. Results are cached for 10 minutes per tab, so an expired token can still show the cached view until then.
- **Adding admins:** add them as collaborators with **Write** (or Maintain/Admin) access in Settings → Collaborators. Each admin signs in with their own token. Removing their access ends the admin view at their next load. Admins are the repo's collaborators with write access; a repo secret can't work here, because a static page can't read secrets. The entry files are public in the repo anyway; the admin view only gathers them in one place.

### Discussions (Discourse)

Script pages embed their thread from the forum set in `site.config.json → discourse` (`comments: true` turns the embed on). On the Discourse side (Admin → Customize → Embedding):

1. Add an embeddable host `splines.cc` with the category the threads should go to.
2. Set **Username for topic creation** (e.g. a `splines` bot user).
3. Turn on **Embed unlisted** so topics stay out of the category until someone replies, and set **CSS selector for elements that are allowed in embeds** to `.entry-head` so a thread's first post is the script's name and description.
4. For likes: create a read-only API key (single user, scope `embed`/global read) and add it as the `DISCOURSE_API_KEY` repo secret. `enrich` uses it once per topic to find which topic belongs to which page.

A topic is created the first time someone scrolls to a page's comments, and later visits reuse it (matched by page URL). Likes on its first post count as ♥.

## TODO / to verify

- [ ] **Maiden catalog source config**: confirm where maiden reads extra catalog URLs on the device (its config file) and document the exact steps in `src/about.md`.
- [x] **awesome lists**: p3r7/awesome-monome-norns is imported (frozen since 2021, so it rarely adds anything new).
- [x] Name and domain: splines, at splines.cc.
- [x] Mods get `kind: mod` (same platform, own filter and badge), libraries get `kind: library` (no layout check, not in `catalog.json`).
