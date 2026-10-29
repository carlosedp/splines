// Fetch GitHub metadata (stars, last push, license, cover image) into .cache/github.json, and each repo's
// README into .cache/readme/<owner>/<repo>.md. Runs in CI before the build with GITHUB_TOKEN.
// The build works without it; cards just show less and script pages have no README.
//
//   node tools/enrich.mjs [--only name1,name2]
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, loadConfig, loadEntries, githubSlug, gh, readJSON, readmeFile } from './lib.mjs';

const args = process.argv.slice(2);
const only = args.includes('--only') ? new Set(args[args.indexOf('--only') + 1].split(',')) : null;

const cacheFile = path.join(ROOT, '.cache', 'github.json');
const cache = readJSON(cacheFile, {});
const maxAgeMs = 20 * 60 * 60 * 1000; // refresh roughly daily
const now = Date.now();

if (!process.env.GITHUB_TOKEN) console.warn('! GITHUB_TOKEN not set: unauthenticated API limit is 60 requests/hour.');

let fetched = 0;
let readmes = 0;
const seen = new Set();
for (const e of loadEntries()) {
  if (only && !only.has(e.slug)) continue;
  const slug = githubSlug(e.data?.repo);
  if (!slug || seen.has(slug)) continue;
  seen.add(slug);
  const hit = cache[slug];
  const fresh = hit && now - (hit.fetchedAt || 0) < maxAgeMs;
  // entries cached before READMEs were fetched get their README on the next run, without waiting for the TTL
  if (fresh && (hit.missing || hit.readmeFetchedAt)) continue;

  let info = hit;
  if (!fresh) {
    const res = await gh(`/repos/${slug}`);
    if (res.status === 403 || res.status === 429) {
      console.warn('! rate limited, stopping early; cached data is kept.');
      break;
    }
    if (!res.ok) {
      cache[slug] = { missing: res.status === 404, fetchedAt: now };
      continue;
    }
    const r = await res.json();
    info = {
      description: r.description || null,
      stars: r.stargazers_count,
      forks: r.forks_count,
      pushedAt: r.pushed_at,
      license: r.license?.spdx_id && r.license.spdx_id !== 'NOASSERTION' ? r.license.spdx_id : null,
      archived: r.archived,
      defaultBranch: r.default_branch,
      topics: r.topics || [],
      fetchedAt: now,
    };
    // Pick up a cover/screenshot image at the repo root, if there is one. Entries can also set `cover:` explicitly.
    const contents = await gh(`/repos/${slug}/contents/`);
    if (contents.ok) {
      const files = await contents.json();
      const cover = files.find((f) => /^(cover|screenshot|norns[-_]?screen)[^/]*\.(png|gif|jpe?g)$/i.test(f.name));
      if (cover) info.cover = `https://raw.githubusercontent.com/${slug}/${info.defaultBranch}/${cover.path}`;
    }
    fetched++;
  }

  // The README is rendered on the script page; its path is kept so relative links can be resolved.
  const readme = await gh(`/repos/${slug}/readme`);
  if (readme.status === 403 || readme.status === 429) {
    cache[slug] = info;
    console.warn('! rate limited, stopping early; cached data is kept.');
    break;
  }
  const file = readmeFile(slug);
  if (readme.ok) {
    const r = await readme.json();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, Buffer.from(r.content, 'base64').toString('utf8'));
    info.readmePath = r.path;
    readmes++;
  } else {
    fs.rmSync(file, { force: true });
    delete info.readmePath;
  }
  info.readmeFetchedAt = now;
  cache[slug] = info;
}

fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 2));
console.log(`✓ enriched ${fetched} repos, ${readmes} READMEs (${Object.keys(cache).length} cached).`);

// Forks: for each repo with forks, the forks someone pushed to after forking, with how many commits they are
// ahead of / behind upstream (compare API). Stored raw in .cache/forks.json; build.mjs decides which count as
// active. Fork lists refresh weekly; a compare only reruns when the fork or upstream got new pushes.
// Stops while some API budget is left, so a big first run spreads over a few days instead of starving the rest.
const forksFile = path.join(ROOT, '.cache', 'forks.json');
const forksCache = readJSON(forksFile, {});
const forksMaxAgeMs = 7 * 24 * 60 * 60 * 1000;
const RESERVE = 200;
const lowOnBudget = (res) => res.status === 403 || res.status === 429 || Number(res.headers.get('x-ratelimit-remaining') ?? Infinity) < RESERVE;
let forkLists = 0;
let compares = 0;
forks: for (const slug of seen) {
  const info = cache[slug];
  if (!info?.forks || info.missing) continue;
  const prev = forksCache[slug];
  if (prev && now - prev.fetchedAt < forksMaxAgeMs && prev.total === info.forks) continue;

  const known = new Map((prev?.forks || []).map((f) => [f.slug, f]));
  const touched = [];
  for (let page = 1; page <= 3; page++) {
    const res = await gh(`/repos/${slug}/forks?sort=newest&per_page=100&page=${page}`);
    if (!res.ok) break;
    const list = await res.json();
    // a fresh fork inherits the parent's pushed_at, so a push after creation means someone worked on it
    touched.push(...list.filter((f) => !f.archived && f.pushed_at > f.created_at));
    if (lowOnBudget(res)) break forks;
    if (list.length < 100) break;
  }
  forkLists++;

  const out = [];
  for (const f of touched) {
    const old = known.get(f.full_name);
    const rec = { slug: f.full_name, branch: f.default_branch, pushedAt: f.pushed_at, stars: f.stargazers_count, upstreamPushedAt: info.pushedAt };
    if (old && old.pushedAt === f.pushed_at && old.upstreamPushedAt === info.pushedAt) {
      out.push({ ...rec, ahead: old.ahead, behind: old.behind });
      continue;
    }
    const base = encodeURIComponent(info.defaultBranch || 'HEAD');
    const res = await gh(`/repos/${slug}/compare/${base}...${f.owner.login}:${f.name}:${encodeURIComponent(f.default_branch)}?per_page=1`);
    compares++;
    if (res.ok) {
      const c = await res.json();
      out.push({ ...rec, ahead: c.ahead_by, behind: c.behind_by });
    } else if (old) out.push(old); // keep what we knew
    if (lowOnBudget(res)) {
      // save what this repo got so far; it's retried in full next run since fetchedAt isn't advanced
      forksCache[slug] = { ...prev, forks: out.concat((prev?.forks || []).filter((p) => !out.some((o) => o.slug === p.slug))) };
      break forks;
    }
  }
  forksCache[slug] = { fetchedAt: now, total: info.forks, forks: out };
}
fs.writeFileSync(forksFile, JSON.stringify(forksCache, null, 2));
console.log(`✓ forks: ${forkLists} fork lists, ${compares} compares (${Object.keys(forksCache).length} repos cached).`);

// Likes: positive reactions on each script's giscus discussion. giscus (mapping "pathname") titles each
// discussion with the page path without the leading slash, e.g. "scripts/NEVE/", which is also our record path.
// GraphQL needs a token; without one the previous cache is kept.
const giscus = loadConfig().giscus || {};
const LIKES = ['THUMBS_UP', 'HEART', 'HOORAY', 'ROCKET'];
if (process.env.GITHUB_TOKEN && giscus.repo && giscus.categoryId) {
  const [owner, name] = giscus.repo.split('/');
  const likes = {};
  let after = null;
  let ok = true;
  do {
    const res = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, 'User-Agent': 'norns-catalog', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `query($owner: String!, $name: String!, $cat: ID!, $after: String) {
          repository(owner: $owner, name: $name) {
            discussions(first: 100, after: $after, categoryId: $cat) {
              pageInfo { hasNextPage endCursor }
              nodes { title comments { totalCount } reactionGroups { content reactors { totalCount } } }
            }
          }
        }`,
        variables: { owner, name, cat: giscus.categoryId, after },
      }),
    });
    const j = res.ok ? await res.json() : null;
    const page = j?.data?.repository?.discussions;
    if (!page) {
      console.warn(`! could not read discussions (${res.status}${j?.errors ? `: ${j.errors[0].message}` : ''}); keeping cached likes.`);
      ok = false;
      break;
    }
    for (const d of page.nodes) {
      const n = d.reactionGroups.filter((g) => LIKES.includes(g.content)).reduce((s, g) => s + g.reactors.totalCount, 0);
      likes[d.title.replace(/^\/+/, '')] = { likes: n, comments: d.comments.totalCount };
    }
    after = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
  } while (after);
  if (ok) {
    fs.writeFileSync(path.join(ROOT, '.cache', 'discussions.json'), JSON.stringify(likes, null, 2));
    console.log(`✓ likes from ${Object.keys(likes).length} discussions.`);
  }
}
