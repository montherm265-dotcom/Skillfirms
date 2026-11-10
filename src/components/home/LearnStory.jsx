import { useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "framer-motion";
import { Award, CheckCircle2, Search, ShieldCheck, Sparkles } from "lucide-react";

const ease = [0.22, 1, 0.36, 1];

const STEPS = [
  { kicker: "Pick", title: "Pick the skill a job needs.", text: "Search any skill, or arrive from a Talfirms job: we line up exactly the courses that close your gap, shortest first.",
    card: <><p className="flex items-center gap-2 text-sm font-semibold"><Search className="h-4 w-4 text-[#1f4189]" />Data Analyst · Northwind</p><p className="mt-1 text-xs text-muted-foreground">You're missing: SQL, Excel</p><p className="mt-2 inline-flex rounded-full bg-[#1f4189]/10 px-2 py-0.5 text-[11px] font-semibold text-[#1f4189]">2 courses · 5 hr</p></> },
  { kicker: "Learn", title: "Learn with a tutor beside you.", text: "Experts teach the paid courses, AI teaches the free basics, and an AI tutor answers your questions in every lesson.",
    card: <><p className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4 text-[#1f4189]" />Ask the tutor</p><p className="mt-1.5 rounded-lg bg-[#f3f5ff] px-2 py-1.5 text-xs">Why does a JOIN double my totals?</p><p className="mt-1 text-xs text-muted-foreground">Because one store matched two rows…</p></> },
  { kicker: "Pass", title: "Pass a graded check every lesson.", text: "You can't click your way through. Every lesson ends in a check you have to pass, with no copy-paste.",
    card: <><p className="flex items-center gap-2 text-sm font-semibold"><CheckCircle2 className="h-4 w-4 text-[#1f4189]" />Lesson 3 check</p><p className="mt-1 text-3xl font-extrabold tabular-nums text-[#00041d]">3 / 3</p><p className="text-xs text-muted-foreground">Passed on the first try</p></> },
  { kicker: "Certify", title: "Earn a certificate anyone can check.", text: "Every certificate has its own page and code, saying what you passed and who taught it. Employers can verify it in seconds.",
    card: <><p className="flex items-center gap-2 text-sm font-semibold"><Award className="h-4 w-4 text-[#1f4189]" />Certificate · SF-8K2P4Q</p><p className="mt-1 text-xs text-muted-foreground">Data Analysis with SQL · 88%</p><p className="mt-2 inline-flex rounded-full bg-[#1f4189]/10 px-2 py-0.5 text-[11px] font-semibold text-[#1f4189]">Taught by an expert</p></> },
  { kicker: "Get hired", title: "Walk it straight into a job.", text: "Your certificate shows on Talfirms as verified proof. Jobs that need the skill find you, and your fit score goes up.",
    card: <><p className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4 text-[#1f4189]" />Verified on Talfirms</p><p className="mt-1 text-xs text-muted-foreground">Job fit</p><p className="text-2xl font-extrabold tabular-nums text-[#00041d]">64% → 82%</p></> },
];

// The learning journey, Apple-style: the screen holds while you scroll, a new
// proof card slides in, and each step slides in. A plain list on phones.
export default function LearnStory() {
  const ref = useRef(null);
  const [i, setI] = useState(0);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  useMotionValueEvent(scrollYProgress, "change", (v) => setI(Math.min(STEPS.length - 1, Math.max(0, Math.floor(v * STEPS.length)))));
  const s = STEPS[i];

  return (
    <>
      <section ref={ref} className="relative hidden lg:block" style={{ height: `${STEPS.length * 85}vh` }}>
        <div className="sticky top-16 flex h-[calc(100vh-4rem)] items-center">
          <div className="mx-auto grid w-full max-w-6xl grid-cols-2 items-center gap-16 px-6">
            <div className="relative aspect-[4/5] max-h-[78vh] overflow-hidden rounded-[2.5rem] bg-[radial-gradient(120%_90%_at_50%_0%,#eef1ff_0%,#dfe5ff_55%,#c9d3fb_100%)] shadow-[0_40px_80px_-40px_rgba(10,20,51,0.45)]">
              <div aria-hidden className="absolute inset-0 opacity-50" style={{ backgroundImage: "radial-gradient(rgba(31,65,137,0.12) 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
              <AnimatePresence mode="wait">
                <motion.p key={`n-${i}`} aria-hidden className="pointer-events-none absolute -bottom-10 -right-4 select-none text-[22rem] font-extrabold leading-none tracking-[-0.08em] text-[#1f4189]/[0.08]" initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -30 }} transition={{ duration: 0.6, ease }}>
                  {String(i + 1).padStart(2, "0")}
                </motion.p>
              </AnimatePresence>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="origin-center scale-[1.45]">
                  <AnimatePresence mode="wait">
                    <motion.div key={`card-${i}`} initial={{ opacity: 0, y: 24, scale: 0.94, filter: "blur(8px)" }} animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }} exit={{ opacity: 0, y: -16, scale: 0.97 }} transition={{ duration: 0.55, ease }}
                      className="w-64 rounded-2xl border border-white/70 bg-white/90 p-4 text-left shadow-[0_30px_70px_-25px_rgba(10,20,51,0.5)] backdrop-blur-xl">
                      {s.card}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            </div>

            <div>
              <div className="flex gap-2">
                {STEPS.map((x, k) => (
                  <span key={x.kicker} className="h-1 flex-1 overflow-hidden rounded-full bg-[#1f4189]/10">
                    <motion.span className="block h-full rounded-full bg-[#1f4189]" animate={{ width: k < i ? "100%" : k === i ? "60%" : "0%" }} transition={{ duration: 0.5, ease }} />
                  </span>
                ))}
              </div>
              <AnimatePresence mode="wait">
                <motion.div key={i} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -24 }} transition={{ duration: 0.5, ease }}>
                  <p className="mt-10 text-sm font-semibold uppercase tracking-[0.25em] text-[#1f4189]">{String(i + 1).padStart(2, "0")} · {s.kicker}</p>
                  <h2 className="mt-3 text-5xl font-extrabold leading-[1.05] tracking-[-0.04em] text-[#00041d] dark:text-white xl:text-6xl">{s.title}</h2>
                  <p className="mt-5 max-w-md text-xl leading-relaxed text-muted-foreground">{s.text}</p>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </section>

      {/* Phones and tablets: the same story as cards. */}
      <section className="mx-auto mt-16 max-w-xl space-y-5 px-4 lg:hidden">
        {STEPS.map((x, k) => (
          <motion.div key={x.kicker} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.6, ease }}
            className="overflow-hidden rounded-[2rem] bg-[radial-gradient(120%_90%_at_50%_0%,#eef1ff_0%,#dfe5ff_60%,#cfd8fb_100%)] p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#1f4189]">{String(k + 1).padStart(2, "0")} · {x.kicker}</p>
            <h2 className="mt-2 text-3xl font-extrabold leading-tight tracking-[-0.03em] text-[#00041d]">{x.title}</h2>
            <p className="mt-2 text-muted-foreground">{x.text}</p>
            <div className="mx-auto mt-5 w-full max-w-xs rounded-2xl border border-white/70 bg-white/90 p-4 text-left shadow-[0_20px_50px_-20px_rgba(10,20,51,0.4)]">{x.card}</div>
          </motion.div>
        ))}
      </section>
    </>
  );
}
