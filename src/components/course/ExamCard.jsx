import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Clock, FileCheck2, PauseCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { loadExamInfo, shortDate, startExam } from "@/lib/exams";
import { Button } from "@/components/ui/button";

// The course's final exam (0046): how it works, start it, and its result.
export default function ExamCard({ course, enrolled, canOpen }) {
  const navigate = useNavigate();
  const [info, setInfo] = useState(undefined);
  const [busy, setBusy] = useState(false);
  useEffect(() => { loadExamInfo(course.id).then((d) => setInfo(d ?? null)).catch(() => setInfo(null)); }, [course.id]);
  if (!info) return null;
  const last = info.last;

  async function begin() {
    if (!window.confirm(`The exam has ${info.size} questions and ${info.minutes} minutes. The clock starts now and doesn't stop. Ready?`)) return;
    setBusy(true);
    try {
      const id = await startExam(course.id);
      navigate(`/courses/${course.slug}/exam/${id}`);
    } catch (e) { toast.error(e.message); setBusy(false); }
  }

  let status = null;
  if (info.review_overdue) status = <p className="mt-4 flex items-start gap-2 text-sm text-warning"><PauseCircle className="mt-0.5 h-4 w-4 flex-none" />Exams and new certificates are paused until the instructor does this course's yearly check.</p>;
  else if (last?.status === "in_progress") status = <Button className="mt-4" onClick={() => navigate(`/courses/${course.slug}/exam/${last.id}`)}>Continue your exam</Button>;
  else if (last?.status === "marking") status = <p className="mt-4 flex items-start gap-2 text-sm"><Clock className="mt-0.5 h-4 w-4 flex-none text-[#1f4189]" /><span>Sent {shortDate(last.submitted_at)}. Your instructor is marking the written answers; your result should be here by <b>{shortDate(last.result_due_at)}</b>.</span></p>;
  else if (last?.status === "passed") status = <p className="mt-4 flex items-start gap-2 text-sm font-semibold text-mastery"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-none" />Passed with {last.score_pct}%.{last.note ? ` "${last.note}"` : ""}</p>;
  else if (last?.status === "failed") status = (
    <div className="mt-4 text-sm">
      <p className="flex items-start gap-2 font-semibold text-destructive"><XCircle className="mt-0.5 h-4 w-4 flex-none" />{last.score_pct}%, not a pass this time (you need {info.pass_pct}%).</p>
      {last.note && <p className="mt-1 text-muted-foreground">Your instructor: "{last.note}"</p>}
      {info.next_try_at ? <p className="mt-1 text-muted-foreground">You can try again from {shortDate(info.next_try_at)}, with a new mix of questions.</p>
        : <Button className="mt-3" onClick={begin} disabled={busy || !info.ready}>Try again</Button>}
    </div>
  );
  else status = (
    <Button className="mt-4" onClick={begin} disabled={busy || !enrolled || !canOpen || !info.ready}>
      {!enrolled ? "Start the course first" : !canOpen ? "Get the course to take the exam" : !info.ready ? "The exam isn't ready yet" : busy ? "Starting…" : `Start the exam (${info.minutes} min)`}
    </Button>
  );

  return (
    <section id="exam" className="mt-10 rounded-2xl border border-border bg-card p-5 sm:p-6">
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground"><FileCheck2 className="h-4 w-4" />Final exam</p>
      <ul className="mt-3 space-y-1.5 text-sm text-foreground/85">
        <li>{info.size} questions picked at random from the instructor's question bank, so everyone gets a different mix.</li>
        <li>{info.minutes} minutes. Pass mark {info.pass_pct}%.</li>
        {info.has_written
          ? <li>Some questions need a written answer. Your instructor marks them and the result comes within about 2 days.</li>
          : <li>Multiple choice: you see your result as soon as you finish.</li>}
        <li>Answer in your own words. Pasted text and leaving the exam tab are noted for the instructor.</li>
      </ul>
      {status}
    </section>
  );
}
