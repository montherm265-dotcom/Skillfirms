import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, FolderCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";

const safe = (u) => (/^https?:\/\//i.test(u ?? "") ? u : null);

// Projects learners sent for your courses (0041). Pass it and, if your
// course's rule is met, the certificate is issued; or ask for more work.
export default function ProjectReviews() {
  const [rows, setRows] = useState(null);
  const [notes, setNotes] = useState({});
  const load = () => supabase.rpc("skillfirms_project_reviews").then(({ data }) => setRows(data ?? []));
  useEffect(() => { load(); }, []);
  async function decide(id, pass) {
    const { error } = await supabase.rpc("skillfirms_review_course_project", { p_id: id, p_pass: pass, p_note: notes[id] || "" });
    if (error) { toast.error(error.message.replace(/^[a-z_]+: /, "")); return; }
    toast.success(pass ? "Passed. They'll see it, and their certificate if the course's rule is met." : "Sent back with your note. They get the full time again.");
    load();
  }
  if (!rows?.length) return null;
  return (
    <section className="mt-8 rounded-2xl border border-border bg-card p-5">
      <h2 className="flex items-center gap-2 text-lg font-bold"><FolderCheck className="h-5 w-5 text-mastery" />Projects to review <span className="text-sm font-normal text-muted-foreground">· {rows.length}</span></h2>
      <ul className="mt-3 space-y-3">
        {rows.map((r) => (
          <li key={r.id} className="rounded-xl border border-border p-4 text-sm">
            <p><b>{r.learner}</b> · <Link to={`/courses/${r.course.slug}`} className="hover:underline">{r.course.title}</Link> · sent {new Date(r.submitted_at).toLocaleDateString()}</p>
            {safe(r.work_url) && <a href={safe(r.work_url)} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 font-semibold text-[#1f4189] hover:underline">Open their work<ExternalLink className="h-3.5 w-3.5" /></a>}
            {r.notes && <p className="mt-1 text-muted-foreground">"{r.notes}"</p>}
            <textarea rows={2} value={notes[r.id] ?? ""} onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })} placeholder="What you saw: what's right, what to fix"
              className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            <div className="mt-2 flex gap-2">
              <Button size="sm" onClick={() => decide(r.id, true)}>Pass</Button>
              <Button size="sm" variant="outline" onClick={() => decide(r.id, false)}>Needs more work</Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
