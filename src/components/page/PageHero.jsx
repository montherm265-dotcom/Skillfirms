import { motion } from "framer-motion";

const ease = [0.22, 1, 0.36, 1];

// The shared top of every main page: deep navy, two soft blue glows, a fine
// grid fading out, and a big headline. `accent` is the part of the title
// drawn in the blue gradient. `chips` are small [Icon, text] facts.
export default function PageHero({ eyebrow, icon: Icon, title, accent, sub, chips, children, aside, center = false }) {
  return (
    <section className="relative isolate overflow-hidden bg-[#050b24] text-white">
      <div aria-hidden className="absolute -left-40 -top-56 -z-10 h-[34rem] w-[34rem] rounded-full blur-3xl" style={{ background: "radial-gradient(closest-side, rgba(59,108,230,0.42), transparent)" }} />
      <div aria-hidden className="absolute -bottom-64 right-[-10rem] -z-10 h-[34rem] w-[34rem] rounded-full blur-3xl" style={{ background: "radial-gradient(closest-side, rgba(107,140,255,0.25), transparent)", animation: "tf-drift 22s ease-in-out infinite" }} />
      <div aria-hidden className="absolute inset-0 -z-10 opacity-70" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)", backgroundSize: "56px 56px", maskImage: "radial-gradient(ellipse 70% 80% at 30% 20%, black, transparent 80%)", WebkitMaskImage: "radial-gradient(ellipse 70% 80% at 30% 20%, black, transparent 80%)" }} />
      <div aria-hidden className="absolute inset-x-0 bottom-0 -z-10 h-px bg-gradient-to-r from-transparent via-[#6b8cff]/50 to-transparent" />

      <div className={`mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:px-8 ${aside ? "lg:grid-cols-[1.3fr_1fr]" : ""} ${center ? "text-center" : ""}`}>
        <div className="min-w-0">
          {eyebrow && (
            <motion.p initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease }}
              className={`inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#c9d7ff] backdrop-blur ${center ? "mx-auto" : ""}`}>
              {Icon && <Icon className="h-3.5 w-3.5" />}{eyebrow}
            </motion.p>
          )}
          <motion.h1 initial={{ opacity: 0, y: 24, filter: "blur(8px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ duration: 0.8, delay: 0.05, ease }}
            className={`mt-5 text-[2.6rem] font-extrabold leading-[1.02] tracking-[-0.045em] sm:text-6xl ${center ? "mx-auto max-w-3xl" : "max-w-3xl"}`}>
            {title}{accent && <> <span className="bg-gradient-to-r from-[#c9d7ff] via-[#9db7ff] to-[#5b8ef5] bg-clip-text text-transparent">{accent}</span></>}
          </motion.h1>
          {sub && (
            <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.2, ease }}
              className={`mt-5 max-w-2xl text-lg leading-relaxed text-white/65 ${center ? "mx-auto" : ""}`}>{sub}</motion.p>
          )}
          {chips?.length > 0 && (
            <motion.ul initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.35 }} className={`mt-7 flex flex-wrap gap-2 text-sm ${center ? "justify-center" : ""}`}>
              {chips.map(([C, t]) => (
                <li key={t} className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.05] px-3 py-1.5 text-white/80">{C && <C className="h-4 w-4 text-[#9db7ff]" />}{t}</li>
              ))}
            </motion.ul>
          )}
          {children && <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.4, ease }} className="mt-8">{children}</motion.div>}
        </div>
        {aside && <motion.div initial={{ opacity: 0, y: 30, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.9, delay: 0.3, ease }} className="hidden lg:block">{aside}</motion.div>}
      </div>
    </section>
  );
}

// A glass card for hero asides on navy.
export function HeroGlass({ children, className = "" }) {
  return <div className={`rounded-3xl border border-white/10 bg-white/[0.06] p-5 text-left text-white shadow-[0_40px_80px_-40px_rgba(0,0,0,0.8)] backdrop-blur-xl ${className}`}>{children}</div>;
}
