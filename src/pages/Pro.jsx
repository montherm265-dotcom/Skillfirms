import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ArrowRight, Building2, Check, GraduationCap, PiggyBank, Sparkles } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { EXPERT_SHARE, buyPack, dollars, loadPacks, loadWallet } from "@/lib/plans";
import { loadAllowance } from "@/lib/tutor";
import PageHero from "@/components/page/PageHero";
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
      <PageHero center eyebrow="Pricing" icon={Sparkles} title="Pay for experts." accent="No plans, no subscriptions."
        sub="Expert courses cost what the expert sets, paid once. AI-taught basics are free. The AI tutor gives you free questions every day; want more, buy a pack once and keep the questions for any course.">
        {user && allowance && (
          <div className="mx-auto grid max-w-md grid-cols-2 gap-3 text-left">
            <div className="rounded-2xl border border-white/15 bg-white/5 p-4"><p className="text-xs text-white/60">Free today</p><p className="text-2xl font-extrabold">{allowance.left} of {allowance.perDay}</p></div>
            <div className="rounded-2xl border border-white/15 bg-white/5 p-4"><p className="text-xs text-white/60">Saved questions</p><p className="text-2xl font-extrabold">{wallet?.balance ?? allowance.saved ?? 0}</p></div>
          </div>
        )}
      </PageHero>

      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <h2 className="text-3xl font-extrabold tracking-[-0.03em]">AI tutor question packs</h2>
        <p className="mt-1 text-sm text-muted-foreground">Used only after your free questions for the day run out. Saved questions never expire and work in every course.</p>
        <div className="mt-5 grid gap-5 md:grid-cols-3">
          {(packs ?? [{ pack: "a" }, { pack: "b" }, { pack: "c" }]).map((p, i) => {
            const isBest = best && p.pack === best.pack;
            const waiting = wallet?.waiting?.pack === p.pack;
            return (
              <motion.div key={p.pack} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08, duration: 0.5, ease }}
                whileHover={{ y: -4 }}
                className={`relative isolate flex flex-col overflow-hidden rounded-3xl border p-6 ${isBest ? "border-[#1f4189] bg-[#050b24] text-white shadow-[0_40px_80px_-30px_rgba(31,65,137,0.7)]" : "border-border bg-card hover:shadow-[0_30px_60px_-35px_rgba(10,20,51,0.5)]"}`}>
                {isBest && <div aria-hidden className="absolute -right-24 -top-24 -z-10 h-72 w-72 rounded-full blur-3xl" style={{ background: "radial-gradient(closest-side, rgba(59,108,230,0.55), transparent)" }} />}
                {isBest && <span className="mb-3 self-start rounded-full bg-gradient-to-r from-[#3b6ce6] to-[#6b8cff] px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white">Best value</span>}
                <p className="flex items-baseline gap-2"><span className="text-6xl font-extrabold tracking-[-0.04em]">{p.questions ?? "–"}</span><span className={`text-sm ${isBest ? "text-white/55" : "text-muted-foreground"}`}>questions</span></p>
                <p className="mt-3 text-3xl font-extrabold tracking-tight">{dollars(p.price_cents)}</p>
                <p className={`text-xs ${isBest ? "text-white/55" : "text-muted-foreground"}`}>{p.questions ? `${(p.price_cents / p.questions).toFixed(1)}¢ a question · paid once` : ""}</p>
                <ul className={`mt-5 space-y-2 text-sm ${isBest ? "text-white/85" : ""}`}>
                  <li className="flex gap-2"><PiggyBank className={`mt-0.5 h-4 w-4 flex-none ${isBest ? "text-[#9db7ff]" : "text-mastery"}`} />Saved to your balance, never expire</li>
                  <li className="flex gap-2"><Check className={`mt-0.5 h-4 w-4 flex-none ${isBest ? "text-[#9db7ff]" : "text-mastery"}`} />Any course, now or later</li>
                </ul>
                <div className="mt-auto pt-6">
                  {!user ? (
                    <Link to="/auth?mode=signup&next=/pro"><Button className={`h-11 w-full rounded-full ${isBest ? "bg-white text-[#050b24] hover:bg-[#c9d7ff]" : ""}`}>Get {p.questions} questions</Button></Link>
                  ) : waiting ? (
                    <Button variant="outline" className="w-full" disabled>On the list</Button>
                  ) : (
                    <Button className={`h-11 w-full rounded-full ${isBest ? "bg-white text-[#050b24] hover:bg-[#c9d7ff]" : ""}`} disabled={!p.questions || busy === p.pack} onClick={() => buy(p)}>
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

        <section className="relative isolate mt-10 overflow-hidden rounded-[2rem] bg-[#050b24] p-8 text-center text-white sm:p-12">
          <div aria-hidden className="absolute left-1/2 top-[-8rem] -z-10 h-72 w-[40rem] -translate-x-1/2 rounded-full blur-3xl" style={{ background: "radial-gradient(closest-side, rgba(59,108,230,0.45), transparent)" }} />
          <p className="text-3xl font-extrabold tracking-[-0.03em] sm:text-4xl">Know the work? <span className="bg-gradient-to-r from-[#c9d7ff] to-[#5b8ef5] bg-clip-text text-transparent">Teach on Skillfirms.</span></p>
          <p className="mx-auto mt-3 max-w-xl text-white/65">Set your own price and change it any time. Keep {EXPERT_SHARE.marketplace}% when we find the learner, {EXPERT_SHARE.expert_link}% through your own link, and share {EXPERT_SHARE.team_pool}% of company team-training money.</p>
          <Link to="/experts"><Button className="mt-6 h-11 rounded-full bg-white px-6 text-[#050b24] hover:bg-[#c9d7ff]">Become an expert</Button></Link>
        </section>
        <p className="mt-6 text-center text-xs text-muted-foreground">Certificates are never charged extra: pass every lesson's check and you get it. On Talfirms it shows as verified, taught by an expert or taught by AI.</p>
      </div>
    </div>
  );
}
