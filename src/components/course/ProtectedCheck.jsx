import { useEffect, useState } from "react";
import { EyeOff } from "lucide-react";

// Wraps a graded check so it's hard to lift into ChatGPT, Claude etc.:
// no selecting, copying, right-click, dragging or printing; the questions
// hide while you're in another tab or app, and after a Print Screen key;
// and a faint watermark with your name marks any screenshot.
// (No website can stop a phone photo — the watermark is for that.)
export default function ProtectedCheck({ who, children }) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let timer = null;
    const hide = () => setHidden(true);
    const show = () => setHidden(false);
    // A click into the lesson video's iframe also blurs the window; that's fine.
    const onBlur = () => { if (!(document.activeElement instanceof HTMLIFrameElement)) hide(); };
    const onVisibility = () => (document.hidden ? hide() : show());
    const onKey = (e) => {
      const k = e.key ?? "";
      const shot = k === "PrintScreen" || ((e.metaKey || e.ctrlKey) && e.shiftKey && ["3", "4", "5", "s", "S"].includes(k));
      if (shot) {
        hide();
        navigator.clipboard?.writeText?.("").catch(() => {});
        clearTimeout(timer);
        timer = setTimeout(show, 2500);
      }
    };
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", show);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("keyup", onKey, true);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", show);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("keyup", onKey, true);
    };
  }, []);

  const block = (e) => e.preventDefault();
  const mark = who ? `${who} · Skillfirms` : "Skillfirms";

  return (
    <div className="protected-check relative select-none" style={{ WebkitUserSelect: "none", WebkitTouchCallout: "none" }}
      onCopy={block} onCut={block} onContextMenu={block} onDragStart={block}>
      <div className={`transition-[filter] duration-150 ${hidden ? "pointer-events-none blur-md" : ""}`} aria-hidden={hidden || undefined}>{children}</div>
      {/* Watermark over the questions. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
        <div className="absolute -inset-20 flex rotate-[-18deg] flex-wrap content-start gap-x-16 gap-y-14 text-[11px] font-semibold text-foreground/[0.07]">
          {Array.from({ length: 60 }, (_, i) => <span key={i} className="whitespace-nowrap">{mark}</span>)}
        </div>
      </div>
      {hidden && (
        <div className="absolute inset-0 grid place-items-center rounded-2xl bg-background/60 p-6 text-center">
          <p className="flex items-center gap-2 text-sm font-medium"><EyeOff className="h-4 w-4" />Questions are hidden while you're away from this page. Come back to see them.</p>
        </div>
      )}
    </div>
  );
}

// The same choices in a fresh random order for each attempt, keeping each
// choice's real index (that's what gets graded), so "it's B" doesn't travel.
export function shuffledChoices(choices, seed) {
  const order = choices.map((c, i) => ({ c, i }));
  let s = seed >>> 0 || 1;
  for (let i = order.length - 1; i > 0; i -= 1) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const j = s % (i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}
