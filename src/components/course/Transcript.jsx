import { useMemo, useState } from "react";
import { ChevronDown, FileText, Search } from "lucide-react";

// The video's transcript: read it, search it, skim it. Shown under the video.
export default function Transcript({ text }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const paras = useMemo(() => String(text).split(/\n{2,}|\n/).map((p) => p.trim()).filter(Boolean), [text]);
  const term = q.trim().toLowerCase();
  const shown = term ? paras.filter((p) => p.toLowerCase().includes(term)) : paras;
  const mark = (p) => {
    if (!term) return p;
    const out = []; let i = 0; const low = p.toLowerCase();
    for (let at = low.indexOf(term); at !== -1; at = low.indexOf(term, i)) {
      out.push(p.slice(i, at), <mark key={at} className="rounded bg-[#9db7ff]/50 px-0.5">{p.slice(at, at + term.length)}</mark>);
      i = at + term.length;
    }
    out.push(p.slice(i));
    return out;
  };
  return (
    <div className="mt-3 rounded-xl border border-border bg-card">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-semibold">
        <FileText className="h-4 w-4 text-[#1f4189]" />Transcript<span className="font-normal text-muted-foreground">· {paras.length} paragraph{paras.length === 1 ? "" : "s"}</span>
        <ChevronDown className={`ml-auto h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="border-t border-border px-4 pb-4 pt-3">
          <label className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-1.5 text-sm">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the transcript" aria-label="Search the transcript" className="min-w-0 flex-1 bg-transparent outline-none" />
            {term && <span className="text-xs text-muted-foreground">{shown.length} match{shown.length === 1 ? "" : "es"}</span>}
          </label>
          <div className="mt-3 max-h-80 space-y-3 overflow-y-auto pr-1 text-sm leading-6 text-foreground/85">
            {shown.length ? shown.map((p, i) => <p key={i}>{mark(p)}</p>) : <p className="text-muted-foreground">No match.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
