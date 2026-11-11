# Contributing

## Add a script

**The easy way:** fill in the [submission form](https://github.com/carlosedp/splines/issues/new?template=submit.yml). No git needed. A bot turns it into a pull request and comments on your issue if anything needs fixing; editing the issue runs it again.

**With a pull request:**

1. Fork this repo.
2. `npm install && npm run new -- <script-name>` creates `scripts/<script-name>/index.md` from the template (add `--platform iii|crow|teletype` for non-norns scripts). You can also copy `templates/entry.md` by hand.
3. Fill in the front matter. Names are unique across all platforms. For norns, the folder name and `name` must match the folder the script installs into, usually the repo name.
4. That's it: the script page shows your repo's README, so the front matter is all a PR needs. Optionally, add short "catalog notes" below the front matter (shown above the README), e.g. "needs crow v4" or "best with a 128 grid".
5. `npm run validate`, then open a pull request.

## The one rule: you own what you post

However a script was made, by hand or with AI, the person submitting it stands behind it. It runs on real hardware, does what the entry says, and you can answer questions about it and fix it.

## AI disclosure is required

| `ai:`      | meaning                                                                                          |
| ---------- | ------------------------------------------------------------------------------------------------ |
| `none`     | written without AI code generation (autocomplete-level help is fine)                             |
| `assisted` | made with meaningful help from AI tools, up to mostly generated code, reviewed and tested by you |

`unknown` is reserved for automatic imports. If your script was imported, claim it with the [claim form](https://github.com/carlosedp/splines/issues/new?template=claim.yml) (or the "claim it" link on its page), or edit the entry: set `source: submitted`, `listing: published` and fill in `ai`.

## Only with the author's OK

Entries have a `listing`: `published` (on the site), `indexed` (found by the importer, kept in the repo but not shown until the author opts in) or `declined` (the author said no: never shown, never asked again). Only add `listing: published` for a script that isn't yours if its author agreed.

## Update or remove an entry

To change the description, tags, hardware, AI disclosure or links, use the "edit its details" link on the script's page (or the [edit form](https://github.com/carlosedp/splines/issues/new?template=edit.yml)): it opens with the current values filled in, and a bot turns it into a pull request. For anything else, edit or delete your `scripts/<name>/` folder in a PR. Authors can always ask for their entry to be removed, or use the [opt-out form](https://github.com/carlosedp/splines/issues/new?template=optout.yml) to take it off the site.

## Guides

Guides are longer docs on a theme that spans many scripts: a mod framework (like [fx](https://splines.cc/guides/fx/)), nb voices, audio routing, techniques for writing scripts. They link to the scripts they cover, and those scripts' pages link back.

Add one with a pull request: `guides/<slug>/index.md` (lowercase kebab-case folder), with screenshots next to it if you like (PNG, JPEG, GIF or WebP). Front matter:

```yaml
title: fx mod
summary: One or two sentences, 200 characters max.
topic: mods            # mods | nb | audio | crow | dev (GUIDE_TOPICS in tools/lib.mjs)
authors: [your-handle]
checked: 2026-11-11    # when you last checked it against the code
scripts: [fx, fx_tanh] # entries it covers, by name (optional)
tags: [fx]             # also list every published script with these tags (optional)
sources:               # forum threads, repos, docs it draws on (optional)
  - https://llllllll.co/t/fx-mod/62726
```

The body is Markdown. Write `[[name]]` to link a script: it goes to the script's page, or to its repo if it isn't on the site. Scripts not on the site are listed separately, by repo only; a guide never publishes an entry. When a covered script gets pushed to after `checked`, the guide shows a notice, so update the date when you re-check it. Credit forum posts and code you quote. `npm run validate` checks the front matter and every `[[name]]`.

## Working on the site itself

No framework: `tools/build.mjs` renders plain HTML from the page modules in `tools/site/pages/` (an escaping `html` tagged template, no engine), `src/assets/app.js` filters the prerendered cards. `npm run dev` builds, serves locally, and rebuilds and reloads the page when you edit an entry, `src/` or `tools/`.
