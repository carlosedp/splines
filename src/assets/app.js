// Client-side behaviour: search, filters, sorting (all over prerendered cards), copy buttons, theme.
(function () {
  'use strict';
  const assets = document.currentScript.src.replace(/[^/]*$/, ''); // the assets/ URL, basePath included

  // ---- theme toggle ----
  const root = document.documentElement;
  document.querySelectorAll('.theme-toggle').forEach((btn) =>
    btn.addEventListener('click', () => {
      const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
      root.dataset.theme = dark ? 'light' : 'dark';
      try { localStorage.setItem('theme', root.dataset.theme); } catch (e) { /* storage unavailable */ }
    }),
  );

  // ---- copy buttons ----
  document.querySelectorAll('button.copy').forEach((btn) =>
    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(btn.dataset.copy);
        btn.textContent = 'copied';
      } catch (e) {
        btn.textContent = 'press ctrl+c';
        const code = btn.previousElementSibling;
        const range = document.createRange();
        range.selectNodeContents(code);
        getSelection().removeAllRanges();
        getSelection().addRange(range);
      }
      setTimeout(() => (btn.textContent = 'copy'), 1600);
    }),
  );

  // ---- back link: return to the list as it was (filters, scroll) when we came from this site ----
  const back = document.querySelector('a[data-back]');
  let fromHere = false;
  try { fromHere = !!document.referrer && new URL(document.referrer).origin === location.origin; } catch (e) { /* bad referrer */ }
  if (back && fromHere && history.length > 1) {
    back.textContent = '← back';
    back.addEventListener('click', (ev) => {
      ev.preventDefault();
      history.back();
    });
  }

  // ---- forum comments: load Discourse's embed when the section comes near, so its topic is created only then ----
  const comments = document.getElementById('discourse-comments');
  if (comments) {
    const load = () => {
      window.DiscourseEmbed = { discourseUrl: comments.dataset.forum, discourseEmbedUrl: comments.dataset.embedUrl };
      const s = document.createElement('script');
      s.async = true;
      s.src = comments.dataset.forum + 'javascripts/embed.js';
      document.head.appendChild(s);
    };
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((seen) => {
        if (seen.some((e) => e.isIntersecting)) {
          io.disconnect();
          load();
        }
      }, { rootMargin: '400px' });
      io.observe(comments);
    } else load();
  }

  // ---- catalog list ----
  const list = document.getElementById('results');
  if (!list) return;

  const cards = Array.from(list.children);
  const q = document.getElementById('q');
  const sort = document.getElementById('sort');
  const countEl = document.getElementById('count');
  const emptyEl = document.getElementById('empty');
  const clearBtn = document.getElementById('clear');
  const qClear = document.getElementById('q-clear');
  const groups = {}; // group name -> Set of selected values
  const PARAM = { fav: 'fav', platform: 'platform', kind: 'kind', ai: 'ai', requires: 'req', tags: 'tag', listing: 'listing' };
  // how values inside one group combine: "any" = OR, "all" = AND
  const MODE = { fav: 'any', platform: 'any', kind: 'any', ai: 'any', requires: 'all', tags: 'all', listing: 'any' };

  // ---- favorites: a star on each card, kept in this browser only (localStorage, keyed by entry name) ----
  // The button is added here, not prerendered, so it never shows without the script that makes it work. The cards
  // admin.js builds for unpublished entries get one too (splinesAddCards below), so admins can star indexed entries.
  const FAV_KEY = 'splines-favorites';
  const loadFavs = () => {
    try {
      const v = JSON.parse(localStorage.getItem(FAV_KEY));
      return new Set(Array.isArray(v) ? v.map(String) : []);
    } catch (e) { return new Set(); }
  };
  let favs = loadFavs();
  const saveFavs = () => {
    try { localStorage.setItem(FAV_KEY, JSON.stringify([...favs].sort())); } catch (e) { /* storage unavailable */ }
  };
  const favBox = document.querySelector('fieldset.chips[data-group="fav"]');
  function markFav(card) {
    const on = favs.has(card.dataset.name);
    card.dataset.fav = on ? '1' : '';
    const b = card.querySelector('.fav-toggle');
    b.textContent = on ? '★' : '☆';
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    b.title = on
      ? 'Local favorite: saved only in this browser. Click to remove'
      : 'Add as a local favorite: saved only in this browser, not shared or synced';
  }
  function addFavButton(card) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'fav-toggle';
    b.setAttribute('aria-label', `favorite ${card.dataset.name}`);
    card.prepend(b);
    markFav(card);
  }
  cards.forEach(addFavButton);

  document.querySelectorAll('fieldset.chips[data-group]').forEach((fs) => {
    const g = fs.dataset.group;
    groups[g] = groups[g] || new Set();
    fs.addEventListener('click', (ev) => {
      const chip = ev.target.closest('.chip');
      if (!chip) return;
      const v = chip.dataset.value;
      groups[g].has(v) ? groups[g].delete(v) : groups[g].add(v);
      apply();
    });
  });

  // restore state from the URL so filtered views are shareable
  const params = new URLSearchParams(location.search);
  q.value = params.get('q') || '';
  if (params.get('sort')) sort.value = params.get('sort');
  for (const [g, p] of Object.entries(PARAM)) {
    groups[g] = groups[g] || new Set();
    params.getAll(p).forEach((v) => groups[g].add(v));
  }
  if (groups.tags && groups.tags.size) document.querySelector('.tag-panel')?.setAttribute('open', '');

  const dataSet = (card, key) => (card.dataset[key] ? card.dataset[key].split(' ') : []);
  const field = { fav: 'fav', platform: 'platform', kind: 'kind', ai: 'ai', requires: 'requires', tags: 'tags', listing: 'listing' };

  function matches(card, terms) {
    for (const [g, sel] of Object.entries(groups)) {
      if (!sel.size) continue;
      const values = dataSet(card, field[g]);
      const ok = MODE[g] === 'all' ? [...sel].every((v) => values.includes(v)) : values.some((v) => sel.has(v));
      if (!ok) return false;
    }
    const hay = card.dataset.search;
    return terms.every((t) => hay.includes(t));
  }

  const sorters = {
    name: (a, b) => a.dataset.name.localeCompare(b.dataset.name),
    stars: (a, b) => b.dataset.stars - a.dataset.stars || sorters.name(a, b),
    likes: (a, b) => b.dataset.likes - a.dataset.likes || sorters.stars(a, b),
    forks: (a, b) => b.dataset.forks - a.dataset.forks || sorters.stars(a, b),
    updated: (a, b) => (b.dataset.updated || '').localeCompare(a.dataset.updated || '') || sorters.name(a, b),
    added: (a, b) => (b.dataset.added || '').localeCompare(a.dataset.added || '') || sorters.name(a, b),
  };

  function apply() {
    const terms = q.value.toLowerCase().split(/\s+/).filter(Boolean);
    let shown = 0;
    const sorted = cards.slice().sort(sorters[sort.value] || sorters.name);
    const frag = document.createDocumentFragment();
    for (const c of sorted) {
      const ok = matches(c, terms);
      c.hidden = !ok;
      if (ok) shown++;
      frag.appendChild(c);
    }
    list.appendChild(frag);

    countEl.textContent = shown;
    if (favBox) {
      const n = cards.filter((c) => c.dataset.fav).length;
      favBox.querySelector('.count').textContent = n;
      favBox.hidden = n === 0 && !groups.fav.size; // nothing to show until something is starred
    }
    emptyEl.hidden = shown > 0;

    document.querySelectorAll('fieldset.chips[data-group]').forEach((fs) => {
      const sel = groups[fs.dataset.group];
      fs.querySelectorAll('.chip').forEach((chip) => chip.setAttribute('aria-pressed', sel.has(chip.dataset.value) ? 'true' : 'false'));
    });

    const p = new URLSearchParams();
    if (q.value.trim()) p.set('q', q.value.trim());
    if (sort.value !== 'name') p.set('sort', sort.value);
    for (const [g, name] of Object.entries(PARAM)) (groups[g] || []).forEach((v) => p.append(name, v));
    const active = [...p.keys()].some((k) => k !== 'sort');
    clearBtn.hidden = !active;
    qClear.hidden = !q.value;
    const qs = p.toString();
    history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
  }

  list.addEventListener('click', (ev) => {
    const b = ev.target.closest('.fav-toggle');
    if (!b) return;
    const card = b.closest('.card');
    const name = card.dataset.name;
    favs.has(name) ? favs.delete(name) : favs.add(name);
    saveFavs();
    markFav(card);
    apply();
  });
  // starred in another tab
  addEventListener('storage', (ev) => {
    if (ev.key !== FAV_KEY) return;
    favs = loadFavs();
    cards.forEach(markFav);
    apply();
  });

  // in-page tag links filter instead of navigating
  list.addEventListener('click', (ev) => {
    const a = ev.target.closest('a.tag');
    if (!a) return;
    ev.preventDefault();
    const tag = new URL(a.href).searchParams.get('tag');
    groups.tags.add(tag);
    document.querySelector('.tag-panel')?.setAttribute('open', '');
    apply();
    window.scrollTo({ top: document.querySelector('.controls').offsetTop - 8, behavior: 'smooth' });
  });

  let t;
  q.addEventListener('input', () => {
    qClear.hidden = !q.value;
    clearTimeout(t);
    t = setTimeout(apply, 80);
  });
  const clearSearch = () => {
    q.value = '';
    apply();
    q.focus();
  };
  qClear.addEventListener('click', clearSearch);
  q.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && q.value) {
      ev.preventDefault();
      clearSearch();
    }
  });
  sort.addEventListener('change', apply);
  clearBtn.addEventListener('click', () => {
    q.value = '';
    Object.values(groups).forEach((s) => s.clear());
    apply();
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.key === '/' && document.activeElement !== q && !/input|textarea|select/i.test(document.activeElement.tagName)) {
      ev.preventDefault();
      q.focus();
    }
  });

  apply();

  // ---- admin view: admin.js adds cards for unpublished entries (only loaded once someone signed in on /admin/) ----
  window.splinesAddCards = (nodes) => {
    nodes.forEach((n) => {
      addFavButton(n);
      list.appendChild(n);
    });
    cards.push(...nodes);
    apply();
  };
  let signedIn = null;
  try { signedIn = localStorage.getItem('splines-admin-token'); } catch (e) { /* storage unavailable */ }
  if (signedIn) {
    const s = document.createElement('script');
    s.src = assets + 'admin.js';
    document.body.appendChild(s);
  }
})();
