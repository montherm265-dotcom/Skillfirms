import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { Clock, Sparkles, UserCheck } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import { submitMission, runAiEvaluation, requestExpertReview } from "@/lib/missions";
import LoadingSpinner from "@/components/LoadingSpinner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const STATUS_LABEL = {
  submitted: "Submitted — not yet evaluated",
  ai_evaluated: "AI-evaluated",
  expert_requested: "Expert review requested",
  expert_reviewed: "Expert-reviewed",
};

export default function MissionDetail() {
  const { slug } = useParams();
  const { user } = useAuth();
  const [mission, setMission] = useState(null);
  const [skills, setSkills] = useState([]);
  const [submission, setSubmission] = useState(null);
  const [evaluations, setEvaluations] = useState([]);
  const [submissionText, setSubmissionText] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data: missionData, error: missionError } = await supabase.from("skillfirms_missions").select("*").eq("slug", slug).maybeSingle();
    if (missionError || !missionData) { setError("Mission not found"); setLoading(false); return; }
    setMission(missionData);

    const { data: skillData } = await supabase.from("skillfirms_mission_skills").select("coverage, skillfirms_skills(slug, name)").eq("mission_id", missionData.id);
    setSkills(skillData ?? []);

    if (user) {
      const { data: submissionData } = await supabase
        .from("skillfirms_mission_submissions")
        .select("*")
        .eq("user_id", user.id)
        .eq("mission_id", missionData.id)
        .order("submitted_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setSubmission(submissionData ?? null);

      if (submissionData) {
        const { data: evalData } = await supabase
          .from("skillfirms_mission_evaluations")
          .select("*")
          .eq("submission_id", submissionData.id)
          .order("created_at", { ascending: false });
        setEvaluations(evalData ?? []);
      } else {
        setEvaluations([]);
      }
    }
    setLoading(false);
  }, [slug, user]);

  useEffect(() => { load(); }, [load]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!submissionText.trim()) return;
    setBusy(true);
    try {
      const row = await submitMission(mission.id, user.id, submissionText.trim());
      setSubmissionText("");
      toast.success("Submitted. Get AI feedback now, or come back later.");
      await load();
      void row;
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleAiEvaluate() {
    setBusy(true);
    try {
      await runAiEvaluation(submission, mission);
      toast.success("AI evaluation complete.");
      await load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleRequestExpertReview() {
    setBusy(true);
    try {
      await requestExpertReview(submission.id);
      toast.success("Requested — a Skillfirms expert will see this in their review queue.");
      await load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <LoadingSpinner className="py-24" />;
  if (error) return <p className="section-pad text-center text-sm text-destructive">{error}</p>;

  const hasAiEval = evaluations.some((e) => e.evaluator_type === "ai");
  const hasExpertEval = evaluations.some((e) => e.evaluator_type === "expert");

  return (
    <div className="section-pad">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between">
          <Badge variant="outline" className="capitalize">{mission.difficulty}</Badge>
          <p className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3.5 w-3.5" />{mission.estimated_hours}h estimated</p>
        </div>
        <h1 className="mt-2 font-display text-3xl font-bold">{mission.title}</h1>
        <p className="mt-3 text-muted-foreground">{mission.brief}</p>
        <div className="mt-4 rounded-lg border border-border bg-secondary/30 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">What to deliver</p>
          <p className="mt-1 text-sm">{mission.deliverable_instructions}</p>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {skills.map((s) => <Badge key={s.skillfirms_skills.slug} variant="secondary" className="text-xs">{s.skillfirms_skills.name}</Badge>)}
        </div>

        {!user ? (
          <p className="mt-8 text-sm text-muted-foreground">Sign in to submit this mission.</p>
        ) : (
          <div className="mt-8">
            {submission && (
              <div className="card-soft p-5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your latest submission</p>
                  <Badge variant="outline">{STATUS_LABEL[submission.status]}</Badge>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm">{submission.submission_text}</p>

                <div className="mt-4 flex flex-wrap gap-2">
                  {!hasAiEval && (
                    <Button size="sm" disabled={busy} onClick={handleAiEvaluate}>
                      <Sparkles className="mr-1.5 h-4 w-4" />{busy ? "Evaluating…" : "Get AI feedback"}
                    </Button>
                  )}
                  {submission.status !== "expert_requested" && submission.status !== "expert_reviewed" && (
                    <Button size="sm" variant="outline" disabled={busy} onClick={handleRequestExpertReview}>
                      <UserCheck className="mr-1.5 h-4 w-4" />Request expert review
                    </Button>
                  )}
                </div>

                {evaluations.map((ev) => (
                  <div key={ev.id} className="mt-4 border-t border-border pt-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {ev.evaluator_type === "ai" ? "AI-estimated proficiency" : "Expert-verified proficiency"}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="font-display text-xl font-bold text-mastery">{Math.round(ev.overall_score * 100)}%</span>
                      <span className="text-xs text-muted-foreground">overall</span>
                    </div>
                    {ev.feedback && <p className="mt-2 text-sm">{ev.feedback}</p>}
                    {Array.isArray(ev.strengths) && ev.strengths.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs font-semibold text-muted-foreground">Strengths</p>
                        <ul className="mt-1 list-inside list-disc text-sm text-muted-foreground">
                          {ev.strengths.map((s, i) => <li key={i}>{s}</li>)}
                        </ul>
                      </div>
                    )}
                    {Array.isArray(ev.improvements) && ev.improvements.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs font-semibold text-muted-foreground">Could improve</p>
                        <ul className="mt-1 list-inside list-disc text-sm text-muted-foreground">
                          {ev.improvements.map((s, i) => <li key={i}>{s}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}

                {submission.status === "expert_requested" && !hasExpertEval && (
                  <p className="mt-4 text-xs italic text-muted-foreground">Waiting on a Skillfirms expert — this will update here once reviewed.</p>
                )}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {submission ? "Submit another attempt" : "Your submission"}
              </p>
              <Textarea
                value={submissionText}
                onChange={(e) => setSubmissionText(e.target.value)}
                className="mt-2 min-h-40"
                maxLength={20000}
                placeholder="Write your real submission here…"
              />
              <Button type="submit" className="mt-3" disabled={busy || !submissionText.trim()}>
                {busy ? "Submitting…" : "Submit mission"}
              </Button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
