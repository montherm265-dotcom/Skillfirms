// After `vite build`: make the homepage's built-in top section (#shell in
// index.html) paint from the HTML alone.
//   1. Generate just the CSS that #shell uses and inline it.
//   2. Load the full stylesheet after that paint, without blocking it.
//   3. Inline boot.js and allow exactly that script in the CSP by its hash.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dist = "dist";
let html = readFileSync(join(dist, "index.html"), "utf8");

const start = html.indexOf('<div id="shell">');
const end = html.indexOf('<div id="root">');
if (start < 0 || end < 0) throw new Error("inline-shell: #shell or #root not found in dist/index.html");
const shell = html.slice(start, end);

// 1. Critical CSS: Tailwind run over the shell markup only.
const tmp = mkdtempSync(join(tmpdir(), "shell-"));
writeFileSync(join(tmp, "shell.html"), shell);
writeFileSync(join(tmp, "tailwind.shell.config.js"),
  `const base = require(${JSON.stringify(join(process.cwd(), "tailwind.config.js"))});\nmodule.exports = { ...base, content: [${JSON.stringify(join(tmp, "shell.html"))}] };\n`);
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
const boot = readFileSync(join(dist, "boot.js"), "utf8").replace(/^\s*\/\/.*$/gm, "").replace(/\s*\n\s*/g, "").trim();
if (!html.includes('<script src="/boot.js"></script>')) throw new Error("inline-shell: boot.js tag not found");
html = html.replace('<script src="/boot.js"></script>', `<link rel="preload" href="/assets/${fontFile}" as="font" type="font/woff2" crossorigin>\n    <style>${fontFace}${critical}</style>\n    <script>${boot}</script>`);
const hash = createHash("sha256").update(boot).digest("base64");

// 4. Start the app only after the shell has been painted. Its files are
// requested one frame later, all together (no waterfall), so the first view
// never waits on JavaScript or competes with it for the network.
const entryRe = /\s*<script type="module" crossorigin src="(\/assets\/index-[^"]+\.js)"><\/script>/;
const entry = html.match(entryRe);
if (!entry) throw new Error("inline-shell: app entry script not found");
const preloadRe = /\s*<link rel="modulepreload" crossorigin href="([^"]+)">/g;
const chunks = [...html.matchAll(preloadRe)].map((m) => m[1]);
html = html.replace(preloadRe, "");
const starter = `(function(){function add(t){document.head.appendChild(t)}function go(){var c=document.createElement("link");c.rel="stylesheet";c.crossOrigin="";c.media="print";c.id="app-css";c.href="${cssHref}";add(c);${JSON.stringify(chunks)}.forEach(function(h){var l=document.createElement("link");l.rel="modulepreload";l.crossOrigin="";l.href=h;add(l)});var s=document.createElement("script");s.type="module";s.crossOrigin="";s.src="${entry[1]}";add(s)}function ready(){if(document.documentElement.classList.contains("shell"))requestAnimationFrame(function(){setTimeout(go,0)});else go()}if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",ready);else ready()})();`;
html = html.replace(entryRe, `\n    <script>${starter}</script>`);
const starterHash = createHash("sha256").update(starter).digest("base64");

const headersPath = join(dist, "_headers");
let headers = readFileSync(headersPath, "utf8");
if (!headers.includes("script-src 'self'")) throw new Error("inline-shell: CSP script-src not found in _headers");
headers = headers.replace("script-src 'self'", `script-src 'self' 'sha256-${hash}' 'sha256-${starterHash}'`);
writeFileSync(headersPath, headers);
writeFileSync(join(dist, "index.html"), html);
console.log(`inline-shell: critical CSS ${(critical.length / 1024).toFixed(1)} kB, boot script hash sha256-${hash}`);
