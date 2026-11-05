import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { BadgeCheck, Clock, EyeOff, Inbox, Wallet } from "lucide-react";
import { claimReview, loadExpertQueue, submitReview } from "@/lib/missions";
import Seo from "@/components/seo/Seo";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

const money = (c) => `$${(Number(c) / 100).toFixed(Number(c) % 100 ? 2 : 0)}`;
const lines = (t) => t.split("\n").map((l) => l.replace(/^\s*[-•*]\s*/, "").trim()).filter(Boolean).slice(0, 8);

// The expert's queue: paid reviews in their skills (blind), the ones they
// took, and what they've earned.
export default function ExpertReview() {
  const [queue, setQueue] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);

  const load = useCallback(() => {
    loadExpertQueue().then(setQueue).catch((e) => setError(e.message));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function claim(id) {
    setBusy(id);
    try {
      await claimReview(id);
      toast.success("It's yours for 3 days.");
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  }

  if (error === "experts_only" || error === "Couldn't load your review queue.") {
    return (
      <div className="section-pad text-center">
        <p className="font-display text-xl font-semibold">This page is for Skillfirms experts</p>
        <Link to="/experts" className="mt-2 inline-block text-sm font-medium text-mastery hover:underline">Apply to become one</Link>
      </div>
    );
  }
  if (!queue) return <div className="section-pad"><div className="mx-auto max-w-4xl space-y-3"><Skeleton className="h-10 w-1/3" /><Skeleton className="h-40 w-full" /></div></div>;

  const e = queue.earnings ?? {};
  return (
    <div className="section-pad">
      <Seo title="Review queue" canonical="/expert" />
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Skillfirms expert</p>
            <h1 className="mt-1 font-display text-3xl font-semibold">Review queue</h1>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground"><EyeOff className="h-4 w-4" />Reviews are blind: you see the work, never the name.</p>
          </div>
          <dl className="flex gap-6">
            <div><dt className="text-xs text-muted-foreground">Reviews done</dt><dd className="font-display text-2xl font-semibold">{e.reviews ?? 0}</dd></div>
            <div><dt className="flex items-center gap-1 text-xs text-muted-foreground"><Wallet className="h-3.5 w-3.5" />Earned</dt><dd className="font-display text-2xl font-semibold">{money(e.earned_cents ?? 0)}</dd></div>
          </dl>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">You earn {Math.round(Number(e.share ?? 0.6) * 100)}% of each review. Payouts start when payments open.</p>

        {queue.mine.length > 0 && (
          <section className="mt-8">
            <h2 className="font-display text-xl font-semibold">Your reviews in progress</h2>
            <div className="mt-3 space-y-4">{queue.mine.map((o) => <ReviewForm key={o.id} order={o} onDone={load} />)}</div>
          </section>
        )}

        <section className="mt-8">
          <h2 className="font-display text-xl font-semibold">Waiting for an expert</h2>
          {queue.available.length === 0 ? (
            <div className="mt-3 rounded-2xl border border-dashed border-border p-8 text-center">
              <Inbox className="mx-auto h-6 w-6 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">Nothing in your skills right now. Paid reviews show up here as they come in.</p>
            </div>
          ) : (
            <ul className="mt-3 space-y-2">
              {queue.available.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
                  <div className="min-w-0">
                    <p className="font-semibold">{o.mission}{o.priority && <span className="ml-2 rounded-md bg-warning/20 px-1.5 py-0.5 text-xs font-semibold">Priority · Mastery</span>}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground"><span className="capitalize">{o.difficulty}</span> · {(o.skills ?? []).join(", ")}{o.paid_at ? ` · waiting since ${new Date(o.paid_at).toLocaleDateString()}` : ""}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-display text-lg font-semibold text-mastery">{money(o.earn_cents)}</span>
                    <Button size="sm" onClick={() => claim(o.id)} disabled={busy === o.id}>{busy === o.id ? "Taking…" : "Take this review"}</Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function ReviewForm({ order, onDone }) {
  const [scores, setScores] = useState(() => Object.fromEntries((order.skills ?? []).map((s) => [s.id, 60])));
  const [overall, setOverall] = useState(60);
  const [feedback, setFeedback] = useState("");
  const [strengths, setStrengths] = useState("");
  const [improvements, setImprovements] = useState("");
  const [passed, setPassed] = useState(null);
  const [busy, setBusy] = useState(false);

  async function send(e) {
    e.preventDefault();
    if (passed == null) { toast.error("Choose pass or not yet."); return; }
    setBusy(true);
    try {
      const res = await submitReview(order.id, {
        skillScores: Object.entries(scores).map(([skill_id, v]) => ({ skill_id, score: v / 100 })),
        overall: overall / 100, feedback: feedback.trim(), strengths: lines(strengths), improvements: lines(improvements), passed,
      });
      toast.success(res?.passed ? "Sent. They've earned an Expert verified certificate." : "Sent. Thanks for the honest review.");
      onDone();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={send} className="rounded-2xl border border-mastery/30 bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="font-display text-lg font-semibold">{order.mission}</p>
        <p className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3.5 w-3.5" />Due {new Date(order.due_at).toLocaleString()} · you earn {money(order.earn_cents)}</p>
      </div>
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer font-medium">The brief</summary>
        <p className="mt-1 text-muted-foreground">{order.brief}</p>
        <p className="mt-2 text-muted-foreground"><b>They were asked to deliver:</b> {order.instructions}</p>
      </details>
      <div className="mt-3 max-h-80 overflow-y-auto whitespace-pre-wrap rounded-xl bg-secondary/60 p-4 text-sm leading-relaxed">{order.submission}</div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {(order.skills ?? []).map((s) => (
          <label key={s.id} className="block text-sm">
            <span className="flex justify-between"><span className="font-medium">{s.name}</span><span className="tabular-nums text-muted-foreground">{scores[s.id]}%</span></span>
            <input type="range" min={0} max={100} step={5} value={scores[s.id]} onChange={(ev) => setScores({ ...scores, [s.id]: Number(ev.target.value) })} className="mt-1 w-full accent-[hsl(var(--mastery))]" />
          </label>
        ))}
        <label className="block text-sm sm:col-span-2">
          <span className="flex justify-between"><span className="font-semibold">Overall</span><span className="tabular-nums">{overall}%</span></span>
          <input type="range" min={0} max={100} step={5} value={overall} onChange={(ev) => setOverall(Number(ev.target.value))} className="mt-1 w-full accent-[hsl(var(--mastery))]" />
        </label>
      </div>
      <Textarea value={feedback} onChange={(ev) => setFeedback(ev.target.value)} maxLength={4000} placeholder="Feedback they can act on (at least 80 characters)" className="mt-3 min-h-28" />
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Textarea value={strengths} onChange={(ev) => setStrengths(ev.target.value)} placeholder="Strengths, one per line" className="min-h-20" />
        <Textarea value={improvements} onChange={(ev) => setImprovements(ev.target.value)} placeholder="What to improve, one per line" className="min-h-20" />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">Decision:</span>
        <button type="button" onClick={() => setPassed(true)} aria-pressed={passed === true} className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${passed === true ? "border-mastery bg-mastery text-mastery-foreground" : "border-border"}`}><BadgeCheck className="mr-1 inline h-4 w-4" />Pass</button>
        <button type="button" onClick={() => setPassed(false)} aria-pressed={passed === false} className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${passed === false ? "border-foreground bg-foreground text-background" : "border-border"}`}>Not yet</button>
        {passed && overall < 60 && <span className="text-xs text-destructive">A pass needs an overall score of 60% or more.</span>}
        <Button type="submit" className="ml-auto" disabled={busy || feedback.trim().length < 80 || passed == null || (passed && overall < 60)}>{busy ? "Sending…" : "Send review"}</Button>
      </div>
    </form>
  );
}
