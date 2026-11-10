import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Award, BookOpen, Flame, ListChecks } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { loadCatalog, loadMyLearning } from "@/lib/catalog";
import { loadMyAssignments } from "@/lib/team";
import CourseCard from "@/components/course/CourseCard";
import CourseCover from "@/components/course/CourseCover";
import JobGoalBanner from "@/components/course/JobGoalBanner";
import useSaved from "@/components/course/useSaved";
import Seo from "@/components/seo/Seo";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const TABS = [
  { id: "progress", label: "In progress" },
  { id: "done", label: "Completed" },
  { id: "saved", label: "Saved" },
];

export default function MyLearning() {
  const { user, profile } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") ?? "progress";
  const [items, setItems] = useState(null);
  const [catalog, setCatalog] = useState([]);
  const [stats, setStats] = useState(null);
  const [assigned, setAssigned] = useState([]);
  const { saved, toggle } = useSaved();

  useEffect(() => {
    let active = true;
    loadMyLearning(user.id).then((x) => active && setItems(x)).catch(() => active && setItems([]));
    loadCatalog().then((x) => active && setCatalog(x)).catch(() => {});
    loadMyAssignments().then((x) => active && setAssigned(x));
    Promise.all([
      supabase.from("skillfirms_credentials").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "active_verified"),
      supabase.from("skillfirms_module_progress").select("completed_at, skillfirms_enrollments!inner(user_id)").eq("skillfirms_enrollments.user_id", user.id).not("completed_at", "is", null),
    ]).then(([creds, passed]) => {
      if (!active) return;
      const days = new Set((passed.data ?? []).map((p) => p.completed_at.slice(0, 10)));
      let streak = 0;
      for (let d = new Date(); ; d.setDate(d.getDate() - 1)) {
        const key = d.toISOString().slice(0, 10);
        if (days.has(key)) streak += 1;
        else if (streak > 0 || key !== new Date().toISOString().slice(0, 10)) break;
      }
      setStats({ certificates: creds.count ?? 0, lessons: (passed.data ?? []).length, streak });
    });
    return () => { active = false; };
  }, [user.id]);

  const inProgress = useMemo(() => (items ?? []).filter((e) => !e.finished).sort((a, b) => b.done - a.done), [items]);
  const done = useMemo(() => (items ?? []).filter((e) => e.finished), [items]);
  const savedCourses = useMemo(() => catalog.filter((c) => saved.has(c.id)), [catalog, saved]);
  const resume = inProgress[0];
  const takenIds = new Set((items ?? []).map((e) => e.course.id));
  const suggestions = catalog.filter((c) => !takenIds.has(c.id) && (!resume || c.category?.id === resume.course.category?.id)).slice(0, 4);

  return (
    <div className="mx-auto max-w-8xl px-4 py-10 sm:px-6 lg:px-8">
      <Seo title="My learning" canonical="/my-learning" />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">My learning</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-[-0.03em] sm:text-4xl">{profile?.display_name ? `Keep going, ${profile.display_name.split(" ")[0]}` : "Keep going"}</h1>
        </div>
        {stats && (
          <dl className="flex gap-6">
            <Stat icon={Flame} label="Day streak" value={stats.streak} />
            <Stat icon={ListChecks} label="Lessons passed" value={stats.lessons} />
            <Stat icon={Award} label="Certificates" value={stats.certificates} />
          </dl>
        )}
      </div>

      <JobGoalBanner className="mt-8" />

      {resume && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-8 grid overflow-hidden rounded-2xl border border-border bg-card sm:grid-cols-[18rem_minmax(0,1fr)]">
          <CourseCover course={resume.course} className="aspect-[16/9] sm:aspect-auto sm:h-full" />
          <div className="p-5 sm:p-6">
            <p className="eyebrow text-mastery">Pick up where you left off</p>
            <h2 className="mt-1 text-2xl font-extrabold tracking-[-0.03em]">{resume.course.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">Lesson {resume.next} of {resume.course.lessons} · {resume.done} passed</p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-mastery" style={{ width: `${Math.max(3, resume.progress_percent)}%` }} /></div>
            <Link to={`/courses/${resume.course.slug}/lessons/${resume.next}`}><Button className="mt-5">Continue lesson {resume.next}<ArrowRight className="h-4 w-4" /></Button></Link>
          </div>
        </motion.div>
      )}

      {assigned.length > 0 && (
        <section className="mt-8 rounded-2xl border border-border bg-card p-5">
          <p className="font-display text-xl font-semibold">Assigned by your company</p>
          <ul className="mt-3 divide-y divide-border">
            {assigned.map((a) => {
              const course = catalog.find((c) => c.id === a.course_id);
              const mine = (items ?? []).find((e) => e.course.id === a.course_id);
              const overdue = a.due_on && !mine?.finished && a.due_on < new Date().toISOString().slice(0, 10);
              if (!course) return null;
              return (
                <li key={a.course_id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <Link to={`/courses/${course.slug}`} className="font-semibold hover:underline">{course.title}</Link>
                    <p className="text-xs text-muted-foreground">{a.company}{a.due_on ? <> · <span className={overdue ? "font-semibold text-destructive" : ""}>due {new Date(a.due_on).toLocaleDateString()}</span></> : ""}</p>
                  </div>
                  {mine?.finished ? <span className="text-sm font-semibold text-mastery">Done</span> : (
                    <Link to={`/courses/${course.slug}/lessons/${mine?.next ?? 1}`}><Button size="sm" variant={overdue ? "default" : "outline"}>{mine?.done ? `Continue (${mine.done}/${course.lessons})` : "Start"}</Button></Link>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="mt-10 flex gap-1 border-b border-border" role="tablist">
        {TABS.filter((t) => t.id !== "saved" || toggle).map((t) => {
          const n = t.id === "progress" ? inProgress.length : t.id === "done" ? done.length : savedCourses.length;
          return (
            <button key={t.id} role="tab" aria-selected={tab === t.id} type="button" onClick={() => setParams(t.id === "progress" ? {} : { tab: t.id }, { replace: true })}
              className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${tab === t.id ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              {t.label}{items ? <span className="ml-1.5 text-xs font-normal text-muted-foreground">{n}</span> : null}
            </button>
          );
        })}
      </div>

      {!items ? (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="aspect-[4/5] rounded-2xl" />)}</div>
      ) : (
        <div className="mt-6">
          {tab === "progress" && (inProgress.length ? <Grid>{inProgress.map((e) => <CourseCard key={e.id} course={e.course} progress={e.progress_percent} />)}</Grid> : <Empty text="Nothing in progress." />)}
          {tab === "done" && (done.length ? <Grid>{done.map((e) => <CourseCard key={e.id} course={e.course} progress={100} />)}</Grid> : <Empty text="Finish every lesson of a course and it lands here, with its certificate." />)}
          {tab === "saved" && (savedCourses.length ? <Grid>{savedCourses.map((c) => <CourseCard key={c.id} course={c} saved onToggleSave={toggle} />)}</Grid> : <Empty text="Tap the bookmark on any course to save it for later." />)}
        </div>
      )}

      {suggestions.length > 0 && (
        <section className="mt-14">
          <h2 className="text-2xl font-extrabold tracking-[-0.03em]">{resume ? `More in ${resume.course.category?.label}` : "Start here"}</h2>
          <div className="mt-4"><Grid>{suggestions.map((c) => <CourseCard key={c.id} course={c} saved={saved.has(c.id)} onToggleSave={toggle} />)}</Grid></div>
        </section>
      )}
    </div>
  );
}

function Grid({ children }) {
  return <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{children}</div>;
}

function Empty({ text }) {
  return (
    <div className="rounded-2xl border border-dashed border-border p-10 text-center">
      <BookOpen className="mx-auto h-6 w-6 text-muted-foreground" />
      <p className="mt-2 text-sm text-muted-foreground">{text}</p>
      <Link to="/courses" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-mastery hover:underline">Browse courses<ArrowRight className="h-3.5 w-3.5" /></Link>
    </div>
  );
}

function Stat({ icon: Icon, label, value }) {
  return (
    <div>
      <dt className="flex items-center gap-1 text-xs text-muted-foreground"><Icon className="h-3.5 w-3.5" />{label}</dt>
      <dd className="mt-0.5 text-2xl font-extrabold tracking-[-0.03em] tabular-nums">{value}</dd>
    </div>
  );
}
