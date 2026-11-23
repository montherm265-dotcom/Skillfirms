import LanguagePicker from "@/components/LanguagePicker";
import { Link } from "react-router-dom";
import { SF_MARK_PATH, SF_MARK_VIEWBOX } from "@/components/brand/sfMark";
import { ArrowUpRight } from "lucide-react";
import { openCrossApp } from "@/lib/crossApp";
import { TALFIRMS_URL } from "@/lib/externalLinks";

const COLS = [
  ["Learn", [["All courses", "/courses"], ["Learn a skill", "/learn"], ["Career paths", "/roles"], ["Pricing", "/pro"]]],
  ["Prove", [["My certificates", "/credentials"], ["Skill Passport", "/passport"], ["My learning", "/my-learning"]]],
  ["Work with us", [["Teach as an expert", "/experts"], ["Train your team", "/team"]]],
  ["Skillfirms", [["Security", "/trust"], ["Privacy", "/privacy"], ["Terms", "/terms"], ["Payments & refunds", "/terms/payments"]]],
];

function Mark() {
  return (
    <svg viewBox={SF_MARK_VIEWBOX} className="h-[18px] w-auto" fill="#fff" aria-hidden="true"><path d={SF_MARK_PATH} /></svg>
  );
}

// Deep navy footer: the promise, every main page, and the giant wordmark
// fading into the bottom edge. Matches Talfirms so the two feel like one place.
export default function SiteFooter() {
  return (
    <footer className="relative isolate mt-24 overflow-hidden bg-[#050b24] text-white">
      <div aria-hidden className="absolute left-1/2 top-0 -z-10 h-px w-[80%] -translate-x-1/2 bg-gradient-to-r from-transparent via-[#6b8cff]/60 to-transparent" />
      <div aria-hidden className="absolute -top-40 left-1/2 -z-10 h-80 w-[60rem] -translate-x-1/2 rounded-full blur-3xl" style={{ background: "radial-gradient(closest-side, rgba(59,108,230,0.22), transparent)" }} />
      <div className="mx-auto max-w-7xl px-4 pt-16 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-[1.3fr_2fr]">
          <div>
            <Link to="/" className="flex items-center gap-2.5 text-xl font-bold tracking-tight"><Mark />Skillfirms</Link>
            <p className="mt-4 max-w-xs text-2xl font-bold leading-tight tracking-[-0.03em] text-white/90">Learn job skills, prove them, <span className="text-[#9db7ff]">take the proof to work.</span></p>
            <a href={TALFIRMS_URL} onClick={(e) => { e.preventDefault(); openCrossApp(TALFIRMS_URL, "/"); }}
              className="group mt-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/80 transition-colors hover:border-white/30 hover:text-white">
              Find jobs on Talfirms<ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </a>
          </div>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {COLS.map(([h, links]) => (
              <div key={h}>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">{h}</p>
                <ul className="mt-4 space-y-2.5 text-sm">
                  {links.map(([t, to]) => <li key={to}><Link to={to} className="text-white/70 transition-colors hover:text-white">{t}</Link></li>)}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-14 flex flex-col gap-2 border-t border-white/10 py-6 text-xs text-white/60 sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} Skillfirms · part of Talfirms</p>
          <LanguagePicker />
          <p>Every certificate has its own page anyone can check.</p>
        </div>
      </div>
      <p aria-hidden className="pointer-events-none select-none bg-gradient-to-b from-white/[0.09] to-transparent bg-clip-text text-center text-[19vw] font-extrabold leading-[0.8] tracking-[-0.06em] text-transparent">Skillfirms</p>
    </footer>
  );
}
