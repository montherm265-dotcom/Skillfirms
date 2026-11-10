import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { openCrossApp } from "@/lib/crossApp";
import { TALFIRMS_URL } from "@/lib/externalLinks";

const COLS = [
  ["Learn", [["All courses", "/courses"], ["Learn a skill", "/learn"], ["Career paths", "/roles"], ["Pricing", "/pro"]]],
  ["Prove", [["My certificates", "/credentials"], ["Skill Passport", "/passport"], ["My learning", "/my-learning"]]],
  ["Work with us", [["Teach as an expert", "/experts"], ["Train your team", "/team"]]],
  ["Skillfirms", [["Privacy", "/privacy"], ["Terms", "/terms"]]],
];

function Mark() {
  return (
    <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden="true">
      <rect width="32" height="32" rx="7" fill="#fff" />
      <path d="M9 11.5C9 9.567 10.567 8 12.5 8H21.5L19.8 11.2H12.8C12.2 11.2 11.7 11.7 11.7 12.3C11.7 12.9 12.2 13.4 12.8 13.4H17.2C19.4 13.4 21.2 15.2 21.2 17.4C21.2 19.6 19.4 21.4 17.2 21.4H9.5L11.2 18.2H17.1C17.7 18.2 18.2 17.7 18.2 17.1C18.2 16.5 17.7 16 17.1 16H13.3C10.9 16 9 14.1 9 11.5Z" fill="#050b24" />
    </svg>
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
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">{h}</p>
                <ul className="mt-4 space-y-2.5 text-sm">
                  {links.map(([t, to]) => <li key={to}><Link to={to} className="text-white/70 transition-colors hover:text-white">{t}</Link></li>)}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-14 flex flex-col gap-2 border-t border-white/10 py-6 text-xs text-white/40 sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} Skillfirms · part of Talfirms</p>
          <p>Every certificate has its own page anyone can check.</p>
        </div>
      </div>
      <p aria-hidden className="pointer-events-none select-none bg-gradient-to-b from-white/[0.09] to-transparent bg-clip-text text-center text-[19vw] font-extrabold leading-[0.8] tracking-[-0.06em] text-transparent">Skillfirms</p>
    </footer>
  );
}
