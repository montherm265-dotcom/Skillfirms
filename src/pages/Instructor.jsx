import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Award, BookOpen, Clock, Star, Users } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import Seo from "@/components/seo/Seo";
import CourseCover from "@/components/course/CourseCover";
import { Skeleton } from "@/components/ui/skeleton";

const money = (c) => (c > 0 ? `$${(c / 100).toFixed(c % 100 ? 2 : 0)}` : "Free");
const fmt = (n) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n ?? 0));

function Stat({ icon: Icon, value, label }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10"><Icon className="h-5 w-5" /></span>
      <span><span className="block text-lg font-bold leading-tight tabular-nums">{value}</span><span className="text-xs text-white/70">{label}</span></span>
    </div>
  );
}

// An expert's public page: who they are, why trust them, what they teach.
export default function Instructor() {
  const { id } = useParams();
  const [p, setP] = useState(undefined);
  useEffect(() => { supabase.rpc("skillfirms_instructor", { p_expert_id: id }).then(({ data }) => setP(data ?? null)); }, [id]);

  if (p === undefined) return <div className="mx-auto max-w-5xl px-4 py-10"><Skeleton className="h-56 w-full rounded-2xl" /><Skeleton className="mt-6 h-40 w-full rounded-2xl" /></div>;
  if (!p) return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <Seo title="Instructor not found" />
      <p className="text-xl font-semibold">We couldn't find this instructor.</p>
      <Link to="/courses" className="mt-4 inline-block font-semibold text-[#1f4189] hover:underline">Browse courses</Link>
    </div>
  );

  const creds = String(p.credentials ?? "").split(/\n|;|•/).map((s) => s.trim()).filter(Boolean);
  return (
    <div>
      <Seo title={`${p.display_name}, instructor`} description={p.headline || `Courses taught by ${p.display_name} on Skillfirms.`} />
      <section className="relative overflow-hidden bg-gradient-to-br from-[#0f2350] via-[#1f4189] to-[#3b6ce6] text-white">
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
        <div className="relative mx-auto flex max-w-5xl flex-col gap-6 px-4 py-12 sm:flex-row sm:items-center">
          <span className="flex h-24 w-24 flex-none items-center justify-center rounded-3xl bg-white text-4xl font-bold text-[#1f4189] shadow-xl">{p.display_name.slice(0, 1)}</span>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/70">Instructor</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">{p.display_name}</h1>
            {p.headline && <p className="mt-2 max-w-2xl text-white/85">{p.headline}</p>}
            <div className="mt-5 flex flex-wrap gap-x-8 gap-y-3">
              <Stat icon={Users} value={fmt(p.learners)} label="learners" />
              <Stat icon={BookOpen} value={p.courses.length} label={p.courses.length === 1 ? "course" : "courses"} />
              {p.rating ? <Stat icon={Star} value={p.rating} label={`${fmt(p.reviews)} review${p.reviews === 1 ? "" : "s"}`} /> : null}
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-5xl gap-10 px-4 py-10 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div>
          {p.bio && (<><h2 className="text-xl font-semibold tracking-tight">About</h2><p className="mt-3 whitespace-pre-line leading-7 text-foreground/85">{p.bio}</p></>)}
          <h2 className={`${p.bio ? "mt-10" : ""} text-xl font-semibold tracking-tight`}>Courses by {p.display_name.split(" ")[0]}</h2>
          {p.courses.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">The first course is on its way.</p> : (
            <ul className="mt-4 space-y-4">
              {p.courses.map((c) => (
                <li key={c.id}>
                  <Link to={`/courses/${c.slug}`} className="group flex overflow-hidden rounded-xl border border-border bg-card transition-shadow hover:shadow-md">
                    <CourseCover course={c} className="hidden w-44 flex-none sm:block" />
                    <div className="min-w-0 flex-1 p-4">
                      <p className="font-semibold leading-snug group-hover:underline">{c.title}</p>
                      {c.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{c.description}</p>}
                      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {c.rating_count > 0 && <span className="inline-flex items-center gap-1 font-semibold text-foreground"><Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />{Number(c.rating_avg).toFixed(1)} ({c.rating_count})</span>}
                        <span className="capitalize">{c.level}</span>
                        <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{Math.max(1, Math.round(c.duration_hours))}h</span>
                        <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{fmt(c.learners)}</span>
                        <span className="ml-auto font-semibold text-foreground">{money(c.price_cents)}</span>
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        <aside className="space-y-4">
          {creds.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-5">
              <p className="flex items-center gap-2 font-semibold"><Award className="h-4 w-4 text-[#1f4189]" />Experience</p>
              <ul className="mt-3 space-y-2 text-sm text-foreground/85">{creds.map((c, i) => <li key={i} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-[#1f4189]" />{c}</li>)}</ul>
            </div>
          )}
          <div className="rounded-2xl border border-border bg-secondary/40 p-5 text-sm text-muted-foreground">
            Every Skillfirms instructor is checked by our team before they can teach. Teaching since {new Date(p.since).toLocaleDateString(undefined, { month: "long", year: "numeric" })}.
          </div>
        </aside>
      </div>
    </div>
  );
}
