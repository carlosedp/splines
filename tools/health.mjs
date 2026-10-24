// Check that every entry's repository is still where the entry says it is.
//
//   node tools/health.mjs [--dry-run]
//
// Renamed or transferred GitHub repos are fixed in place (the API redirects to the new location), and the
// old URL goes into site.config.json -> import.ignore so sources that still list it don't re-import it.
// Deleted, unreachable and archived repos are only reported: removing an entry is a human decision.
// The report goes to health.md, used by .github/workflows/health.yml for the pull request and the
// "catalog health" issue.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, PLATFORMS, loadEntries, normalizeRepo, githubSlug, gh, updateFrontMatter } from './lib.mjs';

const dryRun = process.argv.includes('--dry-run');
const moved = [];
const gone = [];
const archived = [];
const duplicates = [];
const unchecked = [];

const entries = loadEntries();
// "platform owner/repo" -> entry, to catch two entries that now lead to the same repo
const bySlug = new Map(entries.map((e) => [`${e.platform} ${githubSlug(e.data?.repo)}`, e]));

for (const e of entries) {
  if (!e.data?.repo) continue;
  const slug = githubSlug(e.data.repo);
  if (!slug) {
    // other forges: a plain request is all we can do
    const res = await fetch(e.data.repo, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(15000) }).catch(() => null);
    if (!res || res.status >= 400) gone.push({ e, why: res ? `HTTP ${res.status}` : 'unreachable' });
    continue;
  }
  const res = await gh(`/repos/${slug}`).catch((err) => err);
  if (res instanceof Error) {
    unchecked.push(`${e.slug}: ${res.cause?.code || res.message}`);
    continue;
  }
  if (res.status === 403 || res.status === 429) {
    console.warn('! rate limited, stopping early; the report is partial.');
    unchecked.push('(rate limited before every entry was checked)');
    break;
  }
  if (res.status === 404 || res.status === 451) {
    gone.push({ e, why: res.status === 404 ? 'not found (deleted or made private)' : 'unavailable for legal reasons' });
    continue;
  }
  if (!res.ok) {
    unchecked.push(`${e.slug}: GitHub returned ${res.status}`);
    continue;
  }
  const r = await res.json();
  if (r.full_name.toLowerCase() !== slug) {
    // only owner/name change: some entries link a release zip or a subfolder on purpose
    const to = e.data.repo.replace(/^(https:\/\/(?:www\.)?github\.com\/)[^/]+\/[^/#?]+?(\.git)?(?=[/#?]|$)/i, `$1${r.full_name}`);
    const key = `${e.platform} ${r.full_name.toLowerCase()}`;
    const other = bySlug.get(key);
    if (other && other !== e) {
      duplicates.push({ e, other, to });
    } else {
      moved.push({ e, to, renamed: r.name !== e.slug && PLATFORMS[e.platform]?.luaRoot });
      bySlug.set(key, e);
      if (!dryRun) {
        const file = path.join(ROOT, e.file);
        fs.writeFileSync(file, updateFrontMatter(fs.readFileSync(file, 'utf8'), { repo: to }));
      }
    }
  }
  if (r.archived) archived.push({ e, pushed: r.pushed_at?.slice(0, 10) });
}

if (moved.length && !dryRun) {
  const file = path.join(ROOT, 'site.config.json');
  const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
  cfg.import = cfg.import || {};
  const ignore = new Set(cfg.import.ignore || []);
  const known = new Set([...ignore].map(normalizeRepo));
  for (const m of moved) if (!known.has(normalizeRepo(m.e.data.repo))) ignore.add(m.e.data.repo);
  cfg.import.ignore = [...ignore];
  fs.writeFileSync(file, `${JSON.stringify(cfg, null, 2)}\n`);
}

const link = (e) => `[${e.slug}](${e.data.repo})`;
const section = (title, items, fmt) => (items.length ? `### ${title} (${items.length})\n\n${items.map((x) => `- ${fmt(x)}`).join('\n')}\n\n` : '');
const report =
  `Weekly check of every entry's repository (${new Date().toISOString().slice(0, 10)}).\n\n` +
  section('moved', moved, (m) => `\`${m.e.slug}\`: ${m.e.data.repo} → ${m.to}${m.renamed ? ' ⚠️ the repo name changed, so the norns install folder may have too; consider renaming the entry' : ''}`) +
  section('duplicates', duplicates, (d) => `\`${d.e.slug}\`: ${d.e.data.repo} now leads to ${d.to}, which \`${d.other.slug}\` already lists. Remove one of them, and add the old URL to \`import.ignore\` in site.config.json`) +
  section('gone', gone, (g) => `${link(g.e)}: ${g.why}. Remove the entry (and add its repo to \`import.ignore\` in site.config.json), or point it at a new home`) +
  section('archived', archived, (a) => `${link(a.e)} (last push ${a.pushed || 'unknown'}). Shown with a warning on its page; fine to keep if it still works`) +
  section('not checked', unchecked, (u) => u) +
  (moved.length || duplicates.length || gone.length || archived.length ? '' : 'Everything is where it should be. ✓\n');

fs.writeFileSync('health.md', report);
console.log(report);
console.log(`${dryRun ? '[dry run] ' : ''}moved ${moved.length}, duplicates ${duplicates.length}, gone ${gone.length}, archived ${archived.length}.`);
