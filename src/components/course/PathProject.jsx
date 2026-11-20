import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, ClipboardCheck, ExternalLink, Hammer, Hourglass, RotateCcw, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const clean = (msg) => String(msg ?? "").replace(/^[a-z_]+: /, "");
const STATUS = {
  in_review: { icon: Hourglass, label: "In peer review", tone: "bg-amber-50 text-amber-800 border-amber-200", sub: "Two passing reviews pass it. You'll see every comment here." },
  passed: { icon: CheckCircle2, label: "Passed", tone: "bg-success/10 text-success border-success/30", sub: "Peers checked your work against the rubric and passed it." },
  needs_work: { icon: RotateCcw, label: "Needs work", tone: "bg-orange-50 text-orange-800 border-orange-200", sub: "Read the comments, improve it and send it again." },
};

function ReviewForm({ sub, rubric, onDone }) {
  const [met, setMet] = useState({});
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  async function send(verdict) {
    setBusy(true);
    const { data, error } = await supabase.rpc("skillfirms_review_project", { p_submission_id: sub.id, p_verdict: verdict, p_comment: comment.trim(), p_scores: met });
    setBusy(false);
    if (error) { toast.error(clean(error.message)); return; }
    toast.success(data === "passed" ? "Thanks! That was the deciding review: it passed." : "Thanks for reviewing.");
    onDone();
  }
  const ok = comment.trim().length >= 20;
  return (
    <li className="rounded-xl border border-border bg-card p-4">
      <p className="whitespace-pre-wrap text-sm leading-6">{sub.summary}</p>
      {sub.link && <a href={sub.link} target="_blank" rel="noopener noreferrer nofollow" className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-[#1f4189] hover:underline">Open their work<ExternalLink className="h-3.5 w-3.5" /></a>}
      <p className="mt-1 text-xs text-muted-foreground">{sub.reviews} of 2 reviews so far</p>
      <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
        {rubric.map((r, i) => (
          <label key={i} className={`flex cursor-pointer items-start gap-2 rounded-lg border px-2.5 py-2 text-xs transition-colors ${met[i] ? "border-[#1f4189]/40 bg-[#1f4189]/[0.05]" : "border-border"}`}>
            <input type="checkbox" checked={!!met[i]} onChange={(e) => setMet((m) => ({ ...m, [i]: e.target.checked }))} className="mt-0.5 h-3.5 w-3.5 accent-[#1f4189]" />{r}
          </label>
        ))}
      </div>
      <Textarea value={comment} onChange={(e) => setComment(e.target.value.slice(0, 3000))} rows={3} className="mt-3" placeholder="What works, and one thing to improve. Be kind and specific." />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button size="sm" className="rounded-full" disabled={busy || !ok} onClick={() => send("pass")}>Pass</Button>
        <Button size="sm" variant="outline" className="rounded-full" disabled={busy || !ok} onClick={() => send("needs_work")}>Needs work</Button>
        {!ok && <span className="text-xs text-muted-foreground">{20 - comment.trim().length} more characters</span>}
      </div>
    </li>
  );
}

// The path's capstone: a real piece of work, checked by people who've
// learned the same things. Two passing reviews pass it.
export default function PathProject({ roleId, user }) {
  const [d, setD] = useState(null);
  const [summary, setSummary] = useState("");
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [redo, setRedo] = useState(false);

  const load = useCallback(() => {
    supabase.rpc("skillfirms_path_project", { p_role_id: roleId }).then(({ data }) => setD(data ?? null));
  }, [roleId]);
  useEffect(() => { load(); }, [load]);

  if (!d?.project) return null;
  const p = d.project;
  const mine = d.mine;
  const canSubmit = user && (!mine || mine.status === "needs_work");

  async function submit(e) {
    e.preventDefault();
    if (link.trim() && !/^https:\/\//i.test(link.trim())) { toast.error("Use an https:// link."); return; }
    setBusy(true);
    const { error } = await supabase.rpc("skillfirms_submit_project", { p_role_id: roleId, p_summary: summary.trim(), p_link: link.trim() || null });
    setBusy(false);
    if (error) { toast.error(clean(error.message)); return; }
    toast.success("Sent for peer review.");
    setSummary(""); setLink(""); setRedo(false); load();
  }

  const st = mine ? STATUS[mine.status] : null;
  return (
    <section className="mt-12" aria-labelledby="proj-title">
      <div className="overflow-hidden rounded-2xl border border-border">
        <div className="relative bg-gradient-to-br from-[#0f2350] via-[#1f4189] to-[#3b6ce6] p-6 text-white">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/70"><Hammer className="h-4 w-4" />Capstone project · peer reviewed</p>
          <h2 id="proj-title" className="mt-2 text-2xl font-bold tracking-tight">{p.title}</h2>
          <p className="mt-2 max-w-2xl text-white/85">{p.brief}</p>
          {d.passed_count > 0 && <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold"><Users className="h-3.5 w-3.5" />{d.passed_count} {d.passed_count === 1 ? "person has" : "people have"} passed it</p>}
        </div>
        <div className="grid gap-6 p-6 md:grid-cols-2">
          <div>
            <p className="text-sm font-semibold">What you hand in</p>
            <ol className="mt-2 space-y-2 text-sm">
              {p.deliverables.map((x, i) => <li key={i} className="flex gap-2.5"><span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-[#1f4189]/10 text-[11px] font-bold text-[#1f4189]">{i + 1}</span>{x}</li>)}
            </ol>
          </div>
          <div>
            <p className="flex items-center gap-1.5 text-sm font-semibold"><ClipboardCheck className="h-4 w-4 text-[#1f4189]" />How peers check it</p>
            <ul className="mt-2 space-y-2 text-sm text-foreground/85">
              {p.rubric.map((x, i) => <li key={i} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-muted-foreground" />{x}</li>)}
            </ul>
          </div>
        </div>

        <div className="border-t border-border bg-secondary/30 p-6">
          {!user ? (
            <p className="text-sm"><Link to="/auth" className="font-semibold text-[#1f4189] hover:underline">Sign in</Link> to hand in your project or review others'.</p>
          ) : (
            <>
              {st && (
                <div className={`rounded-xl border p-4 ${st.tone}`}>
                  <p className="flex items-center gap-2 font-semibold"><st.icon className="h-4 w-4" />Your project: {st.label}</p>
                  <p className="mt-0.5 text-sm opacity-90">{st.sub}</p>
                  {mine.reviews.length > 0 && (
                    <ul className="mt-3 space-y-2">
                      {mine.reviews.map((r, i) => (
                        <li key={i} className="rounded-lg bg-white/70 p-3 text-sm text-foreground">
                          <span className={`mr-2 rounded-full px-2 py-0.5 text-[11px] font-bold ${r.verdict === "pass" ? "bg-success/15 text-success" : "bg-orange-100 text-orange-800"}`}>{r.verdict === "pass" ? "Pass" : "Needs work"}</span>
                          {r.comment}
                        </li>
                      ))}
                    </ul>
                  )}
                  {mine.status === "needs_work" && !redo && <Button size="sm" className="mt-3 rounded-full" onClick={() => setRedo(true)}>Hand in again</Button>}
                </div>
              )}
              {canSubmit && (!mine || redo) && (
                <form onSubmit={submit} className="mt-4 space-y-3">
                  <p className="text-sm font-semibold">Hand in your project</p>
                  <Textarea value={summary} onChange={(e) => setSummary(e.target.value.slice(0, 6000))} rows={5} placeholder="Walk reviewers through what you did and why. Cover each item they'll check." />
                  <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https:// link to your files (Drive, GitHub, Notion…)" inputMode="url" />
                  <div className="flex flex-wrap items-center gap-3">
                    <Button type="submit" className="rounded-full" disabled={busy || summary.trim().length < 50}>{busy ? "Sending…" : "Send for peer review"}</Button>
                    {summary.trim().length < 50 && <span className="text-xs text-muted-foreground">{50 - summary.trim().length} more characters</span>}
                  </div>
                  <p className="text-xs text-muted-foreground">Don't share confidential client or employer documents. Use your own or made-up data.</p>
                </form>
              )}
              {d.to_review.length > 0 && (
                <div className="mt-6">
                  <p className="text-sm font-semibold">Review someone's project</p>
                  <p className="text-xs text-muted-foreground">Reviewing is how you learn what good looks like. You need at least one passed lesson check.</p>
                  <ul className="mt-3 space-y-3">{d.to_review.map((s) => <ReviewForm key={s.id} sub={s} rubric={p.rubric} onDone={load} />)}</ul>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
