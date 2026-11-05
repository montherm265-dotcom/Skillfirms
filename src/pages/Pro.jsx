import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { BookOpenCheck, Check, Crown, GraduationCap, Minus, Sparkles, Timer, Zap } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { INCLUDED_WITH, dollars, joinPlan, loadMyPlan, loadSkillfirmsPlans } from "@/lib/plans";
import { TALFIRMS_URL } from "@/lib/externalLinks";
import { crossAppClick } from "@/lib/crossApp";
import Seo from "@/components/seo/Seo";
import { Button } from "@/components/ui/button";

const ease = [0.22, 1, 0.36, 1];
const CARDS = {
  free: { icon: BookOpenCheck, blurb: "Learn anything here and prove it. Free for good." },
  scholar: { icon: GraduationCap, blurb: "For steady learners: a tutor all month and more tries.", best: true },
  mastery: { icon: Crown, blurb: "For going all in: the most tutor time, the best prices, reviewed first." },
};

// Skillfirms plans: Free, Scholar, Mastery. Every number on this page is read
// from the table the server enforces (migration 0031).
export default function Pro() {
  const { user } = useAuth();
  const [plans, setPlans] = useState(null);
  const [mine, setMine] = useState(null);
  const [yearly, setYearly] = useState(false);
  const [busy, setBusy] = useState(null);

  useEffect(() => { loadSkillfirmsPlans().then(setPlans); }, []);
  useEffect(() => { if (user) loadMyPlan().then(setMine); }, [user]);

  const byPlan = Object.fromEntries((plans ?? []).map((p) => [p.plan, p]));
  const waiting = mine?.membership && ["waitlist", "awaiting_payment"].includes(mine.membership.status) ? mine.membership.plan : null;

  async function join(plan) {
    setBusy(plan);
    try {
      await joinPlan(plan, yearly ? "yearly" : "monthly");
      toast.success(`You're on the ${byPlan[plan]?.name} waiting list. Nothing is charged now; you'll confirm before you ever pay.`);
      setMine(await loadMyPlan());
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  }

  const rows = [
    ["Every free course, lesson and graded check", true, true, true],
    ["Certificate when you pass every check", true, true, true],
    ["Proof that shows on your Talfirms profile", true, true, true],
    ["AI tutor questions a day", byPlan.free?.tutor_per_day, byPlan.scholar?.tutor_per_day, byPlan.mastery?.tutor_per_day],
    ["Tutor never pauses mid-month", false, true, true],
    ["Tries a day at each graded check", byPlan.free?.check_tries_per_day, byPlan.scholar?.check_tries_per_day, byPlan.mastery?.check_tries_per_day],
    ["Off expert-taught courses", false, `${byPlan.scholar?.expert_discount_pct ?? "–"}%`, `${byPlan.mastery?.expert_discount_pct ?? "–"}%`],
    ["Your Missions reviewed first by experts", false, false, true],
    ["Included with", "–", INCLUDED_WITH.scholar, INCLUDED_WITH.mastery],
  ];

  return (
    <div>
      <Seo title="Plans" description="Skillfirms is free to learn. Scholar and Mastery add an AI tutor all month, more tries, money off expert courses and faster expert reviews." canonical="/pro" />
      <section className="relative overflow-hidden bg-[hsl(222_38%_8%)] text-white">
        <div className="bg-grid absolute inset-0 opacity-40 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
        <motion.div aria-hidden className="absolute left-1/2 top-0 h-80 w-[40rem] -translate-x-1/2 rounded-full bg-mastery/30 blur-3xl"
          animate={{ opacity: [0.6, 1, 0.6], scale: [1, 1.08, 1] }} transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }} />
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease }} className="relative mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold"><Sparkles className="h-3.5 w-3.5 text-warning" />Skillfirms plans</p>
          <h1 className="mt-5 font-display text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">Learning is free. <span className="italic text-[hsl(var(--mastery))]">Go further, faster.</span></h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-white/75">Courses, graded checks and certificates are free for everyone, always. Scholar and Mastery give you a tutor all month, more tries, money off expert courses and faster expert reviews.</p>
          {mine && mine.plan !== "free" && (
            <p className="mt-6 inline-flex items-center gap-2 rounded-full bg-mastery px-4 py-1.5 text-sm font-semibold text-mastery-foreground">
              <Check className="h-4 w-4" />You're on {mine.name}{mine.via_talfirms ? ` (included with your Talfirms ${mine.talfirms_plan === "ultra" ? "Ultra" : "Pro"})` : ""}
            </p>
          )}
          <div className="mt-8 inline-flex rounded-full border border-white/15 bg-white/5 p-1 text-sm">
            {[["Monthly", false], ["Yearly · 2 months free", true]].map(([label, y]) => (
              <button key={label} type="button" onClick={() => setYearly(y)} aria-pressed={yearly === y}
                className={`rounded-full px-4 py-1.5 font-medium transition-colors ${yearly === y ? "bg-white text-black" : "text-white/75 hover:text-white"}`}>{label}</button>
            ))}
          </div>
        </motion.div>
      </section>

      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <div className="grid gap-5 md:grid-cols-3">
          {["free", "scholar", "mastery"].map((plan, i) => {
            const p = byPlan[plan];
            const c = CARDS[plan];
            const current = (mine?.plan ?? (user ? "free" : null)) === plan;
            const price = plan === "free" ? 0 : yearly ? p?.yearly_cents : p?.monthly_cents;
            return (
              <motion.div key={plan} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08, duration: 0.5, ease }}
                whileHover={{ y: -4 }}
                className={`relative flex flex-col rounded-3xl border p-6 ${c.best ? "border-mastery bg-gradient-to-b from-mastery/10 to-card shadow-glow" : "border-border bg-card"}`}>
                {c.best && <span className="absolute -top-3 left-6 rounded-full bg-mastery px-3 py-0.5 text-xs font-bold text-mastery-foreground">Most popular</span>}
                <div className="flex items-center gap-2">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-mastery/15 text-mastery"><c.icon className="h-5 w-5" /></span>
                  <p className="font-display text-2xl font-semibold">{p?.name ?? plan}</p>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{c.blurb}</p>
                <p className="mt-5">
                  <span className="font-display text-4xl font-semibold">{plans ? dollars(price) : "–"}</span>
                  {plan !== "free" && <span className="text-sm text-muted-foreground"> / {yearly ? "year" : "month"}</span>}
                </p>
                {plan !== "free" && <p className="text-xs text-muted-foreground">Included with {INCLUDED_WITH[plan]}</p>}
                <ul className="mt-5 space-y-2 text-sm">
                  <li className="flex gap-2"><Sparkles className="mt-0.5 h-4 w-4 flex-none text-mastery" /><span><b>{p?.tutor_per_day ?? "–"}</b> AI tutor questions a day{plan === "free" ? ", within the free monthly AI allowance" : ""}</span></li>
                  <li className="flex gap-2"><Timer className="mt-0.5 h-4 w-4 flex-none text-mastery" /><span><b>{p?.check_tries_per_day ?? "–"}</b> tries a day at each graded check</span></li>
                  {plan === "free" ? (
                    <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 flex-none text-mastery" />All free courses, checks and certificates</li>
                  ) : (
                    <li className="flex gap-2"><Zap className="mt-0.5 h-4 w-4 flex-none text-mastery" /><span><b>{p?.expert_discount_pct ?? "–"}% off</b> expert-taught courses (the expert still earns their full share)</span></li>
                  )}
                  {plan === "mastery" && <li className="flex gap-2"><Crown className="mt-0.5 h-4 w-4 flex-none text-mastery" />Your Missions go to the front of the expert review queue</li>}
                </ul>
                <div className="mt-auto space-y-2 pt-6">
                  {current ? (
                    <Button variant="outline" className="w-full" disabled>Your plan</Button>
                  ) : plan === "free" ? (
                    user ? <Button variant="outline" className="w-full" disabled>Included</Button> : <Link to="/auth?mode=signup"><Button variant="outline" className="w-full">Join free</Button></Link>
                  ) : !user ? (
                    <Link to="/auth?mode=signup&next=/pro"><Button className={`w-full ${c.best ? "bg-mastery text-mastery-foreground hover:bg-mastery/90" : ""}`}>Get {p?.name}</Button></Link>
                  ) : waiting === plan ? (
                    <Button variant="outline" className="w-full" disabled>On the waiting list</Button>
                  ) : (
                    <Button className={`w-full ${c.best ? "bg-mastery text-mastery-foreground hover:bg-mastery/90" : ""}`} disabled={busy === plan} onClick={() => join(plan)}>
                      {busy === plan ? "Saving…" : `Get ${p?.name ?? plan}`}
                    </Button>
                  )}
                  {plan !== "free" && TALFIRMS_URL && !current && (
                    <a href={`${TALFIRMS_URL}/pricing`} onClick={crossAppClick(TALFIRMS_URL, "/pricing")} target="_blank" rel="noreferrer"
                      className="block text-center text-xs font-medium text-muted-foreground hover:text-foreground">Or get it with {INCLUDED_WITH[plan]}, jobs included ↗</a>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground">Card payments open soon. Until then a paid plan puts you on the waiting list and nothing is charged.</p>

        <section className="mt-14 overflow-x-auto">
          <h2 className="font-display text-2xl font-semibold">Compare</h2>
          <table className="mt-4 w-full min-w-[36rem] text-sm">
            <thead><tr className="border-b border-border text-left text-muted-foreground"><th className="py-2 font-medium"></th>
              {["free", "scholar", "mastery"].map((pl) => <th key={pl} className={`w-28 py-2 text-center font-medium ${pl === "scholar" ? "text-mastery" : ""}`}>{byPlan[pl]?.name ?? pl}</th>)}</tr></thead>
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
          <p className="mt-3 text-xs text-muted-foreground">Free AI pauses for the rest of the month once the free monthly allowance is used up, and comes back on the 1st. Certificates never depend on a plan: pass every lesson's check and you get it. Experts can put a time limit on their checks; it's the same for every plan.</p>
        </section>
      </div>
    </div>
  );
}
