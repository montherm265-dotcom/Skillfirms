// After `vite build`: make the homepage's built-in top section (#shell in
// index.html) paint from the HTML alone.
//   1. Generate just the CSS that #shell uses and inline it.
//   2. Load the full stylesheet after that paint, without blocking it.
//   3. Inline boot.js and allow exactly that script in the CSP by its hash.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dist = "dist";
let html = readFileSync(join(dist, "index.html"), "utf8");
// The built-in home shell must say exactly what the page says, or the
// page's main text is drawn twice and counts as late (LCP). Stop the build
// if the shell's hero paragraph is missing from src/components/home/SkillHero.jsx.
{
  const shellP = (html.match(/<p class="mx-auto mt-6[^"]*">([^<]+)<\/p>/) || [])[1];
  const heroSrc = readFileSync("src/components/home/SkillHero.jsx", "utf8").replace(/\s+/g, " ");
  if (shellP && !heroSrc.includes(shellP.trim())) throw new Error("index.html shell text differs from src/components/home/SkillHero.jsx: update the shell");
}

const start = html.indexOf('<div id="shell">');
const end = html.indexOf('<div id="root">');
if (start < 0 || end < 0) throw new Error("inline-shell: #shell or #root not found in dist/index.html");
const shell = html.slice(start, end);

// 1. Critical CSS: Tailwind run over the shell markup only.
const tmp = mkdtempSync(join(tmpdir(), "shell-"));
writeFileSync(join(tmp, "shell.html"), shell);
writeFileSync(join(tmp, "tailwind.shell.config.js"),
  `const base = require(${JSON.stringify(join(process.cwd(), "tailwind.config.js"))});\nmodule.exports = { ...base, content: [${JSON.stringify(join(tmp, "shell.html"))}, ${JSON.stringify(join(process.cwd(), "scripts/shell-courses.src.js"))}] };\n`);
execFileSync("npx", ["tailwindcss", "-c", join(tmp, "tailwind.shell.config.js"), "-i", "src/index.css", "-o", join(tmp, "shell.css"), "--minify"], { stdio: ["ignore", "ignore", "inherit"] });
const critical = readFileSync(join(tmp, "shell.css"), "utf8").trim();

// The latin Inter face is declared inline and preloaded, so the headline
// gets its real font without waiting for the full stylesheet.
const fontFile = readdirSync(join(dist, "assets")).find((f) => /^inter-latin-wght-normal-.*\.woff2$/.test(f));
if (!fontFile) throw new Error("inline-shell: Inter latin font not found in dist/assets");
const fontFace = `@font-face{font-family:'Inter Variable';font-style:normal;font-display:swap;font-weight:100 900;src:url(/assets/${fontFile}) format('woff2-variations');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}`;

// 2. The full stylesheet moves from <head> to just before #root.
const linkRe = /\s*<link rel="stylesheet"[^>]*href="\/assets\/[^"]+\.css"[^>]*>/;
const link = html.match(linkRe);
if (!link) throw new Error("inline-shell: built stylesheet link not found");
// It is requested by the starter script (step 4), after the shell's first
// paint, as "print" so it never blocks; src/lib/shell.js switches it on
// before the app renders.
const cssHref = link[0].match(/href="([^"]+)"/)[1];
html = html.replace(linkRe, "");

// Small images in the shell travel inside the HTML, so its first paint waits
// on nothing else.
html = html.replace(/(<div id="shell"[\s\S]*?)(?=<div id="root">)/, (shellHtml) =>
  shellHtml.replace(/<img src="(\/[^"]+\.png)"/g, (tag, src) => {
    const file = join(dist, src);
    const bytes = readFileSync(file);
    return bytes.length > 4096 ? tag : `<img src="data:image/png;base64,${bytes.toString("base64")}"`;
  }));

// 3. boot.js inline, allowed by hash.
const bootRaw = readFileSync(join(dist, "boot.js"), "utf8").replace(/^\s*\/\/.*$/gm, "").replace(/\s*\n\s*/g, "").trim();
// The Courses page asks for its courses from boot.js: fill in the public
// Supabase address and key (the same ones the app ships with) and the
// catalog's columns. Taken from the build environment, or else from the
// built app itself.
function supabasePublic() {
  let url = process.env.VITE_SUPABASE_URL || "", key = process.env.VITE_SUPABASE_ANON_KEY || "";
  if (!url || !key) {
    for (const f of readdirSync(join(dist, "assets")).filter((n) => n.endsWith(".js"))) {
      const src = readFileSync(join(dist, "assets", f), "utf8");
      url ||= (src.match(/https:\/\/[a-z0-9]{20}\.supabase\.co/) || [""])[0];
      if (!key) {
        for (const jwt of src.match(/eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g) || []) {
          try { if (JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString()).role === "anon") { key = jwt; break; } } catch { /* not ours */ }
        }
      }
      if (url && key) break;
    }
  }
  if (!url || !key) console.warn("inline-shell: Supabase address not found; the Courses page will wait for the app");
  return { url: url.replace(/\/+$/, ""), key };
}
const pub = supabasePublic();
const { CATALOG_SELECT } = await import(join(process.cwd(), "src/lib/catalog-core.js"));
const boot = bootRaw.replace("%%SUPABASE_URL%%", pub.url).replace("%%SUPABASE_ANON_KEY%%", pub.key).replace("%%CATALOG_SELECT%%", CATALOG_SELECT.replace(/\s+/g, ""));
if (!html.includes('<script src="/boot.js"></script>')) throw new Error("inline-shell: boot.js tag not found");
html = html.replace('<script src="/boot.js"></script>', `<link rel="preload" href="/assets/${fontFile}" as="font" type="font/woff2" crossorigin>\n    <style>${fontFace}${critical}</style>\n    <script>${boot}</script>`);
const hash = createHash("sha256").update(boot).digest("base64");

// 3b. The Courses page's instant list (scripts/shell-courses.src.js),
// bundled with the shared catalog logic and inlined, allowed by hash.
const { buildSync } = await import("esbuild");
const coursesJs = buildSync({ entryPoints: ["scripts/shell-courses.src.js"], bundle: true, minify: true, format: "iife", write: false, target: "es2019" }).outputFiles[0].text.trim();
if (!html.includes('<script src="/shell-courses.js"></script>')) throw new Error("inline-shell: shell-courses.js tag not found");
html = html.replace('<script src="/shell-courses.js"></script>', () => `<script>${coursesJs}</script>`);
const coursesHash = createHash("sha256").update(coursesJs).digest("base64");

// 4. Start the app only after the shell has been painted. Its files are
// requested one frame later, all together (no waterfall), so the first view
// never waits on JavaScript or competes with it for the network.
const entryRe = /\s*<script type="module" crossorigin src="(\/assets\/index-[^"]+\.js)"><\/script>/;
const entry = html.match(entryRe);
if (!entry) throw new Error("inline-shell: app entry script not found");
const preloadRe = /\s*<link rel="modulepreload" crossorigin href="([^"]+)">/g;
const chunks = [...html.matchAll(preloadRe)].map((m) => m[1]);
html = html.replace(preloadRe, "");
// 4b. Each page's own code (and what it imports) is requested together with
// the app, instead of after it: a map from route pattern to its files, from
// the build manifest and the routes in src/App.jsx.
const manifestPath = join(dist, ".vite", "manifest.json");
let routeMap = [];
if (existsSync(manifestPath)) {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const entryKey = Object.keys(manifest).find((k) => manifest[k].isEntry);
  const loaded = new Set();
  (function walk(k) { if (!manifest[k] || loaded.has(k)) return; loaded.add(k); (manifest[k].imports || []).forEach(walk); })(entryKey);
  const filesFor = (key) => {
    const out = new Set(); const seen = new Set();
    (function walk(k) { if (!manifest[k] || seen.has(k) || loaded.has(k)) return; seen.add(k); out.add("/" + manifest[k].file); (manifest[k].imports || []).forEach(walk); })(key);
    return [...out];
  };
  const app = readFileSync("src/App.jsx", "utf8");
  const lazy = Object.fromEntries([...app.matchAll(/const (\w+) = lazy\(\(\) => import\('@\/([^']+)'\)\)/g)].map((m) => [m[1], m[2]]));
  for (const m of app.matchAll(/<Route path="([^"]+)" element=\{([^\n]*?)\} \/>/g)) {
    const [, path, el] = m;
    if (path === "*") continue;
    const comp = [...el.matchAll(/<(\w+)/g)].map((x) => x[1]).reverse().find((n) => lazy[n]);
    if (!comp) continue;
    const key = Object.keys(manifest).find((k) => k === `src/${lazy[comp]}.jsx` || k === `src/${lazy[comp]}.js`);
    if (!key) continue;
    const files = filesFor(key);
    if (files.length) files.splice(16), routeMap.push([path === "/" ? "^/$" : "^" + path.replace(/:[^/]+/g, "[^/]+") + "/?$", files]);
  }
  // Fixed paths (/opportunities/new) before patterns (/opportunities/:id).
  routeMap.sort((x, y) => x[0].includes("[^/]+") - y[0].includes("[^/]+"));
  rmSync(join(dist, ".vite"), { recursive: true, force: true });
}
const routeJs = routeMap.length ? `var rm=${JSON.stringify(routeMap)},lp=location.pathname;for(var i=0;i<rm.length;i++){if(new RegExp(rm[i][0]).test(lp)){rm[i][1].forEach(function(h){var l=document.createElement("link");l.rel="modulepreload";l.crossOrigin="";l.href=h;add(l)});break}}` : "";

const starter = `(function(){function add(t){document.head.appendChild(t)}function go(){var p=document.createElement("link");p.rel="preload";p.as="style";p.crossOrigin="";p.setAttribute("fetchpriority","high");p.href="${cssHref}";add(p);var c=document.createElement("link");c.rel="stylesheet";c.crossOrigin="";c.media="print";c.id="app-css";c.href="${cssHref}";add(c);var s=document.createElement("script");s.type="module";s.crossOrigin="";s.src="${entry[1]}";add(s);${JSON.stringify(chunks)}.forEach(function(h){var l=document.createElement("link");l.rel="modulepreload";l.crossOrigin="";l.href=h;add(l)});setTimeout(function(){${routeJs}},0)}function ready(){if(document.documentElement.classList.contains("shell"))(window.__coursesShellDone||Promise.resolve()).then(function(){requestAnimationFrame(function(){setTimeout(go,0)})});else go()}if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",ready);else ready()})();`;
html = html.replace(entryRe, `\n    <script>${starter}</script>`);
const starterHash = createHash("sha256").update(starter).digest("base64");

const headersPath = join(dist, "_headers");
let headers = readFileSync(headersPath, "utf8");
if (!headers.includes("script-src 'self'")) throw new Error("inline-shell: CSP script-src not found in _headers");
headers = headers.replace("script-src 'self'", `script-src 'self' 'sha256-${hash}' 'sha256-${starterHash}' 'sha256-${coursesHash}'`);
writeFileSync(headersPath, headers);
writeFileSync(join(dist, "index.html"), html);
console.log(`inline-shell: critical CSS ${(critical.length / 1024).toFixed(1)} kB, boot script hash sha256-${hash}`);
