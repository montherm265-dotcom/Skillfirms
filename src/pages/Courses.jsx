import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { dropShellAfterPaint, shellShown } from "@/lib/shell";
import { CATEGORIES, LEVELS, loadCatalog, searchCourses, teacherOf, totalMinutes } from "@/lib/catalog";
import CourseCard from "@/components/course/CourseCard";
import useSaved from "@/components/course/useSaved";
import useHiring from "@/components/course/useHiring";
import Seo from "@/components/seo/Seo";
import { Skeleton } from "@/components/ui/skeleton";

const SORTS = [
  { id: "best", label: "Best match" },
  { id: "popular", label: "Most learners" },
  { id: "rated", label: "Highest rated" },
  { id: "new", label: "Newest" },
];
const DURATIONS = [
  { id: "short", label: "Less than 2 hours", test: (m) => m < 120 },
  { id: "mid", label: "2 to 5 hours", test: (m) => m >= 120 && m <= 300 },
  { id: "long", label: "More than 5 hours", test: (m) => m > 300 },
];
const TAUGHT = [{ id: "expert", label: "Taught by experts" }, { id: "ai", label: "Free basics (no certificate)" }];
const LEVEL_OPTS = LEVELS.map((l) => ({ id: l, label: l[0].toUpperCase() + l.slice(1) }));

// URL keeps every filter (shareable, back button works). Multi-select
// values are comma separated.
const list = (v) => (v ? v.split(",").filter(Boolean) : []);

function FilterGroup({ title, options, selected, onToggle, counts, max = 6 }) {
  const [more, setMore] = useState(false);
  const shownOpts = more ? options : options.slice(0, max);
  return (
    <fieldset className="min-w-0 border-b border-border py-4">
      <legend className="text-sm font-semibold">{title}</legend>
      <div className="mt-2 space-y-1.5">
        {shownOpts.map((o) => (
          <label key={o.id} title={o.label} className="flex min-w-0 cursor-pointer items-center gap-2.5 text-sm text-foreground/85 hover:text-foreground">
            <input type="checkbox" checked={selected.includes(o.id)} onChange={() => onToggle(o.id)}
              className="h-4 w-4 flex-none rounded border-border accent-[#1f4189]" />
            <span className="min-w-0 flex-1 truncate">{o.label}</span>
            {counts && <span className="flex-none text-xs text-muted-foreground">{counts[o.id] ?? 0}</span>}
          </label>
        ))}
      </div>
      {options.length > max && (
        <button type="button" onClick={() => setMore((m) => !m)} className="mt-2 text-xs font-semibold text-[#1f4189] hover:underline">{more ? "Show less" : `Show ${options.length - max} more`}</button>
      )}
    </fieldset>
  );
}

export default function Courses() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const cats = list(params.get("category"));
  const levels = list(params.get("level"));
  const by = list(params.get("by"));
  const durs = list(params.get("duration"));
  const skillsSel = list(params.get("skill"));
  const sort = params.get("sort") ?? "best";
  const [courses, setCourses] = useState(null);
  const [error, setError] = useState(null);
  const [text, setText] = useState(q);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { saved, toggle } = useSaved();
  const hiring = useHiring();

  useEffect(() => { setText(q); }, [q]);
  // index.html drew this list already (shell-courses); hand over once the
  // same courses are here.
  useLayoutEffect(() => { if (courses && shellShown()) dropShellAfterPaint(); }, [courses]);
  useEffect(() => {
    loadCatalog().then(setCourses).catch(() => setError("Couldn't load courses. Try again in a moment."));
  }, []);

  function set(key, value) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    setParams(next, { replace: true });
  }
  const toggleIn = (key, current) => (id) => set(key, (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]).join(","));

  // Every filter except one, so each group's counts show what you'd get.
  const filterBy = (except) => (c) =>
    (except === "category" || !cats.length || cats.includes(c.category?.id)) &&
    (except === "level" || !levels.length || levels.includes(c.level)) &&
    (except === "by" || !by.length || by.includes(teacherOf(c).kind)) &&
    (except === "duration" || !durs.length || DURATIONS.some((d) => durs.includes(d.id) && d.test(totalMinutes(c)))) &&
    (except === "skill" || !skillsSel.length || c.skills.some((s) => skillsSel.includes(s.slug)));

  const matched = useMemo(() => (courses ? searchCourses(courses, q) : []), [courses, q]);
  const shown = useMemo(() => {
    let out = matched.filter(filterBy(null));
    out = [...out].sort((a, b) => Number(teacherOf(b).kind === "expert") - Number(teacherOf(a).kind === "expert"));
    const cmp = {
      popular: (a, b) => b.enrollment_count - a.enrollment_count,
      rated: (a, b) => (b.rating_avg ?? 0) - (a.rating_avg ?? 0) || b.rating_count - a.rating_count,
      new: (a, b) => new Date(b.created_at) - new Date(a.created_at),
    }[sort];
    return cmp ? [...out].sort(cmp) : out;
  }, [matched, params, sort]);

  const countBy = (key, idOf) => {
    const counts = {};
    for (const c of matched.filter(filterBy(key))) for (const id of [].concat(idOf(c))) counts[id] = (counts[id] ?? 0) + 1;
    return counts;
  };
  const catCounts = countBy("category", (c) => c.category?.id);
  const levelCounts = countBy("level", (c) => c.level);
  const byCounts = countBy("by", (c) => teacherOf(c).kind);
  const durCounts = countBy("duration", (c) => DURATIONS.filter((d) => d.test(totalMinutes(c))).map((d) => d.id));
  const skillCounts = countBy("skill", (c) => c.skills.map((s) => s.slug));
  const skillOpts = useMemo(() => {
    const names = {};
    for (const c of courses ?? []) for (const s of c.skills) names[s.slug] = s.name;
    return Object.entries(names).map(([id, label]) => ({ id, label })).sort((a, b) => (skillCounts[b.id] ?? 0) - (skillCounts[a.id] ?? 0) || a.label.localeCompare(b.label));
  }, [courses, params]);

  const active = [
    ...cats.map((id) => ({ key: "category", id, label: CATEGORIES.find((c) => c.id === id)?.label ?? id, cur: cats })),
    ...skillsSel.map((id) => ({ key: "skill", id, label: skillOpts.find((s) => s.id === id)?.label ?? id, cur: skillsSel })),
    ...levels.map((id) => ({ key: "level", id, label: LEVEL_OPTS.find((l) => l.id === id)?.label ?? id, cur: levels })),
    ...durs.map((id) => ({ key: "duration", id, label: DURATIONS.find((d) => d.id === id)?.label ?? id, cur: durs })),
    ...by.map((id) => ({ key: "by", id, label: TAUGHT.find((t) => t.id === id)?.label ?? id, cur: by })),
  ];
  const singleCat = cats.length === 1 ? CATEGORIES.find((c) => c.id === cats[0]) : null;

  const filters = (
    <div>
      <FilterGroup title="Subject" options={CATEGORIES.map((c) => ({ id: c.id, label: c.label }))} selected={cats} onToggle={toggleIn("category", cats)} counts={catCounts} />
      <FilterGroup title="Skills" options={skillOpts} selected={skillsSel} onToggle={toggleIn("skill", skillsSel)} counts={skillCounts} max={8} />
      <FilterGroup title="Level" options={LEVEL_OPTS} selected={levels} onToggle={toggleIn("level", levels)} counts={levelCounts} />
      <FilterGroup title="Duration" options={DURATIONS} selected={durs} onToggle={toggleIn("duration", durs)} counts={durCounts} />
      <FilterGroup title="Taught by" options={TAUGHT} selected={by} onToggle={toggleIn("by", by)} counts={byCounts} />
    </div>
  );

  return (
    <div className="mx-auto max-w-8xl px-4 py-6 sm:px-6 lg:px-8">
      <Seo title={singleCat ? `${singleCat.label} courses` : "All courses"} description="The job, taught by people who do it, with checks they write and a certificate anyone can verify. Plus free basics to get started." canonical="/courses" />

      <form onSubmit={(e) => { e.preventDefault(); set("q", text.trim()); }} className="flex max-w-3xl items-center gap-2 rounded-full border border-border bg-card p-1 pl-4 focus-within:ring-2 focus-within:ring-[#1f4189]/25">
        <Search className="h-4 w-4 flex-none text-muted-foreground" />
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="What do you want to learn?" aria-label="Search courses" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
        {text && <button type="button" onClick={() => { setText(""); set("q", ""); }} aria-label="Clear search" className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>}
        <button type="submit" className="h-9 rounded-full bg-[#00041d] px-5 text-sm font-semibold text-white hover:bg-[#1f4189]">Search</button>
      </form>

      <div className="mt-6 lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-8">
        <aside className="hidden min-w-0 lg:block" aria-label="Filters">
          <p className="text-base font-semibold">Filter by</p>
          {filters}
        </aside>

        <section>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight">
              {courses ? <>{shown.length} result{shown.length === 1 ? "" : "s"}</> : "Courses"}
              {q && <span className="font-normal text-muted-foreground"> for “{q}”</span>}
              {singleCat && !q && <span className="font-normal text-muted-foreground"> in {singleCat.label}</span>}
            </h1>
            <button type="button" onClick={() => setFiltersOpen(true)} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-3.5 text-sm font-medium lg:hidden">
              <SlidersHorizontal className="h-4 w-4" />Filters{active.length ? ` (${active.length})` : ""}
            </button>
            <label className="relative ml-auto">
              <span className="sr-only">Sort</span>
              <select value={sort} onChange={(e) => set("sort", e.target.value === "best" ? "" : e.target.value)} className="h-9 appearance-none rounded-full border border-border bg-background pl-3.5 pr-8 text-sm font-medium outline-none hover:border-foreground/30">
                {SORTS.map((o) => <option key={o.id} value={o.id}>Sort: {o.label}</option>)}
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">▾</span>
            </label>
          </div>
          {active.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {active.map((f) => (
                <button key={`${f.key}:${f.id}`} type="button" onClick={() => toggleIn(f.key, f.cur)(f.id)}
                  className="inline-flex items-center gap-1 rounded-full bg-[#1f4189]/10 px-2.5 py-1 text-xs font-medium text-[#1f4189] hover:bg-[#1f4189]/15">
                  {f.label}<X className="h-3 w-3" />
                </button>
              ))}
              <button type="button" onClick={() => setParams(q ? { q } : {}, { replace: true })} className="ml-1 text-xs font-semibold text-[#1f4189] hover:underline">Clear all</button>
            </div>
          )}

          {error ? (
            <p className="mt-10 text-center text-sm text-destructive">{error}</p>
          ) : !courses ? (
            <div className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2">
              {Array.from({ length: 8 }, (_, i) => <div key={i} className="flex gap-3.5 rounded-xl border border-border p-3"><Skeleton className="h-[84px] w-[84px] flex-none rounded-lg" /><div className="flex-1 space-y-2 py-1"><Skeleton className="h-3 w-1/3" /><Skeleton className="h-4 w-4/5" /><Skeleton className="h-3 w-2/3" /></div></div>)}
            </div>
          ) : shown.length === 0 ? (
            <div className="mt-12 text-center">
              <p className="text-lg font-semibold">No courses match that yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Try fewer words or clear the filters.</p>
              <button type="button" onClick={() => setParams({}, { replace: true })} className="mt-4 text-sm font-semibold text-[#1f4189] hover:underline">Show all courses</button>
            </div>
          ) : (
            <div className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2">
              {shown.map((c) => <CourseCard key={c.id} course={c} saved={saved.has(c.id)} onToggleSave={toggle} hiring={hiring[c.id]} />)}
            </div>
          )}
        </section>
      </div>

      {filtersOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Filters">
          <button type="button" aria-label="Close filters" className="absolute inset-0 bg-black/40" onClick={() => setFiltersOpen(false)} />
          <div className="absolute inset-y-0 right-0 flex w-[min(22rem,90vw)] flex-col bg-background shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <p className="text-base font-semibold">Filter by</p>
              <button type="button" onClick={() => setFiltersOpen(false)} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-secondary"><X className="h-4 w-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-4">{filters}</div>
            <div className="border-t border-border p-3">
              <button type="button" onClick={() => setFiltersOpen(false)} className="h-10 w-full rounded-full bg-[#00041d] text-sm font-semibold text-white">Show {shown.length} result{shown.length === 1 ? "" : "s"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
