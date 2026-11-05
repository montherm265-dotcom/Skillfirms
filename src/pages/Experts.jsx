import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { BadgeCheck, CheckCircle2, EyeOff, Hourglass, Laptop, Search, Wallet } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import { applyAsExpert, loadExpertStatus } from "@/lib/missions";
import Seo from "@/components/seo/Seo";
import { EXPERT_SHARE, UDEMY_SHARE } from "@/lib/plans";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const ease = [0.22, 1, 0.36, 1];

// Become a Skillfirms expert: real people who know the work review Mission
// submissions and earn 60% of each review. Every application is checked by
// Skillfirms before anyone can review.
export default function Experts() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState(null);
  const [skills, setSkills] = useState([]);
  const [prices, setPrices] = useState([]);
  const [form, setForm] = useState({ headline: "", experience: "", years: 5, links: "" });
  const [picked, setPicked] = useState([]);
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from("skillfirms_skills").select("id, name").order("name").then(({ data }) => setSkills(data ?? []));
    supabase.from("skillfirms_missions").select("review_price_cents").eq("status", "published").then(({ data }) => setPrices((data ?? []).map((m) => m.review_price_cents)));
  }, []);
  useEffect(() => { if (user) loadExpertStatus().then(setStatus); }, [user]);

  const shown = useMemo(() => skills.filter((s) => s.name.toLowerCase().includes(filter.toLowerCase())), [skills, filter]);
  const lo = prices.length ? Math.min(...prices) : 2900;
  const hi = prices.length ? Math.max(...prices) : 4900;
  const earn = (c) => `$${Math.round((c * 0.6) / 100)}`;

  async function submit(e) {
    e.preventDefault();
    if (!user) { navigate("/auth?mode=signup&next=/experts"); return; }
    setBusy(true);
    try {
      await applyAsExpert({ ...form, years: Number(form.years) || 0, skillIds: picked });
      toast.success("Application sent. We'll review it soon.");
      setStatus(await loadExpertStatus());
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  const app = status?.application;
  const ready = form.headline.trim().length >= 3 && form.experience.trim().length >= 50 && picked.length > 0;

  return (
    <div>
      <Seo title="Become a Skillfirms expert" description="Teach your own courses at your own price and keep 70% (97% through your own link), or review real work for 60% of every review." canonical="/experts" />
      <section className="relative overflow-hidden bg-[hsl(222_38%_8%)] text-white">
        <div className="bg-grid absolute inset-0 opacity-40 [mask-image:radial-gradient(ellipse_at_top_left,black,transparent_70%)]" />
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease }} className="relative mx-auto max-w-5xl px-4 py-14 sm:px-6">
          <p className="eyebrow text-[hsl(var(--mastery))]">Skillfirms experts</p>
          <h1 className="mt-3 max-w-2xl font-display text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">Know the work? Teach it, judge it, get paid.</h1>
          <p className="mt-4 max-w-xl text-lg text-white/75">Build your own courses, with video, at the price you choose, and change it whenever you like. Or review real Mission submissions from people learning your field. One expert account does both.</p>
          <dl className="mt-8 grid max-w-xl grid-cols-3 gap-6 border-t border-white/15 pt-6">
            <div><dt className="text-xs text-white/60">You earn per review</dt><dd className="mt-1 font-display text-2xl font-semibold">{earn(lo)}–{earn(hi)}</dd></div>
            <div><dt className="text-xs text-white/60">Time per review</dt><dd className="mt-1 font-display text-2xl font-semibold">20–40 min</dd></div>
            <div><dt className="text-xs text-white/60">Experts so far</dt><dd className="mt-1 font-display text-2xl font-semibold">{status ? status.experts_total : "–"}</dd></div>
          </dl>
        </motion.div>
      </section>

      <section className="mx-auto max-w-5xl px-4 pt-12 sm:px-6">
        <h2 className="font-display text-2xl font-semibold">Teach a course: you keep more than anywhere else</h2>
        <p className="mt-1 text-sm text-muted-foreground">You set your price ($9 to $199, or free) and can change it any time. Skillfirms checks every course before it goes live.</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {[
            ["Skillfirms finds the learner", EXPERT_SHARE.marketplace, UDEMY_SHARE.marketplace, "Someone finds your course by browsing or searching Skillfirms."],
            ["You bring the learner", EXPERT_SHARE.expert_link, UDEMY_SHARE.expert_link, "They buy through your own link. The 3% only covers card fees."],
            ["Companies train their teams", EXPERT_SHARE.team_pool, UDEMY_SHARE.team_pool, "Half of what companies pay for team training goes to experts, shared by how many minutes of your lessons their staff complete."],
          ].map(([t, ours, udemy, d], i) => (
            <motion.div key={t} initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08, duration: 0.45, ease }}
              whileHover={{ y: -3 }} className="rounded-2xl border border-border bg-card p-5">
              <p className="text-sm font-semibold">{t}</p>
              <p className="mt-2 flex items-baseline gap-2"><span className="font-display text-4xl font-semibold text-mastery">{ours}%</span><span className="text-sm text-muted-foreground">yours</span></p>
              <p className="text-xs text-muted-foreground">Udemy pays {udemy}%{t === "Companies train their teams" ? " of its subscription pool" : ""}.</p>
              <p className="mt-2 text-sm text-muted-foreground">{d}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <div className="mx-auto grid max-w-5xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_22rem]">
        <section>
          <h2 className="font-display text-2xl font-semibold">Reviewing work: how it works</h2>
          <ol className="mt-4 space-y-4">
            {[
              { icon: Search, t: "Pick work in your skills", d: "You only see paid reviews for missions that match the skills you were approved for. Take one, and you have 3 days." },
              { icon: EyeOff, t: "Judge it blind", d: "You see the work, never the person's name. Score every skill, write feedback they can act on, and decide pass or not yet." },
              { icon: BadgeCheck, t: "Your pass means something", d: "A pass gives them an \"Expert verified\" certificate that shows as verified proof on Talfirms, where employers look." },
              { icon: Wallet, t: "Earn 60%", d: "Every finished review adds to your earnings, shown in your review queue. Payouts start when payments open." },
              { icon: Laptop, t: "From anywhere, when you like", d: "No schedule and no minimum. Review when you have time." },
            ].map((s) => (
              <li key={s.t} className="flex gap-3">
                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-mastery/10 text-mastery"><s.icon className="h-5 w-5" /></span>
                <span><span className="block font-semibold">{s.t}</span><span className="block text-sm text-muted-foreground">{s.d}</span></span>
              </li>
            ))}
          </ol>
          <p className="mt-6 text-sm text-muted-foreground">We check every application by hand. You can't review your own work, and you can't review outside your approved skills.</p>
        </section>

        <aside>
          <div className="rounded-2xl border border-border bg-card p-5 lg:sticky lg:top-20">
            {status?.expert ? (
              <div>
                <p className="flex items-center gap-2 font-display text-xl font-semibold"><CheckCircle2 className="h-5 w-5 text-mastery" />You're an expert</p>
                <p className="mt-1 text-sm text-muted-foreground">Open your queue to pick up reviews.</p>
                <Link to="/expert"><Button className="mt-4 w-full">Open my review queue</Button></Link>
              </div>
            ) : app?.status === "pending" ? (
              <div>
                <p className="flex items-center gap-2 font-display text-xl font-semibold"><Hourglass className="h-5 w-5" />Application received</p>
                <p className="mt-1 text-sm text-muted-foreground">Sent {new Date(app.created_at).toLocaleDateString()}. We'll review it and let you know.</p>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-3">
                <p className="font-display text-xl font-semibold">Apply</p>
                {app?.status === "declined" && <p className="rounded-lg bg-secondary p-2 text-xs">Your last application wasn't approved{app.admin_note ? `: ${app.admin_note}` : "."} You can apply again.</p>}
                <label className="block text-sm font-medium">Your headline
                  <input value={form.headline} onChange={(e) => setForm({ ...form, headline: e.target.value })} maxLength={120} placeholder="e.g. Validation lead, sterile manufacturing" className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
                </label>
                <label className="block text-sm font-medium">Years doing this work
                  <input type="number" min={0} max={60} value={form.years} onChange={(e) => setForm({ ...form, years: e.target.value })} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
                </label>
                <label className="block text-sm font-medium">What you've done
                  <Textarea value={form.experience} onChange={(e) => setForm({ ...form, experience: e.target.value })} maxLength={3000} placeholder="Roles, projects, what you've reviewed or signed off before (at least 50 characters)" className="mt-1 min-h-28" />
                </label>
                <div>
                  <p className="text-sm font-medium">Skills you can judge <span className="font-normal text-muted-foreground">({picked.length}/10)</span></p>
                  <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter skills" className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm" />
                  <div className="mt-2 flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
                    {shown.map((s) => {
                      const on = picked.includes(s.id);
                      return (
                        <button key={s.id} type="button" aria-pressed={on} disabled={!on && picked.length >= 10}
                          onClick={() => setPicked((p) => (on ? p.filter((x) => x !== s.id) : [...p, s.id]))}
                          className={`rounded-full border px-2.5 py-1 text-xs ${on ? "border-mastery bg-mastery/10 font-semibold text-mastery" : "border-border hover:border-foreground/30 disabled:opacity-40"}`}>
                          {s.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <label className="block text-sm font-medium">Links <span className="font-normal text-muted-foreground">(optional: Talfirms or LinkedIn profile)</span>
                  <input value={form.links} onChange={(e) => setForm({ ...form, links: e.target.value })} maxLength={500} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
                </label>
                <Button type="submit" className="w-full" disabled={busy || (user && !ready)}>{!user ? "Sign in to apply" : busy ? "Sending…" : "Send application"}</Button>
              </form>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
