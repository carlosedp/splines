# about {{title}}

{{title}} is a community catalog of scripts for monome norns, grid, iii, crow and teletype. Anyone can list a script with a pull request. Handmade and AI-assisted work are both welcome, as long as the entry discloses it. The maintainer of the catalog lightly curates the submissions to ensure quality and relevance.

It's unofficial and community-run, and has no affiliation with monome. Scripts live in their authors' repositories and keep their own licenses; {{title}} only links to them.

## the one rule: you own what you post

However a script was made, the person who submits it stands behind it:

- it runs on real hardware and does what the entry says,
- you understand it well enough to answer questions and fix bugs,
- you'll keep the entry honest if that changes (archive it, update it, or remove it).

## AI disclosure

Every entry carries one of these labels, and the list can be filtered by them, so everyone can choose what they want to see.

| label                            | meaning                                                                                                 |
| -------------------------------- | ------------------------------------------------------------------------------------------------------- |
| **handmade** (`ai: none`)        | written without AI code generation (autocomplete-level help is fine)                                    |
| **ai-assisted** (`ai: assisted`) | made with meaningful help from AI tools, up to mostly generated code, reviewed and tested by the author |
| **undisclosed** (`ai: unknown`)  | imported automatically; the author hasn't said yet                                                      |

## submitting a script

**The easy way:** fill in the [submission form](https://github.com/{{repo}}/issues/new?template=submit.yml). No git needed, just a GitHub account. A bot turns it into a pull request; if something needs fixing it comments on your issue, and editing the issue runs it again.

**With a pull request:**

1. Fork [{{repo}}](https://github.com/{{repo}}).
2. Create `scripts/<your-script>/index.md`. Names are unique across the whole catalog. For norns, the folder name must match the name the script installs as, usually the repo name.
3. Fill in the front matter (copy `templates/entry.md`):

```yaml
---
name: my-script
platform: norns          # norns | iii | crow | teletype
repo: https://github.com/you/my-script
author: you
description: one line, under 160 characters
tags: [sequencer, generative]
requires: [grid, midi]   # grid, arc, crow, midi, audio-in, keyboard, jf, ...
supports: [grid, arc, crow, midi, audio-in, keyboard, jf]   # grid, arc, crow, midi, audio-in, keyboard, jf, ...
ai: assisted             # none | assisted
license: MIT
---

Optional "catalog notes" go here, shown above your README.
```

The script page shows your repository's README, so there's no need to copy your docs here; keep them in one place.

4. Open a pull request. A check validates the entry and confirms the repo exists (for norns, that it has a `.lua` script at its root). Once merged, the site rebuilds in a minute or two.

Already listed through an import? Use the "claim it" link on the script's page (or the [claim form](https://github.com/{{repo}}/issues/new?template=claim.yml)) to disclose AI use and fix its details.

Once it's listed, the script page has a README badge you can copy, linking readers back to the catalog.

## installing with maiden

Every script page has a one-line install command for maiden's REPL:

```
;install https://github.com/author/script
```

{{title}} also publishes a maiden-compatible catalog at:

```
{{catalog}}
```

maiden's project manager reads its catalogs from its configuration on the device. Add the URL above as an extra catalog source and the {{title}} scripts show up in the project manager next to the official community catalog, with install and update buttons.

## where the scripts come from

Besides direct submissions, a weekly job looks for scripts in the official community catalog, curated lists, GitHub repositories tagged or mentioning `norns`, and new threads in the [lines norns library](https://llllllll.co/tags/c/library/18/norns/15). New finds are proposed as a pull request and reviewed before they appear here. They're marked **undisclosed** until their authors claim them.

Another weekly job checks that every listed repository still exists: moved repos are followed automatically, and deleted ones are flagged for removal.

## discussions

Script pages can have a discussion thread backed by GitHub Discussions, so no extra account or database is needed beyond GitHub.
