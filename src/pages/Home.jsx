import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight, Award, BarChart3, BrainCircuit, Briefcase, CheckCircle2, Cog, Compass, FlaskConical, KanbanSquare,
  ListChecks, Search, ShieldCheck, Sparkles,
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

const ICONS = { FlaskConical, Cog, KanbanSquare, BarChart3, BrainCircuit, Compass };
const ease = [0.22, 1, 0.36, 1];
const EXAMPLE = "I'm a mechanical engineer with 1 year of experience and I want to work in pharmaceutical CQV within 12 months.";
const fadeUp = { hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0, transition: { duration: 0.6, ease } } };

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [courses, setCourses] = useState(null);
  const [mine, setMine] = useState([]);
  const [q, setQ] = useState("");
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
        description="Free courses for real jobs. Every lesson ends in a graded check, and your certificate shows as verified skill proof on Talfirms."
        jsonLd={{
          "@context": "https://schema.org",
          "@graph": [
            { "@type": "Organization", "@id": "https://skillfirms.com/#organization", name: "Skillfirms", url: "https://skillfirms.com" },
            { "@type": "WebSite", "@id": "https://skillfirms.com/#website", name: "Skillfirms", url: "https://skillfirms.com", publisher: { "@id": "https://skillfirms.com/#organization" } },
          ],
        }}
      />

      {/* Hero */}
      <section className="relative isolate overflow-hidden border-b border-border">
        <div className="bg-grid absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_at_top,black,transparent_75%)]" />
        <div className="absolute -left-40 top-10 -z-10 h-[28rem] w-[28rem] rounded-full bg-mastery/20 blur-3xl" />
        <div className="mx-auto grid max-w-8xl grid-cols-[minmax(0,1fr)] items-center gap-12 px-4 pb-16 pt-12 sm:px-6 sm:pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:pb-24">
          <motion.div className="min-w-0" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.08 } } }}>
            <motion.p variants={fadeUp} className="flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              <motion.span className="h-px w-8 origin-left bg-mastery" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.6, ease, delay: 0.2 }} />
              The Skill Bridge for Talfirms
            </motion.p>
            <motion.h1 variants={fadeUp} className="mt-5 max-w-xl font-display text-[2.6rem] font-semibold leading-[1.05] tracking-tight sm:text-6xl">
              Learn the job. <span className="italic text-mastery">Prove it.</span> Get hired.
            </motion.h1>
            <motion.p variants={fadeUp} className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
              Free courses built for real jobs. Every lesson ends in a graded check, and your certificate shows on your Talfirms profile as verified proof that employers can see.
            </motion.p>
            <motion.form variants={fadeUp} onSubmit={(e) => { e.preventDefault(); navigate(q.trim() ? `/courses?q=${encodeURIComponent(q.trim())}` : "/courses"); }}
              className="mt-8 flex max-w-xl items-center gap-2 rounded-full border border-border bg-background p-1.5 pl-5 shadow-soft focus-within:ring-2 focus-within:ring-ring/20">
              <Search className="h-5 w-5 flex-none text-muted-foreground" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="What do you want to learn?" aria-label="Search courses" className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground" />
              <Button type="submit" className="h-11 rounded-full px-6">Search</Button>
            </motion.form>
            <motion.div variants={fadeUp} className="mt-4 flex flex-wrap gap-2 text-sm">
              {["CQV", "GMP", "SQL", "Agile", "Machine learning"].map((t) => (
                <Link key={t} to={`/courses?q=${encodeURIComponent(t)}`} className="rounded-full border border-border bg-card px-3 py-1 text-muted-foreground transition hover:-translate-y-px hover:border-foreground/20 hover:text-foreground">{t}</Link>
              ))}
            </motion.div>
            <motion.dl variants={fadeUp} className="mt-10 grid max-w-md grid-cols-3 gap-6 border-t border-border pt-6">
              {[["Courses", totals.courses], ["Lessons", totals.lessons], ["Graded questions", totals.questions]].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="mt-1 font-display text-3xl font-semibold tabular-nums">{courses ? value : "–"}</dd>
                </div>
              ))}
            </motion.dl>
          </motion.div>
          <ProofStory courses={courses} />
        </div>
      </section>

      {/* Continue learning */}
      {mine.length > 0 && (
        <section className="mx-auto max-w-8xl px-4 pt-12 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between gap-4">
            <h2 className="font-display text-2xl font-semibold">Continue learning</h2>
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
        <h2 className="font-display text-2xl font-semibold sm:text-3xl">Explore by career</h2>
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
            <h2 className="font-display text-2xl font-semibold">{cat.label}</h2>
            <Link to={`/courses?category=${cat.id}`} className="group inline-flex flex-none items-center gap-1.5 text-sm font-semibold">See all<ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" /></Link>
          </div>
          <div className="no-scrollbar -mx-4 mt-4 flex snap-x gap-5 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
            {list.map((c) => <div key={c.id} className="w-72 flex-none snap-start"><CourseCard course={c} saved={saved.has(c.id)} onToggleSave={toggle} hiring={hiring[c.id]} /></div>)}
          </div>
        </section>
      ))}

      {/* Why different */}
      <section className="mx-auto mt-20 max-w-8xl px-4 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-3xl bg-[hsl(222_38%_8%)] p-6 text-white sm:p-10">
          <p className="eyebrow text-[hsl(var(--mastery))]">Not just another course site</p>
          <h2 className="mt-2 max-w-2xl font-display text-3xl font-semibold leading-tight sm:text-4xl">A certificate that counts for something, because the jobs are next door.</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            {[
              { icon: ListChecks, t: "Graded, not clicked through", d: "You can't finish a course by pressing Next. Each lesson ends in a check you have to pass." },
              { icon: ShieldCheck, t: "Proof employers see", d: "Pass a course and its skills show as verified on your Talfirms profile. You can turn this off at any time." },
              { icon: Briefcase, t: "Learn for a real opening", d: "Each course shows the open Talfirms jobs that ask for its skills, and how your fit changes." },
            ].map((s) => (
              <div key={s.t}>
                <s.icon className="h-6 w-6 text-[hsl(var(--mastery))]" />
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
function ProofStory({ courses }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep((s) => (s + 1) % 3), 2600);
    return () => clearInterval(t);
  }, []);
  const course = courses?.find((c) => c.slug === "cqv-bootcamp") ?? courses?.[0];
  return (
    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease, delay: 0.2 }} className="relative mx-auto w-full max-w-md">
      <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-br from-mastery/25 via-transparent to-warning/20 blur-2xl" />
      <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-[0_40px_80px_-40px_hsl(var(--foreground)/0.5)]">
        {course ? <CourseCover course={course} size="lg" className="aspect-[16/8]" /> : <div className="aspect-[16/8] bg-secondary" />}
        <div className="p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Example</p>
          <p className="mt-1 font-display text-xl font-semibold">{course?.title ?? "Your course"}</p>
          <ol className="mt-4 space-y-2.5">
            {[
              { icon: CheckCircle2, t: "Lesson 4 check passed", d: "3 of 3 correct" },
              { icon: Award, t: "Certificate earned", d: "Every lesson passed" },
              { icon: Sparkles, t: "Verified on Talfirms", d: "Fit for a matching job rises from 64% to 82%" },
            ].map((s, i) => (
              <motion.li key={s.t} animate={{ opacity: step >= i ? 1 : 0.35, x: step >= i ? 0 : -4 }} transition={{ duration: 0.4, ease }}
                className={`flex items-center gap-3 rounded-xl border p-3 ${step >= i ? "border-mastery/40 bg-mastery/5" : "border-border"}`}>
                <s.icon className={`h-5 w-5 flex-none ${step >= i ? "text-mastery" : "text-muted-foreground"}`} />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{s.t}</span>
                  <span className="block text-xs text-muted-foreground">{s.d}</span>
                </span>
              </motion.li>
            ))}
          </ol>
          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.3 }}
              className="mt-4 flex items-center justify-between rounded-xl bg-secondary px-3 py-2 text-xs">
              <span className="text-muted-foreground">Job fit</span>
              <span className="font-display text-lg font-semibold tabular-nums">{step === 2 ? "82%" : "64%"}</span>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

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
      <div className="mx-auto max-w-2xl text-center">
        <p className="eyebrow">Not sure where to start?</p>
        <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">Tell us where you want to go</h2>
        <p className="mt-3 text-muted-foreground">We match your goal to a real role, show which skills you're missing, and build the path of courses and missions to close the gap.</p>
      </div>
      <form onSubmit={handleSubmit} className="mx-auto mt-8 max-w-xl">
        <Textarea value={goalText} onChange={(e) => setGoalText(e.target.value)} placeholder={EXAMPLE} className="min-h-28 text-base" maxLength={2000} aria-label="Your career goal" />
        <div className="mt-3 flex items-center justify-between gap-3">
          <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setGoalText(EXAMPLE)}>Try the example</button>
          <Button type="submit" disabled={busy || !goalText.trim()}><Sparkles className="h-4 w-4" />{busy ? "Thinking…" : "Build my path"}</Button>
        </div>
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      </form>
      {result && <div className="mx-auto mt-8 max-w-xl"><DiagnosisResult result={result} /></div>}
    </section>
  );
}
