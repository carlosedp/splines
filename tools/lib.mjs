// Shared helpers: config, entry loading, front matter parsing, validation rules.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// All entries live in scripts/<name>/index.md, whatever platform they run on.
export const ENTRIES_DIR = 'scripts';

// Where the code runs (front matter `platform`, default norns). Grid and arc are controllers, so they are
// hardware (`requires`), not platforms. Only `maiden` platforms go into catalog.json; `luaRoot` enables
// the online "main .lua at the repo root" check.
export const PLATFORMS = {
  norns: { label: 'norns', maiden: true, luaRoot: true },
  iii: { label: 'iii' },
  crow: { label: 'crow' },
  teletype: { label: 'teletype' },
};
export const DEFAULT_PLATFORM = 'norns';

// What an entry is (front matter `kind`, default script). Mods extend norns itself: they load from lib/mod.lua and
// are enabled in SYSTEM > MODS. They install like scripts, so they stay in catalog.json. Libraries are code for
// script authors to copy into their own scripts: nothing runs on its own, so they skip the layout check
// (`layout: false`) and stay out of catalog.json (`maiden: false`).
export const KINDS = {
  script: { label: 'script', plural: 'scripts' },
  mod: { label: 'mod', plural: 'mods', platforms: ['norns'] },
  library: { label: 'library', plural: 'libraries', layout: false, maiden: false },
};
export const DEFAULT_KIND = 'script';

// Repo problems found by tools/health.mjs (front matter `status`): the build shows a ⚠️ with this as its tooltip.
// health.mjs owns this field: it sets it, and clears it once the repo is fine again.
export const STATUSES = {
  archived: 'The repository is archived: it may no longer be maintained, or a newer script may have replaced it',
  gone: 'The repository could not be found: it may have been deleted, made private or moved',
};
// Whether an entry is on the site (front matter `listing`). Scripts are only published with their author's OK: they
// submitted or opted in, or listed the script in a maiden community catalog themselves. Everything else found by the
// importer stays indexed: kept here, tracked by enrich and health, shown only to admins, and its author can be invited
// to opt in (tools/invite.mjs). An author who says no gets `declined`: never shown, never asked again.
export const LISTINGS = {
  published: 'On the site and in catalog.json: the author submitted it, opted in, or listed it in a community catalog',
  indexed: 'Found by the importer; not on the site until its author opts in',
  declined: 'The author asked not to be listed; not on the site, and never invited again',
};
export const DEFAULT_LISTING = 'indexed';
export const listingOf = (data) => data?.listing ?? DEFAULT_LISTING;
export const AI_VALUES = ['none', 'assisted', 'unknown'];
export const SOURCE_VALUES = ['submitted', 'imported'];
export const KNOWN_REQUIRES = ['grid', 'arc', 'crow', 'midi', 'audio-in', 'keyboard', 'jf', 'ansible', 'teletype', 'hid', 'osc', 'txo', 'er-301'];
// Case is kept (the norns install folder is case-sensitive); uniqueness is checked ignoring case.
// what the importer writes when a source has no description; the build shows the repo's description instead
export const PLACEHOLDER_DESCRIPTION = 'no description yet';
export const SLUG_RE = /^[A-Za-z0-9_][A-Za-z0-9_.-]*$/;
export const TAG_RE = /^[a-z0-9][a-z0-9-]*$/;

export function loadConfig() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'site.config.json'), 'utf8'));
}

export function parseFrontMatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { data: null, body: text };
  return { data: YAML.parse(m[1]) ?? {}, body: m[2] };
}

export function stringifyFrontMatter(data, body = '') {
  return `---\n${YAML.stringify(data, { lineWidth: 0 }).trimEnd()}\n---\n${body.trim() ? `\n${body.trim()}\n` : ''}`;
}

/** Set (or, with undefined, delete) front matter fields in an entry file's text, keeping comments and order. */
export function updateFrontMatter(text, changes) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---(\r?\n[\s\S]*)?$/);
  if (!m) throw new Error('missing front matter');
  const doc = YAML.parseDocument(m[1]);
  for (const [k, v] of Object.entries(changes)) {
    if (v === undefined) doc.delete(k);
    else doc.set(k, v);
  }
  return `---\n${doc.toString({ lineWidth: 0 }).trimEnd()}\n---${m[2] ?? '\n'}`;
}

export function normalizeRepo(url) {
  return String(url || '')
    .trim()
    .replace(/^git\+/, '')
    .replace(/^http:\/\//, 'https://')
    .replace(/^https:\/\/www\./, 'https://')
    .replace(/\.git$/, '')
    .replace(/\/+$/, '')
    .toLowerCase();
}

export function githubSlug(url) {
  const m = normalizeRepo(url).match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)/);
  return m ? `${m[1]}/${m[2]}` : null;
}

/** Where enrich.mjs caches a repo's README (slug = "owner/repo", already lowercase). */
export const readmeFile = (slug) => path.join(ROOT, '.cache', 'readme', ...slug.split('/')) + '.md';

/** Load every scripts/<slug>/index.md entry. */
export function loadEntries() {
  const entries = [];
  const dir = path.join(ROOT, ENTRIES_DIR);
  if (!fs.existsSync(dir)) return entries;
  for (const slug of fs.readdirSync(dir).sort()) {
    const file = path.join(dir, slug, 'index.md');
    if (!fs.existsSync(file)) continue;
    const { data, body } = parseFrontMatter(fs.readFileSync(file, 'utf8'));
    const platform = data?.platform ?? DEFAULT_PLATFORM;
    const kind = data?.kind ?? DEFAULT_KIND;
    entries.push({ platform, kind, slug,file: path.relative(ROOT, file).replaceAll('\\', '/'), data, body });
  }
  return entries;
}

/** Returns a list of error strings for one entry (empty when valid). */
export function validateEntry(entry) {
  const errs = [];
  const d = entry.data;
  if (!d) return ['missing or malformed front matter (expected a --- YAML block at the top)'];
  if (!SLUG_RE.test(entry.slug)) errs.push(`folder name "${entry.slug}" may only use letters, digits, "_", "-" or "."`);

  const reqStr = (k) => {
    if (typeof d[k] !== 'string' || !d[k].trim()) errs.push(`"${k}" is required and must be a non-empty string`);
  };
  reqStr('name');
  reqStr('repo');
  reqStr('author');
  reqStr('description');

  if (typeof d.name === 'string' && d.name !== entry.slug) {
    errs.push(`"name" (${d.name}) must match the folder name (${entry.slug}); on norns it is the folder the script installs into`);
  }
  if (!PLATFORMS[entry.platform]) errs.push(`"platform" must be one of: ${Object.keys(PLATFORMS).join(', ')}`);
  if (!KINDS[entry.kind]) errs.push(`"kind" must be one of: ${Object.keys(KINDS).join(', ')}`);
  else if (KINDS[entry.kind].platforms && !KINDS[entry.kind].platforms.includes(entry.platform)) {
    errs.push(`"kind: ${entry.kind}" is only for ${KINDS[entry.kind].platforms.join(', ')}`);
  }
  if (typeof d.repo === 'string' && !/^https:\/\/[^\s]+$/.test(d.repo)) errs.push('"repo" must be an https URL');
  if (typeof d.description === 'string' && d.description.length > 160) errs.push('"description" should be 160 characters or fewer');

  if (!Array.isArray(d.tags) || d.tags.length === 0) errs.push('"tags" must be a non-empty list');
  else for (const t of d.tags) if (!TAG_RE.test(String(t))) errs.push(`tag "${t}" must be lowercase kebab-case`);

  if (d.requires !== undefined) {
    if (!Array.isArray(d.requires)) errs.push('"requires" must be a list');
    else for (const r of d.requires) if (!KNOWN_REQUIRES.includes(r)) errs.push(`unknown "requires" value "${r}" (known: ${KNOWN_REQUIRES.join(', ')})`);
  }
  if (!AI_VALUES.includes(d.ai)) errs.push(`"ai" must be one of: ${AI_VALUES.join(', ')}`);
  if (d.source !== undefined && !SOURCE_VALUES.includes(d.source)) errs.push(`"source" must be one of: ${SOURCE_VALUES.join(', ')}`);
  if (d.status !== undefined && !STATUSES[d.status]) errs.push(`"status" must be one of: ${Object.keys(STATUSES).join(', ')}`);
  if (d.listing !== undefined && !LISTINGS[d.listing]) errs.push(`"listing" must be one of: ${Object.keys(LISTINGS).join(', ')}`);
  if (d.source !== 'imported' && d.ai === 'unknown') errs.push('"ai: unknown" is only allowed for imported entries; submitters must disclose');
  // drives the /new/ page and feed; the initial import has no date, so it doesn't flood them
  if (d.added !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(String(d.added))) errs.push('"added" must be a date like 2026-10-21');
  if (d.added === undefined && d.source !== 'imported') errs.push('"added" is required: the date the entry is submitted, like 2026-10-21');
  for (const k of ['discussion', 'docs', 'cover', 'install', 'invited']) {
    if (d[k] !== undefined && !/^https:\/\/[^\s]+$/.test(String(d[k]))) errs.push(`"${k}" must be an https URL`);
  }
  return errs;
}

export function readJSON(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

export async function gh(pathname, { token = process.env.GITHUB_TOKEN, accept = 'application/vnd.github+json' } = {}) {
  const headers = { Accept: accept, 'User-Agent': 'norns-catalog' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`https://api.github.com${pathname}`, { headers });
  return res;
}

/** Whether a GitHub repo ("owner/repo") looks installable on norns: a .lua at the root, or lib/mod.lua for a mod. */
export async function hasNornsLayout(slug) {
  const c = await gh(`/repos/${slug}/contents/`);
  if (!c.ok) return null; // unknown (missing repo or rate limit)
  const files = await c.json();
  return files.some((f) => f.type === 'file' && f.name.endsWith('.lua')) || (await isNornsMod(slug)) === true;
}

/** Whether a GitHub repo ("owner/repo") is a norns mod (has lib/mod.lua); null when GitHub can't tell. */
export async function isNornsMod(slug) {
  const res = await gh(`/repos/${slug}/contents/lib/mod.lua`);
  return res.ok ? true : res.status === 404 ? false : null;
}

/**
 * Whether a GitHub repo is only a norns mod: lib/mod.lua and no script at the root. Repos that ship both
 * (a synth script with an nb voice mod, say) stay `kind: script` unless the entry says otherwise. Null when unknown.
 */
export async function isModOnly(slug) {
  const mod = await isNornsMod(slug);
  if (!mod) return mod;
  const c = await gh(`/repos/${slug}/contents/`);
  if (!c.ok) return null;
  return !(await c.json()).some((f) => f.type === 'file' && f.name.endsWith('.lua'));
}
