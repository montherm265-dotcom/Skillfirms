import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AnimatePresence, motion, useScroll, useSpring } from "framer-motion";
import { ArrowLeft, ArrowRight, Award, BookOpen, Check, CheckCircle2, Circle, Clock, Lightbulb, ListChecks, Lock, PenLine, Sparkles, Target, XCircle } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import { enroll, submitQuiz } from "@/lib/courses";
import { loadLesson, openLesson, readingMinutes, toBlocks } from "@/lib/lessons";
import { priceLabel } from "@/lib/catalog";
import VideoPlayer from "@/components/course/VideoPlayer";
import Seo from "@/components/seo/Seo";
import LessonNotes from "@/components/course/LessonNotes";
import TutorPanel from "@/components/course/TutorPanel";
import { loadCourseHiring } from "@/lib/catalog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

const PASS = 0.66;
const ease = [0.22, 1, 0.36, 1];

function Prose({ text }) {
  return toBlocks(text).map((b, i) => (b.type === "list" ? (
    <ul key={i} className="my-3 space-y-1.5 pl-5">
      {b.items.map((it, j) => <li key={j} className="list-disc leading-relaxed marker:text-mastery">{it}</li>)}
    </ul>
  ) : (
    <p key={i} className="my-3 leading-[1.75]">{b.text}</p>
  )));
}

export default function LessonReader() {
  const { slug, n } = useParams();
  const index = Math.max(1, Number(n) || 1) - 1;
  const navigate = useNavigate();
  const { user } = useAuth();
  const [course, setCourse] = useState(null);
  const [modules, setModules] = useState([]);
  const [enrollment, setEnrollment] = useState(null);
  const [progress, setProgress] = useState({});
  const [lesson, setLesson] = useState(undefined);
  const [lessonError, setLessonError] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [credentialCode, setCredentialCode] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [hiring, setHiring] = useState([]);

  const mod = modules[index];
  const [access, setAccess] = useState(true);
  const locked = Number(course?.price_cents ?? 0) > 0 && !access && index > 0;
  const { scrollYProgress } = useScroll();
  const readBar = useSpring(scrollYProgress, { stiffness: 200, damping: 30, restDelta: 0.001 });

  const loadCourse = useCallback(async () => {
    const { data: c } = await supabase.from("skillfirms_courses").select("id, slug, title, level, taught_by, price_cents, skillfirms_experts(display_name, profile_id)").eq("slug", slug).maybeSingle();
    if (!c) { setNotFound(true); return; }
    setCourse(c);
    const { data: mods } = await supabase.from("skillfirms_course_modules").select("id, title, description, order_index, duration_minutes").eq("course_id", c.id).order("order_index");
    setModules(mods ?? []);
    if (user) {
      let { data: e } = await supabase.from("skillfirms_enrollments").select("*").eq("user_id", user.id).eq("course_id", c.id).maybeSingle();
      // Opening a lesson signed in enrolls you; progress needs it.
      if (!e) e = await enroll(c.id, user.id).catch(() => null);
      setEnrollment(e);
      if (e) {
        const { data: p } = await supabase.from("skillfirms_module_progress").select("module_id, completed_at, quiz_score").eq("enrollment_id", e.id);
        setProgress(Object.fromEntries((p ?? []).map((r) => [r.module_id, r])));
      }
      const { data: cred } = await supabase.from("skillfirms_credentials").select("credential_code").eq("user_id", user.id).eq("course_id", c.id).eq("status", "active_verified").maybeSingle();
      setCredentialCode(cred?.credential_code ?? null);
    }
    // Depends on the user's id, not the user object: the sign-in refreshes
    // in the background, and a new object must not reset the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, user?.id]);
  useEffect(() => { loadCourse(); }, [loadCourse]);
  useEffect(() => { if (course?.id) loadCourseHiring(course.id).then(setHiring); }, [course?.id]);

  useEffect(() => {
    if (!mod?.id) return undefined;
    let active = true;
    setLesson(undefined);
    setLessonError(null);
    setResult(null);
    setAnswers({});
    window.scrollTo({ top: 0, behavior: "smooth" });
    // Expert lessons are written by the instructor: read them (a locked paid
    // lesson simply comes back empty); never ask the AI to write one.
    const open = course?.taught_by === "expert" ? loadLesson(mod.id) : openLesson(mod.id, { signedIn: Boolean(user) });
    open
      .then((l) => { if (active) setLesson(l); })
      .catch((e) => { if (active) { setLesson(null); setLessonError(e.message); } });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mod?.id, Boolean(user), course?.taught_by]);

  useEffect(() => {
    if (!course?.id) return;
    if (!(Number(course.price_cents) > 0)) { setAccess(true); return; }
    supabase.rpc("skillfirms_can_open_course", { p_course: course.id }).then(({ data }) => setAccess(Boolean(data)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course?.id, user?.id]);

  // Questions appear once the lesson exists (writing a lesson adds them).
  useEffect(() => {
    if (!mod || !lesson) return;
    supabase.from("skillfirms_module_quiz_questions").select("id, order_index, question, choices").eq("module_id", mod.id).order("order_index")
      .then(({ data }) => setQuestions(data ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mod?.id, Boolean(lesson)]);

  const done = Object.values(progress).filter((p) => p.completed_at).length;
  const pct = modules.length ? Math.round((100 * done) / modules.length) : 0;
  const thisDone = mod && progress[mod.id]?.completed_at;
  const minutes = useMemo(() => readingMinutes(lesson?.body), [lesson]);

  async function check() {
    if (!user) { navigate(`/auth?next=${encodeURIComponent(window.location.pathname)}`); return; }
    setBusy(true);
    try {
      const score = await submitQuiz(mod.id, answers);
      setResult({ score, passed: score >= PASS });
      await loadCourse();
    } catch (e) {
      setResult({ error: e.message });
    } finally {
      setBusy(false);
    }
  }

  if (notFound) return <p className="section-pad text-center text-sm text-muted-foreground">Course not found.</p>;
  if (!course || !modules.length) return <div className="section-pad"><div className="mx-auto max-w-3xl space-y-3"><Skeleton className="h-6 w-1/3" /><Skeleton className="h-10 w-2/3" /><Skeleton className="h-64 w-full" /></div></div>;
  if (!mod) return <p className="section-pad text-center text-sm text-muted-foreground">That lesson doesn't exist. <Link to={`/courses/${slug}`} className="underline">Back to the course</Link></p>;

  const body = lesson?.body;
  const next = modules[index + 1];
  const prev = modules[index - 1];

  return (
    <div className="section-pad">
      <motion.div aria-hidden="true" style={{ scaleX: readBar }} className="fixed inset-x-0 top-0 z-50 h-1 origin-left bg-mastery" />
      <Seo title={`${mod.title} — ${course.title}`} description={body?.summary ?? mod.description ?? course.title} canonical={`/courses/${slug}/lessons/${index + 1}`} />
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[16rem_minmax(0,1fr)]">
        {/* Lesson list */}
        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <Link to={`/courses/${slug}`} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />{course.title}</Link>
            {enrollment && (
              <div className="mt-4">
                <div className="flex justify-between text-xs text-muted-foreground"><span>{done} of {modules.length} done</span><span>{pct}%</span></div>
                <Progress value={pct} className="mt-1.5 h-1.5" />
              </div>
            )}
            <ol className="mt-5 space-y-1">
              {modules.map((m, i) => {
                const isDone = progress[m.id]?.completed_at;
                return (
                  <li key={m.id}>
                    <Link to={`/courses/${slug}/lessons/${i + 1}`} className={`flex items-start gap-2 rounded-lg px-2 py-1.5 text-sm ${i === index ? "bg-secondary font-medium" : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"}`}>
                      {isDone ? <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-mastery" /> : <Circle className="mt-0.5 h-4 w-4 flex-none" />}
                      <span>{i + 1}. {m.title}</span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </div>
        </aside>

        <article className="min-w-0">
          <Link to={`/courses/${slug}`} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground lg:hidden"><ArrowLeft className="h-4 w-4" />{course.title}</Link>
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-mastery lg:mt-0">Lesson {index + 1} of {modules.length}</p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">{mod.title}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{minutes ?? mod.duration_minutes} min read</span>
            {thisDone && <span className="inline-flex items-center gap-1 text-mastery"><Check className="h-3.5 w-3.5" />Passed</span>}
          </p>

          {lesson === undefined && (
            <div className="mt-8 rounded-2xl border border-dashed border-mastery/40 bg-mastery/5 p-6">
              <p className="flex items-center gap-2 font-medium"><Sparkles className="h-4 w-4 animate-pulse text-mastery" />Getting your lesson ready…</p>
              <p className="mt-1 text-sm text-muted-foreground">If this is the first time anyone has opened it, it's being written now. This takes under a minute, once.</p>
              <div className="mt-5 space-y-2.5"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-11/12" /><Skeleton className="h-4 w-4/5" /><Skeleton className="h-4 w-full" /></div>
            </div>
          )}
          {lesson === null && locked && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-8 overflow-hidden rounded-2xl bg-[hsl(222_38%_8%)] p-8 text-center text-white">
              <Lock className="mx-auto h-8 w-8 text-[hsl(var(--mastery))]" />
              <p className="mt-3 font-display text-2xl font-semibold">This lesson is part of the full course</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-white/70">Lesson 1 is a free preview. Get every lesson, the graded checks and the certificate for {priceLabel(course.price_cents)}.</p>
              <Link to={`/courses/${slug}`}><Button className="mt-5 bg-mastery text-mastery-foreground hover:bg-mastery/90">See the course</Button></Link>
            </motion.div>
          )}
          {lesson === null && !locked && (
            <div className="mt-8 rounded-2xl border border-border p-6 text-center">
              {!user ? (
                <>
                  <Lock className="mx-auto h-6 w-6 text-muted-foreground" />
                  <p className="mt-2 font-medium">Sign in to open this lesson</p>
                  <Button className="mt-4" onClick={() => navigate(`/auth?next=${encodeURIComponent(window.location.pathname)}`)}>Sign in — it's free</Button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">{lessonError === "daily_limit" ? "You've opened a lot of brand-new lessons today — try this one tomorrow." : "This lesson couldn't be loaded. Try again in a minute."}</p>
              )}
            </div>
          )}

          {body && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease }}>
              {body.video_url && <div className="mt-6"><VideoPlayer url={body.video_url} title={mod.title} /></div>}
              {body.summary && <p className="mt-6 text-lg leading-relaxed text-foreground/90">{body.summary}</p>}
              <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-[11px] text-muted-foreground">
                <Sparkles className="h-3 w-3" />
                {lesson.source === "expert_written" ? `Taught by ${course.skillfirms_experts?.display_name ?? "an expert"}` : lesson.reviewed_at ? "AI-taught basics · reviewed by an expert" : "AI-taught basics · drafted with AI, not yet reviewed by an expert"}
              </p>

              {body.sections.map((s, i) => (
                <section key={i} className="mt-9">
                  <h2 className="font-display text-xl font-semibold tracking-tight">{s.heading}</h2>
                  <div className="text-[15.5px] text-foreground/90"><Prose text={s.body} /></div>
                </section>
              ))}

              {body.example?.body && (
                <section className="mt-10 rounded-2xl border border-mastery/30 bg-mastery/5 p-5 sm:p-6">
                  <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-mastery"><BookOpen className="h-4 w-4" />Worked example</p>
                  <h3 className="mt-2 font-display text-lg font-semibold">{body.example.title}</h3>
                  <div className="text-[15px] text-foreground/90"><Prose text={body.example.body} /></div>
                </section>
              )}

              <div className={`mt-6 grid gap-4 ${body.try_it ? "sm:grid-cols-2" : ""}`}>
                {body.key_points?.length > 0 && (
                  <section className="rounded-2xl border border-border bg-card p-5">
                    <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground"><Lightbulb className="h-4 w-4 text-warning" />Remember</p>
                    <ul className="mt-3 space-y-2">
                      {body.key_points.map((k, i) => <li key={i} className="flex gap-2 text-sm"><Check className="mt-0.5 h-4 w-4 flex-none text-mastery" />{k}</li>)}
                    </ul>
                  </section>
                )}
                {body.try_it && (
                  <section className="rounded-2xl border border-border bg-card p-5">
                    <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground"><PenLine className="h-4 w-4 text-mastery" />Try it (10–15 min)</p>
                    <div className="text-sm"><Prose text={body.try_it} /></div>
                  </section>
                )}
              </div>

              {/* Knowledge check */}
              {questions.length > 0 && (
                <section className="mt-10 rounded-2xl border-2 border-foreground/10 bg-card p-5 sm:p-6" id="check">
                  <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground"><ListChecks className="h-4 w-4" />Knowledge check</p>
                  <h2 className="mt-1 font-display text-xl font-semibold">{thisDone ? "You passed this one" : `Get ${Math.ceil(questions.length * PASS)} of ${questions.length} right to pass`}</h2>
                  <ol className="mt-4 space-y-5">
                    {questions.map((q, qi) => (
                      <li key={q.id}>
                        <p className="font-medium">{qi + 1}. {q.question}</p>
                        <div className="mt-2 grid gap-2">
                          {q.choices.map((c, ci) => {
                            const on = answers[q.id] === ci;
                            return (
                              <button key={ci} type="button" disabled={busy} onClick={() => setAnswers((a) => ({ ...a, [q.id]: ci }))}
                                className={`rounded-xl border px-3.5 py-2.5 text-left text-sm transition-colors ${on ? "border-mastery bg-mastery/10 font-medium" : "border-border hover:border-foreground/30"}`}>
                                {c}
                              </button>
                            );
                          })}
                        </div>
                      </li>
                    ))}
                  </ol>
                  <AnimatePresence mode="wait">
                    {result?.error && <motion.p key="e" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 text-sm text-destructive">{result.error}</motion.p>}
                    {result && !result.error && (
                      <motion.div key={result.passed ? "p" : "f"} initial={{ opacity: 0, y: 8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.35, ease }}
                        className={`mt-5 flex items-start gap-3 rounded-xl p-4 ${result.passed ? "bg-mastery/10" : "bg-destructive/10"}`}>
                        {result.passed ? <CheckCircle2 className="h-6 w-6 flex-none text-mastery" /> : <XCircle className="h-6 w-6 flex-none text-destructive" />}
                        <div>
                          <p className="font-semibold">{Math.round(result.score * 100)}% — {result.passed ? "passed" : "not yet"}</p>
                          <p className="text-sm text-muted-foreground">{result.passed ? "This counts toward your skill and your course certificate." : "Have another read of the lesson and try again — you get 5 tries a day."}</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {!user ? (
                      <Button onClick={() => navigate(`/auth?next=${encodeURIComponent(window.location.pathname)}`)}>Sign in to take the check</Button>
                    ) : (
                      <Button onClick={check} disabled={busy || Object.keys(answers).length < questions.length}>{busy ? "Checking…" : thisDone ? "Take it again" : "Check my answers"}</Button>
                    )}
                    {(thisDone || result?.passed) && next && <Button variant="outline" onClick={() => navigate(`/courses/${slug}/lessons/${index + 2}`)}>Next lesson<ArrowRight className="h-4 w-4" /></Button>}
                  </div>
                </section>
              )}

              {credentialCode && pct >= 100 && (
                <motion.section initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, ease }}
                  className="mt-8 overflow-hidden rounded-2xl bg-primary p-6 text-primary-foreground">
                  <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-mastery"><Award className="h-4 w-4" />Course complete</p>
                  <p className="mt-2 font-display text-2xl font-bold">You've earned your {course.title} certificate</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button className="bg-mastery text-mastery-foreground hover:bg-mastery/90" onClick={() => navigate(`/credentials/${credentialCode}`)}>See your certificate</Button>
                    {hiring.some((h) => !h.sent) && (
                      <Button className="bg-warning text-black hover:bg-warning/90" onClick={() => navigate(`/courses/${slug}#hiring`)}>Send it to {hiring.find((h) => !h.sent).company} (hiring)</Button>
                    )}
                    <Button variant="outline" className="border-white/30 bg-transparent text-primary-foreground hover:bg-white/10" onClick={() => navigate("/missions")}><Target className="h-4 w-4" />Prove it in a Mission</Button>
                  </div>
                </motion.section>
              )}

              {user && <LessonNotes userId={user.id} moduleId={mod.id} />}

              <nav className="mt-10 flex items-center justify-between gap-3 border-t border-border pt-6">
                {prev ? <Link to={`/courses/${slug}/lessons/${index}`} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />{prev.title}</Link> : <span />}
                {next ? <Link to={`/courses/${slug}/lessons/${index + 2}`} className="flex items-center gap-1.5 text-right text-sm font-medium hover:underline">{next.title}<ArrowRight className="h-4 w-4" /></Link> : <Link to={`/courses/${slug}`} className="text-sm font-medium hover:underline">Back to the course</Link>}
              </nav>
            </motion.div>
          )}
        </article>
      </div>
      <TutorPanel user={user} moduleId={mod.id} lessonTitle={mod.title} ready={Boolean(body)} />
    </div>
  );
}
