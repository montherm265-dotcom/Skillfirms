import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BadgeCheck, MessageCircleQuestion, Sparkles, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { askTutor } from "@/lib/tutor";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const ago = (d) => {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return "just now"; if (m < 60) return `${m}m ago`; if (m < 1440) return `${Math.floor(m / 60)}h ago`;
  return `${Math.floor(m / 1440)}d ago`;
};
const clean = (msg) => String(msg ?? "").replace(/^[a-z_]+: /, "");

function Answer({ a, onVote }) {
  const ai = a.kind === "ai";
  return (
    <li className={`rounded-xl p-3 text-sm ${a.instructor ? "border border-[#1f4189]/30 bg-[#1f4189]/[0.05]" : ai ? "bg-gradient-to-br from-[#eef1ff] to-transparent" : "bg-secondary/50"}`}>
      <p className="flex flex-wrap items-center gap-1.5 text-xs">
        {ai ? <Sparkles className="h-3.5 w-3.5 text-[#3b6ce6]" /> : null}
        <span className="font-semibold">{a.author}</span>
        {a.instructor && <span className="inline-flex items-center gap-0.5 rounded-full bg-[#1f4189] px-1.5 py-px text-[10px] font-bold text-white"><BadgeCheck className="h-3 w-3" />Instructor</span>}
        <span className="text-muted-foreground">· {ago(a.created_at)}</span>
      </p>
      <p className="mt-1.5 whitespace-pre-wrap leading-6">{a.body}</p>
      {!ai && (
        <button type="button" onClick={() => onVote(a)} disabled={a.mine} aria-pressed={a.voted}
          className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-colors disabled:opacity-50 ${a.voted ? "bg-[#1f4189] text-white" : "text-muted-foreground hover:bg-secondary"}`}>
          <ThumbsUp className="h-3 w-3" />Helpful{a.helpful > 0 ? ` · ${a.helpful}` : ""}
        </button>
      )}
    </li>
  );
}

// Questions under a lesson. The AI tutor can answer first (one of your
// daily tutor questions); people answer too, and helpful answers rise.
export default function LessonQA({ moduleId, user }) {
  const [thread, setThread] = useState(null);
  const [q, setQ] = useState("");
  const [useAi, setUseAi] = useState(true);
  const [busy, setBusy] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [reply, setReply] = useState("");
  const [open, setOpen] = useState(3);

  const load = useCallback(() => {
    supabase.rpc("skillfirms_lesson_thread", { p_module_id: moduleId }).then(({ data }) => setThread(data ?? []));
  }, [moduleId]);
  useEffect(() => { setThread(null); load(); }, [load]);

  async function ask(e) {
    e.preventDefault();
    if (q.trim().length < 5) return;
    setBusy(true);
    const { data: qid, error } = await supabase.rpc("skillfirms_ask_question", { p_module_id: moduleId, p_body: q.trim() });
    if (error) { setBusy(false); toast.error(clean(error.message)); return; }
    const asked = q.trim();
    setQ("");
    load();
    if (useAi) {
      try {
        const res = await askTutor({ moduleId, question: asked, history: [] });
        if (res?.answer) await supabase.rpc("skillfirms_answer_question", { p_question_id: qid, p_body: res.answer, p_ai: true });
      } catch (err) {
        toast.message(err.code === "limit" ? "No AI answer this time: you've used today's tutor questions. People can still answer." : "The AI tutor couldn't answer; people can still answer.");
      }
      load();
    }
    setBusy(false);
  }

  async function answer(qid) {
    if (!reply.trim()) return;
    const { error } = await supabase.rpc("skillfirms_answer_question", { p_question_id: qid, p_body: reply.trim(), p_ai: false });
    if (error) { toast.error(clean(error.message)); return; }
    setReply(""); setReplyTo(null); load();
  }

  async function vote(a) {
    setThread((t) => t.map((x) => ({ ...x, answers: x.answers.map((y) => (y.id === a.id ? { ...y, voted: !y.voted, helpful: y.helpful + (y.voted ? -1 : 1) } : y)) })));
    await supabase.rpc("skillfirms_vote_answer", { p_answer_id: a.id, p_on: !a.voted });
  }

  return (
    <section className="mt-10 border-t border-border pt-8" aria-labelledby="qa-title">
      <h2 id="qa-title" className="flex items-center gap-2 text-xl font-semibold tracking-tight"><MessageCircleQuestion className="h-5 w-5 text-[#1f4189]" />Questions about this lesson{thread?.length ? <span className="text-base font-normal text-muted-foreground"> · {thread.length}</span> : null}</h2>
      {user ? (
        <form onSubmit={ask} className="mt-4 rounded-2xl border border-border bg-card p-3">
          <Textarea value={q} onChange={(e) => setQ(e.target.value.slice(0, 2000))} rows={2} placeholder="Stuck on something? Ask it here. Others learning this lesson will see it too." className="border-0 p-1 shadow-none focus-visible:ring-0" />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={useAi} onChange={(e) => setUseAi(e.target.checked)} className="h-4 w-4 accent-[#1f4189]" />
              <Sparkles className="h-3.5 w-3.5 text-[#3b6ce6]" />AI tutor answers first (uses a daily tutor question)
            </label>
            <Button type="submit" size="sm" className="rounded-full" disabled={busy || q.trim().length < 5}>{busy ? "Posting…" : "Ask"}</Button>
          </div>
        </form>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground"><Link to="/auth" className="font-semibold text-[#1f4189] hover:underline">Sign in</Link> to ask or answer.</p>
      )}

      {thread == null ? <div className="mt-5 h-24 animate-pulse rounded-2xl bg-secondary/60" />
        : thread.length === 0 ? <p className="mt-5 text-sm text-muted-foreground">No questions yet. Be the first; it helps the next person too.</p>
        : (
          <ul className="mt-6 space-y-5">
            {thread.slice(0, open).map((t) => (
              <li key={t.id} className="flex gap-3">
                <span className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-full bg-gradient-to-br from-[#3b6ce6] to-[#1f4189] text-xs font-semibold text-white">{t.author.slice(0, 1)}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground"><span className="font-semibold text-foreground">{t.mine ? "You" : t.author}</span> · {ago(t.created_at)}</p>
                  <p className="mt-0.5 whitespace-pre-wrap text-[15px] font-medium leading-6">{t.body}</p>
                  {t.answers.length > 0 && <ul className="mt-3 space-y-2">{t.answers.map((a) => <Answer key={a.id} a={a} onVote={vote} />)}</ul>}
                  {user && (replyTo === t.id ? (
                    <div className="mt-2 flex gap-2">
                      <Textarea value={reply} onChange={(e) => setReply(e.target.value.slice(0, 4000))} rows={2} placeholder="Share what you know" className="min-h-0" autoFocus />
                      <div className="flex flex-col gap-1"><Button size="sm" onClick={() => answer(t.id)} disabled={!reply.trim()}>Answer</Button><Button size="sm" variant="ghost" onClick={() => setReplyTo(null)}>Cancel</Button></div>
                    </div>
                  ) : (
                    <button type="button" onClick={() => { setReplyTo(t.id); setReply(""); }} className="mt-2 text-xs font-semibold text-[#1f4189] hover:underline">Answer</button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      {thread?.length > open && <button type="button" onClick={() => setOpen((n) => n + 10)} className="mt-4 text-sm font-semibold text-[#1f4189] hover:underline">Show more questions</button>}
    </section>
  );
}
