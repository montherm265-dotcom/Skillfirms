import { motion } from "framer-motion";
import { Award, CheckCircle2, ShieldCheck, Sparkles } from "lucide-react";

const ease = [0.22, 1, 0.36, 1];

function Glass({ children, className = "", delay = 0, float = 0 }) {
  return (
    <motion.div initial={{ opacity: 0, y: 24, filter: "blur(6px)" }} animate={{ opacity: 1, y: [0, -6, 0], filter: "blur(0px)" }}
      transition={{ opacity: { duration: 0.8, delay, ease }, filter: { duration: 0.8, delay }, y: { duration: 6, repeat: Infinity, ease: "easeInOut", delay: delay + float } }}
      className={`rounded-2xl border border-white/10 bg-white/[0.06] p-4 text-left text-white shadow-[0_30px_60px_-30px_rgba(0,0,0,0.8)] backdrop-blur-xl ${className}`}>
      {children}
    </motion.div>
  );
}

// Sign-in as one large card: the learning promise on a navy panel at the
// left, the form at the right. Phones see the form alone.
export default function AuthLayout({ title, subtitle, footer, children }) {
  return (
    <div className="mx-auto grid max-w-6xl overflow-hidden rounded-[2rem] border border-border bg-card shadow-[0_40px_100px_-50px_rgba(10,20,51,0.45)] lg:min-h-[640px] lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative isolate hidden overflow-hidden bg-[#050b24] p-12 text-white lg:flex lg:flex-col">
        <div aria-hidden className="absolute -left-40 -top-40 -z-10 h-[30rem] w-[30rem] rounded-full blur-3xl" style={{ background: "radial-gradient(closest-side, rgba(59,108,230,0.45), transparent)" }} />
        <div aria-hidden className="absolute -bottom-48 -right-32 -z-10 h-[28rem] w-[28rem] rounded-full blur-3xl" style={{ background: "radial-gradient(closest-side, rgba(107,140,255,0.28), transparent)", animation: "tf-drift 20s ease-in-out infinite" }} />
        <div aria-hidden className="absolute inset-0 -z-10 opacity-70" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)", backgroundSize: "48px 48px", maskImage: "radial-gradient(ellipse 70% 60% at 40% 40%, black, transparent 80%)", WebkitMaskImage: "radial-gradient(ellipse 70% 60% at 40% 40%, black, transparent 80%)" }} />
        <motion.h2 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease }} className="text-5xl font-extrabold leading-[1.02] tracking-[-0.045em]">
          Learn the job. <span className="bg-gradient-to-r from-[#c9d7ff] to-[#5b8ef5] bg-clip-text text-transparent">Prove it.</span> Get hired.
        </motion.h2>
        <p className="mt-4 text-lg text-white/60">One account for Skillfirms and Talfirms.</p>
        <div className="relative mt-auto h-60">
          <Glass delay={0.4} className="absolute left-0 top-0 w-60">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-white/80"><CheckCircle2 className="h-4 w-4 text-[#9db7ff]" />Lesson 4 check</p>
            <p className="mt-1 text-3xl font-extrabold tabular-nums">3 / 3</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"><motion.div className="h-full rounded-full bg-[#6b8cff]" initial={{ width: 0 }} animate={{ width: "33%" }} transition={{ delay: 1, duration: 1, ease }} /></div>
          </Glass>
          <Glass delay={0.6} float={1.5} className="absolute right-0 top-6 w-56">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-[#9db7ff]"><Sparkles className="h-4 w-4" />AI tutor</p>
            <p className="mt-1 text-sm">“A LEFT JOIN keeps every store, even with no sales.”</p>
          </Glass>
          <Glass delay={0.8} float={3} className="absolute bottom-0 left-10 w-72">
            <p className="flex items-center gap-1.5 text-sm font-semibold"><Award className="h-4 w-4 text-[#9db7ff]" />Certificate · SF-8K2P4Q</p>
            <p className="mt-1 flex items-center gap-1 text-xs text-white/55"><ShieldCheck className="h-3.5 w-3.5" />Verified on Talfirms · anyone can check it</p>
          </Glass>
        </div>
      </aside>
      <div className="flex items-center px-6 py-10 sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          <h1 className="text-4xl font-extrabold tracking-[-0.035em] text-foreground">{title}</h1>
          {subtitle && <p className="mt-2 text-lg text-muted-foreground">{subtitle}</p>}
          <div className="mt-8">{children}</div>
          {footer && <p className="mt-8 text-sm text-muted-foreground">{footer}</p>}
        </div>
      </div>
    </div>
  );
}
