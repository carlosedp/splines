// Client-side behaviour: search, filters, sorting (all over prerendered cards), copy buttons, theme.
(function () {
  "use strict";
  const assets = document.currentScript.src.replace(/[^/]*$/, ""); // the assets/ URL, basePath included

  // ---- theme toggle ----
  const root = document.documentElement;
  document.querySelectorAll(".theme-toggle").forEach((btn) =>
    btn.addEventListener("click", () => {
      const dark = root.dataset.theme
        ? root.dataset.theme === "dark"
        : matchMedia("(prefers-color-scheme: dark)").matches;
      root.dataset.theme = dark ? "light" : "dark";
      try {
        localStorage.setItem("theme", root.dataset.theme);
      } catch (e) {
        /* storage unavailable */
      }
    }),
  );

  // ---- copy buttons ----
  document.querySelectorAll("button.copy").forEach((btn) =>
    btn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(btn.dataset.copy);
        btn.textContent = "copied";
      } catch (e) {
        btn.textContent = "press ctrl+c";
        const code = btn.previousElementSibling;
        const range = document.createRange();
        range.selectNodeContents(code);
        getSelection().removeAllRanges();
        getSelection().addRange(range);
      }
      setTimeout(() => (btn.textContent = "copy"), 1600);
    }),
  );

  // ---- back link: return to the list as it was (filters, scroll) when we came from this site ----
  const back = document.querySelector("a[data-back]");
  let fromHere = false;
  try {
    fromHere =
      !!document.referrer &&
      new URL(document.referrer).origin === location.origin;
  } catch (e) {
    /* bad referrer */
  }
  if (back && fromHere && history.length > 1) {
    back.textContent = "← back";
    back.addEventListener("click", (ev) => {
      ev.preventDefault();
      history.back();
    });
  }

  // ---- forum comments: load Discourse's embed when the section comes near, so its topic is created only then ----
  const comments = document.getElementById("discourse-comments");
  if (comments) {
    const load = () => {
      window.DiscourseEmbed = {
        discourseUrl: comments.dataset.forum,
        discourseEmbedUrl: comments.dataset.embedUrl,
      };
      const s = document.createElement("script");
      s.async = true;
      s.src = comments.dataset.forum + "javascripts/embed.js";
      document.head.appendChild(s);
    };
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver(
        (seen) => {
          if (seen.some((e) => e.isIntersecting)) {
            io.disconnect();
            load();
          }
        },
        { rootMargin: "400px" },
      );
      io.observe(comments);
    } else load();
  }

  // ---- catalog list ----
  const list = document.getElementById("results");
  if (!list) return;

  const cards = Array.from(list.children);
  const q = document.getElementById("q");
  const sort = document.getElementById("sort");
  const countEl = document.getElementById("count");
  const emptyEl = document.getElementById("empty");
  const clearBtn = document.getElementById("clear");
  const qClear = document.getElementById("q-clear");
  const groups = {}; // group name -> Set of selected values
  const PARAM = {
    fav: "fav",
    platform: "platform",
    kind: "kind",
    ai: "ai",
    requires: "req",
    tags: "tag",
    listing: "listing",
  };
  // how values inside one group combine: "any" = OR, "all" = AND
  const MODE = {
    fav: "any",
    platform: "any",
    kind: "any",
    ai: "any",
    requires: "all",
    tags: "all",
    listing: "any",
  };

  // ---- favorites: a star on each card, kept in this browser only (localStorage, keyed by entry name) ----
  // The button is added here, not prerendered, so it never shows without the script that makes it work. The cards
  // admin.js builds for unpublished entries get one too (splinesAddCards below), so admins can star indexed entries.
  const FAV_KEY = "splines-favorites";
  const loadFavs = () => {
    try {
      const v = JSON.parse(localStorage.getItem(FAV_KEY));
      return new Set(Array.isArray(v) ? v.map(String) : []);
    } catch (e) {
      return new Set();
    }
  };
  let favs = loadFavs();
  const saveFavs = () => {
    try {
      localStorage.setItem(FAV_KEY, JSON.stringify([...favs].sort()));
    } catch (e) {
      /* storage unavailable */
    }
  };
  const favBox = document.querySelector('fieldset.chips[data-group="fav"]');
  function markFav(card) {
    const on = favs.has(card.dataset.name);
    card.dataset.fav = on ? "1" : "";
    const b = card.querySelector(".fav-toggle");
    b.textContent = on ? "★" : "☆";
    b.setAttribute("aria-pressed", on ? "true" : "false");
    b.title = on
      ? "Local favorite: saved only in this browser. Click to remove"
      : "Add as a local favorite: saved only in this browser, not shared or synced";
  }
  function addFavButton(card) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "fav-toggle";
    b.setAttribute("aria-label", `favorite ${card.dataset.name}`);
    card.prepend(b);
    markFav(card);
  }

  // ---- quick view: a handle at the bottom right of every card opens a dialog with its details and maiden install line ----
  // Built from the card's data-* attributes and text, through textContent only (admin.js cards carry the same
  // attributes, plus admin-only rows in `card.splinesInfo`).
  const aiLabels = JSON.parse(list.dataset.aiLabels || "{}");
  const https = (u) =>
    typeof u === "string" && /^https:\/\/[^\s]+$/.test(u) ? u : null;
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  // what the script page shows (tools/site/pages/entry.mjs): norns scripts and mods install from maiden, libraries don't
  const installTarget = (d) =>
    d.platform === "norns" && d.kind !== "library"
      ? https(d.install) || https(d.repo)
      : null;
  let dialog = null;
  function showInfo(card) {
    if (!dialog) {
      dialog = el("dialog", "quick-info");
      dialog.addEventListener("click", (ev) => {
        if (ev.target === dialog) dialog.close();
      }); // backdrop
      document.body.append(dialog);
    }
    const d = card.dataset;
    const extra = card.splinesInfo || {};
    const head = el("div", "quick-info-head");
    const close = el("button", "quick-info-close", "×");
    close.type = "button";
    close.setAttribute("aria-label", "Close");
    close.addEventListener("click", () => dialog.close());
    head.append(el("h2", null, d.name), close);
    const text = (sel) => card.querySelector(sel)?.textContent.trim() || "";
    const body = [
      head,
      el("p", "card-author", text(".card-author")),
      el("p", "quick-info-desc", text(".card-desc")),
    ];

    const dl = el("dl");
    const count = (v) => (Number(v) > 0 ? v : "");
    const rows = [
      ...(extra.rows || []),
      ["platform", d.platform],
      ["type", d.kind],
      ["AI", (aiLabels[d.ai] || [d.ai])[0]],
      ["requires", d.requires],
      ["tags", d.tags],
      ["added", d.added],
      ["last push", d.updated],
      ["GitHub stars", count(d.stars)],
      ["likes", count(d.likes)],
      ["active forks", count(d.forks)],
    ];
    for (const [k, v] of rows)
      if (v) dl.append(el("dt", null, k), el("dd", null, v));
    for (const [k, url, label] of [["repo", d.repo], ...(extra.links || [])]) {
      if (!https(url)) continue;
      const a = el("a", null, label || url);
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener";
      const dd = el("dd");
      dd.append(a);
      dl.append(el("dt", null, k), dd);
    }
    body.push(dl);

    const target = installTarget(d);
    if (target) {
      const cmd = `;install ${target}`;
      const code = el("code", "cmd", cmd);
      const copy = el("button", "copy", "copy");
      copy.type = "button";
      copy.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(cmd);
          copy.textContent = "copied";
        } catch (err) {
          copy.textContent = "press ctrl+c";
          const range = document.createRange();
          range.selectNodeContents(code);
          getSelection().removeAllRanges();
          getSelection().addRange(range);
        }
        setTimeout(() => (copy.textContent = "copy"), 1600);
      });
      const row = el("div", "copy-row");
      row.append(code, copy);
      body.push(el("h3", null, "install from maiden"), row);
    }
    const page = card.querySelector("a.card-link[href]");
    if (page) {
      const more = el("a", "quick-info-page", "script page →");
      more.href = page.href;
      body.push(more);
    }
    dialog.replaceChildren(...body);
    dialog.showModal();
  }
  window.splinesShowInfo = showInfo;
  function addQuickButton(card) {
    const installs = !!installTarget(card.dataset);
    // inline SVG rather than a ⤴/⋯ glyph: glyph metrics vary by font, so a character never sits centered in the circle
    const b = el("button", "card-quick");
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 16 16");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute(
      "d",
      installs
        ? "M2.5 12.5H7.5a3 3 0 0 0 3-3V3.5M7.5 6.5l3-3 3 3" // ⤴, its bounding box centered on 8,8
        : "M3 8h.01M8 8h.01M13 8h.01", // ⋯ (round caps make the dots)
    );
    svg.append(path);
    b.append(svg);
    if (!installs) b.classList.add("dots");
    b.type = "button";
    b.title = installs
      ? "Quick view: details and the maiden install line"
      : "Quick view: details";
    b.setAttribute("aria-label", `quick view of ${card.dataset.name}`);
    b.setAttribute("aria-haspopup", "dialog");
    card.append(b);
  }
  const decorate = (card) => {
    addFavButton(card);
    addQuickButton(card);
  };
  cards.forEach(decorate);

  document.querySelectorAll("fieldset.chips[data-group]").forEach((fs) => {
    const g = fs.dataset.group;
    groups[g] = groups[g] || new Set();
    fs.addEventListener("click", (ev) => {
      const chip = ev.target.closest(".chip");
      if (!chip) return;
      const v = chip.dataset.value;
      groups[g].has(v) ? groups[g].delete(v) : groups[g].add(v);
      apply();
    });
  });

  // restore state from the URL so filtered views are shareable
  const params = new URLSearchParams(location.search);
  q.value = params.get("q") || "";
  if (params.get("sort")) sort.value = params.get("sort");
  for (const [g, p] of Object.entries(PARAM)) {
    groups[g] = groups[g] || new Set();
    params.getAll(p).forEach((v) => groups[g].add(v));
  }
  if (groups.tags && groups.tags.size)
    document.querySelector(".tag-panel")?.setAttribute("open", "");

  const dataSet = (card, key) =>
    card.dataset[key] ? card.dataset[key].split(" ") : [];
  const field = {
    fav: "fav",
    platform: "platform",
    kind: "kind",
    ai: "ai",
    requires: "requires",
    tags: "tags",
    listing: "listing",
  };

  function matches(card, terms) {
    for (const [g, sel] of Object.entries(groups)) {
      if (!sel.size) continue;
      const values = dataSet(card, field[g]);
      const ok =
        MODE[g] === "all"
          ? [...sel].every((v) => values.includes(v))
          : values.some((v) => sel.has(v));
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
    updated: (a, b) =>
      (b.dataset.updated || "").localeCompare(a.dataset.updated || "") ||
      sorters.name(a, b),
    added: (a, b) =>
      (b.dataset.added || "").localeCompare(a.dataset.added || "") ||
      sorters.name(a, b),
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
      favBox.querySelector(".count").textContent = n;
      favBox.hidden = n === 0 && !groups.fav.size; // nothing to show until something is starred
    }
    emptyEl.hidden = shown > 0;

    document.querySelectorAll("fieldset.chips[data-group]").forEach((fs) => {
      const sel = groups[fs.dataset.group];
      fs.querySelectorAll(".chip").forEach((chip) =>
        chip.setAttribute(
          "aria-pressed",
          sel.has(chip.dataset.value) ? "true" : "false",
        ),
      );
    });

    const p = new URLSearchParams();
    if (q.value.trim()) p.set("q", q.value.trim());
    if (sort.value !== "name") p.set("sort", sort.value);
    for (const [g, name] of Object.entries(PARAM))
      (groups[g] || []).forEach((v) => p.append(name, v));
    const active = [...p.keys()].some((k) => k !== "sort");
    clearBtn.hidden = !active;
    qClear.hidden = !q.value;
    const qs = p.toString();
    history.replaceState(null, "", qs ? `?${qs}` : location.pathname);
  }

  list.addEventListener("click", (ev) => {
    const b = ev.target.closest(".card-quick");
    if (b) showInfo(b.closest(".card"));
  });
  list.addEventListener("click", (ev) => {
    const b = ev.target.closest(".fav-toggle");
    if (!b) return;
    const card = b.closest(".card");
    const name = card.dataset.name;
    favs.has(name) ? favs.delete(name) : favs.add(name);
    saveFavs();
    markFav(card);
    apply();
  });
  // the whole card opens the script page (its title stays the real link, for keyboard and screen readers);
  // ctrl/cmd/shift-click and middle-click open a new tab like a link would. admin.js cards open their own dialog.
  function openCard(ev) {
    if (
      ev.defaultPrevented ||
      ev.target.closest("a, button") ||
      getSelection().toString()
    )
      return;
    const link = ev.target.closest(".card")?.querySelector("a.card-link[href]");
    if (!link) return;
    if (ev.button === 1 || ev.ctrlKey || ev.metaKey || ev.shiftKey)
      window.open(link.href, "_blank", "noopener");
    else if (ev.button === 0) location.href = link.href;
  }
  list.addEventListener("click", openCard);
  list.addEventListener("auxclick", openCard);

  // starred in another tab
  addEventListener("storage", (ev) => {
    if (ev.key !== FAV_KEY) return;
    favs = loadFavs();
    cards.forEach(markFav);
    apply();
  });

  // in-page tag links filter instead of navigating
  list.addEventListener("click", (ev) => {
    const a = ev.target.closest("a.tag");
    if (!a) return;
    ev.preventDefault();
    const tag = new URL(a.href).searchParams.get("tag");
    groups.tags.add(tag);
    document.querySelector(".tag-panel")?.setAttribute("open", "");
    apply();
    window.scrollTo({
      top: document.querySelector(".controls").offsetTop - 8,
      behavior: "smooth",
    });
  });

  let t;
  q.addEventListener("input", () => {
    qClear.hidden = !q.value;
    clearTimeout(t);
    t = setTimeout(apply, 80);
  });
  const clearSearch = () => {
    q.value = "";
    apply();
    q.focus();
  };
  qClear.addEventListener("click", clearSearch);
  q.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && q.value) {
      ev.preventDefault();
      clearSearch();
    }
  });
  sort.addEventListener("change", apply);
  clearBtn.addEventListener("click", () => {
    q.value = "";
    Object.values(groups).forEach((s) => s.clear());
    apply();
  });
  document.addEventListener("keydown", (ev) => {
    if (
      ev.key === "/" &&
      document.activeElement !== q &&
      !/input|textarea|select/i.test(document.activeElement.tagName)
    ) {
      ev.preventDefault();
      q.focus();
    }
  });

  apply();

  // ---- admin view: admin.js adds cards for unpublished entries (only loaded once someone signed in on /admin/) ----
  window.splinesAddCards = (nodes) => {
    nodes.forEach((n) => {
      decorate(n);
      list.appendChild(n);
    });
    cards.push(...nodes);
    apply();
  };
  let signedIn = null;
  try {
    signedIn = localStorage.getItem("splines-admin-token");
  } catch (e) {
    /* storage unavailable */
  }
  if (signedIn) {
    const s = document.createElement("script");
    s.src = assets + "admin.js";
    document.body.appendChild(s);
  }
})();
