import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ArrowRight, Building2, Check, GraduationCap, PiggyBank, Sparkles } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { EXPERT_SHARE, buyPack, dollars, loadPacks, loadWallet } from "@/lib/plans";
import { loadAllowance } from "@/lib/tutor";
import Seo from "@/components/seo/Seo";
import { Button } from "@/components/ui/button";

const ease = [0.22, 1, 0.36, 1];

// Skillfirms pricing: AI-taught basics are free; expert courses are paid at
// the price the expert sets; extra AI tutor questions come in packs you keep
// for any course; companies pay for team training. Numbers come from the
// tables the server enforces (migration 0032).
export default function Pro() {
  const { user } = useAuth();
  const [packs, setPacks] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [allowance, setAllowance] = useState(null);
  const [freeLimits, setFreeLimits] = useState(null);
  const [seat, setSeat] = useState(1500);
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    loadPacks().then(setPacks);
    supabase.from("ai_plan_limits").select("plan, quick_per_day").in("plan", ["free", "pro", "ultra"])
      .then(({ data }) => setFreeLimits(Object.fromEntries((data ?? []).map((r) => [r.plan, r.quick_per_day]))));
    supabase.from("ad_pricing").select("cents").eq("key", "team_seat_month").maybeSingle().then(({ data }) => { if (data?.cents) setSeat(data.cents); });
  }, []);
  useEffect(() => { if (user) { loadWallet().then(setWallet); loadAllowance().then(setAllowance); } }, [user]);

  async function buy(p) {
    setBusy(p.pack);
    try {
      await buyPack(p.pack);
      toast.success(`You're on the list for ${p.questions} questions. Nothing is charged now; you'll confirm before you ever pay.`);
      setWallet(await loadWallet());
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  }

  const best = packs?.length ? packs.reduce((a, b) => (a.price_cents / a.questions <= b.price_cents / b.questions ? a : b)) : null;

  return (
    <div>
      <Seo title="Pricing" description="Expert courses at the price the expert sets, free AI-taught basics, and AI tutor question packs you keep for any course." canonical="/pro" />
      <section className="relative overflow-hidden bg-[hsl(222_38%_8%)] text-white">
        <div className="bg-grid absolute inset-0 opacity-40 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
        <motion.div aria-hidden className="absolute left-1/2 top-0 h-80 w-[40rem] -translate-x-1/2 rounded-full bg-mastery/30 blur-3xl"
          animate={{ opacity: [0.6, 1, 0.6], scale: [1, 1.08, 1] }} transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }} />
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease }} className="relative mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold"><Sparkles className="h-3.5 w-3.5 text-warning" />Pricing</p>
          <h1 className="mt-5 font-display text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">Pay for experts. <span className="italic text-[hsl(var(--mastery))]">No plans, no subscriptions.</span></h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-white/75">Expert courses cost what the expert sets, paid once. AI-taught basics are free. The AI tutor gives you free questions every day; want more, buy a pack once and keep the questions for any course.</p>
          {user && allowance && (
            <div className="mx-auto mt-8 grid max-w-md grid-cols-2 gap-3 text-left">
              <div className="rounded-2xl border border-white/15 bg-white/5 p-4"><p className="text-xs text-white/60">Free today</p><p className="font-display text-2xl font-semibold">{allowance.left} of {allowance.perDay}</p></div>
              <div className="rounded-2xl border border-white/15 bg-white/5 p-4"><p className="text-xs text-white/60">Saved questions</p><p className="font-display text-2xl font-semibold">{wallet?.balance ?? allowance.saved ?? 0}</p></div>
            </div>
          )}
        </motion.div>
      </section>

      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <h2 className="font-display text-2xl font-semibold">AI tutor question packs</h2>
        <p className="mt-1 text-sm text-muted-foreground">Used only after your free questions for the day run out. Saved questions never expire and work in every course.</p>
        <div className="mt-5 grid gap-5 md:grid-cols-3">
          {(packs ?? [{ pack: "a" }, { pack: "b" }, { pack: "c" }]).map((p, i) => {
            const isBest = best && p.pack === best.pack;
            const waiting = wallet?.waiting?.pack === p.pack;
            return (
              <motion.div key={p.pack} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08, duration: 0.5, ease }}
                whileHover={{ y: -4 }}
                className={`relative flex flex-col rounded-3xl border p-6 ${isBest ? "border-mastery bg-gradient-to-b from-mastery/10 to-card shadow-glow" : "border-border bg-card"}`}>
                {isBest && <span className="absolute -top-3 left-6 rounded-full bg-mastery px-3 py-0.5 text-xs font-bold text-mastery-foreground">Best value</span>}
                <p className="flex items-baseline gap-2"><span className="font-display text-5xl font-semibold">{p.questions ?? "–"}</span><span className="text-sm text-muted-foreground">questions</span></p>
                <p className="mt-3 font-display text-3xl font-semibold">{dollars(p.price_cents)}</p>
                <p className="text-xs text-muted-foreground">{p.questions ? `${(p.price_cents / p.questions).toFixed(1)}¢ a question · paid once` : ""}</p>
                <ul className="mt-5 space-y-2 text-sm">
                  <li className="flex gap-2"><PiggyBank className="mt-0.5 h-4 w-4 flex-none text-mastery" />Saved to your balance, never expire</li>
                  <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 flex-none text-mastery" />Any course, now or later</li>
                </ul>
                <div className="mt-auto pt-6">
                  {!user ? (
                    <Link to="/auth?mode=signup&next=/pro"><Button className="w-full">Get {p.questions} questions</Button></Link>
                  ) : waiting ? (
                    <Button variant="outline" className="w-full" disabled>On the list</Button>
                  ) : (
                    <Button className={`w-full ${isBest ? "bg-mastery text-mastery-foreground hover:bg-mastery/90" : ""}`} disabled={!p.questions || busy === p.pack} onClick={() => buy(p)}>
                      {busy === p.pack ? "Saving…" : `Get ${p.questions ?? ""} questions`}
                    </Button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground">Card payments open soon. Until then, picking a pack puts you on the list and nothing is charged.</p>

        <section className="mt-14 grid gap-5 md:grid-cols-3">
          {[
            { icon: Sparkles, t: "Free every day", d: `${freeLimits?.free ?? 10} tutor questions a day on Free (within the free monthly AI allowance), ${freeLimits?.pro ?? 50} with Talfirms Pro and ${freeLimits?.ultra ?? 120} with Talfirms Ultra.`, to: null },
            { icon: GraduationCap, t: "Expert courses", d: `Real experts set their own price, paid once. Lesson 1 is always a free preview. Experts keep ${EXPERT_SHARE.marketplace}% of every sale, so your money goes to the person teaching you. AI-taught basics are free.`, to: "/courses?by=expert", cta: "Browse expert courses" },
            { icon: Building2, t: "For companies", d: `Train your team: assign courses, track every graded check, export the record. Free for 3 people, then $${(seat / 100).toFixed(0)} a person a month.`, to: "/team", cta: "Team training" },
          ].map((c, i) => (
            <motion.div key={c.t} initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.07, duration: 0.45, ease }}
              className="flex flex-col rounded-2xl border border-border bg-card p-5">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-mastery/15 text-mastery"><c.icon className="h-5 w-5" /></span>
              <p className="mt-3 font-display text-xl font-semibold">{c.t}</p>
              <p className="mt-1 text-sm text-muted-foreground">{c.d}</p>
              {c.to && <Link to={c.to} className="mt-auto inline-flex items-center gap-1 pt-4 text-sm font-semibold text-mastery hover:underline">{c.cta}<ArrowRight className="h-4 w-4" /></Link>}
            </motion.div>
          ))}
        </section>

        <section className="mt-10 rounded-3xl border border-border bg-card p-6 text-center">
          <p className="font-display text-2xl font-semibold">Teach on Skillfirms</p>
          <p className="mx-auto mt-1 max-w-xl text-sm text-muted-foreground">Set your own price and change it any time. Keep {EXPERT_SHARE.marketplace}% when we find the learner, {EXPERT_SHARE.expert_link}% through your own link, and share {EXPERT_SHARE.team_pool}% of company team-training money.</p>
          <Link to="/experts"><Button className="mt-4">Become an expert</Button></Link>
        </section>
        <p className="mt-6 text-center text-xs text-muted-foreground">Certificates are never charged extra: pass every lesson's check and you get it. On Talfirms it shows as verified, taught by an expert or taught by AI.</p>
      </div>
    </div>
  );
}
