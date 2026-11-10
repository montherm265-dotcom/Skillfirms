import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Briefcase, Cpu, FlaskConical, Layers, Route, Wrench } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { Skeleton } from "@/components/ui/skeleton";
import PageHero from "@/components/page/PageHero";
import Seo from "@/components/seo/Seo";

const ease = [0.22, 1, 0.36, 1];
const ICON = { software: Cpu, pharmaceutical: FlaskConical, engineering: Wrench, "cross-industry": Layers };
const iconFor = (industry) => ICON[String(industry ?? "").toLowerCase()] ?? Briefcase;

export default function CareerRoles() {
  const [roles, setRoles] = useState(null);
  const [sector, setSector] = useState("All");

  useEffect(() => {
    supabase.from("skillfirms_career_roles").select("*").order("title").then(({ data }) => setRoles(data ?? []));
  }, []);

  const sectors = useMemo(() => ["All", ...new Set((roles ?? []).map((r) => r.industry).filter(Boolean))], [roles]);
  const shown = (roles ?? []).filter((r) => sector === "All" || r.industry === sector);

  return (
    <div>
      <Seo title="Career roles" description="Browse the real skill graph behind every Skillfirms diagnosis — what each career role actually requires." canonical="/roles" />
      <PageHero eyebrow="Career paths" icon={Route} title="Pick the job." accent="We'll map the skills."
        sub="Every role below is broken into the skills it really needs. Open one to see the shortest path of courses that gets you there." />

      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        {roles && sectors.length > 2 && (
          <div className="mb-8 flex flex-wrap gap-2">
            {sectors.map((s) => (
              <button key={s} type="button" onClick={() => setSector(s)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${sector === s ? "bg-[#00041d] text-white" : "border border-border bg-card text-muted-foreground hover:text-foreground"}`}>{s}</button>
            ))}
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {!roles ? Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-44 rounded-3xl" />)
            : shown.map((r, i) => {
              const Icon = iconFor(r.industry);
              return (
                <motion.div key={r.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04, duration: 0.5, ease }}>
                  <Link to={`/roles/${r.slug}`} className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-card p-6 transition-all hover:-translate-y-1 hover:border-[#1f4189]/30 hover:shadow-[0_30px_60px_-35px_rgba(10,20,51,0.55)]">
                    <span aria-hidden className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-[#3b6ce6]/15 opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100" />
                    <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-[#3b6ce6] to-[#00041d] text-white shadow-[0_12px_24px_-12px_rgba(31,65,137,0.8)]"><Icon className="h-6 w-6" /></span>
                    <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.18em] text-[#1f4189]">{r.industry}</p>
                    <p className="mt-1 text-xl font-bold tracking-tight">{r.title}</p>
                    {r.description && <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{r.description}</p>}
                    <p className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-[#1f4189]">See the skills<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></p>
                  </Link>
                </motion.div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
