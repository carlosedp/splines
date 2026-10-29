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

`unknown` is reserved for automatic imports. If your script was imported, claim it with the [claim form](https://github.com/carlosedp/splines/issues/new?template=claim.yml) (or the "claim it" link on its page), or edit the entry: set `source: submitted` and fill in `ai`.

## Update or remove an entry

Edit or delete your `scripts/<name>/` folder in a PR. Authors can always ask for their entry to be removed.

## Working on the site itself

No framework: `tools/build.mjs` renders plain HTML from the page modules in `tools/site/pages/` (an escaping `html` tagged template, no engine), `src/assets/app.js` filters the prerendered cards. `npm run dev` builds, serves locally, and rebuilds and reloads the page when you edit an entry, `src/` or `tools/`.
