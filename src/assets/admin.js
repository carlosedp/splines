// Admin view. On /admin/: sign in with a GitHub token (kept in localStorage) and check the user can write to the
// catalog repo. On the catalog page (app.js loads this file only when a token is stored): read every
// scripts/*/index.md through the GitHub API, build cards for the entries that aren't published, hand them to app.js,
// and show the listing filter. Entry data is untrusted: it only reaches the page through textContent, attributes
// and https-checked links.
(function () {
  'use strict';

  const KEY = 'splines-admin-token';
  const MEMO = 'splines-admin-entries';
  const store = {
    get: () => { try { return localStorage.getItem(KEY); } catch (e) { return null; } },
    set: (v) => {
      try {
        v ? localStorage.setItem(KEY, v) : localStorage.removeItem(KEY);
        sessionStorage.removeItem(MEMO);
      } catch (e) { /* storage unavailable */ }
    },
  };
  // the unpublished entries last fetched in this tab, reused for 10 minutes
  const memo = {
    get: () => {
      try {
        const m = JSON.parse(sessionStorage.getItem(MEMO));
        return m && Date.now() - m.at < 10 * 60e3 ? m : null;
      } catch (e) { return null; }
    },
    set: (m) => { try { sessionStorage.setItem(MEMO, JSON.stringify({ ...m, at: Date.now() })); } catch (e) { /* storage unavailable */ } },
  };

  // the token can't be used for the admin view (any other error, like a network one, keeps it)
  class AccessError extends Error {}

  async function graphql(token, query, variables, { partial = false } = {}) {
    const res = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    });
    if (res.status === 401) throw new AccessError('GitHub rejected the token (expired or revoked?)');
    const json = await res.json();
    // partial: a missing repo is an error for its alias only; keep the rest
    if (json.errors && !(partial && json.data)) throw new Error(json.errors[0].message);
    return json.data;
  }

  /** The signed-in login, or an error when the token can't write to the repo. */
  async function check(token, owner, name) {
    const who = await graphql(token, 'query($o:String!,$n:String!){viewer{login} repository(owner:$o,name:$n){viewerPermission}}', { o: owner, n: name });
    if (!['ADMIN', 'MAINTAIN', 'WRITE'].includes(who.repository?.viewerPermission)) {
      throw new AccessError(`${who.viewer.login} doesn't have write access to ${owner}/${name}`);
    }
    return who.viewer.login;
  }

  // Many aliased fields per query: one query for every file times out on GitHub's side.
  async function batched(items, size, run) {
    const out = [];
    for (let i = 0; i < items.length; i += size) out.push(run(items.slice(i, i + size)));
    return (await Promise.all(out)).flat();
  }

  // Top-level fields of an entry's front matter: scalars, plus lists in block (- a) or flow ([a, b]) style.
  function frontMatter(text) {
    const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    const data = {};
    if (!m) return data;
    const scalar = (v) => {
      v = v.trim();
      if (v.startsWith('"')) { try { return JSON.parse(v); } catch (e) { return v.slice(1, -1); } }
      if (v.startsWith("'")) return v.slice(1, -1).replace(/''/g, "'");
      return v.replace(/\s+#.*$/, '');
    };
    let list = null;
    for (const line of m[1].split(/\r?\n/)) {
      const item = line.match(/^\s+-\s+(.*)$/);
      if (item && list) { list.push(scalar(item[1])); continue; }
      const kv = line.match(/^([A-Za-z_]+):\s*(.*)$/);
      list = null;
      if (!kv) continue;
      const v = kv[2].replace(/\s+#.*$/, '').trim();
      if (!v) data[kv[1]] = list = [];
      else if (v.startsWith('[')) data[kv[1]] = v.slice(1, -1).split(',').map(scalar).filter(Boolean);
      else data[kv[1]] = scalar(kv[2]);
    }
    return data;
  }

  const https = (u) => (typeof u === 'string' && /^https:\/\/[^\s]+$/.test(u) ? u : null);
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const arr = (v) => (Array.isArray(v) ? v.map(String) : []);

  /** The same card as card() in tools/site/components.mjs, for an entry without a page: it links to its repo. */
  function card(e, aiLabels) {
    const li = el('li', 'card');
    const tags = arr(e.tags);
    const requires = arr(e.requires);
    Object.assign(li.dataset, {
      listing: e.listing,
      platform: e.platform || 'norns',
      kind: e.kind || 'script',
      ai: e.ai || 'unknown',
      tags: tags.join(' '),
      requires: requires.join(' '),
      name: e.name || e.slug,
      stars: e.stars ?? 0,
      likes: 0,
      forks: 0,
      updated: e.updated || '',
      added: e.added || '',
      search: [e.name, e.author, e.description, ...tags, ...requires].join(' ').toLowerCase(),
    });
    const link = el('a', 'card-link');
    if (https(e.repo)) link.href = e.repo;
    const title = el('span', 'card-title', e.name || e.slug);
    title.append(' ', Object.assign(el('span', 'badge listing', e.listing), { title: `${e.listing}: not on the public site` }));
    link.append(title, el('span', 'card-author', `by ${e.author || '?'}`));
    const meta = el('div', 'card-meta');
    const ai = aiLabels[li.dataset.ai] || [li.dataset.ai, ''];
    meta.append(Object.assign(el('span', `badge ai ai-${li.dataset.ai}`, ai[0]), { title: ai[1] }));
    if (li.dataset.platform !== 'norns') meta.append(el('span', 'badge kind', li.dataset.platform));
    if (li.dataset.kind !== 'script') meta.append(el('span', 'badge kind', li.dataset.kind));
    for (const q of requires) meta.append(el('span', 'badge req', q));
    if (e.stars != null) meta.append(Object.assign(el('span', 'stat', `★ ${e.stars}`), { title: 'GitHub stars' }));
    if (e.updated) meta.append(Object.assign(el('span', 'stat', e.updated), { title: 'Last push' }));
    if (https(e.invited)) {
      const a = el('a', 'stat', 'invited');
      a.href = e.invited;
      a.title = 'The opt-in invitation issue';
      meta.append(a);
    }
    meta.append(el('span', 'stat', e.origin || ''));
    const tagBox = el('div', 'card-tags');
    for (const t of tags.filter((t) => !requires.includes(t))) {
      const a = el('a', 'tag', t);
      a.href = `?tag=${encodeURIComponent(t)}`;
      tagBox.append(a);
    }
    li.append(link, el('p', 'card-desc', e.description || ''), meta, tagBox);
    return li;
  }

  async function showAll(list) {
    const token = store.get();
    const [owner, name] = list.dataset.repo.split('/');
    const branch = list.dataset.branch;
    const status = document.querySelector('.controls .status');
    const note = el('span', 'admin-note', ' · admin: loading unpublished entries…');
    status.append(note);
    try {
      // published entries are already on the page. Skip them by name too, not only by listing: GitHub's copy can be
      // behind this build (a listing changed but not yet on the branch), and a script must never show twice.
      const shown = new Set(Array.from(list.children, (c) => c.dataset.name.toLowerCase()));
      // GitHub's copy is fetched once per tab every 10 minutes (about nine queries); later pages use the cached one
      let { login, hidden } = memo.get() || {};
      if (!hidden) {
        login = await check(token, owner, name);
        hidden = await unpublished(token, owner, name, branch, shown);
        memo.set({ login, hidden });
      }
      hidden = hidden.filter((e) => !shown.has(e.slug.toLowerCase()));
      const aiLabels = JSON.parse(list.dataset.aiLabels || '{}');
      window.splinesAddCards(hidden.map((e) => card(e, aiLabels)));

      const chips = document.querySelector('fieldset[data-group="listing"]');
      chips.hidden = false;
      // counted from the cards, so they match what the filter shows
      chips.querySelectorAll('.chip').forEach((c) => {
        c.querySelector('.count').textContent = list.querySelectorAll(`.card[data-listing="${c.dataset.value}"]`).length;
      });
      // "admin (login)" links to the sign-in page; "sign out" works right here
      const who = el('a', null, login);
      who.href = list.dataset.admin;
      who.title = 'Admin sign-in page';
      const out = el('button', 'link-button', 'sign out');
      out.type = 'button';
      out.addEventListener('click', () => {
        store.set(null);
        location.reload();
      });
      note.replaceChildren(' · admin (', who, `): ${hidden.length} unpublished entries included · `, out);
    } catch (err) {
      // an expired or revoked token, or lost write access: forget it, so the next page is the public view again
      if (err instanceof AccessError) store.set(null);
      const again = el('a', null, 'sign in again');
      again.href = list.dataset.admin;
      note.replaceChildren(` · admin: ${err.message}. `, ...(err instanceof AccessError ? [again] : []));
    }
  }

  /** Every entry on the branch that isn't published, with stars and last push for sorting. */
  async function unpublished(token, owner, name, branch, skip) {
    const tree = await graphql(token, 'query($o:String!,$n:String!,$e:String!){repository(owner:$o,name:$n){object(expression:$e){... on Tree{entries{name type}}}}}', { o: owner, n: name, e: `${branch}:scripts` });
    const slugs = (tree.repository.object?.entries || []).filter((d) => d.type === 'tree').map((d) => d.name);
    const entries = await batched(slugs, 100, async (batch) => {
      const fields = batch.map((s, i) => `e${i}:object(expression:${JSON.stringify(`${branch}:scripts/${s}/index.md`)}){... on Blob{text}}`).join(' ');
      const data = await graphql(token, `query($o:String!,$n:String!){repository(owner:$o,name:$n){${fields}}}`, { o: owner, n: name });
      return batch.map((s, i) => {
        const d = frontMatter(data.repository[`e${i}`]?.text || '');
        return { slug: s, ...d, listing: d.listing || 'indexed' };
      });
    });
    const hidden = entries.filter((e) => e.listing !== 'published' && !skip.has(e.slug.toLowerCase()));
    // stars and last push for sorting, like the enrich cache gives published cards
    const onGitHub = hidden.map((e) => [e, String(e.repo || '').match(/^https:\/\/github\.com\/([^/]+)\/([^/#?]+)/)]).filter(([, m]) => m);
    await batched(onGitHub, 100, async (batch) => {
      const fields = batch.map(([, m], i) => `r${i}:repository(owner:${JSON.stringify(m[1])},name:${JSON.stringify(m[2].replace(/\.git$/, ''))}){stargazerCount pushedAt}`).join(' ');
      const data = await graphql(token, `{${fields}}`, {}, { partial: true });
      batch.forEach(([e], i) => {
        const r = data[`r${i}`];
        if (r) Object.assign(e, { stars: r.stargazerCount, updated: r.pushedAt?.slice(0, 10) });
      });
      return [];
    });
    return hidden;
  }

  function signInPage(root) {
    const [owner, name] = root.dataset.repo.split('/');
    const form = root.querySelector('.admin-signin');
    const status = root.querySelector('.admin-status');
    const actions = root.querySelector('.admin-actions');
    async function signIn(token) {
      form.hidden = true;
      status.textContent = 'checking your access…';
      try {
        const login = await check(token, owner, name);
        store.set(token);
        status.textContent = `Signed in as ${login}. The catalog page now shows every entry, with a listing filter.`;
        actions.hidden = false;
      } catch (err) {
        store.set(null);
        status.textContent = `Couldn't sign in: ${err.message}.`;
        form.hidden = false;
      }
    }
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const token = form.querySelector('input').value.trim();
      if (token) signIn(token);
    });
    root.querySelector('.admin-signout').addEventListener('click', () => {
      store.set(null);
      actions.hidden = true;
      status.textContent = 'Signed out.';
      form.hidden = false;
    });
    const saved = store.get();
    if (saved) signIn(saved);
    else form.hidden = false;
  }

  const root = document.getElementById('admin');
  const list = document.getElementById('results');
  if (root) signInPage(root);
  else if (list && store.get() && window.splinesAddCards) showAll(list);
})();
