import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { toast } from "sonner";
import { CheckCircle2, Circle, Clock, Target, Award } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import { enroll, markModuleComplete, submitQuiz, refreshEnrollmentProgress } from "@/lib/courses";
import LoadingSpinner from "@/components/LoadingSpinner";
import Seo from "@/components/seo/Seo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

function QuizForm({ module, onSubmit, busy }) {
  const [answers, setAnswers] = useState({});
  const questions = module.skillfirms_module_quiz_questions ?? [];
  const allAnswered = questions.every((q) => answers[q.id] !== undefined);

  return (
    <div className="mt-3 space-y-4 rounded-lg border border-border bg-secondary/30 p-4">
      {questions.map((q, qi) => (
        <div key={q.id}>
          <p className="text-sm font-medium">{qi + 1}. {q.question}</p>
          <div className="mt-2 space-y-1.5">
            {q.choices.map((choice, ci) => (
              <label key={ci} className="flex items-center gap-2 text-sm">
                <input type="radio" name={q.id} checked={answers[q.id] === ci} onChange={() => setAnswers((a) => ({ ...a, [q.id]: ci }))} />
                {choice}
              </label>
            ))}
          </div>
        </div>
      ))}
      <Button size="sm" disabled={!allAnswered || busy} onClick={() => onSubmit(answers)}>
        {busy ? "Grading…" : "Submit answers"}
      </Button>
    </div>
  );
}

export default function CourseDetail() {
  const { slug } = useParams();
  const { user } = useAuth();
  const [course, setCourse] = useState(null);
  const [modules, setModules] = useState([]);
  const [enrollment, setEnrollment] = useState(null);
  const [progressByModule, setProgressByModule] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openQuizModuleId, setOpenQuizModuleId] = useState(null);
  const [busyModuleId, setBusyModuleId] = useState(null);
  const [credential, setCredential] = useState(null);

  const load = useCallback(async () => {
    const { data: courseData, error: courseError } = await supabase
      .from("skillfirms_courses")
      .select("*, skillfirms_experts(display_name, headline, bio), skillfirms_course_skills(coverage, skillfirms_skills(slug, name))")
      .eq("slug", slug)
      .maybeSingle();
    if (courseError || !courseData) { setError("Course not found"); setLoading(false); return; }
    setCourse(courseData);

    const { data: moduleData } = await supabase
      .from("skillfirms_course_modules")
      .select("*, skillfirms_module_quiz_questions(id, order_index, question, choices)")
      .eq("course_id", courseData.id)
      .order("order_index");
    setModules(moduleData ?? []);

    if (user) {
      const { data: enrollmentData } = await supabase.from("skillfirms_enrollments").select("*").eq("user_id", user.id).eq("course_id", courseData.id).maybeSingle();
      setEnrollment(enrollmentData ?? null);
      if (enrollmentData) {
        const { data: progressData } = await supabase.from("skillfirms_module_progress").select("*").eq("enrollment_id", enrollmentData.id);
        setProgressByModule(Object.fromEntries((progressData ?? []).map((p) => [p.module_id, p])));
      }
      const { data: credentialData } = await supabase
        .from("skillfirms_credentials")
        .select("credential_code")
        .eq("user_id", user.id)
        .eq("course_id", courseData.id)
        .eq("status", "active_verified")
        .maybeSingle();
      setCredential(credentialData ?? null);
    }
    setLoading(false);
  }, [slug, user]);

  useEffect(() => { load(); }, [load]);

  async function handleEnroll() {
    const row = await enroll(course.id, user.id);
    setEnrollment(row);
    toast.success("Enrolled — your first module is ready.");
  }

  async function completeAndRefresh(moduleId) {
    const completedCount = Object.keys(progressByModule).length + (progressByModule[moduleId] ? 0 : 1);
    await refreshEnrollmentProgress(enrollment.id, modules.length, completedCount);
    await load();
  }

  async function handleMarkComplete(moduleId) {
    setBusyModuleId(moduleId);
    try {
      await markModuleComplete(enrollment.id, moduleId);
      await completeAndRefresh(moduleId);
      toast.success("Module marked complete.");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyModuleId(null);
    }
  }

  async function handleQuizSubmit(module, answers) {
    setBusyModuleId(module.id);
    try {
      const score = await submitQuiz(module.id, answers);
      await completeAndRefresh(module.id);
      setOpenQuizModuleId(null);
      if (score >= 0.6) {
        toast.success(`You scored ${Math.round(score * 100)}% — this now counts as assessment-based proficiency, and you've earned a Skillfirms certificate for this course.`);
      } else {
        toast.message(`You scored ${Math.round(score * 100)}%. No proficiency change — review the module and try again when ready.`);
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyModuleId(null);
    }
  }

  if (loading) return <LoadingSpinner className="py-24" />;
  if (error) return <p className="section-pad text-center text-sm text-destructive">{error}</p>;

  return (
    <div className="section-pad">
      <Seo
        title={course.title}
        description={course.description || `${course.title} — a Skillfirms course with a real graded assessment, not just a completion certificate.`}
        canonical={`/courses/${slug}`}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Course",
          name: course.title,
          description: course.description || undefined,
          provider: { "@type": "Organization", name: "Skillfirms" },
          ...(course.skillfirms_experts?.display_name ? { instructor: { "@type": "Person", name: course.skillfirms_experts.display_name, description: course.skillfirms_experts.headline || undefined } } : {}),
          ...(course.duration_hours ? { timeRequired: `PT${course.duration_hours}H` } : {}),
          educationalLevel: course.level || undefined,
        }}
      />
      <div className="mx-auto max-w-2xl">
        <Badge variant="outline" className="capitalize">{course.level}</Badge>
        <h1 className="mt-2 font-display text-3xl font-bold">{course.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {course.skillfirms_experts?.display_name}{course.skillfirms_experts?.headline ? ` — ${course.skillfirms_experts.headline}` : ""}
        </p>
        {course.description && <p className="mt-3 text-muted-foreground">{course.description}</p>}
        <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3.5 w-3.5" />{course.duration_hours} hours · {course.enrollment_count} enrolled</p>

        {course.skillfirms_course_skills?.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {course.skillfirms_course_skills.map((cs) => (
              <Badge key={cs.skillfirms_skills.slug} variant="secondary" className="text-xs">{cs.skillfirms_skills.name} · {Math.round(cs.coverage * 100)}%</Badge>
            ))}
          </div>
        )}

        <div className="mt-6 card-soft p-5">
          {!user ? (
            <p className="text-sm text-muted-foreground">Sign in to enroll and track your progress.</p>
          ) : !enrollment ? (
            <Button onClick={handleEnroll}>Enroll in this course</Button>
          ) : (
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Your progress</span>
                <span className="font-display tabular-nums text-mastery">{Math.round(enrollment.progress_percent)}%</span>
              </div>
              <Progress value={enrollment.progress_percent} className="mt-2" />
              {credential && (
                <Link to={`/credentials/${credential.credential_code}`} className="mt-4 flex items-center gap-1.5 text-sm font-medium text-mastery hover:underline">
                  <Award className="h-4 w-4" />View your Skillfirms certificate
                </Link>
              )}
              {enrollment.progress_percent >= 100 && (
                <Link to="/missions" className="mt-2 flex items-center gap-1.5 text-sm font-medium text-mastery hover:underline">
                  <Target className="h-4 w-4" />Course complete — practice it for real in a Mission
                </Link>
              )}
            </>
          )}
        </div>

        <div className="mt-8 space-y-3">
          {modules.map((m) => {
            const progress = progressByModule[m.id];
            const hasRealQuiz = m.has_quiz && (m.skillfirms_module_quiz_questions?.length ?? 0) > 0;
            const isBusy = busyModuleId === m.id;
            return (
              <div key={m.id} className="rounded-lg border border-border p-4">
                <div className="flex items-start gap-3">
                  {progress?.completed_at ? <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-mastery" /> : <Circle className="mt-0.5 h-5 w-5 flex-shrink-0 text-muted-foreground" />}
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">{m.title}</p>
                      <span className="text-xs text-muted-foreground">{m.duration_minutes} min</span>
                    </div>
                    {m.description && <p className="mt-1 text-sm text-muted-foreground">{m.description}</p>}
                    {progress?.quiz_score != null && (
                      <p className="mt-1 text-xs italic text-muted-foreground">Last score: {Math.round(progress.quiz_score * 100)}%</p>
                    )}

                    {enrollment && !progress?.completed_at && (
                      hasRealQuiz ? (
                        openQuizModuleId === m.id ? (
                          <QuizForm module={m} busy={isBusy} onSubmit={(answers) => handleQuizSubmit(m, answers)} />
                        ) : (
                          <Button size="sm" variant="outline" className="mt-2" onClick={() => setOpenQuizModuleId(m.id)}>Take knowledge check</Button>
                        )
                      ) : (
                        <Button size="sm" variant="outline" className="mt-2" disabled={isBusy} onClick={() => handleMarkComplete(m.id)}>
                          {isBusy ? "Saving…" : "Mark complete"}
                        </Button>
                      )
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
