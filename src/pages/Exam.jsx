import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Clock, Send } from "lucide-react";
import { toast } from "sonner";
import { loadAttempt, saveAnswers, submitExam } from "@/lib/exams";
import Seo from "@/components/seo/Seo";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const clock = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

// Taking a final exam (0046). The server holds the clock and the right
// answers; this page shows the questions, saves answers as you go, and
// notes pasting and leaving the tab for the instructor (it never blocks).
export default function Exam() {
  const { slug, attemptId } = useParams();
  const navigate = useNavigate();
  const [a, setA] = useState(undefined);
  const [answers, setAnswers] = useState({});
  const [left, setLeft] = useState(null);
  const [busy, setBusy] = useState(false);
  const signals = useRef({ pasted_chars: 0, pastes: 0, blurs: 0 });
  const offset = useRef(0);
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const done = useRef(false);

  useEffect(() => {
    loadAttempt(attemptId).then((d) => {
      if (!d) { setA(null); return; }
      offset.current = new Date(d.now).getTime() - Date.now();
      setAnswers(d.answers ?? {});
      setA(d);
    }).catch(() => setA(null));
  }, [attemptId]);

  const finish = useCallback(async (auto = false) => {
    if (done.current) return;
    done.current = true;
    setBusy(true);
    try {
      const status = await submitExam(attemptId, answersRef.current, signals.current);
      toast.success(auto ? "Time's up. Your answers were sent." : status === "marking" ? "Sent. Your result comes within about 2 days." : "Done.");
      navigate(`/courses/${slug}#exam`, { replace: true });
    } catch (e) { done.current = false; setBusy(false); toast.error(e.message); }
  }, [attemptId, navigate, slug]);

  // Timer.
  useEffect(() => {
    if (a?.status !== "in_progress") return undefined;
    const end = new Date(a.ends_at).getTime();
    const tick = () => {
      const ms = end - (Date.now() + offset.current);
      setLeft(ms);
      if (ms <= 0) finish(true);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [a, finish]);

  // Save every 20 seconds, and when leaving the page.
  useEffect(() => {
    if (a?.status !== "in_progress") return undefined;
    const save = () => { if (!done.current) saveAnswers(attemptId, answersRef.current, signals.current); };
    const t = setInterval(save, 20000);
    const onHide = () => { if (document.visibilityState === "hidden") { signals.current.blurs += 1; save(); } };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", save);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onHide); window.removeEventListener("pagehide", save); };
  }, [a, attemptId]);

  if (a === undefined) return <div className="mx-auto max-w-3xl px-4 py-10"><Skeleton className="h-10 w-1/2" /><Skeleton className="mt-6 h-64 w-full" /></div>;
  if (!a || a.status !== "in_progress") return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <Seo title="Exam" />
      <p className="text-xl font-semibold">{a ? "This exam has been sent." : "We couldn't find this exam."}</p>
      <Link to={`/courses/${slug}#exam`} className="mt-4 inline-block font-semibold text-[#1f4189] hover:underline">Back to the course</Link>
    </div>
  );

  const qs = a.questions ?? [];
  const answered = qs.filter((q) => String(answers[q.id] ?? "").trim() !== "").length;
  const set = (id, v) => setAnswers((x) => ({ ...x, [id]: v }));
  const onPaste = (e) => {
    const n = (e.clipboardData?.getData("text") ?? "").length;
    signals.current.pastes += 1;
    signals.current.pasted_chars += n;
  };

  return (
    <div className="mx-auto max-w-3xl px-4 pb-28 pt-6">
      <Seo title="Final exam" />
      <div className="sticky top-14 z-20 -mx-4 flex items-center justify-between gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur sm:top-16">
        <p className="text-sm"><b>{answered}</b> of {qs.length} answered</p>
        <p className={`flex items-center gap-1.5 font-mono text-lg font-bold tabular-nums ${left != null && left < 5 * 60000 ? "text-destructive" : ""}`}><Clock className="h-4 w-4" />{left == null ? "…" : clock(left)}</p>
      </div>

      <ol className="mt-6 space-y-5">
        {qs.map((q, i) => (
          <li key={q.id} className="rounded-2xl border border-border bg-card p-5">
            <p className="text-xs font-semibold text-muted-foreground">Question {i + 1} · {q.points} point{q.points === 1 ? "" : "s"}{q.kind === "written" ? " · written" : ""}</p>
            <p className="mt-1.5 whitespace-pre-line font-medium leading-relaxed">{q.question}</p>
            {q.kind === "mcq" ? (
              <div className="mt-3 space-y-2" role="radiogroup">
                {(q.choices ?? []).map((c, ci) => (
                  <label key={ci} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm transition-colors ${String(answers[q.id]) === String(ci) ? "border-[#1f4189] bg-[#1f4189]/5" : "border-border hover:border-foreground/30"}`}>
                    <input type="radio" name={q.id} className="mt-0.5" checked={String(answers[q.id]) === String(ci)} onChange={() => set(q.id, ci)} />
                    <span>{c}</span>
                  </label>
                ))}
              </div>
            ) : (
              <textarea rows={6} value={answers[q.id] ?? ""} onChange={(e) => set(q.id, e.target.value)} onPaste={onPaste} maxLength={6000}
                placeholder="Your answer, in your own words"
                className="mt-3 w-full rounded-xl border border-border bg-background p-3 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-[#1f4189]/25" />
            )}
          </li>
        ))}
      </ol>

      <div className="mt-8 flex flex-col items-center gap-2">
        <Button size="lg" disabled={busy} onClick={() => {
          const missing = qs.length - answered;
          if (!window.confirm(missing ? `${missing} question${missing === 1 ? " is" : "s are"} still empty. Send the exam anyway? You can't change it after.` : "Send the exam? You can't change it after.")) return;
          finish(false);
        }}><Send className="h-4 w-4" />{busy ? "Sending…" : "Send the exam"}</Button>
        <p className="text-xs text-muted-foreground">Your answers are saved as you go. When the time runs out, what you've written is sent.</p>
      </div>
    </div>
  );
}
