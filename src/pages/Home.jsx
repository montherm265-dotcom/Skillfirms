import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight, BarChart3, BrainCircuit, Briefcase, Cog, Compass, FlaskConical, KanbanSquare,
  ListChecks, ShieldCheck, Sparkles,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { runDiagnosis, stashPendingGoal } from "@/lib/diagnosis";
import { CATEGORIES, loadCatalog, loadMyLearning } from "@/lib/catalog";
import DiagnosisResult from "@/components/DiagnosisResult";
import CourseCard from "@/components/course/CourseCard";
import CourseCover from "@/components/course/CourseCover";
import useSaved from "@/components/course/useSaved";
import useHiring from "@/components/course/useHiring";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import Seo from "@/components/seo/Seo";
import SkillHero from "@/components/home/SkillHero";

// Below the first screen: loads on its own.
const LearnStory = lazy(() => import("@/components/home/LearnStory"));

const ICONS = { FlaskConical, Cog, KanbanSquare, BarChart3, BrainCircuit, Compass };
const ease = [0.22, 1, 0.36, 1];
const EXAMPLE = "I'm a mechanical engineer with 1 year of experience and I want to work in pharmaceutical CQV within 12 months.";

export default function Home() {
  const { user } = useAuth();
  const [courses, setCourses] = useState(null);
  const [mine, setMine] = useState([]);
  const { saved, toggle } = useSaved();
  const hiring = useHiring();

  useEffect(() => { loadCatalog().then(setCourses).catch(() => setCourses([])); }, []);
  useEffect(() => {
    if (!user?.id) { setMine([]); return; }
    loadMyLearning(user.id).then((x) => setMine(x.filter((e) => !e.finished))).catch(() => {});
  }, [user?.id]);

  const totals = useMemo(() => {
    const list = courses ?? [];
    const lessons = list.reduce((n, c) => n + c.lessons, 0);
    return { courses: list.length, lessons, questions: lessons * 3 };
  }, [courses]);

  const rows = useMemo(() => CATEGORIES.map((cat) => ({ cat, list: (courses ?? []).filter((c) => c.category?.id === cat.id) })).filter((r) => r.list.length), [courses]);

  return (
    <div>
      <Seo
        canonical="/"
        title="Learn job skills, prove them, get hired"
        description="Learn job skills from real experts, with free AI-taught basics. Every lesson ends in a graded check, and every certificate shows on Talfirms as verified, taught by an expert or by AI."
        jsonLd={{
          "@context": "https://schema.org",
          "@graph": [
            { "@type": "Organization", "@id": "https://skillfirms.com/#organization", name: "Skillfirms", url: "https://skillfirms.com" },
            { "@type": "WebSite", "@id": "https://skillfirms.com/#website", name: "Skillfirms", url: "https://skillfirms.com", publisher: { "@id": "https://skillfirms.com/#organization" } },
          ],
        }}
      />

      <SkillHero totals={courses ? totals : null} />
      <Suspense fallback={<div className="min-h-screen" />}><LearnStory /></Suspense>

      {/* Continue learning */}
      {mine.length > 0 && (
        <section className="mx-auto max-w-8xl px-4 pt-12 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between gap-4">
            <h2 className="text-2xl font-extrabold tracking-[-0.03em]">Continue learning</h2>
            <Link to="/my-learning" className="group inline-flex items-center gap-1.5 text-sm font-semibold">My learning<ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" /></Link>
          </div>
          <div className="no-scrollbar -mx-4 mt-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
            {mine.slice(0, 6).map((e) => (
              <Link key={e.id} to={`/courses/${e.course.slug}/lessons/${e.next}`} className="hover-lift flex w-80 flex-none snap-start overflow-hidden rounded-2xl border border-border bg-card">
                <CourseCover course={e.course} className="w-28 flex-none" />
                <div className="min-w-0 p-3.5">
                  <p className="line-clamp-2 text-sm font-semibold">{e.course.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Next: lesson {e.next} of {e.course.lessons}</p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-mastery" style={{ width: `${Math.max(3, e.progress_percent)}%` }} /></div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Categories */}
      <section className="mx-auto max-w-8xl px-4 pt-14 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-extrabold tracking-[-0.03em] sm:text-4xl">Explore by career</h2>
        <div className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CATEGORIES.map((c, i) => {
            const Icon = ICONS[c.icon];
            const n = (courses ?? []).filter((x) => x.category?.id === c.id).length;
            return (
              <motion.div key={c.id} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05, duration: 0.45, ease }}>
                <Link to={`/courses?category=${c.id}`} className="hover-lift group flex items-center gap-4 rounded-2xl border border-border bg-card p-4">
                  <span className="flex h-12 w-12 flex-none items-center justify-center rounded-xl text-white" style={{ background: `linear-gradient(135deg, hsl(${c.hue} 70% 28%), hsl(${c.hue} 75% 48%))` }}><Icon className="h-6 w-6" strokeWidth={1.75} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-lg font-semibold">{c.label}</span>
                    <span className="block truncate text-xs text-muted-foreground">{c.blurb}</span>
                  </span>
                  <span className="flex-none text-xs text-muted-foreground">{courses ? `${n} course${n === 1 ? "" : "s"}` : ""}</span>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* Course rows */}
      {rows.map(({ cat, list }) => (
        <section key={cat.id} className="mx-auto max-w-8xl px-4 pt-14 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between gap-4">
            <h2 className="text-2xl font-extrabold tracking-[-0.03em]">{cat.label}</h2>
            <Link to={`/courses?category=${cat.id}`} className="group inline-flex flex-none items-center gap-1.5 text-sm font-semibold">See all<ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" /></Link>
          </div>
          <div className="no-scrollbar -mx-4 mt-4 flex snap-x gap-5 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
            {list.map((c) => <div key={c.id} className="w-72 flex-none snap-start"><CourseCard course={c} saved={saved.has(c.id)} onToggleSave={toggle} hiring={hiring[c.id]} /></div>)}
          </div>
        </section>
      ))}

      {/* Why different */}
      <section className="mx-auto mt-20 max-w-8xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-[2rem] bg-[#050b24] p-6 text-white sm:p-12">
          <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full blur-3xl" style={{ background: "radial-gradient(circle, rgba(59,108,230,0.45), transparent 65%)" }} />
          <p className="eyebrow text-[#9db7ff]">Not just another course site</p>
          <h2 className="relative mt-2 max-w-2xl text-3xl font-extrabold leading-[1.05] tracking-[-0.035em] sm:text-5xl">A certificate that counts for something, because the jobs are next door.</h2>
          <div className="relative mt-8 grid gap-6 sm:grid-cols-3">
            {[
              { icon: ListChecks, t: "Graded, not clicked through", d: "You can't finish a course by pressing Next. Each lesson ends in a check you have to pass." },
              { icon: ShieldCheck, t: "Proof employers see", d: "Every course you pass shows as verified on your Talfirms profile, labelled taught by an expert or taught by AI, so employers know exactly what it means. You can turn this off at any time." },
              { icon: Briefcase, t: "Learn for a real opening", d: "Each course shows the open Talfirms jobs that ask for its skills, and how your fit changes." },
            ].map((s) => (
              <div key={s.t}>
                <s.icon className="h-6 w-6 text-[#9db7ff]" />
                <p className="mt-3 font-display text-xl font-semibold">{s.t}</p>
                <p className="mt-1 text-sm text-white/70">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <GoalBox user={user} />
    </div>
  );
}

// An example (clearly labelled) of the path from a lesson to a job.
function GoalBox({ user }) {
  const navigate = useNavigate();
  const [goalText, setGoalText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!goalText.trim()) return;
    setError(null);
    if (!user) {
      stashPendingGoal(goalText.trim());
      navigate("/auth?mode=signup");
      return;
    }
    setBusy(true);
    try {
      setResult(await runDiagnosis(goalText.trim(), user.id));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-8xl px-4 py-20 sm:px-6 lg:px-8">
      <div className="relative isolate overflow-hidden rounded-[2rem] border border-[#1f4189]/15 bg-[radial-gradient(120%_100%_at_50%_0%,#eef1ff_0%,#ffffff_65%)] px-5 py-14 sm:px-12 dark:bg-none">
      <div aria-hidden className="absolute inset-0 -z-10 opacity-60" style={{ backgroundImage: "linear-gradient(rgba(31,65,137,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(31,65,137,0.06) 1px, transparent 1px)", backgroundSize: "48px 48px", maskImage: "radial-gradient(ellipse 60% 70% at 50% 0%, black, transparent 75%)", WebkitMaskImage: "radial-gradient(ellipse 60% 70% at 50% 0%, black, transparent 75%)" }} />
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#1f4189]">Not sure where to start?</p>
        <h2 className="mt-3 text-4xl font-extrabold tracking-[-0.04em] sm:text-5xl">Tell us where you <span className="mark">want to go.</span></h2>
        <p className="mt-4 text-lg text-muted-foreground">We match your goal to a real role, show which skills you're missing, and build the path of courses to close the gap.</p>
      </div>
      <form onSubmit={handleSubmit} className="mx-auto mt-8 max-w-xl">
        <Textarea value={goalText} onChange={(e) => setGoalText(e.target.value)} placeholder={EXAMPLE} className="min-h-32 rounded-2xl bg-card text-base shadow-[0_20px_50px_-30px_rgba(10,20,51,0.45)]" maxLength={2000} aria-label="Your career goal" />
        <div className="mt-3 flex items-center justify-between gap-3">
          <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setGoalText(EXAMPLE)}>Try the example</button>
          <Button type="submit" disabled={busy || !goalText.trim()} className="h-11 rounded-full px-6"><Sparkles className="h-4 w-4" />{busy ? "Thinking…" : "Build my path"}</Button>
        </div>
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      </form>
      {result && <div className="mx-auto mt-8 max-w-xl"><DiagnosisResult result={result} /></div>}
      </div>
    </section>
  );
}
