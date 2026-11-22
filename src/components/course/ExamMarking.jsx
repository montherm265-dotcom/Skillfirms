import { useEffect, useState } from "react";
import { AlertTriangle, PenLine } from "lucide-react";
import { toast } from "sonner";
import { loadMarkingQueue, markExam, shortDate } from "@/lib/exams";
import { Button } from "@/components/ui/button";

// Written answers waiting for your marks (0046). Multiple choice is already
// marked. Signals (pasted text, leaving the tab, copied answers, very fast
// writing) are only notes for you: you decide.
export default function ExamMarking() {
  const [rows, setRows] = useState(null);
  const [marks, setMarks] = useState({});
  const [notes, setNotes] = useState({});
  const [busy, setBusy] = useState(null);
  const load = () => loadMarkingQueue().then(setRows).catch(() => setRows([]));
  useEffect(() => { load(); }, []);
  if (!rows?.length) return null;

  async function send(r) {
    const m = marks[r.id] ?? {};
    if ((r.written ?? []).some((q) => m[q.id] === undefined || m[q.id] === "")) { toast.error("Give points for every written answer."); return; }
    setBusy(r.id);
    try {
      const status = await markExam(r.id, Object.fromEntries(Object.entries(m).map(([k, v]) => [k, Number(v)])), notes[r.id]);
      toast.success(status === "passed" ? "Passed. Their certificate is issued if the course's rule is met." : "Marked as not passed. They can try again in 7 days.");
      load();
    } catch (e) { toast.error(e.message); } finally { setBusy(null); }
  }

  return (
    <section className="mt-8 rounded-2xl border border-border bg-card p-5">
      <h2 className="flex items-center gap-2 text-lg font-bold"><PenLine className="h-5 w-5 text-mastery" />Exams to mark <span className="text-sm font-normal text-muted-foreground">· {rows.length}</span></h2>
      <ul className="mt-3 space-y-4">
        {rows.map((r) => {
          const late = r.result_due_at && new Date(r.result_due_at) < new Date();
          const m = marks[r.id] ?? {};
          const written = (r.written ?? []).reduce((n, q) => n + (Number(m[q.id]) || 0), 0);
          const pct = Math.round(((r.mcq_points ?? 0) + written) * 100 / Math.max((r.mcq_max ?? 0) + (r.written_max ?? 0), 1));
          return (
            <li key={r.id} className="rounded-xl border border-border p-4 text-sm">
              <p><b>{r.learner}</b> · {r.course.title} · sent {shortDate(r.submitted_at)} · <span className={late ? "font-semibold text-destructive" : "text-muted-foreground"}>result {late ? "overdue since" : "due"} {shortDate(r.result_due_at)}</span></p>
              <p className="mt-1 text-muted-foreground">Multiple choice: {r.mcq_points}/{r.mcq_max}</p>
              {r.flags?.length > 0 && (
                <ul className="mt-2 space-y-1 rounded-lg bg-warning/10 p-3 text-xs">
                  {r.flags.map((f, i) => <li key={i} className="flex gap-1.5"><AlertTriangle className="h-3.5 w-3.5 flex-none text-warning" />{f}</li>)}
                  <li className="text-muted-foreground">These are signals, not proof. Read the answers and decide.</li>
                </ul>
              )}
              <ol className="mt-3 space-y-3">
                {(r.written ?? []).map((q, i) => (
                  <li key={q.id} className="rounded-lg bg-secondary/40 p-3">
                    <p className="font-medium">{i + 1}. {q.question}</p>
                    {q.model_answer && <p className="mt-1 text-xs text-muted-foreground"><b>Your model answer:</b> {q.model_answer}</p>}
                    <p className="mt-2 whitespace-pre-line rounded-md bg-background p-2">{q.answer?.trim() ? q.answer : <span className="text-muted-foreground">(no answer)</span>}</p>
                    <label className="mt-2 flex items-center gap-2 text-xs font-medium">Points
                      <input type="number" min={0} max={q.points} value={m[q.id] ?? ""} onChange={(e) => setMarks({ ...marks, [r.id]: { ...m, [q.id]: e.target.value } })} className="w-16 rounded-md border border-border bg-background px-2 py-1" />
                      <span className="text-muted-foreground">of {q.points}</span>
                    </label>
                  </li>
                ))}
              </ol>
              <textarea rows={2} value={notes[r.id] ?? ""} onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })} placeholder="A note for them (optional): what was good, what to work on"
                className="mt-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              <div className="mt-2 flex items-center gap-3">
                <Button size="sm" onClick={() => send(r)} disabled={busy === r.id}>Send result</Button>
                <span className="text-xs text-muted-foreground">Score so far: {pct}% (pass mark {r.course.pass_pct}%)</span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
