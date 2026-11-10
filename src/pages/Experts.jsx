import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { BadgeCheck, CheckCircle2, GraduationCap, Hourglass, Laptop, PencilRuler, Video, Wallet } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import { applyAsExpert, loadExpertStatus } from "@/lib/missions";
import PageHero, { HeroGlass } from "@/components/page/PageHero";
import Seo from "@/components/seo/Seo";
import { EXPERT_SHARE, UDEMY_SHARE } from "@/lib/plans";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const ease = [0.22, 1, 0.36, 1];

// Become a Skillfirms expert: real people who know the work build paid
// courses at their own price. Every application is checked by Skillfirms.
export default function Experts() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState(null);
  const [skills, setSkills] = useState([]);
  const [form, setForm] = useState({ headline: "", experience: "", years: 5, links: "" });
  const [picked, setPicked] = useState([]);
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from("skillfirms_skills").select("id, name").order("name").then(({ data }) => setSkills(data ?? []));
  }, []);
  useEffect(() => { if (user) loadExpertStatus().then(setStatus); }, [user]);

  const shown = useMemo(() => skills.filter((s) => s.name.toLowerCase().includes(filter.toLowerCase())), [skills, filter]);

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
      <Seo title="Become a Skillfirms expert" description="Teach your own courses at your own price and keep 70% (97% through your own link)." canonical="/experts" />
      <PageHero eyebrow="Skillfirms experts" icon={GraduationCap} title="Know the work?" accent="Teach it and get paid."
        sub="Build your own courses, with video, at the price you choose, and change it whenever you like. People who pass your course get proof on Talfirms that says you taught them."
        aside={<HeroGlass className="mx-auto max-w-sm">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#9db7ff]">Your course · example</p>
          <p className="mt-2 text-lg font-bold">Risk-Based Change Control</p>
          <p className="text-xs text-white/55">Taught by an expert · 6 lessons · $49</p>
          <div className="mt-5 grid grid-cols-3 gap-2 text-center">
            {[["70%", "found by us"], ["97%", "your link"], ["50%", "team pool"]].map(([v, l]) => <div key={l} className="rounded-xl bg-white/[0.06] p-2.5"><p className="text-xl font-extrabold">{v}</p><p className="text-[10px] text-white/55">{l}</p></div>)}
          </div>
          <p className="mt-4 text-xs text-white/55">The share you keep of each sale</p>
        </HeroGlass>}>
        <dl className="grid max-w-xl grid-cols-3 gap-6 border-t border-white/15 pt-6">
          <div><dt className="text-xs text-white/60">You keep per sale</dt><dd className="mt-1 whitespace-nowrap text-2xl font-extrabold tracking-tight sm:text-3xl">70–97%</dd></div>
          <div><dt className="text-xs text-white/60">Your price</dt><dd className="mt-1 whitespace-nowrap text-2xl font-extrabold tracking-tight sm:text-3xl">$9–$199</dd></div>
          <div><dt className="text-xs text-white/60">Experts so far</dt><dd className="mt-1 whitespace-nowrap text-2xl font-extrabold tracking-tight sm:text-3xl">{status ? status.experts_total : "–"}</dd></div>
        </dl>
      </PageHero>

      <section className="mx-auto max-w-5xl px-4 pt-12 sm:px-6">
        <h2 className="font-display text-2xl font-semibold">Teach a course: you keep more than anywhere else</h2>
        <p className="mt-1 text-sm text-muted-foreground">You set your price ($9 to $199) and can change it any time. Expert courses are always paid; the free courses on Skillfirms are AI-taught basics. Skillfirms checks every course before it goes live.</p>
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
          <h2 className="font-display text-2xl font-semibold">How teaching works</h2>
          <ol className="mt-4 space-y-4">
            {[
              { icon: PencilRuler, t: "Build it in the studio", d: "Write lessons, add your own videos, and write at least 3 graded questions per lesson. You can put a time limit on each check." },
              { icon: BadgeCheck, t: "We check it, then it's live", d: "Skillfirms reviews every course before it goes live, so learners can trust it." },
              { icon: Video, t: "Lesson 1 is a free preview", d: "Learners try your teaching first, then buy the course at the price you set." },
              { icon: Wallet, t: "Keep 70% to 97%", d: "70% when Skillfirms finds the learner, 97% through your own link, and a share of company team-training money." },
              { icon: Laptop, t: "Proof with your name on it", d: "People who pass show it on Talfirms as \"taught by an expert\", with your name." },
            ].map((s) => (
              <li key={s.t} className="flex gap-3">
                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-mastery/10 text-mastery"><s.icon className="h-5 w-5" /></span>
                <span><span className="block font-semibold">{s.t}</span><span className="block text-sm text-muted-foreground">{s.d}</span></span>
              </li>
            ))}
          </ol>
          <p className="mt-6 text-sm text-muted-foreground">We check every application by hand.</p>
        </section>

        <aside>
          <div className="rounded-2xl border border-border bg-card p-5 lg:sticky lg:top-20">
            {status?.expert ? (
              <div>
                <p className="flex items-center gap-2 font-display text-xl font-semibold"><CheckCircle2 className="h-5 w-5 text-mastery" />You're an expert</p>
                <p className="mt-1 text-sm text-muted-foreground">Build a course or check how your courses are doing.</p>
                <Link to="/teach"><Button className="mt-4 w-full">Open my course studio</Button></Link>
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
                  <p className="text-sm font-medium">Skills you can teach <span className="font-normal text-muted-foreground">({picked.length}/10)</span></p>
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
