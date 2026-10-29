// HTML templating without a template engine: the `html` tag escapes every interpolated value unless it is
// already safe (the result of another `html` template, `raw()` or `join()`). Arrays are rendered item by item;
// null, undefined and false render as nothing, so `${cond && html`...`}` works.
//
//   html`<a href="${url}">${name}</a>`        url and name are escaped
//   html`<ul>${items.map((i) => html`<li>${i}</li>`)}</ul>`
//   raw(markdownOutput)                        trusted HTML, e.g. from the sanitizing markdown renderer

class Safe {
  constructor(s) {
    this.s = s;
  }
  toString() {
    return this.s;
  }
}

export const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );

const render = (v) =>
  v instanceof Safe
    ? v.s
    : Array.isArray(v)
      ? v.map(render).join("")
      : v == null || v === false
        ? ""
        : esc(v);

export const html = (strings, ...values) =>
  new Safe(strings.reduce((out, s, i) => out + render(values[i - 1]) + s));

/** Mark a string as trusted HTML. Only for output that is already escaped or sanitized. */
export const raw = (s) => new Safe(String(s ?? ""));

/** Render items (escaping plain strings) and join them with a separator. */
export const join = (items, sep = "") => new Safe(items.map(render).join(sep));

/** Links: http(s), mailto, anchors and relative paths pass; any other scheme (javascript:, data:) becomes "#". */
export const safeUrl = (u) =>
  /^(https?:|mailto:|#|\/|\.\.?\/)/i.test(u || "") || !/^[a-z]+:/i.test(u || "") ? u : "#";
