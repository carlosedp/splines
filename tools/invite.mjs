// Ask the authors of indexed scripts whether they'd like them published, with an issue on their repo.
//
//   node tools/invite.mjs                      review list → invites.md (default; touches nothing on GitHub)
//   node tools/invite.mjs --send --only a,b    open the invitation issues for these entries (or --limit N: the first N ready)
//   node tools/invite.mjs --sync               invitations closed without an opt-in → `listing: declined`
//
// The issue text is templates/invite.md. It links to the claim form (opt in → `listing: published`) and the
// opt-out form (→ `listing: declined`), both prefilled; .github/workflows/issue-entry.yml turns those into PRs.
// Each repo is asked once: the issue URL is saved as `invited` in the entry, and declined entries are never asked.
// --send and --sync need a token that can open issues on other people's repos (GITHUB_TOKEN; in Actions, a PAT).
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, loadConfig, loadEntries, listingOf, githubSlug, readJSON, parseFrontMatter, updateFrontMatter } from './lib.mjs';

const args = process.argv.slice(2);
const opt = (k) => (args.includes(k) ? args[args.indexOf(k) + 1] : null);
const only = opt('--only') ? new Set(opt('--only').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)) : null;
const limit = opt('--limit') ? Number(opt('--limit')) : 10;
const send = args.includes('--send');
const sync = args.includes('--sync');
const token = process.env.GITHUB_TOKEN;

// repos without a push in this long are listed apart: likely abandoned, and the author may not answer
const STALE_DAYS = 730;

const cfg = loadConfig();
const siteUrl = (cfg.siteUrl || '').replace(/\/+$/, '');
const cache = readJSON(path.join(ROOT, '.cache', 'github.json'), {});
const now = Date.now();
const issueForm = (template, kind, name) =>
  `https://github.com/${cfg.repo}/issues/new?template=${template}&title=${encodeURIComponent(`[${kind}] ${name}`)}&script=${encodeURIComponent(name)}`;

const template = parseFrontMatter(fs.readFileSync(path.join(ROOT, 'templates', 'invite.md'), 'utf8'));
/** The invitation for one entry: { title, body }. */
function invitation(e) {
  const fill = (s) =>
    s
      .replaceAll('{{name}}', e.data.name)
      .replaceAll('{{author}}', e.data.author)
      .replaceAll('{{repo}}', e.data.repo)
      .replaceAll('{{site}}', siteUrl)
      .replaceAll('{{about}}', `${siteUrl}/about/`)
      .replaceAll('{{optin}}', issueForm('claim.yml', 'claim', e.slug))
      .replaceAll('{{optout}}', issueForm('optout.yml', 'optout', e.slug));
  return { title: fill(template.data.title), body: fill(template.body.trim()) + '\n' };
}

const setFields = (e, changes) => {
  const abs = path.join(ROOT, e.file);
  fs.writeFileSync(abs, updateFrontMatter(fs.readFileSync(abs, 'utf8'), changes));
  Object.assign(e.data, changes);
};

async function api(method, pathname, body) {
  const res = await fetch(`https://api.github.com${pathname}`, {
    method,
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'norns-catalog', Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body && JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${method} ${pathname}: ${res.status} ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

const entries = loadEntries();
const indexed = entries.filter((e) => listingOf(e.data) === 'indexed');

// --sync: an invitation closed by its author without opting in counts as a no
if (sync) {
  if (!token) throw new Error('--sync needs GITHUB_TOKEN');
  let n = 0;
  for (const e of indexed.filter((e) => e.data.invited)) {
    const m = e.data.invited.match(/^https:\/\/github\.com\/([^/]+\/[^/]+)\/issues\/(\d+)/);
    if (!m) continue;
    const issue = await api('GET', `/repos/${m[1]}/issues/${m[2]}`);
    if (issue.state === 'closed') {
      setFields(e, { listing: 'declined' });
      console.log(`  ✗ ${e.slug}: invitation closed (${issue.state_reason || 'closed'}) → declined`);
      n++;
    }
  }
  console.log(`✓ synced invitations: ${n} declined`);
}

// who can be invited, and who's set apart (and why)
const groups = { ready: [], stale: [], invited: [], skipped: [] };
for (const e of indexed) {
  if (listingOf(e.data) !== 'indexed') continue; // declined by --sync just now
  const slug = githubSlug(e.data.repo);
  const info = cache[slug] || {};
  const row = { e, slug, stars: info.stars ?? null, pushed: info.pushedAt?.slice(0, 10) ?? null };
  if (e.data.invited) groups.invited.push(row);
  else if (!slug) groups.skipped.push({ ...row, why: 'not on GitHub' });
  else if (e.data.status || info.archived) groups.skipped.push({ ...row, why: e.data.status || 'archived' });
  else if (row.pushed && now - Date.parse(row.pushed) > STALE_DAYS * 864e5) groups.stale.push(row);
  else groups.ready.push(row);
}
const byInterest = (a, b) => (b.stars ?? -1) - (a.stars ?? -1) || String(b.pushed).localeCompare(String(a.pushed));
for (const g of Object.values(groups)) g.sort(byInterest);

if (send) {
  if (!token) throw new Error('--send needs GITHUB_TOKEN (a token that can open issues on public repos)');
  const picked = only ? [...groups.ready, ...groups.stale].filter((r) => only.has(r.e.slug.toLowerCase())) : groups.ready.slice(0, limit);
  if (only) for (const name of only) if (!picked.some((r) => r.e.slug.toLowerCase() === name)) console.warn(`  ? ${name}: not an indexed entry waiting for an invitation`);
  const me = (await api('GET', '/user')).login;
  let n = 0;
  for (const { e, slug } of picked) {
    try {
      // the cache can be a day old: check the repo still takes issues before writing to it
      const repo = await api('GET', `/repos/${slug}`);
      if (repo.archived || !repo.has_issues) {
        console.warn(`  - ${e.slug}: ${repo.archived ? 'archived' : 'issues are disabled'}, skipped`);
        continue;
      }
      const { title, body } = invitation(e);
      // never twice: an earlier run may have opened it without the entry change being merged
      const mine = await api('GET', `/repos/${slug}/issues?creator=${me}&state=all&per_page=100`);
      const issue = mine.find((i) => i.title === title) || (await api('POST', `/repos/${slug}/issues`, { title, body }));
      setFields(e, { invited: issue.html_url });
      console.log(`  ✓ ${e.slug}: ${issue.html_url}`);
      n++;
    } catch (err) {
      console.warn(`  ! ${e.slug}: ${err.message}`);
    }
  }
  console.log(`✓ invited ${n} of ${picked.length}`);
} else {
  writeList();
  // for invite.yml: the entries the send job would invite
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `names=${groups.ready.slice(0, limit).map((r) => r.e.slug).join(',')}\n`);
}

function writeList() {
  const cell = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\s+/g, ' ');
  const row = ({ e, slug, stars, pushed }) => {
    const { title, body } = invitation(e);
    // "open" prefills the issue on their repo, for inviting by hand from the browser
    const open = `https://github.com/${slug}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
    return `| [${cell(e.slug)}](${e.data.repo}) | ${cell(e.data.author)} | ${cell(e.data.origin)} | ${stars ?? '?'} | ${pushed ?? '?'} | ${cell(e.data.description)} | [open](${open}) |`;
  };
  const table = (rows) =>
    rows.length ? ['| entry | author | origin | ★ | last push | description | invite |', '|---|---|---|---|---|---|---|', ...rows.map(row)].join('\n') : '_none_';
  const sample = groups.ready[0] || groups.stale[0];
  const declined = entries.filter((e) => listingOf(e.data) === 'declined').length;
  const md = `# Invitations to review

${indexed.length} indexed entries: **${groups.ready.length} ready**, ${groups.stale.length} stale, ${groups.invited.length} already invited, ${groups.skipped.length} can't be invited. ${declined} declined.

Nothing has been sent. Review the text and the list, then either open issues by hand with each row's **open** link (it prefills the issue on their repo; afterwards add \`invited: <issue url>\` to the entry), or run \`node tools/invite.mjs --send --only name1,name2\` with a GITHUB_TOKEN.

## Ready (sorted by stars, then last push)

${table(groups.ready)}

## Stale: no push in ${STALE_DAYS / 365} years

These authors may not answer. Invite them with \`--only\` if a script looks worth it.

${table(groups.stale)}

## Can't be invited

${groups.skipped.length ? groups.skipped.map((r) => `- [${r.e.slug}](${r.e.data.repo}): ${r.why}`).join('\n') : '_none_'}

## Already invited

${groups.invited.length ? groups.invited.map((r) => `- [${r.e.slug}](${r.e.data.repo}): ${r.e.data.invited}`).join('\n') : '_none_'}
${
  sample
    ? `
## The invitation, as ${sample.e.slug} would get it

> **${invitation(sample.e).title}**

${invitation(sample.e).body.replace(/^/gm, '> ')}`
    : ''
}`;
  fs.writeFileSync(path.join(ROOT, 'invites.md'), md);
  console.log(`✓ invites.md: ${groups.ready.length} ready, ${groups.stale.length} stale, ${groups.invited.length} invited, ${groups.skipped.length} skipped`);
}
