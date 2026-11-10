import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, useMotionValue, useScroll, useSpring, useTransform } from "framer-motion";
import { Award, CheckCircle2, ChevronRight, Search, ShieldCheck, Sparkles } from "lucide-react";
import Mascot from "@/components/Mascot";
import { TALFIRMS_URL } from "@/lib/externalLinks";

const ease = [0.22, 1, 0.36, 1];

function Float({ children, className, depth = 1, scrollY, px, py, delay }) {
  const y = useTransform(scrollY, [0, 600], [0, -90 * depth]);
  const x = useTransform(px, [-0.5, 0.5], [-14 * depth, 14 * depth]);
  const yy = useTransform(py, [-0.5, 0.5], [-10 * depth, 10 * depth]);
  return (
    <motion.div style={{ y }} className={`absolute ${className}`}>
      <motion.div style={{ x, y: yy }} initial={{ opacity: 0, scale: 0.85, filter: "blur(8px)" }} animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
        transition={{ duration: 0.9, delay, ease }}
        className="rounded-2xl border border-white/70 bg-white/80 p-3 text-left shadow-[0_20px_60px_-20px_rgba(10,20,51,0.35)] backdrop-blur-xl">
        {children}
      </motion.div>
    </motion.div>
  );
}

// Skillfirms' first screen: one big sentence, a search for any skill, and Tal
// studying with the moments that matter floating around him.
export default function SkillHero({ totals }) {
  const ref = useRef(null);
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const { scrollY } = useScroll();
  const px = useSpring(useMotionValue(0), { stiffness: 60, damping: 20 });
  const py = useSpring(useMotionValue(0), { stiffness: 60, damping: 20 });
  const fade = useTransform(scrollY, [0, 500], [1, 0.2]);
  const scale = useTransform(scrollY, [0, 500], [1, 0.94]);
  const move = (e) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    px.set((e.clientX - r.left) / r.width - 0.5);
    py.set((e.clientY - r.top) / r.height - 0.5);
  };

  return (
    <section ref={ref} onMouseMove={move} className="relative isolate overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(180deg,#f3f3ff_0%,#ffffff_70%)] dark:bg-none" />
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-[-18rem] -z-10 h-[46rem] w-[70rem] -translate-x-1/2 rounded-full blur-3xl" style={{ background: "radial-gradient(closest-side, rgba(59,108,230,0.22), transparent)" }} />
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 opacity-60" style={{ backgroundImage: "linear-gradient(rgba(31,65,137,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(31,65,137,0.06) 1px, transparent 1px)", backgroundSize: "56px 56px", maskImage: "radial-gradient(ellipse 60% 55% at 50% 30%, black, transparent 75%)", WebkitMaskImage: "radial-gradient(ellipse 60% 55% at 50% 30%, black, transparent 75%)" }} />

      <motion.div style={{ opacity: fade, scale }} className="mx-auto max-w-5xl px-4 pt-14 text-center sm:pt-20">
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease }}>
          <a href={TALFIRMS_URL} className="group inline-flex items-center gap-2 rounded-full border border-[#1f4189]/15 bg-white/80 py-1 pl-1 pr-3 text-sm shadow-sm backdrop-blur">
            <span className="rounded-full bg-[#1f4189] px-2 py-0.5 text-xs font-semibold text-white">Talfirms</span>
            <span className="text-foreground/80"><span className="sm:hidden">Certificates show on Talfirms</span><span className="hidden sm:inline">Every certificate shows on your Talfirms profile</span></span>
            <ChevronRight className="h-4 w-4 text-[#1f4189] transition-transform group-hover:translate-x-0.5" />
          </a>
        </motion.div>

        <h1 className="mx-auto mt-7 max-w-4xl text-[2.9rem] font-extrabold leading-[1.02] tracking-[-0.045em] text-[#00041d] sm:text-7xl lg:text-[5.4rem] dark:text-white">
          {["Learn", "the", "job."].map((w, i) => (
            <motion.span key={i} className="inline-block pr-[0.22em]" initial={{ opacity: 0, y: 30, filter: "blur(10px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ duration: 0.8, delay: 0.1 + i * 0.07, ease }}>{w}</motion.span>
          ))}
          <motion.span className="mark inline-block pr-[0.22em]" initial={{ opacity: 0, y: 30, filter: "blur(10px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ duration: 0.9, delay: 0.35, ease }}>Prove it.</motion.span>
          <br />
          {["Get", "hired."].map((w, i) => (
            <motion.span key={w} className="inline-block pr-[0.22em]" initial={{ opacity: 0, y: 30, filter: "blur(10px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ duration: 0.8, delay: 0.5 + i * 0.07, ease }}>{w}</motion.span>
          ))}
        </h1>

        <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.7, ease }}
          className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
          Courses taught by people who do the job, plus free AI-taught basics. A graded check in every lesson, an AI tutor beside you, and a certificate employers can check.
        </motion.p>

        <motion.form initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.85, ease }}
          onSubmit={(e) => { e.preventDefault(); navigate(q.trim() ? `/courses?q=${encodeURIComponent(q.trim())}` : "/courses"); }}
          className="mx-auto mt-8 flex max-w-xl items-center gap-2 rounded-full border border-[#1f4189]/15 bg-white/90 p-1.5 pl-5 shadow-[0_12px_40px_-16px_rgba(10,20,51,0.4)] backdrop-blur focus-within:ring-2 focus-within:ring-[#1f4189]/30">
          <Search className="h-5 w-5 flex-none text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="What do you want to learn?" aria-label="Search courses" className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground" />
          <button type="submit" className="h-11 rounded-full bg-[#00041d] px-6 text-sm font-semibold text-white transition-colors hover:bg-[#1f4189]">Search</button>
        </motion.form>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} className="mt-4 flex flex-wrap justify-center gap-2 text-sm">
          {["CQV", "GMP", "SQL", "Agile", "Machine learning"].map((t) => (
            <Link key={t} to={`/courses?q=${encodeURIComponent(t)}`} className="rounded-full border border-border bg-white/70 px-3 py-1 text-muted-foreground transition hover:-translate-y-px hover:border-[#1f4189]/40 hover:text-foreground">{t}</Link>
          ))}
        </motion.div>
        {totals?.courses > 0 && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1 }} className="mt-5 text-sm text-muted-foreground">
            <b className="tabular-nums text-foreground">{totals.courses}</b> courses · <b className="tabular-nums text-foreground">{totals.lessons}</b> lessons · <b className="tabular-nums text-foreground">{totals.questions}</b> graded questions
          </motion.p>
        )}
      </motion.div>

      <div className="relative mx-auto mt-10 h-[400px] max-w-5xl sm:h-[480px]">
        <div aria-hidden className="absolute bottom-0 left-1/2 h-40 w-[34rem] -translate-x-1/2 rounded-[50%] bg-[#1f4189]/10 blur-2xl" />
        <Mascot pose="laptop" className="absolute bottom-0 left-1/2 aspect-[365/437] h-[340px] -translate-x-1/2 sm:h-[420px]" delay={0.5} />

        <Float scrollY={scrollY} px={px} py={py} depth={1.2} delay={0.9} className="left-[2%] top-[8%] sm:left-[8%] sm:top-[12%]">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-[#00041d]"><CheckCircle2 className="h-4 w-4 text-[#1f4189]" />Lesson 4 check passed</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">3 of 3 right</p>
        </Float>
        <Float scrollY={scrollY} px={px} py={py} depth={0.8} delay={1.05} className="hidden sm:block sm:left-[5%] sm:top-[56%]">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-[#1f4189]"><Sparkles className="h-4 w-4" />AI tutor</p>
          <p className="mt-0.5 max-w-[13rem] text-sm text-[#00041d]">“OQ proves it works as specified. PQ proves it keeps working in real use.”</p>
        </Float>
        <Float scrollY={scrollY} px={px} py={py} depth={1.4} delay={1.2} className="right-[2%] top-[4%] sm:right-[9%] sm:top-[8%]">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-[#00041d]"><Award className="h-4 w-4 text-[#1f4189]" />Certificate earned</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Anyone can check it online</p>
        </Float>
        <Float scrollY={scrollY} px={px} py={py} depth={0.9} delay={1.35} className="right-[3%] top-[58%] sm:right-[6%] sm:top-[52%]">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-[#00041d]"><ShieldCheck className="h-4 w-4 text-[#1f4189]" />Verified on Talfirms</p>
          <div className="mt-1.5 flex gap-1">{[1, 2, 3].map((k) => <span key={k} className={`h-1.5 w-7 rounded-full ${k === 1 ? "bg-[#1f4189]" : "bg-[#1f4189]/15"}`} />)}</div>
          <p className="mt-1 text-[11px] text-muted-foreground">Tier 1 · job fit 64% → 82%</p>
        </Float>
      </div>
      <p className="pb-2 text-center text-[11px] text-muted-foreground">Example</p>
    </section>
  );
}
