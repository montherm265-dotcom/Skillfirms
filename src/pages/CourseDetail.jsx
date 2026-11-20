import { trackEvent } from "@/lib/monitoring";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import {
  ArrowRight, Award, Bookmark, BookmarkCheck, Bot, Briefcase, Check, CheckCircle2, ChevronDown, Circle, ExternalLink,
  Link2, ListChecks, Lock, MapPin, PlayCircle, ShieldCheck, Sparkles,
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
import CourseCard, { ProviderLine } from "@/components/course/CourseCard";
import Stars from "@/components/course/Stars";
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
  const [offer, setOffer] = useState(false);
  const { saved, toggle } = useSaved();
  const userId = user?.id;

  const load = useCallback(async () => {
    const { data: c, error: e } = await supabase
      .from("skillfirms_courses")
      .select("*, skillfirms_experts(id, display_name, headline, profile_id), skillfirms_course_modules(id, duration_minutes), skillfirms_course_skills(coverage, skillfirms_skills(slug, name))")
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
      if (c.first_course_discount !== false) supabase.rpc("skillfirms_first_course_offer", { p_course_id: c.id }).then(({ data }) => setOffer(Boolean(data)));
      else setOffer(false);
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
  const locked = paid && !access;

  async function buy() {
    if (!user) { navigate(`/auth?mode=signup&next=${encodeURIComponent(`/courses/${slug}`)}`); return; }
    setBusy(true);
    try {
      const p = await buyCourse(course.id, readRef(slug));
      setPurchase(p);
      trackEvent("course_buy_clicked", { discounted: p.discount_kind === "first_course", channel: p.channel });
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
      trackEvent("course_enrolled", { paid });
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
  // 20% off a learner's first paid course (shown, then held on their purchase).
  const held = purchase && !["paid", "credit"].includes(purchase.payment_status) ? purchase : null;
  const discounted = held ? held.discount_kind === "first_course" : paid && offer && course.first_course_discount !== false;
  const payPrice = held ? held.price_cents : discounted ? Math.round(course.price_cents * 0.8) : course.price_cents;
  const cta = locked
    ? (purchase?.status === "waitlist" ? "You're on the list" : `Buy · ${priceLabel(payPrice)}`)
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

      {/* Top: what it is, who teaches it, one big button. */}
      <section className="border-b border-border bg-gradient-to-b from-[#eef1ff] to-background">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:px-8 lg:py-12">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
              <Link to="/courses" className="hover:text-foreground hover:underline">Courses</Link><span aria-hidden="true">›</span>
              <Link to={`/courses?category=${course.category?.id}`} className="hover:text-foreground hover:underline">{course.category?.label}</Link>
            </p>
            <ProviderLine course={course} className="mt-5" />
            <h1 className="mt-2 max-w-3xl text-3xl font-semibold leading-tight tracking-tight sm:text-[2.4rem]">{course.title}</h1>
            {course.description && <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-foreground/75">{course.description}</p>}
            {realExpert ? (
              <p className="mt-4 flex items-center gap-2 text-sm">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1f4189] text-xs font-semibold text-white">{realExpert.display_name.slice(0, 1)}</span>
                <span>Instructor: <Link to={`/instructors/${realExpert.id}`} className="font-semibold text-[#1f4189] hover:underline">{realExpert.display_name}</Link>{realExpert.headline ? <span className="text-muted-foreground"> · {realExpert.headline}</span> : null}</span>
              </p>
            ) : (
              <p className="mt-4 flex items-center gap-1.5 text-sm text-muted-foreground">
                <Bot className="h-4 w-4" />{reviewedAll ? "AI-taught basics, reviewed by an expert" : "AI-taught basics: lessons drafted with AI, not yet reviewed by an expert (each lesson says so)"}
              </p>
            )}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button className="h-12 rounded-lg px-7 text-base" onClick={start} disabled={busy}>
                {busy ? "Starting…" : cta}
                {!enrollment && !locked && <span className="ml-1 hidden text-xs font-normal opacity-80 sm:inline">· starts today</span>}
              </Button>
              {toggle && (
                <Button variant="outline" className="h-12 rounded-lg" onClick={() => toggle(course)} aria-pressed={isSaved}>
                  {isSaved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}{isSaved ? "Saved" : "Save"}
                </Button>
              )}
              <Button variant="ghost" className="h-12 rounded-lg" onClick={share}><Link2 className="h-4 w-4" />Share</Button>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              {paid ? (discounted && locked
                ? <><s>{priceLabel(course.price_cents)}</s> <b className="text-foreground">{priceLabel(payPrice)}</b> once: every lesson, the graded checks and the certificate. Lesson 1 is a free preview.</>
                : `${priceLabel(course.price_cents)} once: every lesson, the graded checks and the certificate. Lesson 1 is a free preview.`) : "Free: learning, graded checks and the certificate."}
              {course.enrollment_count > 0 && <> · <b className="text-foreground">{course.enrollment_count.toLocaleString()}</b> already enrolled</>}
            </p>
            {locked && <Link to={`/courses/${slug}/lessons/1`} className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-[#1f4189] hover:underline"><PlayCircle className="h-4 w-4" />Try lesson 1 free</Link>}
            {locked && discounted && !held && (
              <div className="mt-3">
                <p className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#1f4189] to-[#3b6ce6] px-3 py-1.5 text-xs font-semibold text-white shadow-sm">
                  <Sparkles className="h-3.5 w-3.5" />20% off your first course · applied automatically
                </p>
              </div>
            )}
            {locked && purchase?.status === "waitlist" && <p className="mt-2 max-w-md rounded-lg bg-secondary p-2 text-xs">You're on the list. Nothing has been charged; we'll let you know when buying opens.{held?.discount_kind === "first_course" ? " Your 20% first-course discount is saved." : ""}</p>}
            {enrollment && (
              <div className="mt-4 max-w-md">
                <div className="flex justify-between text-xs"><span className="font-medium">{passed} of {modules.length} lessons passed</span><span className="tabular-nums">{Math.round(enrollment.progress_percent)}%</span></div>
                <Progress value={enrollment.progress_percent} className="mt-1.5 h-1.5" />
              </div>
            )}
            {credential && (
              <Link to={`/credentials/${credential.credential_code}`} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-success/10 px-3 py-2 text-sm font-medium text-success hover:bg-success/15">
                <Award className="h-4 w-4" />You've earned this certificate
              </Link>
            )}
          </div>
          <button type="button" onClick={start} className="group relative hidden self-start overflow-hidden rounded-xl border border-border shadow-[0_20px_50px_-25px_rgba(0,4,29,0.45)] lg:block" aria-label={cta}>
            <CourseCover course={course} size="lg" className="aspect-[16/10] w-full" />
            <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/15">
              <PlayCircle className="h-12 w-12 text-white opacity-90 drop-shadow-lg transition group-hover:scale-110" strokeWidth={1.25} />
            </span>
          </button>
        </div>

        {/* Key facts */}
        <div className="mx-auto max-w-6xl px-4 pb-8 sm:px-6 lg:px-8">
          <div className="grid divide-y divide-border rounded-xl border border-border bg-card shadow-sm sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
            <Fact title={`${modules.length} lesson${modules.length === 1 ? "" : "s"}`} sub={`Each ends in a graded check · ${questions} questions in all`} />
            <Fact title={course.rating_count ? <span className="inline-flex items-center gap-1.5">{Number(course.rating_avg).toFixed(1)} <Stars value={Number(course.rating_avg)} /></span> : "New course"}
              sub={course.rating_count ? `${course.rating_count.toLocaleString()} review${course.rating_count === 1 ? "" : "s"} from learners who passed a lesson` : "No reviews yet; only learners who pass a lesson can review"} />
            <Fact title={`${(course.level ?? "All levels").replace(/^./, (x) => x.toUpperCase())} level`} sub={course.level === "beginner" ? "No experience needed" : course.level === "advanced" ? "For people already working in the field" : "Some background helps"} />
            <Fact title={`${formatHours(course)} to complete`} sub="Flexible schedule: learn at your own pace" />
          </div>
        </div>
      </section>

      {/* Section tabs */}
      <nav aria-label="Course sections" className="sticky top-[57px] z-20 border-b border-border bg-background/95 backdrop-blur">
        <div className="no-scrollbar mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 sm:px-6 lg:px-8">
          {[["about", "About"], ["outcomes", "Outcomes"], ["modules", "Lessons"], ["reviews", "Reviews"]].map(([id, label]) => (
            <a key={id} href={`#${id}`} className="flex-none border-b-2 border-transparent px-3 py-3 text-sm font-medium text-muted-foreground hover:border-[#1f4189]/40 hover:text-foreground">{label}</a>
          ))}
        </div>
      </nav>

      <div className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:px-8">
        <main className="min-w-0 pt-8">
          <section id="about" className="scroll-mt-32">
            <h2 className="text-xl font-semibold tracking-tight">What you'll learn</h2>
            {learn.length > 0 ? (
              <ul className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2">
                {learn.map((p, i) => <li key={i} className="flex gap-2.5 text-sm"><Check className="mt-0.5 h-4 w-4 flex-none text-[#1f4189]" />{p}</li>)}
              </ul>
            ) : <p className="mt-2 text-sm text-muted-foreground">{course.description}</p>}
            {course.skills.length > 0 && (
              <>
                <h3 className="mt-8 text-base font-semibold">Skills you'll gain</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {course.skills.map((s) => <Link key={s.slug} to={`/courses?skill=${s.slug}`} className="rounded-full bg-secondary px-3 py-1 text-xs font-medium hover:bg-secondary/70">{s.name}</Link>)}
                </div>
              </>
            )}
            <h3 className="mt-8 text-base font-semibold">Details to know</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Detail icon={Award} title="Shareable certificate" sub="Anyone can verify it online" />
              <Detail icon={ListChecks} title="Graded checks" sub={realExpert ? "Written by the instructor" : `${questions} questions; 2 of 3 to pass a lesson`} />
              <Detail icon={Sparkles} title="AI tutor in every lesson" sub={<Link to="/pro" className="hover:underline">Free daily questions</Link>} />
              <Detail icon={ShieldCheck} title="Proof on Talfirms" sub={realExpert ? "Verified, taught by an expert" : "Verified, taught by AI"} />
            </div>
          </section>

          <div className="mt-10"><JobGoalBanner className="mb-6" /></div>
          <HiringBanner hiring={hiring} user={user} hasCertificate={Boolean(credential)} lessons={modules.length} onSent={() => loadCourseHiring(course.id).then(setHiring)} />

          <div id="outcomes" className="scroll-mt-32">{jobs && <JobsUnlocked jobs={jobs} course={course} />}</div>

          {/* Curriculum */}
          <section id="modules" className="mt-10 scroll-mt-32">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <h2 className="text-xl font-semibold tracking-tight">There {modules.length === 1 ? "is 1 lesson" : `are ${modules.length} lessons`} in this course</h2>
              <p className="text-sm text-muted-foreground">{formatHours(course)} · {questions} graded questions</p>
            </div>
            <div className="mt-4 divide-y divide-border overflow-hidden rounded-xl border border-border">
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
                <p className="mt-3 text-base font-semibold">{i + 1}. {s.t}</p>
                <p className="mt-1 text-sm text-muted-foreground">{s.d}</p>
              </motion.div>
            ))}
          </section>

          <div id="reviews" className="scroll-mt-32"><Reviews course={course} reviews={reviews} onSaved={() => { loadReviews(course.id).then(setReviews); load(); }} /></div>

          {related.length > 0 && (
            <section className="mt-12">
              <h2 className="text-xl font-semibold tracking-tight">More in {course.category?.label}</h2>
              <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {related.map((c) => <CourseCard key={c.id} course={c} saved={saved.has(c.id)} onToggleSave={toggle} />)}
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

function Fact({ title, sub }) {
  return (
    <div className="p-4">
      <p className="text-base font-semibold">{title}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

function Detail({ icon: Icon, title, sub }) {
  return (
    <div className="rounded-xl border border-border p-4">
      <Icon className="h-5 w-5 text-[#1f4189]" aria-hidden="true" />
      <p className="mt-2 text-sm font-semibold">{title}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}
