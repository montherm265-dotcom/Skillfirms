// Four languages: English, Spanish, French and Arabic (right to left).
//
// The site is written in English. For Spanish, French and Arabic the page's
// text is swapped for the translation as it appears, from a dictionary built
// from the site's own text (scripts/i18n-extract.mjs, scripts/i18n-build.mjs).
// People's own words (posts, jobs, profiles) stay as they wrote them.
// English visitors never load any of this.
//
// A run of text between two elements is translated as one piece, so
// "You keep {0}% of net revenue" reads naturally even though the number is
// a separate piece of text. React still owns every text node: we only change
// their values, never add or remove nodes.

import { useEffect, useState } from "react";

export const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "es", name: "Español" },
  { code: "fr", name: "Français" },
  { code: "ar", name: "العربية", rtl: true },
];
const CODES = LANGUAGES.map((l) => l.code);
const KEY = "lang";

export function currentLang() {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved && CODES.includes(saved)) return saved;
  } catch { /* storage blocked */ }
  const nav = (navigator.languages?.[0] ?? navigator.language ?? "en").slice(0, 2).toLowerCase();
  return CODES.includes(nav) ? nav : "en";
}

export function setLang(code) {
  try { localStorage.setItem(KEY, code); } catch { /* storage blocked */ }
  location.reload();
}

const SKIP = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "INPUT", "SELECT", "OPTION", "CODE", "PRE", "SVG", "svg", "TEMPLATE", "IFRAME", "CANVAS", "VIDEO", "AUDIO"]);
const ATTRS = ["placeholder", "title", "aria-label", "alt"];
const norm = (s) => s.replace(/\s+/g, " ").trim();
const NUM = /\d+(?:[.,]\d+)*/g;

let dict = null;           // english pattern -> translation
let fragments = null;      // static pieces of patterns ("You keep ", "% of net revenue")
const applied = new WeakMap(); // text node -> value we wrote
const original = new WeakMap(); // text node -> the English it held
const attrApplied = new WeakMap(); // element -> { attr: value we wrote }

function fill(t, values) {
  return t.replace(/\{(\d+)\}/g, (m, i) => (values[Number(i)] ?? m));
}

// Exact match, then numbers as placeholders ("12 jobs" -> "{0} jobs").
function lookup(text) {
  const n = norm(text);
  if (!n || !/\p{L}/u.test(n)) return null;
  if (dict.has(n)) return dict.get(n);
  const values = [];
  const pattern = n.replace(NUM, (m) => `{${values.push(m) - 1}}`);
  if (values.length && dict.has(pattern)) return fill(dict.get(pattern), values);
  return matchPattern(n);
}

// Sentences with a name or word in them ("Welcome back, {0}"): try the
// patterns whose fixed words all appear in the text. Misses are remembered.
let patterns = null;
const misses = new Set();
function matchPattern(n) {
  if (misses.has(n)) return null;
  if (!patterns) {
    patterns = [];
    for (const [k, v] of dict) {
      if (!/\{\d+\}/.test(k) || /\}\s*\{/.test(k)) continue;
      const parts = k.split(/\{\d+\}/);
      const longest = parts.reduce((a, b) => (b.trim().length > a.length ? b.trim() : a), "");
      if (longest.length < 4) continue;
      const order = [...k.matchAll(/\{(\d+)\}/g)].map((m) => Number(m[1]));
      const re = new RegExp("^" + parts.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("(.+?)") + "$");
      patterns.push({ longest, re, order, v });
    }
  }
  for (const p of patterns) {
    if (!n.includes(p.longest)) continue;
    const m = n.match(p.re);
    if (!m) continue;
    const values = [];
    p.order.forEach((idx, i) => { values[idx] = m[i + 1]; });
    return fill(p.v, values);
  }
  if (misses.size > 5000) misses.clear();
  misses.add(n);
  return null;
}

function translateRun(nodes) {
  // A node we already translated still means its English original, unless
  // React has since given it a new value.
  const texts = nodes.map((n) => (applied.has(n) && applied.get(n) === n.nodeValue ? original.get(n) : n.nodeValue));
  const whole = texts.join("");
  if (!/\p{L}/u.test(whole)) return;
  const lead = whole.match(/^\s*/)[0];
  const trail = whole.match(/\s*$/)[0];
  let out = lookup(whole);
  if (out == null && nodes.length > 1) {
    // Pieces that aren't part of any known sentence are values ({0}, {1}...).
    const values = [];
    const key = texts.map((t) => (!t.trim() || fragments.has(norm(t)) ? t : `{${values.push(norm(t)) - 1}}`)).join("");
    const k = norm(key);
    if (values.length && dict.has(k)) out = fill(dict.get(k), values);
  }
  if (out == null) {
    // Nothing matches any more: put the English back rather than leave blanks.
    nodes.forEach((n, i) => { if (applied.has(n)) { applied.delete(n); if (n.nodeValue !== texts[i]) n.nodeValue = texts[i]; } });
    return;
  }
  const fi = texts.findIndex((t) => t.trim());
  const first = nodes[fi < 0 ? 0 : fi];
  nodes.forEach((n, i) => original.set(n, texts[i]));
  for (const n of nodes) {
    const v = n === first ? lead + out + trail : "";
    if (n.nodeValue !== v) n.nodeValue = v;
    applied.set(n, v);
  }
}

function translateElement(el) {
  if (!el || el.closest?.("[data-no-translate],[contenteditable='true']")) return;
  if (SKIP.has(el.nodeName)) { if (el.nodeName === "INPUT" || el.nodeName === "TEXTAREA") translateAttrs(el); return; }
  let run = [];
  const flush = () => { if (run.length) translateRun(run); run = []; };
  for (const c of el.childNodes) {
    if (c.nodeType === 3) run.push(c);
    else { flush(); if (c.nodeType === 1) translateElement(c); }
  }
  flush();
  translateAttrs(el);
}

function translateAttrs(el) {
  if (!el.getAttribute) return;
  for (const a of ATTRS) {
    const v = el.getAttribute(a);
    if (!v) continue;
    const mine = attrApplied.get(el);
    if (mine?.[a] === v) continue;
    const t = lookup(v);
    if (t != null) {
      attrApplied.set(el, { ...(mine ?? {}), [a]: t });
      el.setAttribute(a, t);
    }
  }
}

const pending = new Set();
let scheduled = false;
function schedule(el) {
  if (!el) return;
  pending.add(el);
  if (!scheduled) {
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      const els = [...pending];
      pending.clear();
      for (const e of els) if (e.isConnected) translateElement(e);
    });
  }
}

function translateTitle() {
  const t = lookup(document.title.replace(/ [|·–—-] (Talfirms|Skillfirms)$/, ""));
  if (t) {
    const suffix = document.title.match(/ [|·–—-] (Talfirms|Skillfirms)$/)?.[0] ?? "";
    if (document.title !== t + suffix) document.title = t + suffix;
  }
}

export async function startI18n() {
  const lang = currentLang();
  const meta = LANGUAGES.find((l) => l.code === lang);
  document.documentElement.lang = lang;
  document.documentElement.dir = meta?.rtl ? "rtl" : "ltr";
  if (lang === "en") return;
  let data;
  try {
    data = window.__i18n ? await window.__i18n : await fetch(`/i18n/${lang}.json`).then((r) => r.json());
  } catch { return; }
  dict = new Map(Object.entries(data ?? {}));
  fragments = new Set();
  for (const k of dict.keys()) for (const p of k.split(/\{\d+\}/)) { const f = norm(p); if (f) fragments.add(f); }

  window.dispatchEvent(new Event("i18n-ready"));
  translateElement(document.body);
  translateTitle();
  new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === "characterData") {
        if (applied.get(r.target) === r.target.nodeValue) continue;
        schedule(r.target.parentElement);
      } else if (r.type === "attributes") {
        translateAttrs(r.target);
      } else {
        for (const n of r.addedNodes) schedule(n.nodeType === 1 ? n : n.parentElement);
      }
    }
  }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  const title = document.querySelector("title");
  if (title) new MutationObserver(translateTitle).observe(title, { childList: true, characterData: true, subtree: true });
}

// For text the page builds piece by piece (a headline animated word by
// word): translate the whole sentence first, then split it.
export function t(text) {
  return (dict && dict.get(norm(text))) ?? text;
}
export function useT() {
  const [, setReady] = useState(Boolean(dict));
  useEffect(() => {
    if (dict) return undefined;
    const on = () => setReady(true);
    window.addEventListener("i18n-ready", on);
    return () => window.removeEventListener("i18n-ready", on);
  }, []);
  return t;
}
