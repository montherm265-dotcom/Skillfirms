import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { BookOpen, Search, SlidersHorizontal, X } from "lucide-react";
import { CATEGORIES, LEVELS, loadCatalog, searchCourses, teacherOf } from "@/lib/catalog";
import CourseCard from "@/components/course/CourseCard";
import useSaved from "@/components/course/useSaved";
import useHiring from "@/components/course/useHiring";
import PageHero from "@/components/page/PageHero";
import Seo from "@/components/seo/Seo";
import { Skeleton } from "@/components/ui/skeleton";

const SORTS = [
  { id: "best", label: "Best match" },
  { id: "popular", label: "Most learners" },
  { id: "rated", label: "Highest rated" },
  { id: "new", label: "Newest" },
];

export default function Courses() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const cat = params.get("category") ?? "";
  const level = params.get("level") ?? "";
  const taughtBy = params.get("by") ?? "";
  const sort = params.get("sort") ?? "best";
  const [courses, setCourses] = useState(null);
  const [error, setError] = useState(null);
  const [text, setText] = useState(q);
  const { saved, toggle } = useSaved();
  const hiring = useHiring();

  useEffect(() => { setText(q); }, [q]);
  useEffect(() => {
    loadCatalog().then(setCourses).catch(() => setError("Couldn't load courses. Try again in a moment."));
  }, []);

  function set(key, value) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    setParams(next, { replace: true });
  }

  const shown = useMemo(() => {
    if (!courses) return [];
    let list = searchCourses(courses, q);
    if (cat) list = list.filter((c) => c.category?.id === cat);
    if (level) list = list.filter((c) => c.level === level);
    if (taughtBy) list = list.filter((c) => teacherOf(c).kind === taughtBy);
    // Experts first: they're the main product; AI-taught basics follow.
    list = [...list].sort((a, b) => Number(teacherOf(b).kind === "expert") - Number(teacherOf(a).kind === "expert"));
    const by = {
      popular: (a, b) => b.enrollment_count - a.enrollment_count,
      rated: (a, b) => (b.rating_avg ?? 0) - (a.rating_avg ?? 0) || b.rating_count - a.rating_count,
      new: (a, b) => new Date(b.created_at) - new Date(a.created_at),
    }[sort];
    return by ? [...list].sort(by) : list;
  }, [courses, q, cat, level, taughtBy, sort]);

  const counts = useMemo(() => Object.fromEntries(CATEGORIES.map((c) => [c.id, (courses ?? []).filter((x) => x.category?.id === c.id).length])), [courses]);
  const activeCat = CATEGORIES.find((c) => c.id === cat);
  const filtersOn = Boolean(q || cat || level || taughtBy);

  return (
    <div>
      <Seo title={activeCat ? `${activeCat.label} courses` : "All courses"} description="Paid courses taught by real experts, plus free AI-taught basics. A graded check on every lesson and a certificate that shows on Talfirms as verified." canonical="/courses" />
      <PageHero eyebrow={activeCat ? "Category" : "Explore"} icon={BookOpen} title={activeCat ? activeCat.label : "Every course."} accent={activeCat ? null : "One graded check per lesson."}
        sub={activeCat ? activeCat.blurb : "Expert courses are paid and taught by people who do the job. AI-taught basics are free. Pass every lesson's check and the certificate shows on Talfirms as verified."}>
        <form onSubmit={(e) => { e.preventDefault(); set("q", text.trim()); }} className="flex max-w-2xl items-center gap-2 rounded-full bg-white p-1.5 pl-5 text-foreground shadow-[0_20px_50px_-20px_rgba(0,0,0,0.7)] focus-within:ring-2 focus-within:ring-[#6b8cff]/60">
          <Search className="h-5 w-5 flex-none text-muted-foreground" />
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Search courses or skills — e.g. URS, SQL, Agile" aria-label="Search courses" className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground" />
          {text && <button type="button" onClick={() => { setText(""); set("q", ""); }} aria-label="Clear search" className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>}
          <button type="submit" className="h-10 rounded-full bg-[#00041d] px-5 text-sm font-semibold text-white hover:bg-[#1f4189]">Search</button>
        </form>
        <div className="no-scrollbar -mx-4 mt-5 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
          {[{ id: "", label: "All" }, ...CATEGORIES].map((c) => {
            const on = c.id ? cat === c.id : !cat;
            return (
              <button key={c.id || "all"} type="button" aria-pressed={on} onClick={() => set("category", c.id && cat !== c.id ? c.id : "")}
                className={`flex-none rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${on ? "bg-white text-[#050b24]" : "border border-white/15 bg-white/[0.05] text-white/75 hover:text-white"}`}>
                {c.label}{c.id && courses ? <span className="ml-1.5 opacity-60">{counts[c.id]}</span> : null}
              </button>
            );
          })}
        </div>
      </PageHero>

      <div className="mx-auto max-w-8xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          <Select value={taughtBy} onChange={(v) => set("by", v)} label="Taught by" options={[{ id: "", label: "Experts and AI basics" }, { id: "expert", label: "Taught by experts" }, { id: "ai", label: "AI-taught basics" }]} />
          <Select value={level} onChange={(v) => set("level", v)} label="Level" options={[{ id: "", label: "All levels" }, ...LEVELS.map((l) => ({ id: l, label: l[0].toUpperCase() + l.slice(1) }))]} />
          <Select value={sort} onChange={(v) => set("sort", v === "best" ? "" : v)} label="Sort" options={SORTS} />
          {filtersOn && <button type="button" onClick={() => setParams({}, { replace: true })} className="ml-1 text-sm font-medium text-mastery hover:underline">Clear all</button>}
          {courses && <span className="ml-auto text-sm text-muted-foreground">{shown.length} course{shown.length === 1 ? "" : "s"}</span>}
        </div>

        {error ? (
          <p className="mt-10 text-center text-sm text-destructive">{error}</p>
        ) : !courses ? (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => <div key={i} className="overflow-hidden rounded-2xl border border-border"><Skeleton className="aspect-[16/9] w-full rounded-none" /><div className="space-y-2 p-4"><Skeleton className="h-4 w-4/5" /><Skeleton className="h-3 w-1/2" /><Skeleton className="h-3 w-2/3" /></div></div>)}
          </div>
        ) : shown.length === 0 ? (
          <div className="mt-12 text-center">
            <p className="font-display text-xl font-semibold">No courses match that yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Try fewer words or clear the filters.</p>
            <button type="button" onClick={() => setParams({}, { replace: true })} className="mt-4 text-sm font-medium text-mastery hover:underline">Show all courses</button>
          </div>
        ) : (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {shown.map((c) => <CourseCard key={c.id} course={c} saved={saved.has(c.id)} onToggleSave={toggle} hiring={hiring[c.id]} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function Select({ value, onChange, label, options }) {
  return (
    <label className="relative">
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-9 appearance-none rounded-full border border-border bg-background pl-3.5 pr-8 text-sm font-medium outline-none hover:border-foreground/30 focus:ring-2 focus:ring-ring/20">
        {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">▾</span>
    </label>
  );
}
