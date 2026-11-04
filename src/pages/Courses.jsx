import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { CATEGORIES, LEVELS, loadCatalog, searchCourses } from "@/lib/catalog";
import CourseCard from "@/components/course/CourseCard";
import useSaved from "@/components/course/useSaved";
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
  const sort = params.get("sort") ?? "best";
  const [courses, setCourses] = useState(null);
  const [error, setError] = useState(null);
  const [text, setText] = useState(q);
  const { saved, toggle } = useSaved();

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
    const by = {
      popular: (a, b) => b.enrollment_count - a.enrollment_count,
      rated: (a, b) => (b.rating_avg ?? 0) - (a.rating_avg ?? 0) || b.rating_count - a.rating_count,
      new: (a, b) => new Date(b.created_at) - new Date(a.created_at),
    }[sort];
    return by ? [...list].sort(by) : list;
  }, [courses, q, cat, level, sort]);

  const counts = useMemo(() => Object.fromEntries(CATEGORIES.map((c) => [c.id, (courses ?? []).filter((x) => x.category?.id === c.id).length])), [courses]);
  const activeCat = CATEGORIES.find((c) => c.id === cat);
  const filtersOn = Boolean(q || cat || level);

  return (
    <div>
      <Seo title={activeCat ? `${activeCat.label} courses` : "All courses"} description="Job-skill courses with a graded check on every lesson and a certificate that counts on Talfirms. Free to learn." canonical="/courses" />
      <section className="border-b border-border bg-card/60">
        <div className="mx-auto max-w-8xl px-4 pb-6 pt-10 sm:px-6 lg:px-8">
          <p className="eyebrow">{activeCat ? "Category" : "Explore"}</p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">{activeCat ? activeCat.label : "All courses"}</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">{activeCat ? activeCat.blurb : "Every course is free to learn. Every lesson ends in a graded check, and passing them all earns a certificate that shows on Talfirms."}</p>
          <form onSubmit={(e) => { e.preventDefault(); set("q", text.trim()); }} className="mt-6 flex max-w-2xl items-center gap-2 rounded-full border border-border bg-background px-4 py-2.5 shadow-soft focus-within:ring-2 focus-within:ring-ring/20">
            <Search className="h-4 w-4 flex-none text-muted-foreground" />
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Search courses or skills — e.g. URS, SQL, Agile" aria-label="Search courses" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
            {text && <button type="button" onClick={() => { setText(""); set("q", ""); }} aria-label="Clear search" className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>}
          </form>
          <div className="no-scrollbar -mx-4 mt-5 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
            <Chip on={!cat} onClick={() => set("category", "")}>All</Chip>
            {CATEGORIES.map((c) => <Chip key={c.id} on={cat === c.id} onClick={() => set("category", cat === c.id ? "" : c.id)}>{c.label}{courses ? <span className="ml-1 opacity-60">{counts[c.id]}</span> : null}</Chip>)}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-8xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
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
            {shown.map((c) => <CourseCard key={c.id} course={c} saved={saved.has(c.id)} onToggleSave={toggle} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function Chip({ on, onClick, children }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on}
      className={`flex-none rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${on ? "border-foreground bg-foreground text-background" : "border-border bg-background hover:border-foreground/30"}`}>
      {children}
    </button>
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
