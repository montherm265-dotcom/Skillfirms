import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { CalendarCheck, FileCheck2, FolderKanban, Plus, Trash2 } from "lucide-react";
import { confirmCourseReview, loadStudioExam, monthYear, retireExamQuestion, saveExamQuestion, setExamSettings } from "@/lib/exams";
import { Button } from "@/components/ui/button";

const input = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";
const blank = (kind) => ({ kind, question: "", choices: ["", "", "", ""], correct_index: 0, model_answer: "", points: kind === "written" ? 3 : 1 });

// Paste many questions at once. Blocks separated by a blank line:
//   Q: What does URS stand for?
//   - User Requirement Specification   <- * marks the right one
//   * User Requirement Specification
//   - Unit Release Sheet
// A block with no choices is a written question; "A:" lines give the model answer.
function parseBulk(text) {
  return text.split(/\n\s*\n/).map((block) => {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return null;
    const question = lines[0].replace(/^(q[:.)]|\d+[.)])\s*/i, "");
    const choices = []; let correct = -1; const model = [];
    for (const l of lines.slice(1)) {
      if (/^[*]\s*/.test(l)) { correct = choices.length; choices.push(l.replace(/^[*]\s*/, "")); }
      else if (/^[-•]\s*/.test(l)) choices.push(l.replace(/^[-•]\s*/, ""));
      else if (/^a[:.)]\s*/i.test(l)) model.push(l.replace(/^a[:.)]\s*/i, ""));
      else model.push(l);
    }
    if (question.length < 5) return null;
    if (choices.length >= 2) return correct >= 0 ? { kind: "mcq", question, choices, correct_index: correct, points: 1 } : { error: question };
    return { kind: "written", question, model_answer: model.join("\n"), points: 3 };
  }).filter(Boolean);
}

// Final exam, project settings and the yearly check, for one course (0046).
export default function ExamBuilder({ courseId, onSize }) {
  const [d, setD] = useState(null);
  const [s, setS] = useState(null);
  const [draft, setDraft] = useState(null);
  const [bulk, setBulk] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => loadStudioExam(courseId).then((x) => {
    setD(x);
    onSize?.(x?.size ?? null);
    setS({ on: x?.size != null, size: x?.size ?? 30, minutes: x?.minutes ?? 60, pass_pct: x?.pass_pct ?? 70, project_review: x?.project_review ?? "tutor", spots: x?.project_monthly_spots ?? "" });
  }).catch((e) => toast.error(e.message)), [courseId, onSize]);
  useEffect(() => { load(); }, [load]);
  if (!d || !s) return null;

  const pool = d.questions.length;
  const need = s.on ? Number(s.size) * 2 : 0;
  const written = d.questions.filter((q) => q.kind === "written").length;
  const usesChecks = d.rule !== "project";
  const usesProject = d.rule !== "checks";

  async function saveSettings() {
    setBusy(true);
    try {
      await setExamSettings(courseId, { size: s.on && usesChecks ? Number(s.size) : null, minutes: Number(s.minutes), pass_pct: Number(s.pass_pct),
        project_review: s.project_review, project_monthly_spots: s.spots === "" ? null : Number(s.spots) });
      toast.success("Saved");
      load();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  }
  async function addOne() {
    const q = { ...draft, choices: draft.kind === "mcq" ? draft.choices.filter((c) => c.trim()) : null };
    setBusy(true);
    try { await saveExamQuestion(courseId, q); setDraft(blank(draft.kind)); load(); } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  }
  async function addBulk() {
    const items = parseBulk(bulk);
    const bad = items.filter((x) => x.error);
    if (bad.length) { toast.error(`Mark the right answer with * in: "${bad[0].error.slice(0, 60)}"`); return; }
    if (!items.length) { toast.error("Nothing to add. See the format below the box."); return; }
    setBusy(true);
    let n = 0;
    try { for (const q of items) { await saveExamQuestion(courseId, q); n += 1; } toast.success(`Added ${n} question${n === 1 ? "" : "s"}`); setBulk(""); }
    catch (e) { toast.error(`Added ${n}, then: ${e.message}`); }
    finally { setBusy(false); load(); }
  }
  async function confirm() {
    if (!window.confirm("Confirm this course is still correct and up to date? Learners see the date.")) return;
    try { await confirmCourseReview(courseId); toast.success("Confirmed. Thanks!"); load(); } catch (e) { toast.error(e.message); }
  }

  const due = d.last_reviewed_at ? new Date(new Date(d.last_reviewed_at).getTime() + 365 * 86400000) : null;
  const daysToDue = due ? Math.ceil((due.getTime() - Date.now()) / 86400000) : null;

  return (
    <div className="space-y-6">
      {d.status === "published" && (
        <section className={`rounded-2xl border p-5 ${d.review_overdue ? "border-destructive/40 bg-destructive/5" : daysToDue != null && daysToDue <= 30 ? "border-warning/40 bg-warning/10" : "border-border bg-card"}`}>
          <h2 className="flex items-center gap-2 text-lg font-bold"><CalendarCheck className="h-5 w-5" />Yearly check</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {d.review_overdue ? "This course is past its yearly check: exams and new certificates are paused until you confirm it's still right (or update it)."
              : `Last confirmed ${monthYear(d.last_reviewed_at)}. Once a year, confirm the course is still right or update it${daysToDue != null ? `; next one due in ${daysToDue} days` : ""}. Learners see the date.`}
          </p>
          <Button size="sm" className="mt-3" variant={d.review_overdue ? "default" : "outline"} onClick={confirm}>It's still right: confirm today</Button>
        </section>
      )}

      {usesChecks && (
        <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <h2 className="flex items-center gap-2 text-lg font-bold"><FileCheck2 className="h-5 w-5" />Final exam</h2>
          <p className="text-sm text-muted-foreground">Write a bank of questions once. Each learner gets a random mix, so shared answers don't help. Multiple-choice questions are marked automatically; you mark written ones (aim for within 2 days), with notes like pasted text or tab switching shown to you.</p>
          <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={s.on} onChange={(e) => setS({ ...s, on: e.target.checked })} />Certify with a final exam (instead of the lesson checks)</label>
          {s.on && (
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-sm font-medium">Questions per exam<input type="number" min={5} max={100} value={s.size} onChange={(e) => setS({ ...s, size: e.target.value })} className={`${input} mt-1`} /></label>
              <label className="text-sm font-medium">Time (minutes)<input type="number" min={10} max={240} value={s.minutes} onChange={(e) => setS({ ...s, minutes: e.target.value })} className={`${input} mt-1`} /></label>
              <label className="text-sm font-medium">Pass mark (%)<input type="number" min={50} max={100} value={s.pass_pct} onChange={(e) => setS({ ...s, pass_pct: e.target.value })} className={`${input} mt-1`} /></label>
            </div>
          )}
          <Button size="sm" onClick={saveSettings} disabled={busy}>Save exam settings</Button>

          {s.on && (
            <>
              <div>
                <div className="flex items-center justify-between text-sm"><b>Question bank: {pool}</b><span className="text-muted-foreground">at least {need} needed · about {Math.max(need, 100)} recommended</span></div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-secondary"><div className={`h-full rounded-full ${pool >= need ? "bg-mastery" : "bg-[#1f4189]"}`} style={{ width: `${Math.min(100, (pool / Math.max(need, 1)) * 100)}%` }} /></div>
                <p className="mt-1 text-xs text-muted-foreground">{written} written · {pool - written} multiple choice</p>
              </div>

              {!draft ? (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => setDraft(blank("mcq"))}><Plus className="h-4 w-4" />Multiple-choice question</Button>
                  <Button size="sm" variant="outline" onClick={() => setDraft(blank("written"))}><Plus className="h-4 w-4" />Written question</Button>
                </div>
              ) : (
                <div className="space-y-2 rounded-xl border border-border p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{draft.kind === "mcq" ? "Multiple choice" : "Written"}</p>
                  <textarea rows={2} value={draft.question} onChange={(e) => setDraft({ ...draft, question: e.target.value })} placeholder="The question" className={input} />
                  {draft.kind === "mcq" ? draft.choices.map((c, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input type="radio" name="correct" checked={draft.correct_index === i} onChange={() => setDraft({ ...draft, correct_index: i })} aria-label={`Choice ${i + 1} is right`} />
                      <input value={c} onChange={(e) => setDraft({ ...draft, choices: draft.choices.map((x, j) => (j === i ? e.target.value : x)) })} placeholder={`Choice ${i + 1}${i < 2 ? "" : " (optional)"}`} className={`${input} flex-1`} />
                    </div>
                  )) : (
                    <textarea rows={3} value={draft.model_answer} onChange={(e) => setDraft({ ...draft, model_answer: e.target.value })} placeholder="What a good answer covers (only you see this, when marking)" className={input} />
                  )}
                  <label className="flex items-center gap-2 text-sm">Points<input type="number" min={1} max={10} value={draft.points} onChange={(e) => setDraft({ ...draft, points: e.target.value })} className={`${input} w-20`} /></label>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={addOne} disabled={busy || draft.question.trim().length < 5 || (draft.kind === "mcq" && draft.choices.filter((c) => c.trim()).length < 2)}>Add to the bank</Button>
                    <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>Close</Button>
                  </div>
                </div>
              )}

              <details className="rounded-xl border border-border p-4">
                <summary className="cursor-pointer text-sm font-semibold">Paste many questions at once</summary>
                <textarea rows={8} value={bulk} onChange={(e) => setBulk(e.target.value)} className={`${input} mt-3 font-mono text-xs`}
                  placeholder={"What does URS stand for?\n* User Requirement Specification\n- Unit Release Sheet\n- User Risk Summary\n\nExplain how you'd qualify a new HVAC unit.\nA: Covers IQ/OQ/PQ, acceptance criteria, deviations."} />
                <p className="mt-1 text-xs text-muted-foreground">Leave a blank line between questions. Choices start with "-", the right one with "*". A question with no choices is written; an "A:" line is your model answer.</p>
                <Button size="sm" className="mt-2" onClick={addBulk} disabled={busy || !bulk.trim()}>Add them</Button>
              </details>

              {pool > 0 && (
                <ul className="divide-y divide-border rounded-xl border border-border text-sm">
                  {d.questions.map((q, i) => (
                    <li key={q.id} className="flex items-start gap-3 p-3">
                      <span className="w-8 flex-none text-xs text-muted-foreground">{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{q.question}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{q.kind === "mcq" ? `Right answer: ${q.choices?.[q.correct_index] ?? "?"}` : "Written"} · {q.points} pt{q.points === 1 ? "" : "s"}</p>
                      </div>
                      <button type="button" onClick={async () => { try { await retireExamQuestion(q.id); load(); } catch (e) { toast.error(e.message); } }} aria-label="Remove" className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>
      )}

      {usesProject && (
        <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
          <h2 className="flex items-center gap-2 text-lg font-bold"><FolderKanban className="h-5 w-5" />Project reviews</h2>
          <p className="text-sm text-muted-foreground">So reviewing stays manageable when many people take the course.</p>
          <label className="block text-sm font-medium">Who reviews projects
            <select value={s.project_review} onChange={(e) => setS({ ...s, project_review: e.target.value })} className={`${input} mt-1`}>
              <option value="tutor">Only me</option>
              <option value="peer">Two learners who already hold this certificate review first (both pass: passed · both fail: needs work · split: I decide)</option>
            </select>
          </label>
          <label className="block text-sm font-medium">Project spots per month <span className="font-normal text-muted-foreground">(leave empty for no limit)</span>
            <input type="number" min={1} value={s.spots} onChange={(e) => setS({ ...s, spots: e.target.value })} className={`${input} mt-1`} />
          </label>
          <Button size="sm" onClick={saveSettings} disabled={busy}>Save project settings</Button>
        </section>
      )}
    </div>
  );
}
