// Build the static site into dist/:
//   index.html            searchable, filterable list (cards are prerendered; JS only filters/sorts)
//   scripts/<slug>/       one page per script
//   new/, updated/        latest additions and upstream pushes, plus Atom feeds
//   forks/                forks people keep working on (data from enrich.mjs)
//   about/, start/        submission guide and getting started, from Markdown in src/
//   admin/                every entry, published or not, for maintainers (data loaded from GitHub with their token)
//   catalog.json          maiden-compatible catalog (norns scripts only)
//   index.json            the whole catalog as plain JSON, for other tools
//
// Pages live in tools/site/pages/ and are written with the `html` tag from tools/site/html.mjs, which escapes
// every interpolated value. Shared pieces (cards, badges) are in components.mjs, the page shell in layout.mjs.
import path from "node:path";
import { ROOT } from "./lib.mjs";
import { DIST } from "./site/context.mjs";
import { collectRecords } from "./site/records.mjs";
import { createOutput } from "./site/output.mjs";
import home from "./site/pages/home.mjs";
import entries from "./site/pages/entry.mjs";
import lists from "./site/pages/lists.mjs";
import forks from "./site/pages/forks.mjs";
import prose from "./site/pages/prose.mjs";
import data from "./site/pages/data.mjs";
import admin from "./site/pages/admin.mjs";

// --all: a local preview with every entry, not just published ones (cards show the listing). Never deploy it.
const all = process.argv.includes("--all");
const records = collectRecords({ all });
const { write, copyDir, prune } = createOutput(DIST);

copyDir(path.join(ROOT, "src", "assets"), "assets");
home(records, write);
entries(records, write);
lists(records, write);
forks(records, write);
prose(records, write);
admin(records, write);
const inCatalog = data(records, write);
// remove what this build didn't write (deleted or renamed entries); always go through write()
prune();

console.log(`✓ built ${records.length} entries into dist/ (${inCatalog} in the maiden catalog)${all ? ", including unpublished ones: preview only" : ""}`);
