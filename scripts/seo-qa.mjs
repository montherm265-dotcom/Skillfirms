#!/usr/bin/env node
// Static source-level SEO/GEO QA for Skillfirms.
//
// What this checks (by reading source files, not by crawling a live site):
//   1. Every routed page component imports and renders <Seo ... />.
//   2. Auth-gated (private) routes either pass noindex or are flagged to add it.
//   3. Each page has exactly one <h1> (heuristic — conditional branches can
//      cause false positives/negatives; read the flagged file before trusting this).
//   4. No two pages share the same *static* canonical string.
//   5. public/robots.txt and public/llms.txt exist.
//   6. The dynamic sitemap Edge Function exists in supabase/functions.
//
// What this does NOT check (needs a live deployment, out of scope for a
// static script): actual rendered HTML per bot, broken links, real
// structured-data validation against Google's Rich Results API, whether
// Search Console actually has the sitemap submitted, or crawl budget.
// Run Google's Rich Results Test and a real crawler (e.g. Screaming Frog)
// against the deployed site for that.
//
// Usage: node scripts/seo-qa.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SRC = path.join(ROOT, "src");

function read(p) {
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null;
}

const results = { pass: [], warn: [], fail: [] };
function pass(msg) { results.pass.push(msg); }
function warn(msg) { results.warn.push(msg); }
function fail(msg) { results.fail.push(msg); }

// ---------------------------------------------------------------------------
// 1. Parse App.jsx for routes + import map (lazy and eager)
// ---------------------------------------------------------------------------
const appSrc = read(path.join(SRC, "App.jsx"));
if (!appSrc) {
  console.error("Could not find src/App.jsx — aborting.");
  process.exit(1);
}

const importMap = {};
for (const m of appSrc.matchAll(/const (\w+) = lazy\(\(\) => import\(['"]@\/pages\/([\w/-]+)['"]\)\)/g)) {
  importMap[m[1]] = m[2];
}
for (const m of appSrc.matchAll(/^import (\w+) from ['"]@\/pages\/([\w/-]+)['"];?$/gm)) {
  importMap[m[1]] = m[2];
}

const routes = [];
const routeRegex = /<Route\s+path="([^"]+)"\s+element=\{([^}]+)\}\s*\/>/g;
for (const m of appSrc.matchAll(routeRegex)) {
  const routePath = m[1];
  const elementExpr = m[2];
  const requiresAuth = elementExpr.includes("RequireAuth");
  const innerMatch = [...elementExpr.matchAll(/<(\w+)\s*\/?>/g)].pop();
  const componentName = innerMatch ? innerMatch[1] : null;
  if (!componentName || componentName === "RequireAuth") continue;
  routes.push({ routePath, componentName, requiresAuth });
}

console.log(`Found ${routes.length} routes in App.jsx.\n`);

// ---------------------------------------------------------------------------
// 2 & 3. Per-page checks
// ---------------------------------------------------------------------------
const canonicalLiterals = new Map();

for (const { routePath, componentName, requiresAuth } of routes) {
  const file = importMap[componentName];
  if (!file) {
    warn(`${routePath} (${componentName}): couldn't resolve source file from import map — skipped.`);
    continue;
  }
  const filePath = path.join(SRC, "pages", `${file}.jsx`);
  const src = read(filePath);
  if (!src) {
    warn(`${routePath} (${componentName}): source file not found at src/pages/${file}.jsx — skipped.`);
    continue;
  }

  const hasSeoImport = /from\s+["']@\/components\/seo\/Seo["']/.test(src);
  const hasSeoUsage = /<Seo[\s/>]/.test(src);

  if (!hasSeoImport || !hasSeoUsage) {
    if (requiresAuth) {
      warn(`${routePath} (${file}.jsx): private route has no <Seo> call. Low priority, but add noindex Seo if this page is ever reachable by a crawler before login-gating kicks in.`);
    } else {
      fail(`${routePath} (${file}.jsx): public route has no <Seo> call — missing title/description/canonical/structured data.`);
    }
  } else {
    pass(`${routePath} (${file}.jsx): wired to <Seo>.`);

    const hasNoindex = /noindex/.test(src);
    if (requiresAuth && !hasNoindex) {
      warn(`${routePath} (${file}.jsx): private route has <Seo> but no noindex — confirm this is intentional.`);
    }

    for (const cm of src.matchAll(/canonical=\{?["'`]([^"'`{}]+)["'`]\}?/g)) {
      const literal = cm[1];
      if (literal.includes("$")) continue;
      if (!canonicalLiterals.has(literal)) canonicalLiterals.set(literal, []);
      canonicalLiterals.get(literal).push(routePath);
    }
  }

  const h1Count = (src.match(/<h1[\s>]/g) || []).length;
  if (h1Count === 0) {
    warn(`${routePath} (${file}.jsx): no <h1> found in source — verify the rendered page has exactly one top-level heading (conditional branches may make this a false positive).`);
  } else if (h1Count > 1) {
    warn(`${routePath} (${file}.jsx): ${h1Count} <h1> occurrences in source — verify only one renders at a time (could be mutually exclusive conditional branches, which is fine).`);
  } else {
    pass(`${routePath} (${file}.jsx): exactly one <h1> in source.`);
  }
}

for (const [literal, usedBy] of canonicalLiterals) {
  if (usedBy.length > 1) {
    fail(`Duplicate static canonical "${literal}" used by routes: ${usedBy.join(", ")}.`);
  }
}

// ---------------------------------------------------------------------------
// 4. robots.txt / llms.txt
// ---------------------------------------------------------------------------
for (const f of ["robots.txt", "llms.txt"]) {
  const p = path.join(ROOT, "public", f);
  if (read(p)) pass(`public/${f} exists.`);
  else fail(`public/${f} is missing.`);
}

// ---------------------------------------------------------------------------
// 5. Sitemap Edge Function
// ---------------------------------------------------------------------------
const sitemapDir = path.join(ROOT, "supabase", "functions", "skillfirms-sitemap");
if (fs.existsSync(sitemapDir)) pass("supabase/functions/skillfirms-sitemap exists.");
else fail("supabase/functions/skillfirms-sitemap is missing — dynamic sitemap not generated.");

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
console.log(`PASS (${results.pass.length}):`);
results.pass.forEach((m) => console.log(`  ✓ ${m}`));
console.log(`\nWARN (${results.warn.length}):`);
results.warn.forEach((m) => console.log(`  ⚠ ${m}`));
console.log(`\nFAIL (${results.fail.length}):`);
results.fail.forEach((m) => console.log(`  ✗ ${m}`));

console.log(`\n${results.fail.length === 0 ? "No hard failures." : `${results.fail.length} hard failure(s).`} ${results.warn.length} warning(s) to review.`);

process.exit(results.fail.length > 0 ? 1 : 0);
