import { useEffect, useRef, useState } from "react";
import { NotebookPen } from "lucide-react";
import { loadNote, saveNote } from "@/lib/catalog";

// Private notes for one lesson. Saves itself a moment after you stop typing.
export default function LessonNotes({ userId, moduleId }) {
  const [state, setState] = useState({ loading: true });
  const [text, setText] = useState("");
  const [status, setStatus] = useState("");
  const timer = useRef(null);
  const last = useRef("");

  useEffect(() => {
    let active = true;
    setState({ loading: true });
    loadNote(userId, moduleId).then((n) => {
      if (!active) return;
      setState(n);
      setText(n.body ?? "");
      last.current = n.body ?? "";
      setStatus(n.updated_at ? "Saved" : "");
    });
    return () => { active = false; clearTimeout(timer.current); };
  }, [userId, moduleId]);

  function change(v) {
    setText(v);
    setStatus("Typing…");
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      if (v === last.current) { setStatus("Saved"); return; }
      try {
        await saveNote(userId, moduleId, v);
        last.current = v;
        setStatus("Saved");
      } catch {
        setStatus("Couldn't save. We'll try again when you type.");
      }
    }, 900);
  }

  if (state.unavailable) return null;
  return (
    <section className="mt-10 rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground"><NotebookPen className="h-4 w-4 text-mastery" />My notes</p>
        <span className="text-[11px] text-muted-foreground" aria-live="polite">{state.loading ? "" : status || "Only you can see these"}</span>
      </div>
      <textarea value={text} onChange={(e) => change(e.target.value)} disabled={state.loading} maxLength={20000}
        placeholder="Write what you want to remember: how this applies at your job, questions to look up…"
        className="mt-3 min-h-32 w-full resize-y rounded-xl border border-input bg-background p-3 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-ring/20" />
    </section>
  );
}
