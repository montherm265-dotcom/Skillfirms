import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, Briefcase, Crown, GraduationCap, Lightbulb, RotateCcw, Sparkles, X } from "lucide-react";
import { askTutor, loadAllowance, loadChat, loadJob, saveChat, saveJob } from "@/lib/tutor";
import { toBlocks } from "@/lib/lessons";

const ease = [0.22, 1, 0.36, 1];
const ACTIONS = [
  { mode: "explain_simpler", icon: Lightbulb, label: "Explain it simpler", q: "Explain the main idea of this lesson more simply." },
  { mode: "my_job", icon: Briefcase, label: "Use my job as the example", q: "Show me how this applies in my job." },
  { mode: "quiz_me", icon: GraduationCap, label: "Practise with me", q: "Give me a practice question on this lesson." },
];

function Text({ text }) {
  return toBlocks(text).map((b, i) => (b.type === "list"
    ? <ul key={i} className="my-1.5 space-y-1 pl-4">{b.items.map((it, j) => <li key={j} className="list-disc">{it}</li>)}</ul>
    : <p key={i} className="my-1.5">{b.text}</p>));
}

export default function TutorPanel({ user, moduleId, lessonTitle, ready }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [allowance, setAllowance] = useState(null);
  const [limitHit, setLimitHit] = useState(null);
  const [job, setJob] = useState(loadJob());
  const [askJob, setAskJob] = useState(false);
  const endRef = useRef(null);

  useEffect(() => { setMessages(loadChat(moduleId)); setLimitHit(null); }, [moduleId]);
  useEffect(() => { if (open && user) loadAllowance().then(setAllowance); }, [open, user]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, busy, open]);

  async function send(question, mode = "ask") {
    const q = question.trim();
    if (!q || busy) return;
    if (!user) { navigate(`/auth?next=${encodeURIComponent(window.location.pathname)}`); return; }
    if (mode === "my_job" && !job.trim()) { setAskJob(true); return; }
    const history = messages;
    const next = [...messages, { role: "learner", text: q }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const res = await askTutor({ moduleId, question: q, history, mode, job });
      const done = [...next, { role: "tutor", text: res.answer, followups: res.followups }];
      setMessages(done);
      saveChat(moduleId, done);
      loadAllowance().then(setAllowance);
    } catch (e) {
      setMessages(history);
      setInput(q);
      if (e.code === "limit") setLimitHit(e.message);
      else setMessages([...history, { role: "error", text: e.message }]);
    } finally {
      setBusy(false);
    }
  }

  function reset() { setMessages([]); saveChat(moduleId, []); }
  const last = messages[messages.length - 1];

  return (
    <>
      <AnimatePresence>
        {!open && ready && (
          <motion.button type="button" onClick={() => setOpen(true)} initial={{ opacity: 0, y: 20, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20 }} transition={{ duration: 0.35, ease }}
            className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-primary py-3 pl-4 pr-5 text-sm font-semibold text-primary-foreground shadow-[0_20px_40px_-12px_hsl(var(--foreground)/0.5)] transition hover:scale-[1.03]">
            <span className="relative flex h-6 w-6 items-center justify-center rounded-full bg-mastery text-mastery-foreground"><Sparkles className="h-3.5 w-3.5" /></span>
            Ask the tutor
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <>
            <motion.div key="scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px] lg:hidden" />
            <motion.aside key="panel" role="dialog" aria-label="Lesson tutor" initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ duration: 0.4, ease }}
              className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-border bg-background shadow-2xl">
              <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 font-display text-lg font-semibold"><Sparkles className="h-4 w-4 text-mastery" />Lesson tutor</p>
                  <p className="truncate text-xs text-muted-foreground">{lessonTitle}</p>
                </div>
                <div className="flex items-center gap-1">
                  {messages.length > 0 && <button type="button" onClick={reset} aria-label="Start over" className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"><RotateCcw className="h-4 w-4" /></button>}
                  <button type="button" onClick={() => setOpen(false)} aria-label="Close tutor" className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"><X className="h-5 w-5" /></button>
                </div>
              </header>

              <div className="flex-1 overflow-y-auto px-4 py-4">
                {messages.length === 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground">Ask anything about this lesson. The tutor has read it, so you don't need to explain where you are.</p>
                    <div className="mt-4 grid gap-2">
                      {ACTIONS.map((a) => (
                        <button key={a.mode} type="button" onClick={() => send(a.q, a.mode)} disabled={busy}
                          className="flex items-center gap-3 rounded-xl border border-border p-3 text-left text-sm font-medium transition hover:border-mastery/50 hover:bg-mastery/5">
                          <a.icon className="h-4 w-4 flex-none text-mastery" />{a.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {askJob && (
                  <form onSubmit={(e) => { e.preventDefault(); if (!job.trim()) return; saveJob(job.trim()); setAskJob(false); send(ACTIONS[1].q, "my_job"); }} className="mt-4 rounded-xl border border-mastery/40 bg-mastery/5 p-3">
                    <label className="text-sm font-medium" htmlFor="tutor-job">What's your job?</label>
                    <input id="tutor-job" value={job} onChange={(e) => setJob(e.target.value)} maxLength={120} autoFocus placeholder="e.g. Validation engineer at a vaccine plant" className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/20" />
                    <button type="submit" className="mt-2 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">Use this</button>
                  </form>
                )}
                <ul className="space-y-3">
                  {messages.map((m, i) => (
                    <motion.li key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
                      className={m.role === "learner" ? "ml-10 rounded-2xl rounded-br-md bg-primary px-3.5 py-2.5 text-sm text-primary-foreground" : m.role === "error" ? "rounded-xl bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive" : "mr-4 rounded-2xl rounded-bl-md bg-secondary px-3.5 py-2 text-sm leading-relaxed"}>
                      {m.role === "tutor" ? <Text text={m.text} /> : m.text}
                    </motion.li>
                  ))}
                  {busy && (
                    <li className="mr-16 flex items-center gap-1.5 rounded-2xl rounded-bl-md bg-secondary px-3.5 py-3">
                      {[0, 1, 2].map((d) => <motion.span key={d} className="h-1.5 w-1.5 rounded-full bg-muted-foreground" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: d * 0.15 }} />)}
                    </li>
                  )}
                </ul>
                {last?.role === "tutor" && last.followups?.length > 0 && !busy && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {last.followups.map((f) => <button key={f} type="button" onClick={() => send(f)} className="rounded-full border border-border px-3 py-1 text-xs hover:border-mastery/50 hover:bg-mastery/5">{f}</button>)}
                  </div>
                )}
                {limitHit && (
                  <div className="mt-4 rounded-2xl bg-primary p-4 text-primary-foreground">
                    <p className="flex items-center gap-2 font-semibold"><Crown className="h-4 w-4 text-warning" />Out of tutor questions for now</p>
                    <p className="mt-1 text-sm text-primary-foreground/80">{limitHit}</p>
                    <Link to="/pro" className="mt-3 inline-block rounded-lg bg-mastery px-3 py-1.5 text-sm font-semibold text-mastery-foreground">See plans</Link>
                  </div>
                )}
                <div ref={endRef} />
              </div>

              <footer className="border-t border-border p-3">
                {!user ? (
                  <button type="button" onClick={() => navigate(`/auth?next=${encodeURIComponent(window.location.pathname)}`)} className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground">Sign in to ask the tutor (free)</button>
                ) : (
                  <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex items-end gap-2">
                    <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={1} maxLength={1500} placeholder="Ask about this lesson…" aria-label="Your question"
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
                      className="max-h-32 min-h-[44px] flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/20" />
                    <button type="submit" disabled={busy || !input.trim()} aria-label="Send" className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-40"><ArrowUp className="h-4 w-4" /></button>
                  </form>
                )}
                <p className="mt-2 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                  <span>AI can be wrong. It won't give you check answers.</span>
                  {allowance && <Link to="/pro" className="flex-none font-medium hover:text-foreground">{allowance.left} of {allowance.perDay} left today · <span className="capitalize">{allowance.plan}</span></Link>}
                </p>
              </footer>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
