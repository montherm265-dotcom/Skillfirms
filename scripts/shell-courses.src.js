// The Courses page's built-in list: draws the first courses straight from
// the early answer boot.js asked for, before the app has loaded, in the same
// markup as components/course/CourseCard.jsx (the app then takes over with
// no visible change). Bundled and inlined by scripts/inline-shell.mjs.
import { formatHours, priceLabel, shapeCourse, sortBest, teacherOf, coverArt } from "../src/lib/catalog-core.js";

const ICONS = {"FlaskConical": "<path d=\"M14 2v6a2 2 0 0 0 .245.96l5.51 10.08A2 2 0 0 1 18 22H6a2 2 0 0 1-1.755-2.96l5.51-10.08A2 2 0 0 0 10 8V2\"></path><path d=\"M6.453 15h11.094\"></path><path d=\"M8.5 2h7\"></path>", "Cog": "<path d=\"M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z\"></path><path d=\"M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z\"></path><path d=\"M12 2v2\"></path><path d=\"M12 22v-2\"></path><path d=\"m17 20.66-1-1.73\"></path><path d=\"M11 10.27 7 3.34\"></path><path d=\"m20.66 17-1.73-1\"></path><path d=\"m3.34 7 1.73 1\"></path><path d=\"M14 12h8\"></path><path d=\"M2 12h2\"></path><path d=\"m20.66 7-1.73 1\"></path><path d=\"m3.34 17 1.73-1\"></path><path d=\"m17 3.34-1 1.73\"></path><path d=\"m11 13.73-4 6.93\"></path>", "KanbanSquare": "<rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\"></rect><path d=\"M8 7v7\"></path><path d=\"M12 7v4\"></path><path d=\"M16 7v9\"></path>", "BarChart3": "<path d=\"M3 3v16a2 2 0 0 0 2 2h16\"></path><path d=\"M18 17V9\"></path><path d=\"M13 17V5\"></path><path d=\"M8 17v-3\"></path>", "BrainCircuit": "<path d=\"M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z\"></path><path d=\"M9 13a4.5 4.5 0 0 0 3-4\"></path><path d=\"M6.003 5.125A3 3 0 0 0 6.401 6.5\"></path><path d=\"M3.477 10.896a4 4 0 0 1 .585-.396\"></path><path d=\"M6 18a4 4 0 0 1-1.967-.516\"></path><path d=\"M12 13h4\"></path><path d=\"M12 18h6a2 2 0 0 1 2 2v1\"></path><path d=\"M12 8h8\"></path><path d=\"M16 8V5a2 2 0 0 1 2-2\"></path><circle cx=\"16\" cy=\"13\" r=\".5\"></circle><circle cx=\"18\" cy=\"3\" r=\".5\"></circle><circle cx=\"20\" cy=\"21\" r=\".5\"></circle><circle cx=\"20\" cy=\"8\" r=\".5\"></circle>", "Compass": "<path d=\"m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z\"></path><circle cx=\"12\" cy=\"12\" r=\"10\"></circle>", "Star": "<path d=\"M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z\"></path>"};
const LEVEL = { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" };
const SF_MARK = '<svg viewBox="0 0 170 111" class="h-2.5 w-auto" fill="#00041d" aria-hidden="true"><path d="M170 0H32A29.5 28.5 0 0 0 36 57H66A7.5 7.5 0 0 1 66 72H11L0 92.5H72A26.5 27 0 0 0 72 38.5H40A9.25 9.25 0 0 1 40 20.5H159.5ZM94.09 39H155V57H115V111H83V98.2A34.5 34.5 0 0 0 94.09 39Z"></path></svg>';
const e = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const svg = (inner, cls, sw = 2) => `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" class="lucide ${cls}">${inner}</svg>`;

function cover(c) {
  const art = coverArt(c);
  return `<div class="relative overflow-hidden h-[84px] w-[84px] flex-none rounded-lg" style="background: ${art.background};"><svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" class="absolute inset-0 h-full w-full" aria-hidden="true">${
    art.shapes.map((s) => `<circle cx="${s.cx}" cy="${s.cy}" r="${s.r}" fill="white" opacity="${s.o}"></circle>`).join("")}${
    art.lines.map((y, i) => `<line x1="0" x2="320" y1="${y}" y2="${y + 40 - i * 20}" stroke="white" stroke-opacity="0.08" stroke-width="1"></line>`).join("")
  }</svg><div class="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent"></div>${
    svg(ICONS[c.category?.icon] || ICONS.Cog, "absolute text-white/90 drop-shadow left-1/2 top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2", 1.5)}</div>`;
}

function card(c) {
  const t = teacherOf(c);
  const provider = t.kind === "expert"
    ? `<span class="flex h-5 w-5 flex-none items-center justify-center rounded bg-[#1f4189] text-[10px] font-bold text-white">${e((t.name || "?").slice(0, 1))}</span>`
    : `<span class="flex h-5 w-5 flex-none items-center justify-center rounded border border-border bg-white">${SF_MARK}</span>`;
  const rating = c.rating_count
    ? `<span class="inline-flex items-center gap-1 text-xs">${svg(ICONS.Star, "h-3.5 w-3.5 text-warning", 0).replace('fill="none"', 'fill="currentColor"')}<span class="font-semibold">${Number(c.rating_avg).toFixed(1)}</span><span class="text-muted-foreground">· ${c.rating_count.toLocaleString()} review${c.rating_count === 1 ? "" : "s"}</span></span>`
    : '<span class="rounded bg-[#1f4189]/10 px-1.5 py-0.5 text-[11px] font-semibold text-[#1f4189]">New</span>';
  const facts = [LEVEL[c.level] || "All levels", formatHours(c), t.kind === "expert" ? priceLabel(c.price_cents) : "Free"].join(" · ");
  return `<div class="group relative h-full min-w-0"><a class="flex h-full min-w-0 gap-3.5 rounded-xl border border-border bg-card p-3 transition-colors duration-200 hover:border-[#1f4189]/40 hover:bg-[#1f4189]/[0.02]" href="/courses/${e(c.slug)}">${cover(c)}<div class="flex min-w-0 flex-1 flex-col pr-7"><p class="flex items-center gap-1.5 text-xs text-muted-foreground !text-[11px]">${provider}<span class="truncate">${e(t.kind === "expert" ? t.name : "Skillfirms · AI-taught basics")}</span></p><h3 class="mt-1 line-clamp-2 text-[14px] font-semibold leading-snug group-hover:text-[#1f4189]">${e(c.title)}</h3>${
    c.skills.length ? `<p class="mt-0.5 truncate text-[11px] text-muted-foreground">${e(c.skills.slice(0, 3).map((s) => s.name).join(" · "))}</p>` : ""
  }<div class="mt-auto flex flex-wrap items-center gap-x-2 gap-y-0.5 pt-1.5 text-[11px] text-muted-foreground">${rating}<span>${e(facts)}</span></div></div></a><a href="/auth" aria-label="Save for later" class="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-[#00041d]">${svg('<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"></path>', "h-4 w-4")}</a></div>`;
}

(function () {
  const w = window.__catalog;
  const list = document.getElementById("sc-list");
  const count = document.getElementById("sc-count");
  let done;
  window.__coursesShellDone = new Promise((r) => { done = r; });
  if (!w || !w.promise || !list) { done(); return; }
  setTimeout(done, 2500); // never hold the app back for long
  w.promise.then((rows) => {
    const courses = sortBest(rows.map(shapeCourse));
    count.textContent = `${courses.length} result${courses.length === 1 ? "" : "s"}`;
    list.innerHTML = courses.slice(0, 12).map(card).join("");
    requestAnimationFrame(() => done());
  }, () => done());
})();
