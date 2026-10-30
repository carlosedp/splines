// Import scripts from external sources as new entries (never overwrites existing ones).
//
//   node tools/import.mjs [--dry-run] [--only community,awesome,github,search,lines] [--limit N] [--days N]
//
// Sources are configured in site.config.json -> import. Imported entries get
// `source: imported` and `ai: unknown`, and are proposed through a pull request
// by the weekly workflow. Only entries from maiden community catalogs are `listing: published` (their
// authors listed them there); the rest are `listing: indexed`: kept and tracked, but not on the site until
// their author opts in (tools/invite.mjs drafts the invitations).
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, ENTRIES_DIR, loadConfig, loadEntries, normalizeRepo, stringifyFrontMatter, gh, githubSlug, hasNornsLayout, isModOnly, TAG_RE, PLACEHOLDER_DESCRIPTION, KNOWN_REQUIRES } from './lib.mjs';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const only = args.includes('--only') ? new Set(args[args.indexOf('--only') + 1].split(',')) : null;
const limit = args.includes('--limit') ? Number(args[args.indexOf('--limit') + 1]) : Infinity;
// overrides the configured look-back of the lines and search sources, for a one-off backfill
const daysArg = args.includes('--days') ? Number(args[args.indexOf('--days') + 1]) : null;
const want = (s) => !only || only.has(s);

const cfg = loadConfig().import || {};
// sources list norns scripts unless they say otherwise (lines sources have a `platform`); names are unique across all platforms
const existing = loadEntries();
// repos are deduped per platform (one repo can hold a norns and an iii version)
const repoKey = (platform, repo) => `${platform} ${normalizeRepo(repo)}`;
const knownRepos = new Set(existing.map((e) => repoKey(e.platform, e.data?.repo)));
// plus repos that must not come back on any platform: old URLs of moved scripts, deleted repos (see health.mjs)
const ignored = new Set((cfg.ignore || []).map(normalizeRepo));
const isKnown = (platform, repo) => ignored.has(normalizeRepo(repo)) || knownRepos.has(repoKey(platform, repo));
const usedSlugs = new Set(existing.map((e) => e.slug.toLowerCase())); // names are unique ignoring case
// lines topics already linked from an entry, by topic id
const knownTopics = new Set(existing.map((e) => String(e.data?.discussion || '').match(/llllllll\.co\/t\/(?:[^/]+\/)?(\d+)/)?.[1]).filter(Boolean));
const today = new Date().toISOString().slice(0, 10);
const added = [];

const slugify = (s) =>
  String(s).toLowerCase().replace(/[^a-z0-9_.-]+/g, '-').replace(/^[-.]+|[-.]+$/g, '') || 'script';
// entry names keep their case: on norns the name is the install folder, and paths are case-sensitive
const toName = (s) => String(s).replace(/[^A-Za-z0-9_.-]+/g, '-').replace(/^[-.]+|[-.]+$/g, '') || 'script';
const cleanTags = (tags) => {
  const out = [...new Set((tags || []).map((t) => slugify(t).replace(/[_.]/g, '-')).filter((t) => TAG_RE.test(t) && !['norns', 'monome', 'monome-norns', 'norns-script', 'lua', 'iii', 'mod', 'mods'].includes(t)))]; // mods get `kind: mod` instead
  return out.length ? out.slice(0, 8) : ['uncategorized'];
};
const clip = (s, n = 160) => {
  s = String(s || '').replace(/\s+/g, ' ').trim();
  return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s || PLACEHOLDER_DESCRIPTION;
};

function add({ name, repo, author, description, tags, requires, discussion, docs, origin, platform = 'norns', onNameClash = 'suffix' }) {
  if (added.length >= limit) return;
  const norm = normalizeRepo(repo);
  if (!norm.startsWith('https://') || isKnown(platform, norm)) return;
  const owner = norm.split('/')[3] || 'unknown';
  let slug = toName(name);
  if (usedSlugs.has(slug.toLowerCase()) && onNameClash === 'skip') {
    console.log(`  ? skipped ${repo}: name "${slug}" is already taken (same script at a new URL?)`);
    return;
  }
  if (usedSlugs.has(slug.toLowerCase())) slug = toName(`${slug}-${owner}`);
  if (usedSlugs.has(slug.toLowerCase())) return;

  const data = {
    name: slug,
    platform,
    repo: repo.replace(/\.git$/, '').replace(/\/+$/, ''),
    author: author || owner,
    description: clip(description),
    tags: cleanTags(tags),
  };
  // hardware tags (grid, arc, crow, midi...) double as the `requires` filter
  const req = requires ?? data.tags.filter((t) => KNOWN_REQUIRES.includes(t));
  if (req.length) data.requires = req;
  const listing = origin.startsWith('catalog:') ? 'published' : 'indexed';
  Object.assign(data, { ai: 'unknown', source: 'imported', origin, listing, added: today });
  if (discussion?.startsWith('https://')) data.discussion = discussion;
  if (docs?.startsWith('https://')) data.docs = docs;

  knownRepos.add(repoKey(platform, norm));
  usedSlugs.add(slug.toLowerCase());
  added.push(data);
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'norns-catalog' } });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.text();
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const daysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);

// 1. maiden-format catalogs (norns.community's community.json and friends)
if (want('community')) {
  for (const url of cfg.communityCatalogs || []) {
    try {
      const cat = JSON.parse(await fetchText(url));
      for (const e of cat.entries || []) {
        add({
          name: e.project_name,
          repo: e.project_url,
          // community.json sometimes has a stray "license" word in author ("tyleretters license")
          author: String(e.author || '').replace(/\blicense\b/gi, '').replace(/\s+/g, ' ').trim(),
          description: e.description,
          tags: e.tags || e.tag,
          discussion: e.discussion_url,
          docs: e.documentation_url,
          origin: cat.catalog_name ? `catalog:${cat.catalog_name}` : url,
        });
      }
      console.log(`· ${url}: ${(cat.entries || []).length} entries read`);
    } catch (err) {
      console.warn(`! ${err.message}`);
    }
  }
}

// 2. awesome-style markdown lists. p3r7/awesome-monome-norns has categorized tables with
//    reference-style links; anything else falls back to "- [name](https://github.com/owner/repo) - description".
if (want('awesome')) {
  for (const url of cfg.awesomeLists || []) {
    try {
      const md = await fetchText(url);
      const before = added.length;
      const rows = /^## _script_ List/m.test(md) ? parseAwesomeNorns(md) : parseAwesomeLinks(md);
      // the same script often lives at a new repo URL now; a name clash is more likely a move than a new script
      for (const r of rows) add({ ...r, origin: `awesome:${url.match(/github(?:usercontent)?\.com\/([^/]+\/[^/]+)/)?.[1] || url}`, onNameClash: 'skip' });
      console.log(`· ${url}: ${rows.length} scripts read, ${added.length - before} new`);
    } catch (err) {
      console.warn(`! ${err.message}`);
    }
  }
}

function parseAwesomeLinks(md) {
  const re = /\[([^\]]+)\]\((https:\/\/github\.com\/[\w.-]+\/[\w.-]+)\/?\)\s*(?:[-–—:]\s*(.*))?/g;
  return [...md.matchAll(re)].map((m) => ({ name: m[2].split('/')[4], repo: m[2], description: m[3] || m[1], tags: [] }));
}

function parseAwesomeNorns(md) {
  const refs = new Map([...md.matchAll(/^\[([^\]]+)\]:\s*<?(\S+?)>?\s*$/gm)].map((m) => [m[1].toLowerCase(), m[2]]));
  // first link in a table cell: [text](url), [text][ref] or [ref]
  const link = (cell) => {
    const m = cell.match(/\[([^\]]+)\](?:\(([^)]+)\)|\[([^\]]*)\])?/);
    if (!m) return { text: cell.trim(), url: null };
    return { text: m[1], url: m[2] || refs.get((m[3] || m[1]).toLowerCase()) || null };
  };
  const plain = (s) => s.replace(/\[([^\]]+)\](?:\([^)]*\)|\[[^\]]*\])?/g, '$1').replace(/[_*`]/g, '').trim();
  const cells = (line) => line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
  const isRow = (line) => line.startsWith('|') && !/^\|\s*:?-{3}/.test(line);
  const CATEGORY_TAGS = {
    'synths & drones': ['synth', 'drone'],
    'granular sample players & synths': ['granulator', 'sampler'],
    'sample players': ['sampler'],
    'basic samplers': ['sampler'],
    sequencers: ['sequencer'],
    trackers: ['tracker', 'sequencer'],
    'control modulation sources': ['modulation'],
    'audio effects': ['audio-fx'],
    'loopers, live samplers & crazy delays': ['looper', 'delay'],
    'midi effects': ['midi'],
    utilities: ['utility'],
  };
  // "scripts by I/O" table: 🔴 marks hardware the script can't run without
  const IO_REQUIRES = { 'audio in': 'audio-in', 'midi sync': 'midi', 'midi in': 'midi', 'midi out': 'midi', keyboard: 'keyboard', grid: 'grid', arc: 'arc', crow: 'crow' };
  const requiresByApp = new Map();
  const io = md.split(/^## _scripts_ by I\/O/m)[1]?.split(/^## /m)[0] || '';
  let header = null;
  for (const line of io.split('\n').filter(isRow)) {
    const c = cells(line);
    if (c[0] === 'app') header = c.map((h) => h.toLowerCase());
    else if (header) {
      const req = c.flatMap((v, i) => (v.includes('🔴') && IO_REQUIRES[header[i]] ? [IO_REQUIRES[header[i]]] : []));
      requiresByApp.set(link(c[0]).text, [...new Set(req)]);
    }
  }

  const rows = [];
  const scripts = md.split(/^## _script_ List/m)[1].split(/^## /m)[0];
  let category = [];
  for (const line of scripts.split('\n')) {
    const h = line.match(/^####\s+(.*)/);
    if (h) category = CATEGORY_TAGS[plain(h[1]).toLowerCase()] || [];
    if (!isRow(line)) continue;
    const [appCell, , codeCell, descCell, , docCell] = cells(line);
    if (!codeCell || appCell === 'app') continue;
    const app = link(appCell);
    const code = link(codeCell).url;
    const gh = code?.match(/^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+)\/?(.*)$/);
    // links into a subfolder (engine collections, monorepos) are not installable as a script on their own
    if (!gh || gh[3]) {
      console.log(`  ~ skipped ${app.text}: code link ${code || '(none)'} is not a repo root`);
      continue;
    }
    const req = requiresByApp.get(app.text) || [];
    rows.push({
      name: gh[2],
      repo: `https://github.com/${gh[1]}/${gh[2]}`,
      description: plain(descCell),
      tags: [...category, ...req],
      requires: req,
      discussion: app.url?.startsWith('https://llllllll.co/') ? app.url : undefined,
      docs: link(docCell || '').url || undefined,
    });
  }
  return rows;
}

// 3. GitHub repositories by topic (needs GITHUB_TOKEN for sane rate limits)
if (want('github')) {
  for (const topic of cfg.githubTopics || []) {
    for (let page = 1; page <= 3; page++) {
      const res = await gh(`/search/repositories?q=topic:${encodeURIComponent(topic)}+fork:false&sort=updated&per_page=100&page=${page}`);
      if (!res.ok) {
        console.warn(`! GitHub search for topic:${topic} returned ${res.status}`);
        break;
      }
      const { items = [] } = await res.json();
      for (const r of items) {
        if (r.archived) continue;
        add({ name: r.name, repo: r.html_url, author: r.owner?.login, description: r.description, tags: r.topics, origin: `github-topic:${topic}` });
      }
      console.log(`· topic:${topic} page ${page}: ${items.length} repos`);
      if (items.length < 100) break;
    }
  }
}

// 4. GitHub keyword search for norns scripts that have no topic. Noisier than topics, so only recently
//    created repos are considered and each must look like a norns script (.lua at the root, or a mod).
if (want('search')) {
  const { queries = [], days = daysArg ?? 30 } = cfg.githubSearch || {};
  for (const q of queries) {
    const res = await gh(`/search/repositories?q=${encodeURIComponent(`${q} fork:false archived:false created:>=${daysAgo(days)}`)}&sort=updated&per_page=100`);
    if (!res.ok) {
      console.warn(`! GitHub search "${q}" returned ${res.status}`);
      continue;
    }
    const { items = [] } = await res.json();
    let n = 0;
    for (const r of items) {
      if (isKnown('norns', r.html_url)) continue;
      if (!(await hasNornsLayout(r.full_name))) continue;
      add({ name: r.name, repo: r.html_url, author: r.owner?.login, description: r.description, tags: r.topics, origin: 'github-search' });
      n++;
    }
    console.log(`· search "${q}": ${items.length} repos, ${n} look like norns scripts`);
  }
}

// 5. lines (llllllll.co) threads, one listing per source (e.g. library/norns, the iii tag). Discourse is a
//    community forum, so stay light: one listing page, only recent topics, one request per topic and a pause
//    between requests. `category` keeps only that category's topics (18 = library), for tag listings.
for (const src of want('lines') ? [cfg.lines || []].flat() : []) {
  const { url, platform = 'norns', category, maxTopics = 30, delayMs = 3000 } = src;
  const days = daysArg ?? src.days ?? 45;
  try {
    const list = JSON.parse(await fetchText(`${url.replace(/\/$/, '')}.json?order=created`));
    const since = daysAgo(days);
    const topics = (list.topic_list?.topics || [])
      .filter((t) => !t.pinned && t.created_at.slice(0, 10) >= since && !knownTopics.has(String(t.id)))
      .filter((t) => category == null || t.category_id === category)
      .slice(0, maxTopics);
    console.log(`· lines ${url}: ${topics.length} recent topics not in the catalog yet`);
    for (const t of topics) {
      await sleep(delayMs);
      const discussion = `https://llllllll.co/t/${t.slug}/${t.id}`;
      let topic;
      try {
        topic = JSON.parse(await fetchText(`https://llllllll.co/t/${t.id}.json`));
      } catch (err) {
        console.warn(`! ${err.message}`);
        continue;
      }
      const post = topic.post_stream?.posts?.[0];
      // repo roots linked from the first post; the poster's own repos first (others are often inspirations or deps)
      const repos = [...new Set([...(post?.cooked || '').matchAll(/href="https:\/\/github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:[/#?][^"]*)?"/g)].map((m) => `${m[1]}/${m[2]}`))]
        .filter((r) => !/^(monome|tehn)\/(norns|dust|maiden)$/i.test(r))
        .sort((a, b) => (b.split('/')[0].toLowerCase() === post?.username?.toLowerCase()) - (a.split('/')[0].toLowerCase() === post?.username?.toLowerCase()))
        .slice(0, 3);
      let found = false;
      for (const slug of repos) {
        if (isKnown(platform, `https://github.com/${slug}`)) {
          found = true; // already listed under another discussion link
          break;
        }
        const r = await gh(`/repos/${slug}`);
        if (!r.ok) continue;
        const info = await r.json();
        // iii scripts are single .lua files too, so a root .lua is a fair sanity check for both
        if (info.fork || info.archived || !(await hasNornsLayout(info.full_name))) continue;
        // "NEVE - generative ambient sequencer" -> description after the separator, else the repo's own
        const fromTitle = topic.title.match(/^[^:–—-]+\s*[:–—-]\s+(.+)$/)?.[1];
        add({
          name: info.name,
          repo: info.html_url,
          author: info.owner?.login,
          description: fromTitle || info.description || topic.title,
          tags: [...(t.tags || []).map((x) => x.name || x), ...(info.topics || [])],
          discussion,
          origin: 'lines',
          platform,
        });
        found = true;
        break;
      }
      if (!found) console.log(`  ~ ${discussion}: no installable GitHub repo linked from the first post`);
    }
  } catch (err) {
    console.warn(`! ${err.message}`);
  }
}

// mods are norns repos with lib/mod.lua and no script at the root (lines lists them in the norns library too, tagged "mods")
for (const [i, data] of added.entries()) {
  const slug = data.platform === 'norns' && githubSlug(data.repo);
  if (slug && (await isModOnly(slug))) added[i] = { name: data.name, platform: data.platform, kind: 'mod', ...data };
}

if (!dryRun) {
  for (const data of added) {
    const dir = path.join(ROOT, ENTRIES_DIR, data.name);
    fs.mkdirSync(dir, { recursive: true });
    // no body: the script page shows the upstream README, and a "claim it" note for imported entries
    fs.writeFileSync(path.join(dir, 'index.md'), stringifyFrontMatter(data));
  }
}
console.log(`${dryRun ? '[dry run] would add' : '✓ added'} ${added.length} new entries.`);
for (const d of added.slice(0, 20)) console.log(`  + ${d.name}${d.kind ? ` [${d.kind}]` : ''}  (${d.origin})`);
if (added.length > 20) console.log(`  … and ${added.length - 20} more`);
