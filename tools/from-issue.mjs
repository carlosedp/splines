// Turn a "[submit]", "[claim]" or "[optout]" issue (from the forms in .github/ISSUE_TEMPLATE) into an entry change.
// A claim is how an author opts in: it publishes the entry (`listing: published`) and discloses AI use. An opt-out
// sets `listing: declined`: the entry stays in the repo, so the importer and invite.mjs leave the script alone.
// Run by .github/workflows/issue-entry.yml; the workflow validates the result and opens the pull request.
//
//   ISSUE_TITLE=… ISSUE_BODY=… ISSUE_NUMBER=… ISSUE_AUTHOR=… node tools/from-issue.mjs
//
// Writes the entry, plus pr-body.md (for the pull request) and comment.md (for the issue), and sets the
// step outputs `file` (the changed entry, empty on failure) and `name`. Issue text is untrusted: it only
// ever becomes YAML values, and the entry is validated before anything is proposed.
import fs from 'node:fs';
import path from 'node:path';
import {
  ROOT, ENTRIES_DIR, PLATFORMS, DEFAULT_PLATFORM, KNOWN_REQUIRES, SLUG_RE, TAG_RE,
  loadEntries, listingOf, normalizeRepo, githubSlug, gh, isModOnly, stringifyFrontMatter, updateFrontMatter,
} from './lib.mjs';

const { ISSUE_TITLE = '', ISSUE_BODY = '', ISSUE_NUMBER = '0', ISSUE_AUTHOR = '' } = process.env;
const kind = ISSUE_TITLE.match(/^\[(submit|claim|optout)\]/i)?.[1].toLowerCase();
const today = new Date().toISOString().slice(0, 10);

function output(key, value) {
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
  else console.log(`${key}=${value}`);
}
// a bad form is not a broken workflow: explain on the issue and finish normally
class FormError extends Error {}
function fail(msg) {
  throw new FormError(msg);
}

// Issue forms render each field as "### <label>" followed by its value; empty optional fields are "_No response_".
const fields = {};
for (const part of ISSUE_BODY.replace(/\r/g, '').split(/^### /m).slice(1)) {
  const [label, ...rest] = part.split('\n');
  const value = rest.join('\n').trim();
  fields[label.trim().toLowerCase()] = value === '_No response_' ? '' : value;
}
const field = (label) => fields[label] || '';
const list = (label) => field(label).split(/[,\n]/).map((s) => s.trim().toLowerCase().replace(/\s+/g, '-')).filter(Boolean);
const checked = (label) => [...field(label).matchAll(/^- \[x\] (.+)$/gim)].map((m) => m[1].trim());
// dropdown options read like "assisted: made with meaningful help from AI tools"; the value is before the colon
const choice = (label) => field(label).split(':')[0].trim().toLowerCase();
const https = (s) => (/^https:\/\/\S+$/.test(s) ? s : undefined);

const tags = (label) => {
  const out = list(label);
  const bad = out.filter((t) => !TAG_RE.test(t));
  if (bad.length) fail(`tags must be lowercase words or kebab-case (not: ${bad.join(', ')})`);
  return out;
};
const hardware = (values) => {
  const bad = values.filter((v) => !KNOWN_REQUIRES.includes(v));
  if (bad.length) fail(`unknown hardware: ${bad.join(', ')} (known: ${KNOWN_REQUIRES.join(', ')})`);
  return values;
};
const ai = (label) => {
  const v = choice(label);
  if (!['none', 'assisted'].includes(v)) fail('pick an AI disclosure: none or assisted');
  return v;
};
// whether the person who opened the issue owns the repo (a hint for the reviewer, not a gate)
const ownsRepo = (repo) => githubSlug(repo)?.split('/')[0] === ISSUE_AUTHOR.toLowerCase();

const entries = loadEntries();
// the claim and opt-out forms' "Script" field: a name, or a link to the script page
function scriptField() {
  const wanted = field('script').replace(/^.*\/scripts\/|\/.*$/g, '');
  const entry = entries.find((e) => e.slug.toLowerCase() === wanted.toLowerCase());
  if (!entry) fail(`there's no script named "${wanted}" in the catalog`);
  return entry;
}
let name, data, file, summary;

try {
  if (!kind) fail('the issue title must start with [submit], [claim] or [optout]');
  if (kind === 'submit') {
    const repo = field('repository').replace(/\.git$/, '').replace(/\/+$/, '');
    if (!https(repo)) fail('the repository must be an https URL, like https://github.com/you/my-script');
    const platform = choice('platform') || DEFAULT_PLATFORM;
    if (!PLATFORMS[platform]) fail(`platform must be one of: ${Object.keys(PLATFORMS).join(', ')}`);
    const listed = entries.find((e) => e.platform === platform && normalizeRepo(e.data?.repo) === normalizeRepo(repo));
    if (listed) fail(`this repo is already listed as \`${listed.slug}\`. If it's yours, use the claim form to publish it instead.`);

    // license and author default to what GitHub knows
    const slug = githubSlug(repo);
    let info = {};
    if (slug) {
      const res = await gh(`/repos/${slug}`);
      if (res.status === 404) fail(`${repo} was not found. Is the repository public?`);
      if (res.ok) info = await res.json();
    }
    name = field('name') || info.name || repo.split('/').pop();
    if (!SLUG_RE.test(name)) fail(`"${name}" can't be an entry name; use letters, digits, "_", "-" or "."`);
    const taken = entries.find((e) => e.slug.toLowerCase() === name.toLowerCase());
    if (taken) fail(`the name "${name}" is already used by \`${taken.slug}\`; fill in the name field with another one`);

    const requires = hardware(checked('hardware it needs'));
    data = {
      name,
      platform,
      // not asked on the form: a norns repo with lib/mod.lua and no script at the root is a mod
      ...(platform === 'norns' && slug && (await isModOnly(slug)) ? { kind: 'mod' } : {}),
      repo: info.html_url || repo,
      author: field('author') || info.owner?.login || ISSUE_AUTHOR,
      description: field('description').replace(/\s+/g, ' '),
      tags: tags('tags'),
    };
    if (requires.length) data.requires = requires;
    data.ai = ai('ai disclosure');
    // the form asks submitters to confirm they're the author or have the author's OK
    data.listing = 'published';
    const license = field('license') || (info.license?.spdx_id !== 'NOASSERTION' && info.license?.spdx_id);
    if (license) data.license = license;
    data.added = today;
    if (https(field('discussion'))) data.discussion = field('discussion');

    file = `${ENTRIES_DIR}/${name}/index.md`;
    fs.mkdirSync(path.join(ROOT, ENTRIES_DIR, name), { recursive: true });
    fs.writeFileSync(path.join(ROOT, file), stringifyFrontMatter(data));
    summary = `Adds **${name}** (${platform}${data.kind ? ` ${data.kind}` : ''}) from ${data.repo}.`;
  } else if (kind === 'claim') {
    const entry = scriptField();
    // indexed or declined entries can always be claimed: that's the author opting in (or changing their mind)
    if (entry.data?.source !== 'imported' && listingOf(entry.data) === 'published') fail(`\`${entry.slug}\` is already claimed; use "suggest an edit" on its page for changes`);
    name = entry.slug;
    const changes = { ai: ai('ai disclosure'), source: 'submitted', origin: undefined, listing: 'published' };
    // claimed entries need a date; an imported one may have none
    if (!entry.data.added) changes.added = today;
    if (field('description')) changes.description = field('description').replace(/\s+/g, ' ');
    if (field('tags')) changes.tags = tags('tags');
    const requires = hardware(list('hardware it needs'));
    if (requires.length) changes.requires = requires;
    if (field('author')) changes.author = field('author');
    data = { ...entry.data, ...changes };

    file = entry.file;
    const abs = path.join(ROOT, file);
    fs.writeFileSync(abs, updateFrontMatter(fs.readFileSync(abs, 'utf8'), changes));
    summary = `Claims **${name}** for its author and publishes it: \`listing: published\`, \`source: submitted\`, \`ai: ${changes.ai}\`${['description', 'tags', 'requires', 'author'].some((k) => k in changes) ? ', plus updated details' : ''}.`;
  } else {
    const entry = scriptField();
    if (listingOf(entry.data) === 'declined') fail(`\`${entry.slug}\` is already marked as not to be listed`);
    name = entry.slug;
    data = { ...entry.data, listing: 'declined' };
    file = entry.file;
    const abs = path.join(ROOT, file);
    fs.writeFileSync(abs, updateFrontMatter(fs.readFileSync(abs, 'utf8'), { listing: 'declined' }));
    summary = `Opts **${name}** out: \`listing: declined\`. It comes off the site if it was on it, and its author won't be asked again.`;
  }

  const owner = ownsRepo(data.repo)
    ? `\`${ISSUE_AUTHOR}\` owns the repository.`
    : `⚠️ The issue was opened by \`${ISSUE_AUTHOR}\`, who doesn't own ${githubSlug(data.repo) || 'the repository'}. Check they're the author or have their OK.`;
  fs.writeFileSync(
    'pr-body.md',
    `${summary}\n\nCloses #${ISSUE_NUMBER}.\n\n${owner}\n\nThe entry was validated online (repo exists${PLATFORMS[data.platform ?? DEFAULT_PLATFORM]?.luaRoot ? ', main .lua at the root' : ''}). Pull requests opened by Actions don't trigger other workflows, so the validate check won't show here.\n\n\`\`\`yaml\n${fs.readFileSync(path.join(ROOT, file), 'utf8').match(/^---\n([\s\S]*?)\n---/)?.[1] ?? ''}\n\`\`\`\n`,
  );
  output('name', name);
  output('file', file);
  console.log(`✓ ${summary}`);
} catch (err) {
  if (!(err instanceof FormError)) throw err;
  fs.writeFileSync('comment.md', `Thanks! This couldn't be turned into an entry yet:\n\n- ${err.message}\n\nEdit the issue to fix it and this runs again.\n`);
  output('file', '');
  console.error(`✗ ${err.message}`);
}
