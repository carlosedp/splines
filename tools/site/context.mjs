// Site-wide settings and data the pages share: config, URL helpers, caches written by enrich.mjs.
import path from "node:path";
import { ROOT, loadConfig, readJSON } from "../lib.mjs";

export const cfg = loadConfig();
export const DIST = path.join(ROOT, "dist");
export const base = (cfg.basePath || "").replace(/\/+$/, "");
export const siteUrl = (cfg.siteUrl || "").replace(/\/+$/, "");
export const href = (p) => `${base}/${p.replace(/^\/+/, "")}`;
// the submission issue form (.github/ISSUE_TEMPLATE/submit.yml): no git needed, a workflow opens the PR
export const submitUrl = `https://github.com/${cfg.repo}/issues/new?template=submit.yml&title=${encodeURIComponent("[submit] ")}`;
// script pages embed their thread from the Discourse forum (topics are created on first view, keyed by page URL)
export const commentsReady = !!(cfg.discourse?.url && cfg.discourse.comments && siteUrl);
export const buildDate = new Date().toISOString();

export const cache = readJSON(path.join(ROOT, ".cache", "github.json"), {});
// likes and comment counts of each script's forum thread, keyed by page path (written by enrich.mjs)
export const discussions = readJSON(path.join(ROOT, ".cache", "discussions.json"), {});
// forks someone pushed to, with commits ahead/behind upstream (written by enrich.mjs)
export const forksCache = readJSON(path.join(ROOT, ".cache", "forks.json"), {});

export const NEW_DAYS = 30; // cards get a "new" badge for this long after `added`
// an active fork has its own work on its default branch and was pushed to recently
export const FORK_MIN_AHEAD = 2;
export const FORK_ACTIVE_DAYS = 365;
export const FEED_SIZE = 50;

export const AI_LABEL = {
  none: ["handmade", "Written without AI code generation"],
  assisted: ["ai-assisted", "Made with help from AI tools, reviewed and tested by the author"],
  unknown: ["undisclosed", "Imported automatically; the author has not disclosed AI use yet"],
};
