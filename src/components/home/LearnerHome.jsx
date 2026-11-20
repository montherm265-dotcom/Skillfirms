import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BarChart3, BrainCircuit, Cog, Compass, Crosshair, FlaskConical, KanbanSquare, Map as MapIcon, Play, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { CATEGORIES, loadCatalog, loadMyLearning } from "@/lib/catalog";
import { supabase } from "@/lib/supabaseClient";
import CourseCard, { ProviderLine } from "@/components/course/CourseCard";
import CourseCover from "@/components/course/CourseCover";
import useSaved from "@/components/course/useSaved";
import useHiring from "@/components/course/useHiring";
import { Skeleton } from "@/components/ui/skeleton";
import WeeklyGoal from "@/components/home/WeeklyGoal";

const ICONS = { FlaskConical, Cog, KanbanSquare, BarChart3, BrainCircuit, Compass };

function Row({ title, sub, to, children }) {
  return (
    <section className="mt-10">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
          {sub && <p className="mt-0.5 text-sm text-muted-foreground">{sub}</p>}
        </div>
        {to && <Link to={to} className="group inline-flex flex-none items-center gap-1 text-sm font-semibold text-[#1f4189]">See all<ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" /></Link>}
      </div>
      <div className="no-scrollbar -mx-4 mt-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">{children}</div>
    </section>
  );
}

// Signed-in home: pick up where you left off, then what to learn next.
export default function LearnerHome() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [courses, setCourses] = useState(null);
  const [mine, setMine] = useState(null);
  const [targets, setTargets] = useState(null);
  const [q, setQ] = useState("");
  const { saved, toggle } = useSaved();
  const hiring = useHiring();

  useEffect(() => { loadCatalog().then(setCourses).catch(() => setCourses([])); }, []);
  useEffect(() => {
    loadMyLearning(user.id).then(setMine).catch(() => setMine([]));
    supabase.rpc("my_target_jobs").then(({ data }) => setTargets(data ?? []), () => setTargets([]));
  }, [user.id]);

  const first = (profile?.display_name || profile?.full_name || "").split(" ")[0];
  const inProgress = (mine ?? []).filter((e) => !e.finished).sort((a, b) => new Date(b.enrolled_at) - new Date(a.enrolled_at));
  const finished = (mine ?? []).filter((e) => e.finished).length;
  const enrolledIds = new Set((mine ?? []).map((e) => e.course_id));

  const rows = useMemo(() => {
    const all = (courses ?? []).filter((c) => !enrolledIds.has(c.id));
    // Recommended: courses teaching what your target jobs miss, then your subjects.
    const gapNames = new Set((targets ?? []).flatMap((t) => (t.gaps ?? []).map((g) => g.label.toLowerCase())));
    const mySubjects = new Set((mine ?? []).map((e) => e.course.category?.id));
    const score = (c) => c.skills.filter((s) => gapNames.has(s.name.toLowerCase())).length * 3 + (mySubjects.has(c.category?.id) ? 1 : 0);
    const recommended = all.map((c) => [c, score(c)]).filter(([, s]) => s > 0).sort((a, b) => b[1] - a[1]).map(([c]) => c);
    const popular = [...all].sort((a, b) => b.enrollment_count - a.enrollment_count || (b.rating_avg ?? 0) - (a.rating_avg ?? 0));
    const fresh = [...all].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return { recommended: recommended.slice(0, 10), popular: popular.slice(0, 10), fresh: fresh.slice(0, 10) };
  }, [courses, mine, targets]);

  const card = (c) => <div key={c.id} className="w-[17rem] flex-none snap-start"><CourseCard course={c} saved={saved.has(c.id)} onToggleSave={toggle} hiring={hiring[c.id]} /></div>;
  const lead = inProgress[0];

  return (
    <div className="mx-auto max-w-8xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Welcome back{first ? `, ${first}` : ""}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mine == null ? " " : `${inProgress.length} in progress · ${finished} completed`}
          </p>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); navigate(q.trim() ? `/courses?q=${encodeURIComponent(q.trim())}` : "/courses"); }}
          className="flex w-full max-w-md items-center gap-2 rounded-full border border-border bg-card px-4 py-2 focus-within:ring-2 focus-within:ring-[#1f4189]/25">
          <Search className="h-4 w-4 flex-none text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="What do you want to learn?" aria-label="Search courses" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
        </form>
      </div>

      {/* Continue learning */}
      {mine == null ? (
        <Skeleton className="mt-6 h-44 w-full rounded-xl" />
      ) : lead ? (
        <section className="mt-6">
          <h2 className="text-xl font-semibold tracking-tight">Continue learning</h2>
          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <Link to={`/courses/${lead.course.slug}/lessons/${lead.next}`} className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card sm:flex-row">
              <CourseCover course={lead.course} className="aspect-[16/9] w-full flex-none sm:aspect-auto sm:w-56" />
              <div className="flex min-w-0 flex-1 flex-col p-5">
                <ProviderLine course={lead.course} />
                <p className="mt-2 text-lg font-semibold leading-snug group-hover:underline">{lead.course.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">Lesson {lead.next} of {lead.course.lessons} · {lead.done} passed</p>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-[#1f4189]" style={{ width: `${Math.max(3, lead.progress_percent)}%` }} /></div>
                <span className="mt-4 inline-flex h-9 w-fit items-center gap-1.5 rounded-full bg-[#00041d] px-5 text-sm font-semibold text-white group-hover:bg-[#1f4189]"><Play className="h-3.5 w-3.5" />Resume</span>
              </div>
            </Link>
            <div className="space-y-4">
            <WeeklyGoal userId={user?.id} />
            {inProgress.length > 1 && (
              <ul className="divide-y divide-border rounded-xl border border-border bg-card">
                {inProgress.slice(1, 5).map((e) => (
                  <li key={e.id}>
                    <Link to={`/courses/${e.course.slug}/lessons/${e.next}`} className="flex items-center gap-3 p-3 hover:bg-secondary/50">
                      <CourseCover course={e.course} className="h-12 w-20 flex-none rounded-md" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{e.course.title}</span>
                        <span className="mt-1 block h-1 overflow-hidden rounded-full bg-secondary"><span className="block h-full rounded-full bg-[#1f4189]" style={{ width: `${Math.max(3, e.progress_percent)}%` }} /></span>
                      </span>
                    </Link>
                  </li>
                ))}
                <li><Link to="/my-learning" className="block p-3 text-center text-sm font-semibold text-[#1f4189] hover:underline">All my learning</Link></li>
              </ul>
            )}
            </div>
          </div>
        </section>
      ) : (
        <section className="mt-6 rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">Start your first course</h2>
          <p className="mt-1 text-sm text-muted-foreground">Pick a subject below, or search for the skill a job asks for. Every lesson ends in a graded check.</p>
        </section>
      )}
      {mine != null && !lead && <div className="mt-4"><WeeklyGoal userId={user?.id} /></div>}

      {/* Target jobs: one quiet line, it's an extra. */}
      {targets?.length > 0 && (
        <Link to="/targets" className="mt-6 flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm hover:bg-secondary/40">
          <Crosshair className="h-4 w-4 flex-none text-[#1f4189]" />
          <span className="min-w-0 flex-1 truncate"><b>{targets.length} target job{targets.length === 1 ? "" : "s"}</b> saved on Talfirms. See the courses that close your gaps.</span>
          <ArrowRight className="h-4 w-4 flex-none text-muted-foreground" />
        </Link>
      )}

      {courses == null ? (
        <div className="mt-10 flex gap-4 overflow-hidden">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-72 w-[17rem] flex-none rounded-xl" />)}</div>
      ) : (
        <>
          {rows.recommended.length > 0 && <Row title="Recommended for you" sub="Based on your courses and the jobs you saved" to="/courses">{rows.recommended.map(card)}</Row>}
          <Row title="Most popular" to="/courses?sort=popular">{rows.popular.map(card)}</Row>
          <Row title="New on Skillfirms" to="/courses?sort=new">{rows.fresh.map(card)}</Row>
        </>
      )}

      <section className="mt-12">
        <h2 className="text-xl font-semibold tracking-tight">Explore by subject</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CATEGORIES.map((c) => {
            const Icon = ICONS[c.icon];
            const n = (courses ?? []).filter((x) => x.category?.id === c.id).length;
            return (
              <Link key={c.id} to={`/courses?category=${c.id}`} className="group flex items-center gap-3 rounded-xl border border-border bg-card p-3.5 hover:shadow-[0_10px_30px_-14px_rgba(0,4,29,0.25)]">
                <span className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-[#1f4189]/10 text-[#1f4189]"><Icon className="h-5 w-5" strokeWidth={1.8} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold group-hover:underline">{c.label}</span>
                  <span className="block truncate text-xs text-muted-foreground">{c.blurb}</span>
                </span>
                {courses && <span className="text-xs text-muted-foreground">{n}</span>}
              </Link>
            );
          })}
        </div>
      </section>

      <Link to="/roles" className="mt-8 flex items-center gap-4 rounded-xl bg-[#050b24] p-5 text-white hover:bg-[#0a1438]">
        <MapIcon className="h-6 w-6 flex-none text-[#9db7ff]" />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">Career paths</span>
          <span className="block text-sm text-white/70">A set of courses toward one job, in order, with a certificate for each.</span>
        </span>
        <ArrowRight className="h-5 w-5 flex-none" />
      </Link>
    </div>
  );
}
