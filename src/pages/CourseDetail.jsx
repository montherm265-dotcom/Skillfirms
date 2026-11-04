import { useEffect, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { CheckCircle2, Circle, Clock, Target, Award, ArrowRight, BookOpen } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import { enroll } from "@/lib/courses";
import Seo from "@/components/seo/Seo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

export default function CourseDetail() {
  const { slug } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [modules, setModules] = useState([]);
  const [enrollment, setEnrollment] = useState(null);
  const [progressByModule, setProgressByModule] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [credential, setCredential] = useState(null);

  const load = useCallback(async () => {
    const { data: courseData, error: courseError } = await supabase
      .from("skillfirms_courses")
      .select("*, skillfirms_experts(display_name, headline, bio), skillfirms_course_skills(coverage, skillfirms_skills(slug, name))")
      .eq("slug", slug)
      .maybeSingle();
    if (courseError || !courseData) { setError("Course not found"); setLoading(false); return; }
    setCourse(courseData);

    // modules, enrollment, and credential all depend only on courseData.id
    // (and user.id) -- none depend on each other, so fetch them concurrently
    // instead of one-at-a-time. Only module progress has a real dependency
    // (needs enrollment's id first).
    const [{ data: moduleData }, enrollmentResult, credentialResult] = await Promise.all([
      supabase
        .from("skillfirms_course_modules")
        .select("*, skillfirms_module_quiz_questions(id, order_index, question, choices)")
        .eq("course_id", courseData.id)
        .order("order_index"),
      user
        ? supabase.from("skillfirms_enrollments").select("*").eq("user_id", user.id).eq("course_id", courseData.id).maybeSingle()
        : Promise.resolve({ data: null }),
      user
        ? supabase
            .from("skillfirms_credentials")
            .select("credential_code")
            .eq("user_id", user.id)
            .eq("course_id", courseData.id)
            .eq("status", "active_verified")
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    setModules(moduleData ?? []);

    if (user) {
      const enrollmentData = enrollmentResult.data;
      setEnrollment(enrollmentData ?? null);
      setCredential(credentialResult.data ?? null);
      if (enrollmentData) {
        const { data: progressData } = await supabase.from("skillfirms_module_progress").select("*").eq("enrollment_id", enrollmentData.id);
        setProgressByModule(Object.fromEntries((progressData ?? []).map((p) => [p.module_id, p])));
      }
    }
    setLoading(false);
  }, [slug, user]);

  useEffect(() => { load(); }, [load]);

  async function handleEnroll() {
    const row = await enroll(course.id, user.id);
    setEnrollment(row);
    toast.success("Enrolled — here's your first lesson.");
    navigate(`/courses/${slug}/lessons/1`);
  }

  // First lesson not yet passed (or the last one, if all are done).
  const nextIndex = Math.max(0, modules.findIndex((m) => !progressByModule[m.id]?.completed_at));

  if (loading) {
    return (
      <div className="section-pad">
        <div className="mx-auto max-w-2xl">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="mt-3 h-9 w-4/5" />
          <Skeleton className="mt-2 h-4 w-1/2" />
          <Skeleton className="mt-3 h-16 w-full" />
          <div className="mt-6 card-soft space-y-3 p-5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-9 w-full rounded-md" />
          </div>
          <div className="mt-8 space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-2 rounded-lg border border-border p-4">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
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
        breadcrumb={[{ label: "Home", path: "/" }, { label: course.title }]}
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
            <Button onClick={handleEnroll}><BookOpen className="h-4 w-4" />Start the course — free</Button>
          ) : (
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Your progress</span>
                <span className="font-display tabular-nums text-mastery">{Math.round(enrollment.progress_percent)}%</span>
              </div>
              <Progress value={enrollment.progress_percent} className="mt-2" />
              {enrollment.progress_percent < 100 && modules.length > 0 && (
                <Button className="mt-4" onClick={() => navigate(`/courses/${slug}/lessons/${nextIndex + 1}`)}>
                  {enrollment.progress_percent > 0 ? "Continue" : "Start"}: lesson {nextIndex + 1}<ArrowRight className="h-4 w-4" />
                </Button>
              )}
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
          {modules.map((m, i) => {
            const progress = progressByModule[m.id];
            return (
              <Link key={m.id} to={`/courses/${slug}/lessons/${i + 1}`} className="group block rounded-xl border border-border p-4 transition-colors hover:border-mastery/50 hover:bg-mastery/5">
                <div className="flex items-start gap-3">
                  {progress?.completed_at ? <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-mastery" /> : <Circle className="mt-0.5 h-5 w-5 flex-shrink-0 text-muted-foreground" />}
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium">{i + 1}. {m.title}</p>
                      <span className="flex-none text-xs text-muted-foreground">{m.duration_minutes} min</span>
                    </div>
                    {m.description && <p className="mt-1 text-sm text-muted-foreground">{m.description}</p>}
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {progress?.completed_at ? `Passed${progress.quiz_score != null ? ` · ${Math.round(progress.quiz_score * 100)}%` : ""}` : progress?.quiz_score != null ? `Best so far ${Math.round(progress.quiz_score * 100)}% · needs 2 of 3` : "Lesson + knowledge check"}
                      <ArrowRight className="ml-1 inline h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
