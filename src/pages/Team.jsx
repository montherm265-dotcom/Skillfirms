import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ArrowRight, ClipboardCheck, FileSpreadsheet, Link2, LockKeyhole, Users } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { leaveTeam, loadMyTeams } from "@/lib/team";
import { TALFIRMS_URL } from "@/lib/externalLinks";
import { crossAppClick } from "@/lib/crossApp";
import PageHero, { HeroGlass } from "@/components/page/PageHero";
import Seo from "@/components/seo/Seo";
import { Button } from "@/components/ui/button";

const ease = [0.22, 1, 0.36, 1];

// Team training: for managers, their companies; for staff, the teams
// they've joined; for everyone else, what it is.
export default function Team() {
  const { user } = useAuth();
  const [teams, setTeams] = useState(null);
  const [price, setPrice] = useState(1500);

  useEffect(() => {
    supabase.from("ad_pricing").select("cents").eq("key", "team_seat_month").maybeSingle().then(({ data }) => { if (data?.cents) setPrice(data.cents); });
  }, []);
  useEffect(() => { if (user) loadMyTeams().then(setTeams); else setTeams([]); }, [user]);

  async function leave(t) {
    if (!window.confirm(`Leave ${t.name}'s training? They'll stop seeing your progress.`)) return;
    try { await leaveTeam(t.id); toast.success("You've left the team."); setTeams(await loadMyTeams()); } catch (e) { toast.error(e.message); }
  }

  const managed = (teams ?? []).filter((t) => t.manager);
  const joined = (teams ?? []).filter((t) => t.member && !t.manager);

  return (
    <div>
      <Seo title="Team training" description="Train your people on job skills, assign courses with due dates, and keep a training record you can export for audits." canonical="/team" />
      <PageHero eyebrow="Skillfirms for teams" icon={Users} title="Train your team." accent="Keep the record."
        sub={`Assign courses with due dates, see who has passed every graded check, and export a training record with certificates anyone can verify. Try it free with 3 people; then $${(price / 100).toFixed(0)} per person a month.`}
        aside={<HeroGlass className="mx-auto max-w-sm">
          <p className="flex items-center justify-between text-xs text-white/60"><span>GMP Basics · due Friday</span><span>Example</span></p>
          {[["Aisha K.", 100], ["Daniel R.", 75], ["Mei L.", 40]].map(([n, v], k) => (
            <div key={n} className="mt-4">
              <p className="flex justify-between text-sm"><span>{n}</span><span className="tabular-nums text-white/60">{v === 100 ? "Passed" : `${v}%`}</span></p>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10"><motion.div className="h-full rounded-full bg-[#6b8cff]" initial={{ width: 0 }} animate={{ width: `${v}%` }} transition={{ delay: 0.8 + k * 0.15, duration: 1, ease }} /></div>
            </div>
          ))}
          <p className="mt-5 border-t border-white/10 pt-3 text-xs text-white/55">Export the record · every certificate checkable</p>
        </HeroGlass>} />

      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        {user && managed.length > 0 && (
          <section>
            <h2 className="text-2xl font-extrabold tracking-[-0.03em]">Your companies</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {managed.map((t) => (
                <Link key={t.id} to={`/team/${t.slug}`} className="hover-lift flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
                  <span className="flex items-center gap-3">
                    {t.logo_url ? <img src={t.logo_url} alt="" className="h-10 w-10 rounded-lg object-cover" /> : <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary font-display text-primary-foreground">{t.name.slice(0, 1)}</span>}
                    <span className="font-semibold">{t.name}</span>
                  </span>
                  <span className="flex items-center gap-1 text-sm font-medium text-mastery">Open training<ArrowRight className="h-4 w-4" /></span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {user && joined.length > 0 && (
          <section className="mt-8">
            <h2 className="text-2xl font-extrabold tracking-[-0.03em]">Teams you're in</h2>
            <ul className="mt-3 space-y-2">
              {joined.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
                  <span><span className="font-semibold">{t.name}</span> <span className="text-sm text-muted-foreground">can see your progress in the courses they assign you.</span></span>
                  <span className="flex gap-2">
                    <Link to="/my-learning"><Button size="sm" variant="outline">My courses</Button></Link>
                    <Button size="sm" variant="ghost" onClick={() => leave(t)}>Leave</Button>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Link2, t: "One invite link", d: "Share it with your people. They join with their own account." },
            { icon: ClipboardCheck, t: "Assign with due dates", d: "To everyone or one person. They're enrolled straight away." },
            { icon: FileSpreadsheet, t: "Export the record", d: "Who passed what and when, with certificate codes anyone can verify." },
            { icon: LockKeyhole, t: "Private by design", d: "You see progress in the courses you assign, never notes, tutor chats or anything else." },
          ].map((s) => (
            <div key={s.t} className="rounded-2xl border border-border bg-card p-5">
              <s.icon className="h-5 w-5 text-mastery" />
              <p className="mt-3 font-semibold">{s.t}</p>
              <p className="mt-1 text-sm text-muted-foreground">{s.d}</p>
            </div>
          ))}
        </section>

        {(!user || (teams && managed.length === 0)) && (
          <section className="mt-10 rounded-2xl border border-dashed border-border p-6">
            <p className="flex items-center gap-2 font-display text-xl font-semibold"><Users className="h-5 w-5" />Set up training for your company</p>
            <p className="mt-1 text-sm text-muted-foreground">Team training uses your company page on Talfirms (same sign-in). If you manage a company there, it shows up here. If not, create one first; it takes a minute.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {!user && <Link to="/auth?next=/team"><Button>Sign in</Button></Link>}
              <a href={`${TALFIRMS_URL}/companies/new`} onClick={crossAppClick(TALFIRMS_URL, "/companies/new")} target="_blank" rel="noreferrer"><Button variant="outline">Create a company on Talfirms ↗</Button></a>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
