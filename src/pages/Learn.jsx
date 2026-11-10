import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, BookOpen, Clock, Target } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { matchSkill } from "@/lib/skillMatch";
import { jobGoalFromParams, rememberJobGoal } from "@/lib/jobGoal";
import JobGoalBanner from "@/components/course/JobGoalBanner";
import Seo from "@/components/seo/Seo";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CATEGORIES } from "@/lib/catalog";

const POPULAR = ["SQL", "Python", "CQV", "GMP", "Agile", "Excel", "Machine learning", "Project scheduling"];

// No skill in the link: ask for one instead of leaving a dead end.
function PickSkill() {
  const [, setParams] = useSearchParams();
  const [q, setQ] = useState("");
  const go = (skill) => { if (skill.trim()) setParams({ skills: skill.trim() }); };
  return (
    <div className="text-center">
      <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">What do you want to <span className="mark">learn?</span></h1>
      <p className="mt-2 text-muted-foreground">Name a skill and we'll line up the courses for it, shortest path first.</p>
      <form onSubmit={(e) => { e.preventDefault(); go(q); }} className="mx-auto mt-6 flex max-w-lg gap-2 rounded-full border border-border bg-card p-1.5 shadow-sm">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. SQL, URS, Agile" className="min-w-0 flex-1 bg-transparent px-4 text-sm outline-none" aria-label="Skill" />
        <button type="submit" className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground">Find courses</button>
      </form>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {POPULAR.map((p) => <button key={p} type="button" onClick={() => go(p)} className="rounded-full border border-border bg-card px-3 py-1.5 text-sm hover:border-mastery hover:text-mastery">{p}</button>)}
      </div>
      <p className="mt-10 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Or browse by area</p>
      <div className="mt-3 grid gap-3 text-left sm:grid-cols-2">
        {CATEGORIES.map((c) => (
          <Link key={c.id} to={`/courses?category=${c.id}`} className="group rounded-2xl border border-border bg-card p-4 transition-shadow hover:shadow-md">
            <p className="flex items-center justify-between font-semibold">{c.label}<ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" /></p>
            <p className="mt-0.5 text-sm text-muted-foreground">{c.blurb}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

// Skill Bridge landing page. Talfirms sends job seekers here with the
// skills a job needs that they're missing ("learn A and B to reach 82%
// for HVAC Engineer"), and this page opens straight on the courses and
// missions for exactly those skills.
//   /learn?skills=A|B&job=HVAC%20Engineer&now=64&target=82&from=talfirms
// (?skill=A also works.)
export default function Learn() {
  const [params] = useSearchParams();
  const labels = useMemo(() => {
    const raw = params.get("skills") ?? params.get("skill") ?? "";
    return [...new Set(raw.split("|").map((s) => s.trim()).filter(Boolean))].slice(0, 5);
  }, [params]);
  const job = params.get("job");
  const now = Number(params.get("now")) || null;
  const target = Number(params.get("target")) || null;
  const fromTalfirms = params.get("from") === "talfirms";

  const [data, setData] = useState(null);
  useEffect(() => { rememberJobGoal(jobGoalFromParams(params)); }, [params]);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      supabase.from("skillfirms_skills").select("id, name"),
      supabase.from("skillfirms_course_skills").select("skill_id, coverage, skillfirms_courses(slug, title, level, duration_hours, status, rating_avg)"),
    ]).then(([skillsRes, coursesRes]) => {
      if (!active) return;
      const firstError = skillsRes.error || coursesRes.error;
      if (firstError) { setError("Couldn't load courses right now. Try again in a moment."); return; }
      setData({ skills: skillsRes.data ?? [], courseLinks: coursesRes.data ?? [] });
    });
    return () => { active = false; };
  }, []);

  const rows = useMemo(() => {
    if (!data) return [];
    return labels.map((label) => {
      const skill = matchSkill(label, data.skills);
      if (!skill) return { label, skill: null, courses: [] };
      const courses = data.courseLinks
        .filter((l) => l.skill_id === skill.id && l.skillfirms_courses?.status === "published")
        .sort((a, b) => (b.coverage ?? 0) - (a.coverage ?? 0) || (b.skillfirms_courses.rating_avg ?? 0) - (a.skillfirms_courses.rating_avg ?? 0))
        .slice(0, 2)
        .map((l) => l.skillfirms_courses);
      return { label, skill, courses };
    });
  }, [data, labels]);

  const goal = target && job ? <>to raise your fit for <span className="font-semibold text-foreground">{job}</span>{now ? <> from {now}%</> : null} to <span className="font-semibold text-foreground">{target}%</span></> : job ? <>for <span className="font-semibold text-foreground">{job}</span></> : null;

  return (
    <div className="section-pad">
      <Seo title="Learn the skills a job needs" description="Courses for exactly the skills a job is asking for." canonical="/learn" />
      <div className="mx-auto max-w-3xl">
        {fromTalfirms && <Badge variant="outline" className="mb-3">From Talfirms · Skill Bridge</Badge>}
        <JobGoalBanner className="mb-5" />
        {labels.length === 0 ? (
          <PickSkill />
        ) : (
          <>
            <h1 className="text-2xl font-extrabold tracking-[-0.03em]">Learn {joinLabels(labels)}</h1>
            {goal && <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground"><Target className="h-4 w-4 flex-none" /><span>{goal}.</span></p>}

            {error ? (
              <p className="mt-6 text-sm text-destructive">{error}</p>
            ) : !data ? (
              <div className="mt-6 space-y-3">{labels.map((l) => <Skeleton key={l} className="h-28 w-full rounded-xl" />)}</div>
            ) : (
              <ul className="mt-6 space-y-3">
                {rows.map((row) => (
                  <li key={row.label} className="card-soft p-4">
                    <p className="font-display font-semibold">{row.label}</p>
                    {row.courses.length === 0 ? (
                      <p className="mt-1 text-sm text-muted-foreground">
                        No Skillfirms course for this yet. <Link to="/roles" className="font-medium text-primary hover:underline">Browse career paths</Link>
                      </p>
                    ) : (
                      <div className="mt-2 space-y-2">
                        {row.courses.map((c) => (
                          <Link key={c.slug} to={`/courses/${c.slug}`} className="group flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 hover:border-primary/50">
                            <span className="flex min-w-0 items-center gap-2 text-sm">
                              <BookOpen className="h-4 w-4 flex-none text-primary" />
                              <span className="font-medium">{c.title}</span>
                            </span>
                            <span className="flex flex-none items-center gap-2 text-xs text-muted-foreground">
                              {c.level && <span className="capitalize">{c.level}</span>}
                              {c.duration_hours ? <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{Math.round(Number(c.duration_hours) * 10) / 10}h</span> : null}
                              <span className="font-medium text-primary">Start</span>
                            </span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-6 text-xs text-muted-foreground">
              Skills you prove on Skillfirms show on your Talfirms profile. You can turn that off in <Link to="/settings" className="font-medium text-primary hover:underline">Settings</Link>.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function joinLabels(labels) {
  if (labels.length <= 1) return labels[0] ?? "";
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}
