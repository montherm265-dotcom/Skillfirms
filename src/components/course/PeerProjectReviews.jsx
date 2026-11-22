import { useEffect, useState } from "react";
import { ExternalLink, Users } from "lucide-react";
import { toast } from "sonner";
import { loadPeerQueue, peerReview } from "@/lib/exams";
import { Button } from "@/components/ui/button";

const safe = (u) => (/^https?:\/\//i.test(u ?? "") ? u : null);

// Projects you can review because you hold that course's certificate
// (0046). Two reviewers decide together; if they disagree, the tutor does.
export default function PeerProjectReviews() {
  const [rows, setRows] = useState(null);
  const [notes, setNotes] = useState({});
  const load = () => loadPeerQueue().then(setRows).catch(() => setRows([]));
  useEffect(() => { load(); }, []);
  if (!rows?.length) return null;
  async function decide(id, pass) {
    try {
      const r = await peerReview(id, pass, notes[id] || "");
      toast.success(r === "waiting" ? "Thanks! One more reviewer will look too." : r === "tutor" ? "Thanks! The other reviewer saw it differently, so the tutor decides." : "Thanks! Your review decided it.");
      load();
    } catch (e) { toast.error(e.message); }
  }
  return (
    <section className="mt-8 rounded-2xl border border-border bg-card p-5">
      <h2 className="flex items-center gap-2 text-lg font-bold"><Users className="h-5 w-5 text-mastery" />Projects you can review <span className="text-sm font-normal text-muted-foreground">· {rows.length}</span></h2>
      <p className="mt-1 text-sm text-muted-foreground">You hold these courses' certificates, so you can review other learners' projects. Be fair and specific; two reviewers decide together.</p>
      <ul className="mt-3 space-y-3">
        {rows.map((r) => (
          <li key={r.id} className="rounded-xl border border-border p-4 text-sm">
            <p className="font-semibold">{r.course.title}</p>
            {r.course.brief && <details className="mt-1 text-xs text-muted-foreground"><summary className="cursor-pointer">The project brief</summary><p className="mt-1 whitespace-pre-line">{r.course.brief}</p></details>}
            {safe(r.work_url) && <a href={safe(r.work_url)} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 font-semibold text-[#1f4189] hover:underline">Open their work<ExternalLink className="h-3.5 w-3.5" /></a>}
            {r.notes && <p className="mt-1 text-muted-foreground">"{r.notes}"</p>}
            <textarea rows={2} value={notes[r.id] ?? ""} onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })} placeholder="What you saw: what's right, what to fix (10+ characters)"
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
