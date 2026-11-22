import { useCallback, useEffect, useState } from "react";
import { FolderKanban, CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";

const days = (iso) => Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000));

// The course's project, set by the tutor (0041): start it (the clock runs
// from then), send a link to the work, see the tutor's decision.
export default function CourseProject({ courseId, enrolled, canOpen }) {
  const [p, setP] = useState(undefined);
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => supabase.rpc("skillfirms_course_project", { p_course: courseId }).then(({ data }) => setP(data ?? null)), [courseId]);
  useEffect(() => { load(); }, [load]);
  if (!p) return null;
  const mine = p.mine;
  async function run(fn, args, ok) {
    setBusy(true);
    const { error } = await supabase.rpc(fn, args);
    setBusy(false);
    if (error) { toast.error(error.message.replace(/^[a-z_]+: /, "")); return; }
    toast.success(ok);
    load();
  }
  return (
    <section className="mt-10 rounded-2xl border border-border bg-card p-5 sm:p-6" id="project">
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground"><FolderKanban className="h-4 w-4" />Course project · {p.days} day{p.days === 1 ? "" : "s"}</p>
      <p className="mt-1 text-sm text-muted-foreground">{p.rule === "both" ? "Your certificate needs the lesson checks and this project." : "Your certificate comes from this project, reviewed by your instructor."}</p>
      <p className="mt-3 whitespace-pre-line text-sm">{p.brief}</p>
      {!mine ? (
        <Button className="mt-4" disabled={busy || !enrolled || !canOpen} onClick={() => run("skillfirms_start_course_project", { p_course: courseId }, `Started. You have ${p.days} days.`)}>
          {!enrolled ? "Start the course first" : !canOpen ? "Get the course to do its project" : `Start the project (${p.days} days)`}
        </Button>
      ) : mine.status === "passed" ? (
        <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-mastery"><CheckCircle2 className="h-4 w-4" />Passed{mine.review_note ? `: "${mine.review_note}"` : ""}</p>
      ) : mine.status === "submitted" ? (
        <p className="mt-4 text-sm text-muted-foreground">Sent {new Date(mine.submitted_at).toLocaleDateString()}. Your instructor will review it.</p>
      ) : (
        <div className="mt-4 space-y-2">
          {mine.status === "needs_work" && mine.review_note && <p className="rounded-lg bg-warning/10 p-3 text-sm"><b>Your instructor:</b> {mine.review_note}</p>}
          <p className="flex items-center gap-1.5 text-sm"><Clock className="h-4 w-4" />{days(mine.due_at) > 0 ? `${days(mine.due_at)} day${days(mine.due_at) === 1 ? "" : "s"} left` : "Time's up"}</p>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Link to your work (shared folder, repo or document)" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={3000} placeholder="Anything your instructor should know (optional)" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <Button disabled={busy || !url.trim()} onClick={() => run("skillfirms_submit_course_project", { p_course: courseId, p_url: url.trim(), p_notes: notes }, "Sent to your instructor.")}>Send my work</Button>
        </div>
      )}
    </section>
  );
}
