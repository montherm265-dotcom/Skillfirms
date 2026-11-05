import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Check, Crown, Minus, Sparkles } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { loadAllowance, loadPlans } from "@/lib/tutor";
import { TALFIRMS_URL } from "@/lib/externalLinks";
import { crossAppClick } from "@/lib/crossApp";
import Seo from "@/components/seo/Seo";
import { Button } from "@/components/ui/button";

const ease = [0.22, 1, 0.36, 1];
const money = (cents) => (cents == null ? null : `$${(cents / 100).toFixed(2).replace(/\.00$/, "")}`);

// One plan for both sites: Talfirms Pro / Ultra include Skillfirms Pro.
// Every number here is read from the same tables the server enforces.
export default function Pro() {
  const { user } = useAuth();
  const [plans, setPlans] = useState(null);
  const [mine, setMine] = useState(null);

  useEffect(() => { loadPlans().then(setPlans); }, []);
  useEffect(() => { if (user) loadAllowance().then(setMine); }, [user]);

  const p = Object.fromEntries((plans ?? []).map((x) => [x.plan, x]));
  const paid = mine && mine.plan !== "free";
  const rows = [
    ["Every course, lesson and graded check", true, true, true],
    ["Certificate when you pass every lesson", true, true, true],
    ["Verified skill proof on Talfirms", true, true, true],
    ["Reviews, notes, saved courses", true, true, true],
    ["AI tutor questions a day", p.free?.quick_per_day, p.pro?.quick_per_day, p.ultra?.quick_per_day],
    ["AI never pauses mid-month", false, true, true],
    ["Practise with the tutor (fresh questions)", true, true, true],
    ["Everything in Talfirms Pro / Ultra", false, true, true],
  ];

  return (
    <div>
      <Seo title="Skillfirms Pro" description="Learning and certificates are free. Pro adds far more time with the AI tutor, and it's included in Talfirms Pro and Ultra." canonical="/pro" />
      <section className="relative overflow-hidden bg-[hsl(222_38%_8%)] text-white">
        <div className="bg-grid absolute inset-0 opacity-40 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
        <div className="absolute left-1/2 top-0 h-80 w-[40rem] -translate-x-1/2 rounded-full bg-mastery/30 blur-3xl" />
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease }} className="relative mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold"><Crown className="h-3.5 w-3.5 text-warning" />Skillfirms Pro</p>
          <h1 className="mt-5 font-display text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">Learning is free. <span className="italic text-[hsl(var(--mastery))]">Pro gives you a tutor.</span></h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-white/75">Courses, graded checks and certificates are free for everyone, always. Pro adds far more time with the AI tutor, and it's included in Talfirms Pro and Ultra. One plan covers both sites.</p>
          {paid && <p className="mt-6 inline-flex items-center gap-2 rounded-full bg-mastery px-4 py-1.5 text-sm font-semibold text-mastery-foreground"><Check className="h-4 w-4" />You have {mine.plan[0].toUpperCase() + mine.plan.slice(1)}, so Pro is already on</p>}
        </motion.div>
      </section>

      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <div className="grid gap-5 md:grid-cols-3">
          {[
            { plan: "free", name: "Free", blurb: "Everything you need to learn and prove it." },
            { plan: "pro", name: "Pro", blurb: "A tutor beside every lesson, all month.", best: true },
            { plan: "ultra", name: "Ultra", blurb: "For heavy learners, plus Talfirms Ultra." },
          ].map((c, i) => {
            const price = p[c.plan];
            const current = mine?.plan === c.plan;
            return (
              <motion.div key={c.plan} initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.07, duration: 0.45, ease }}
                className={`relative flex flex-col rounded-3xl border p-6 ${c.best ? "border-mastery bg-gradient-to-b from-mastery/10 to-card shadow-glow" : "border-border bg-card"}`}>
                {c.best && <span className="absolute -top-3 left-6 rounded-full bg-mastery px-3 py-0.5 text-xs font-bold text-mastery-foreground">Most popular</span>}
                <p className="font-display text-2xl font-semibold">{c.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">{c.blurb}</p>
                <p className="mt-5">
                  {c.plan === "free" ? <span className="font-display text-4xl font-semibold">$0</span> : price?.monthly_price_usd_cents != null ? (
                    <><span className="font-display text-4xl font-semibold">{money(price.monthly_price_usd_cents)}</span><span className="text-sm text-muted-foreground"> / month</span></>
                  ) : <span className="text-muted-foreground">–</span>}
                </p>
                {c.plan !== "free" && price?.yearly_price_usd_cents != null && <p className="text-xs text-muted-foreground">or {money(price.yearly_price_usd_cents)} a year</p>}
                <ul className="mt-5 space-y-2 text-sm">
                  <li className="flex gap-2"><Sparkles className="mt-0.5 h-4 w-4 flex-none text-mastery" /><span><b>{p[c.plan]?.quick_per_day ?? "–"}</b> tutor questions a day{c.plan === "free" ? ", within the free monthly AI allowance" : ""}</span></li>
                  <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 flex-none text-mastery" />All courses, checks and certificates</li>
                  {c.plan !== "free" && <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 flex-none text-mastery" />Everything in Talfirms {c.name}</li>}
                </ul>
                <div className="mt-auto pt-6">
                  {current ? (
                    <Button variant="outline" className="w-full" disabled>Your plan</Button>
                  ) : c.plan === "free" ? (
                    user ? <Button variant="outline" className="w-full" disabled>Included</Button> : <Link to="/auth?mode=signup"><Button variant="outline" className="w-full">Join free</Button></Link>
                  ) : (
                    <a href={`${TALFIRMS_URL}/pricing`} onClick={crossAppClick(TALFIRMS_URL, "/pricing")} target="_blank" rel="noreferrer">
                      <Button className={`w-full ${c.best ? "bg-mastery text-mastery-foreground hover:bg-mastery/90" : ""}`}>Get {c.name} on Talfirms</Button>
                    </a>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>

        <section className="mt-14 overflow-x-auto">
          <h2 className="font-display text-2xl font-semibold">Compare</h2>
          <table className="mt-4 w-full min-w-[34rem] text-sm">
            <thead><tr className="border-b border-border text-left text-muted-foreground"><th className="py-2 font-medium"></th><th className="w-24 py-2 text-center font-medium">Free</th><th className="w-24 py-2 text-center font-medium text-mastery">Pro</th><th className="w-24 py-2 text-center font-medium">Ultra</th></tr></thead>
            <tbody>
              {rows.map(([label, ...cells]) => (
                <tr key={label} className="border-b border-border">
                  <td className="py-3">{label}</td>
                  {cells.map((v, i) => (
                    <td key={i} className="py-3 text-center">
                      {v === true ? <Check className="mx-auto h-4 w-4 text-mastery" /> : v === false ? <Minus className="mx-auto h-4 w-4 text-muted-foreground/50" /> : <span className="font-semibold tabular-nums">{v ?? "–"}</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-muted-foreground">Free AI pauses for the rest of the month once the free monthly allowance is used up, and comes back on the 1st. Certificates never depend on a plan: pass every lesson's check and you get it.</p>
        </section>
      </div>
    </div>
  );
}
