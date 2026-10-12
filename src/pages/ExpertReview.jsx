import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ClipboardCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { fetchPendingReviews, reviewSubmission } from "@/lib/missions";
import LoadingSpinner from "@/components/LoadingSpinner";
import EmptyState from "@/components/EmptyState";
import Seo from "@/components/seo/Seo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

function ReviewForm({ submission, onDone }) {
  const [score, setScore] = useState(80);
  const [feedback, setFeedback] = useState("");
  const [strengths, setStrengths] = useState("");
  const [improvements, setImprovements] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!feedback.trim()) return;
    setBusy(true);
    try {
      await reviewSubmission(submission.id, {
        overallScore: Math.max(0, Math.min(100, Number(score))) / 100,
        feedback: feedback.trim(),
        strengths: strengths.split("\n").map((s) => s.trim()).filter(Boolean),
        improvements: improvements.split("\n").map((s) => s.trim()).filter(Boolean),
      });
      toast.success("Review submitted — the learner's credential path has been updated.");
      onDone(submission.id);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-3 border-t border-border pt-4">
      <div>
        <label className="text-xs font-medium text-muted-foreground">Overall score (0-100)</label>
        <Input type="number" min={0} max={100} value={score} onChange={(e) => setScore(e.target.value)} className="mt-1 w-24" />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground">Feedback (shown to the learner)</label>
        <Textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={3} required className="mt-1" />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground">Strengths (one per line)</label>
        <Textarea value={strengths} onChange={(e) => setStrengths(e.target.value)} rows={2} className="mt-1" />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground">Areas to improve (one per line)</label>
        <Textarea value={improvements} onChange={(e) => setImprovements(e.target.value)} rows={2} className="mt-1" />
      </div>
      <Button type="submit" disabled={busy}>{busy ? "Submitting…" : "Submit expert review"}</Button>
    </form>
  );
}

export default function ExpertReview() {
  const { expertId } = useAuth();
  const [submissions, setSubmissions] = useState(null);
  const [error, setError] = useState(null);
  const [openId, setOpenId] = useState(null);

  const load = useCallback(() => {
    fetchPendingReviews()
      .then((data) => setSubmissions(data))
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    if (expertId) load();
    else setSubmissions([]);
  }, [expertId, load]);

  function handleDone(submissionId) {
    setSubmissions((prev) => prev.filter((s) => s.id !== submissionId));
    setOpenId(null);
  }

  if (!expertId) {
    return (
      <div className="section-pad">
        <Seo title="Expert review" noindex />
        <div className="mx-auto max-w-lg text-center">
          <h1 className="font-display text-2xl font-bold">Expert review queue</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This page is for Skillfirms expert accounts. Your account doesn't have one yet.
          </p>
        </div>
      </div>
    );
  }

  if (submissions === null) return <LoadingSpinner className="py-24" />;

  return (
    <div className="section-pad">
      <Seo title="Expert review" noindex />
      <div className="mx-auto max-w-2xl">
        <h1 className="font-display text-2xl font-bold">Expert review queue</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Mission submissions a learner has asked a real expert to review. Your written review becomes the
          submission's expert-verified evaluation and can unlock a credential.
        </p>

        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

        {submissions.length === 0 ? (
          <EmptyState icon={ClipboardCheck} title="Nothing pending" description="No mission submissions are currently waiting on expert review." />
        ) : (
          <ul className="mt-6 space-y-4">
            {submissions.map((s) => (
              <li key={s.id} className="card-soft p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-display font-semibold">{s.skillfirms_missions?.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {s.profiles?.display_name ?? "A learner"} · submitted {new Date(s.submitted_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant="outline">Pending review</Badge>
                </div>
                <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Deliverable instructions</p>
                <p className="mt-1 text-sm text-muted-foreground">{s.skillfirms_missions?.deliverable_instructions}</p>
                <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Submission</p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{s.submission_text}</p>

                {openId === s.id ? (
                  <ReviewForm submission={s} onDone={handleDone} />
                ) : (
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => setOpenId(s.id)}>Review this submission</Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
