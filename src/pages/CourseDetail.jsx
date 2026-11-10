import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import {
  ArrowRight, Award, Bookmark, BookmarkCheck, Bot, Briefcase, Check, CheckCircle2, ChevronDown, Circle, Clock, ExternalLink,
  Link2, ListChecks, Lock, MapPin, PlayCircle, ShieldCheck, Smartphone, Sparkles, Target, Users,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import { enroll } from "@/lib/courses";
import { formatHours, loadCatalog, loadCourseHiring, loadCourseJobs, loadReviews, priceLabel, saveReview, shapeCourse } from "@/lib/catalog";
import { buyCourse, loadMyPurchase } from "@/lib/studio";
import HiringBanner from "@/components/course/HiringBanner";
import JobGoalBanner from "@/components/course/JobGoalBanner";
import { jobGoalFromParams, rememberJobGoal } from "@/lib/jobGoal";
import { readRef, rememberRef } from "@/lib/plans";
import { TALFIRMS_URL } from "@/lib/externalLinks";
import { crossAppClick } from "@/lib/crossApp";
import CourseCover from "@/components/course/CourseCover";
import CourseCard from "@/components/course/CourseCard";
import Stars, { RatingLine } from "@/components/course/Stars";
import useSaved from "@/components/course/useSaved";
import Seo from "@/components/seo/Seo";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

const ease = [0.22, 1, 0.36, 1];

export default function CourseDetail() {
  const { slug } = useParams();
  const [params] = useSearchParams();
  const { user } = useAuth();
  useEffect(() => { rememberJobGoal(jobGoalFromParams(params)); }, [params]);
  // Came through the expert's own link (?ref=CODE): the sale is theirs (97%).
  useEffect(() => { rememberRef(slug, params.get("ref")); }, [slug, params]);
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [modules, setModules] = useState([]);
  const [lessons, setLessons] = useState({});
  const [enrollment, setEnrollment] = useState(null);
  const [progressByModule, setProgressByModule] = useState({});
  const [credential, setCredential] = useState(null);
  const [reviews, setReviews] = useState(null);
  const [jobs, setJobs] = useState(null);
  const [related, setRelated] = useState([]);
  const [hiring, setHiring] = useState([]);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(0);
  const [busy, setBusy] = useState(false);
  const [access, setAccess] = useState(false);
  const [purchase, setPurchase] = useState(null);
  const { saved, toggle } = useSaved();
  const userId = user?.id;

  const load = useCallback(async () => {
    const { data: c, error: e } = await supabase
      .from("skillfirms_courses")
      .select("*, skillfirms_experts(display_name, headline, profile_id), skillfirms_course_modules(id, duration_minutes), skillfirms_course_skills(coverage, skillfirms_skills(slug, name))")
      .eq("slug", slug).maybeSingle();
    if (e || !c) { setError("Course not found"); return; }
    const shaped = shapeCourse(c);
    setCourse(shaped);

    const [{ data: mods }, enr, cred] = await Promise.all([
      supabase.from("skillfirms_course_modules").select("id, title, description, order_index, duration_minutes, has_quiz, video_url").eq("course_id", c.id).order("order_index"),
      userId ? supabase.from("skillfirms_enrollments").select("*").eq("user_id", userId).eq("course_id", c.id).maybeSingle() : Promise.resolve({ data: null }),
      userId ? supabase.from("skillfirms_credentials").select("credential_code").eq("user_id", userId).eq("course_id", c.id).eq("status", "active_verified").maybeSingle() : Promise.resolve({ data: null }),
    ]);
    setModules(mods ?? []);
    setEnrollment(enr.data ?? null);
    setCredential(cred.data ?? null);
    if (mods?.length) {
      const { data: ls } = await supabase.from("skillfirms_lessons").select("module_id, body, reviewed_at").in("module_id", mods.map((m) => m.id));
      setLessons(Object.fromEntries((ls ?? []).filter((l) => l.body).map((l) => [l.module_id, l])));
    }
    if (enr.data) {
      const { data: p } = await supabase.from("skillfirms_module_progress").select("module_id, completed_at, quiz_score").eq("enrollment_id", enr.data.id);
      setProgressByModule(Object.fromEntries((p ?? []).map((r) => [r.module_id, r])));
    }
    if (Number(c.price_cents) > 0) {
      supabase.rpc("skillfirms_can_open_course", { p_course: c.id }).then(({ data }) => setAccess(Boolean(data)));
      loadMyPurchase(userId, c.id).then(setPurchase);
    } else {
      setAccess(true);
    }
    loadReviews(c.id).then(setReviews);
    loadCourseJobs(c.id).then(setJobs);
    loadCourseHiring(c.id).then(setHiring);
    loadCatalog().then((all) => setRelated(all.filter((x) => x.id !== c.id && x.category?.id === shaped.category?.id).slice(0, 4))).catch(() => {});
  }, [slug, userId]);

  useEffect(() => { setCourse(null); setError(null); load(); }, [load]);
  // Arriving at /courses/x#hiring (e.g. from "send it to ..."): scroll there once it's loaded.
  useEffect(() => {
    if (hiring.length && window.location.hash === "#hiring") document.getElementById("hiring")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [hiring.length]);

  const learn = useMemo(() => {
    const points = [];
    for (const m of modules) {
      const kp = lessons[m.id]?.body?.key_points ?? [];
      points.push(...kp.slice(0, 2));
    }
    return points.slice(0, 8);
  }, [modules, lessons]);

  const nextIndex = Math.max(0, modules.findIndex((m) => !progressByModule[m.id]?.completed_at));
  const passed = modules.filter((m) => progressByModule[m.id]?.completed_at).length;
  const questions = modules.length * 3;
  const reviewedAll = modules.length > 0 && modules.every((m) => lessons[m.id]?.reviewed_at);
  const realExpert = course?.skillfirms_experts?.profile_id && course?.taught_by === "expert" ? course.skillfirms_experts : null;
  const paid = Number(course?.price_cents ?? 0) > 0;
  const videoCount = modules.filter((m) => m.video_url).length;
  const locked = paid && !access;

  async function buy() {
    if (!user) { navigate(`/auth?mode=signup&next=${encodeURIComponent(`/courses/${slug}`)}`); return; }
    setBusy(true);
    try {
      const p = await buyCourse(course.id, readRef(slug));
      setPurchase(p);
      if (p.payment_status === "paid" || p.payment_status === "credit") { setAccess(true); toast.success("You're in."); }
      else toast.success("You're on the list. Nothing is charged; we'll let you know when buying opens.");
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  }

  async function start() {
    if (locked) { buy(); return; }
    if (!user) { navigate(`/auth?mode=signup&next=${encodeURIComponent(`/courses/${slug}/lessons/1`)}`); return; }
    if (enrollment) { navigate(`/courses/${slug}/lessons/${nextIndex + 1}`); return; }
    setBusy(true);
    try {
      const row = await enroll(course.id, user.id);
      setEnrollment(row);
      navigate(`/courses/${slug}/lessons/1`);
    } catch {
      toast.error("Couldn't enroll you. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function share() {
    navigator.clipboard?.writeText(window.location.href).then(() => toast.success("Link copied"), () => {});
  }

  if (error) return <p className="section-pad text-center text-sm text-muted-foreground">{error}. <Link to="/courses" className="font-medium text-mastery hover:underline">Browse all courses</Link></p>;
  if (!course) return <DetailSkeleton />;

  const isSaved = saved.has(course.id);
  const cta = locked
    ? (purchase?.status === "waitlist" ? "You're on the list" : `Buy · ${priceLabel(course.price_cents)}`)
    : !enrollment ? (paid ? "Start learning" : "Start learning — free") : credential ? "Review the course" : passed > 0 ? `Continue: lesson ${nextIndex + 1}` : "Start lesson 1";

  return (
    <div>
      <Seo
        title={course.title}
        description={course.description || `${course.title}: ${paid ? "an expert-taught" : "a free AI-taught"} Skillfirms course with a graded check on every lesson.`}
        canonical={`/courses/${slug}`}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Course",
          name: course.title,
          description: course.description || undefined,
          provider: { "@type": "Organization", name: "Skillfirms" },
          isAccessibleForFree: !paid,
          educationalLevel: course.level || undefined,
          timeRequired: `PT${course.total_minutes}M`,
          ...(course.rating_count ? { aggregateRating: { "@type": "AggregateRating", ratingValue: course.rating_avg, ratingCount: course.rating_count } } : {}),
        }}
        breadcrumb={[{ label: "Courses", path: "/courses" }, { label: course.title }]}
      />

      {/* Hero */}
      <section className="relative overflow-hidden bg-[#050b24] text-white">
        <div aria-hidden className="absolute -left-40 -top-56 h-[32rem] w-[32rem] rounded-full blur-3xl" style={{ background: "radial-gradient(closest-side, rgba(59,108,230,0.42), transparent)" }} />
        <div aria-hidden className="absolute -bottom-56 right-[-6rem] h-[30rem] w-[30rem] rounded-full blur-3xl" style={{ background: "radial-gradient(closest-side, rgba(107,140,255,0.24), transparent)", animation: "tf-drift 22s ease-in-out infinite" }} />
        <div aria-hidden className="absolute inset-0 opacity-70" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)", backgroundSize: "56px 56px", maskImage: "radial-gradient(ellipse 70% 80% at 30% 20%, black, transparent 80%)", WebkitMaskImage: "radial-gradient(ellipse 70% 80% at 30% 20%, black, transparent 80%)" }} />
        <div className="relative mx-auto grid max-w-8xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:px-8 lg:py-14">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease }}>
            <p className="flex flex-wrap items-center gap-2 text-sm text-white/70">
              <Link to="/courses" className="hover:text-white">Courses</Link><span>›</span>
              <Link to={`/courses?category=${course.category?.id}`} className="font-medium text-[#9db7ff] hover:underline">{course.category?.label}</Link>
            </p>
            <h1 className="mt-4 max-w-3xl text-[2.3rem] font-extrabold leading-[1.04] tracking-[-0.04em] sm:text-[3.4rem]">{course.title}</h1>
            {course.description && <p className="mt-4 max-w-2xl text-lg leading-relaxed text-white/70">{course.description}</p>}
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              {hiring.length > 0 && <a href="#hiring" className="rounded-md bg-warning px-2 py-0.5 text-xs font-bold text-black">Hiring now</a>}
              {course.rating_count ? <RatingLine course={course} className="[&_.text-muted-foreground]:text-white/60" /> : <span className="rounded-md bg-mastery px-2 py-0.5 text-xs font-bold text-mastery-foreground">New course</span>}
              {course.enrollment_count > 0 && <span className="inline-flex items-center gap-1.5 text-white/80"><Users className="h-4 w-4" />{course.enrollment_count.toLocaleString()} learner{course.enrollment_count === 1 ? "" : "s"}</span>}
              <span className="inline-flex items-center gap-1.5 text-white/80"><Clock className="h-4 w-4" />{formatHours(course)}</span>
              <span className="capitalize text-white/80">{course.level ?? "All levels"}</span>
            </div>
            {realExpert ? (
              <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/10 py-1 pl-1 pr-3 text-sm">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[hsl(var(--mastery))] font-display text-sm font-semibold text-black">{realExpert.display_name.slice(0, 1)}</span>
                <span>Taught by <b>{realExpert.display_name}</b>{realExpert.headline ? <span className="text-white/70"> · {realExpert.headline}</span> : null}</span>
              </p>
            ) : (
              <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-white/60">
                <Bot className="h-3.5 w-3.5" />
                {reviewedAll ? "AI-taught basics, reviewed by an expert" : "AI-taught basics: lessons drafted with AI and not yet reviewed by an expert (each lesson says so)."}
              </p>
            )}
            {course.skills.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-1.5">
                {course.skills.map((s) => <span key={s.slug} className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-xs">{s.name}</span>)}
              </div>
            )}
          </motion.div>
        </div>
      </section>

      <div className="mx-auto grid max-w-8xl gap-10 px-4 pb-16 sm:px-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:px-8">
        {/* Sticky buy box (overlaps the hero on large screens) */}
        <aside className="relative z-10 order-first -mt-2 lg:order-last lg:-mt-64">
          <div className="lg:sticky lg:top-20">
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, ease, delay: 0.1 }}
              className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_30px_60px_-30px_hsl(var(--foreground)/0.45)]">
              <button type="button" onClick={start} className="group relative block w-full" aria-label={cta}>
                <CourseCover course={course} size="lg" className="aspect-[16/9] w-full" />
                <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/20">
                  <PlayCircle className="h-14 w-14 text-white opacity-90 drop-shadow-lg transition group-hover:scale-110" strokeWidth={1.25} />
                </span>
              </button>
              <div className="p-5">
                <p className="text-3xl font-extrabold tracking-[-0.03em]">{access && paid ? "You have access" : priceLabel(course.price_cents)}</p>
                <p className="text-xs text-muted-foreground">{paid ? "One payment: every lesson, the graded checks and the certificate. Lesson 1 is a free preview." : "Learning, graded checks and the certificate are all free."}</p>
                {locked && <Link to={`/courses/${slug}/lessons/1`} className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-mastery hover:underline"><PlayCircle className="h-4 w-4" />Watch lesson 1 free</Link>}
                {locked && purchase?.status === "waitlist" && <p className="mt-2 rounded-lg bg-secondary p-2 text-xs">You're on the list. Nothing has been charged; we'll let you know when buying opens.</p>}
                {enrollment && (
                  <div className="mt-4">
                    <div className="flex justify-between text-xs"><span className="font-medium">{passed} of {modules.length} lessons passed</span><span className="tabular-nums text-mastery">{Math.round(enrollment.progress_percent)}%</span></div>
                    <Progress value={enrollment.progress_percent} className="mt-1.5 h-1.5" />
                  </div>
                )}
                <Button className="mt-4 h-11 w-full text-base" onClick={start} disabled={busy}>{busy ? "Starting…" : cta}<ArrowRight className="h-4 w-4" /></Button>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {toggle && <Button variant="outline" size="sm" onClick={() => toggle(course)}>{isSaved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}{isSaved ? "Saved" : "Save"}</Button>}
                  <Button variant="outline" size="sm" onClick={share} className={toggle ? "" : "col-span-2"}><Link2 className="h-4 w-4" />Share</Button>
                </div>
                {credential && (
                  <Link to={`/credentials/${credential.credential_code}`} className="mt-4 flex items-center gap-2 rounded-xl bg-mastery/10 p-3 text-sm font-medium text-mastery hover:bg-mastery/15">
                    <Award className="h-5 w-5" />You've earned this certificate
                  </Link>
                )}
                <p className="mt-5 text-sm font-semibold">This course includes</p>
                <ul className="mt-2 space-y-2 text-sm text-foreground/85">
                  {realExpert ? (
                    <>
                      <li className="flex gap-2.5"><PlayCircle className="h-4 w-4 flex-none text-muted-foreground" /><span>{modules.length} lessons{videoCount ? `, ${videoCount} with video` : ""}, taught by {realExpert.display_name}</span></li>
                      <li className="flex gap-2.5"><ListChecks className="h-4 w-4 flex-none text-muted-foreground" />A graded check in every lesson, written by the instructor</li>
                    </>
                  ) : (
                    <>
                      <li className="flex gap-2.5"><PlayCircle className="h-4 w-4 flex-none text-muted-foreground" />{modules.length} AI-drafted lessons with worked examples</li>
                      <li className="flex gap-2.5"><ListChecks className="h-4 w-4 flex-none text-muted-foreground" />{questions} graded questions, 2 of 3 to pass each lesson</li>
                      <li className="flex gap-2.5"><Target className="h-4 w-4 flex-none text-muted-foreground" />A hands-on exercise in every lesson</li>
                    </>
                  )}
                  <li className="flex gap-2.5"><Sparkles className="h-4 w-4 flex-none text-muted-foreground" /><span>An AI tutor beside every lesson (<Link to="/pro" className="underline-offset-2 hover:underline">free daily questions</Link>)</span></li>
                  <li className="flex gap-2.5"><Award className="h-4 w-4 flex-none text-muted-foreground" />Certificate anyone can verify online</li>
                  {realExpert
                    ? <li className="flex gap-2.5"><ShieldCheck className="h-4 w-4 flex-none text-mastery" />Verified on Talfirms, labelled taught by an expert</li>
                    : <li className="flex gap-2.5"><ShieldCheck className="h-4 w-4 flex-none text-mastery" />Verified on Talfirms, labelled taught by AI</li>}
                  <li className="flex gap-2.5"><Smartphone className="h-4 w-4 flex-none text-muted-foreground" />Learn on phone or computer, at your pace</li>
                </ul>
              </div>
            </motion.div>
          </div>
        </aside>

        <main className="min-w-0 pt-8 lg:pt-10">
          <JobGoalBanner className="mb-6" />
          <HiringBanner hiring={hiring} user={user} hasCertificate={Boolean(credential)} lessons={modules.length} onSent={() => loadCourseHiring(course.id).then(setHiring)} />
          {learn.length > 0 && (
            <section className="rounded-2xl border border-border p-5 sm:p-6">
              <h2 className="text-2xl font-extrabold tracking-[-0.03em]">What you'll learn</h2>
              <ul className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
                {learn.map((p, i) => <li key={i} className="flex gap-2.5 text-sm"><Check className="mt-0.5 h-4 w-4 flex-none text-mastery" />{p}</li>)}
              </ul>
            </section>
          )}

          {/* Curriculum */}
          <section className="mt-10">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <h2 className="text-2xl font-extrabold tracking-[-0.03em]">Course content</h2>
              <p className="text-sm text-muted-foreground">{modules.length} lessons · {formatHours(course)} · {questions} graded questions</p>
            </div>
            <div className="mt-4 divide-y divide-border overflow-hidden rounded-2xl border border-border">
              {modules.map((m, i) => {
                const p = progressByModule[m.id];
                const body = lessons[m.id]?.body;
                const isOpen = open === i;
                return (
                  <div key={m.id}>
                    <button type="button" onClick={() => setOpen(isOpen ? -1 : i)} aria-expanded={isOpen}
                      className="flex w-full items-center gap-3 bg-secondary/40 px-4 py-3.5 text-left hover:bg-secondary/70">
                      <ChevronDown className={`h-4 w-4 flex-none transition-transform ${isOpen ? "rotate-180" : ""}`} />
                      <span className="min-w-0 flex-1 font-medium">{i + 1}. {m.title}</span>
                      {p?.completed_at ? <CheckCircle2 className="h-4 w-4 flex-none text-mastery" /> : null}
                      <span className="flex-none text-xs text-muted-foreground">{m.duration_minutes} min</span>
                    </button>
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease }} className="overflow-hidden">
                          <div className="px-4 pb-4 pl-11 pt-3 text-sm">
                            <p className="text-muted-foreground">{body?.summary ?? m.description}</p>
                            {body?.sections?.length > 0 && (
                              <ul className="mt-3 space-y-1.5">
                                {body.sections.map((s, j) => <li key={j} className="flex gap-2"><Circle className="mt-1.5 h-2 w-2 flex-none fill-current text-muted-foreground" />{s.heading}</li>)}
                                {body.example?.title && <li className="flex gap-2"><Circle className="mt-1.5 h-2 w-2 flex-none fill-current text-mastery" />Worked example: {body.example.title}</li>}
                              </ul>
                            )}
                            <div className="mt-3 flex flex-wrap items-center gap-3">
                              <Link to={`/courses/${slug}/lessons/${i + 1}`} className="inline-flex items-center gap-1 font-medium text-mastery hover:underline">{p?.completed_at ? "Open again" : "Open lesson"}<ArrowRight className="h-3.5 w-3.5" /></Link>
                              <span className="text-xs text-muted-foreground">{p?.completed_at ? `Passed${p.quiz_score != null ? ` · ${Math.round(p.quiz_score * 100)}%` : ""}` : locked && i > 0 ? "Unlocks when you buy the course" : "Ends in a graded check"}</span>
                              {locked && i > 0 && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </section>

          {/* How proof works */}
          <section className="mt-10 grid gap-3 sm:grid-cols-3">
            {[
              { icon: PlayCircle, t: "Learn", d: "Read each lesson, work through the example and the exercise." },
              { icon: ListChecks, t: "Pass the checks", d: "Every lesson ends in a graded check. Pass them all to earn the certificate." },
              { icon: ShieldCheck, t: "Show it on Talfirms", d: "Your certificate becomes verified skill proof on your Talfirms profile, which employers see." },
            ].map((s, i) => (
              <motion.div key={s.t} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08, duration: 0.4, ease }}
                className="rounded-2xl border border-border bg-card p-5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-mastery/10 text-mastery"><s.icon className="h-5 w-5" /></span>
                <p className="mt-3 font-display text-lg font-semibold">{i + 1}. {s.t}</p>
                <p className="mt-1 text-sm text-muted-foreground">{s.d}</p>
              </motion.div>
            ))}
          </section>

          {jobs && <JobsUnlocked jobs={jobs} course={course} />}

          <Reviews course={course} reviews={reviews} onSaved={() => { loadReviews(course.id).then(setReviews); load(); }} />

          {related.length > 0 && (
            <section className="mt-12">
              <h2 className="text-2xl font-extrabold tracking-[-0.03em]">More in {course.category?.label}</h2>
              <div className="mt-4 grid gap-5 sm:grid-cols-2">
                {related.map((c) => <CourseCard key={c.id} course={c} saved={saved.has(c.id)} onToggleSave={toggle} compact />)}
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

function JobsUnlocked({ jobs, course }) {
  if (!jobs.jobs_total) {
    return (
      <section className="mt-10 rounded-2xl border border-dashed border-border p-5">
        <p className="flex items-center gap-2 font-display text-lg font-semibold"><Briefcase className="h-5 w-5 text-mastery" />Jobs on Talfirms</p>
        <p className="mt-1 text-sm text-muted-foreground">No open Talfirms job asks for these skills right now. When one does, it shows up here.</p>
      </section>
    );
  }
  return (
    <section className="mt-10 overflow-hidden rounded-2xl border border-mastery/30 bg-gradient-to-br from-mastery/10 via-card to-card">
      <div className="p-5 sm:p-6">
        <p className="eyebrow text-mastery">Skill Bridge</p>
        <h2 className="mt-1 text-2xl font-extrabold tracking-[-0.03em]">{jobs.jobs_total} open job{jobs.jobs_total === 1 ? "" : "s"} on Talfirms ask for these skills</h2>
        {jobs.gap_jobs > 0 && <p className="mt-1 text-sm">You're missing them on <span className="font-semibold">{jobs.gap_jobs}</span>. This course fills that gap.</p>}
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {jobs.jobs.map((j) => {
            const path = `/opportunities/${j.id}`;
            return (
              <li key={j.id}>
                <a href={`${TALFIRMS_URL}${path}`} onClick={crossAppClick(TALFIRMS_URL, path)} target="_blank" rel="noreferrer"
                  className="group flex h-full items-start justify-between gap-3 rounded-xl border border-border bg-background p-3 transition hover:border-mastery/50">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{j.title}</span>
                    <span className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                      {j.company}{j.via_agency ? " · via agency" : ""}{j.city ? <><MapPin className="ml-1 h-3 w-3" />{j.city}</> : j.remote_ok ? " · Remote" : ""}
                    </span>
                  </span>
                  <span className="flex flex-none flex-col items-end gap-1">
                    {j.my_fit != null && <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold tabular-nums">{Math.round(j.my_fit)}% fit</span>}
                    {j.fills_gap && <span className="text-[10px] font-semibold uppercase tracking-wide text-mastery">Fills a gap</span>}
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground" />
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">
          Pass every lesson of {course.title} and these skills show on your Talfirms profile{course.taught_by === "expert" ? " as verified, taught by an expert" : " as verified, taught by AI"}. You can turn that off in Settings.
        </p>
      </div>
    </section>
  );
}

function Reviews({ course, reviews, onSaved }) {
  const { user } = useAuth();
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (reviews?.mine) { setRating(reviews.mine.rating); setBody(reviews.mine.body ?? ""); }
  }, [reviews?.mine]);

  if (!reviews) return null; // reviews not switched on yet
  const total = reviews.count ?? 0;

  async function submit(e) {
    e.preventDefault();
    if (!rating) return;
    setBusy(true);
    try {
      await saveReview(course.id, rating, body.trim());
      toast.success("Thanks — your review is up");
      setEditing(false);
      onSaved();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-12">
      <h2 className="text-2xl font-extrabold tracking-[-0.03em]">Learner reviews</h2>
      {total === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">No reviews yet. Only people who have passed at least one lesson can review, so every review comes from someone who did the work.</p>
      ) : (
        <div className="mt-4 grid gap-6 sm:grid-cols-[11rem_minmax(0,1fr)]">
          <div>
            <p className="font-display text-5xl font-semibold text-warning">{Number(reviews.avg).toFixed(1)}</p>
            <Stars value={Number(reviews.avg)} size="h-4 w-4" />
            <p className="mt-1 text-xs text-muted-foreground">{total} review{total === 1 ? "" : "s"}</p>
          </div>
          <div className="space-y-1.5">
            {[5, 4, 3, 2, 1].map((s) => {
              const n = reviews.stars?.[s] ?? 0;
              return (
                <div key={s} className="flex items-center gap-2 text-xs">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-warning" style={{ width: `${(100 * n) / total}%` }} /></div>
                  <Stars value={s} size="h-3 w-3" />
                  <span className="w-8 text-right tabular-nums text-muted-foreground">{Math.round((100 * n) / total)}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {user && reviews.can_review && (!reviews.mine || editing) && (
        <form onSubmit={submit} className="mt-6 rounded-2xl border border-border bg-card p-5">
          <p className="font-medium">{reviews.mine ? "Edit your review" : "How was this course?"}</p>
          <Stars value={rating} size="h-7 w-7" onPick={setRating} className="mt-2" />
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} placeholder="What helped? What would you change? (optional)" className="mt-3 min-h-24" />
          <div className="mt-3 flex gap-2">
            <Button type="submit" disabled={!rating || busy}>{busy ? "Saving…" : reviews.mine ? "Save changes" : "Post review"}</Button>
            {editing && <Button type="button" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>}
          </div>
        </form>
      )}
      {user && reviews.mine && !editing && (
        <button type="button" onClick={() => setEditing(true)} className="mt-4 text-sm font-medium text-mastery hover:underline">Edit your review</button>
      )}
      {user && !reviews.can_review && (
        <p className="mt-4 text-xs text-muted-foreground">Pass one lesson's check to leave a review.</p>
      )}

      {reviews.reviews?.length > 0 && (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {reviews.reviews.map((r, i) => (
            <li key={i} className="rounded-2xl border border-border p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary font-display text-sm font-semibold text-primary-foreground">{r.name.slice(0, 1)}</span>
                <div>
                  <p className="text-sm font-semibold">{r.name}</p>
                  <p className="text-[11px] text-muted-foreground">Passed {r.passed} of {reviews.lessons} lessons · {new Date(r.created_at).toLocaleDateString(undefined, { month: "short", year: "numeric" })}</p>
                </div>
              </div>
              <Stars value={r.rating} className="mt-2" />
              {r.body && <p className="mt-2 text-sm leading-relaxed">{r.body}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function DetailSkeleton() {
  return (
    <div>
      <div className="bg-[#050b24]"><div className="mx-auto max-w-8xl space-y-3 px-4 py-14 sm:px-6 lg:px-8"><Skeleton className="h-4 w-40 bg-white/10" /><Skeleton className="h-10 w-2/3 bg-white/10" /><Skeleton className="h-5 w-1/2 bg-white/10" /></div></div>
      <div className="mx-auto max-w-8xl space-y-3 px-4 py-10 sm:px-6 lg:px-8"><Skeleton className="h-40 w-full max-w-3xl" /><Skeleton className="h-64 w-full max-w-3xl" /></div>
    </div>
  );
}
