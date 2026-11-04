import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, BookOpen, Clock, Target } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { matchSkill } from "@/lib/skillMatch";
import Seo from "@/components/seo/Seo";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

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
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      supabase.from("skillfirms_skills").select("id, name"),
      supabase.from("skillfirms_course_skills").select("skill_id, coverage, skillfirms_courses(slug, title, level, duration_hours, status, rating_avg)"),
      supabase.from("skillfirms_mission_skills").select("skill_id, skillfirms_missions(slug, title, difficulty, estimated_hours, status)"),
    ]).then(([skillsRes, coursesRes, missionsRes]) => {
      if (!active) return;
      const firstError = skillsRes.error || coursesRes.error || missionsRes.error;
      if (firstError) { setError("Couldn't load courses right now. Try again in a moment."); return; }
      setData({ skills: skillsRes.data ?? [], courseLinks: coursesRes.data ?? [], missionLinks: missionsRes.data ?? [] });
    });
    return () => { active = false; };
  }, []);

  const rows = useMemo(() => {
    if (!data) return [];
    return labels.map((label) => {
      const skill = matchSkill(label, data.skills);
      if (!skill) return { label, skill: null, courses: [], missions: [] };
      const courses = data.courseLinks
        .filter((l) => l.skill_id === skill.id && l.skillfirms_courses?.status === "published")
        .sort((a, b) => (b.coverage ?? 0) - (a.coverage ?? 0) || (b.skillfirms_courses.rating_avg ?? 0) - (a.skillfirms_courses.rating_avg ?? 0))
        .slice(0, 2)
        .map((l) => l.skillfirms_courses);
      const missions = data.missionLinks
        .filter((l) => l.skill_id === skill.id && l.skillfirms_missions?.status === "published")
        .slice(0, 1)
        .map((l) => l.skillfirms_missions);
      return { label, skill, courses, missions };
    });
  }, [data, labels]);

  const goal = target && job ? <>to raise your fit for <span className="font-semibold text-foreground">{job}</span>{now ? <> from {now}%</> : null} to <span className="font-semibold text-foreground">{target}%</span></> : job ? <>for <span className="font-semibold text-foreground">{job}</span></> : null;

  return (
    <div className="section-pad">
      <Seo title="Learn the skills a job needs" description="Courses and missions for exactly the skills a job is asking for." canonical="/learn" />
      <div className="mx-auto max-w-3xl">
        {fromTalfirms && <Badge variant="outline" className="mb-3">From Talfirms · Skill Bridge</Badge>}
        {labels.length === 0 ? (
          <>
            <h1 className="font-display text-2xl font-bold">Learn a skill</h1>
            <p className="mt-2 text-sm text-muted-foreground">No skill was picked. Tell us where you want to go and we'll build your path.</p>
            <Link to="/" className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">Find my path <ArrowRight className="h-4 w-4" /></Link>
          </>
        ) : (
          <>
            <h1 className="font-display text-2xl font-bold">Learn {joinLabels(labels)}</h1>
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
                    {row.courses.length === 0 && row.missions.length === 0 ? (
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
                              {c.duration_hours ? <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{c.duration_hours}h</span> : null}
                              <span className="font-medium text-primary">Start</span>
                            </span>
                          </Link>
                        ))}
                        {row.missions.map((m) => (
                          <Link key={m.slug} to={`/missions/${m.slug}`} className="flex items-center justify-between gap-3 rounded-lg bg-secondary/50 px-3 py-2 text-sm hover:bg-secondary">
                            <span className="min-w-0">Prove it: <span className="font-medium">{m.title}</span></span>
                            <span className="flex-none text-xs text-muted-foreground">Mission{m.estimated_hours ? ` · ${m.estimated_hours}h` : ""}</span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-6 text-xs text-muted-foreground">
              Skills you prove on Skillfirms can show on your Talfirms profile. Turn it on in <Link to="/settings" className="font-medium text-primary hover:underline">Settings</Link>.
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
