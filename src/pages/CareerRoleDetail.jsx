import { useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowRight, Award, Briefcase, Check, CheckCircle2, Circle, Clock, Layers, PlayCircle } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import { formatHours, loadCatalog, loadMyLearning, totalMinutes } from "@/lib/catalog";
import { ProviderLine } from "@/components/course/CourseCard";
import CourseCover from "@/components/course/CourseCover";
import LoadingSpinner from "@/components/LoadingSpinner";
import Seo from "@/components/seo/Seo";
import PathProject from "@/components/course/PathProject";
import { Button } from "@/components/ui/button";

const hours = (m) => (m < 60 ? `${m} min` : `${Math.round(m / 6) / 10} hours`);

// A career path is a program: the courses that cover what one job needs,
// in order, with your progress across all of them and a clear finish line.
export default function CareerRoleDetail() {
  const { slug } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState(null);
  const [roleSkills, setRoleSkills] = useState([]);
  const [links, setLinks] = useState([]); // course_id, skill_id, coverage
  const [catalog, setCatalog] = useState(null);
  const [mine, setMine] = useState([]);
  const [progression, setProgression] = useState({ before: [], after: [] });
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: roleData } = await supabase.from("skillfirms_career_roles").select("*").eq("slug", slug).maybeSingle();
      if (!active) return;
      if (!roleData) { setError("Career path not found"); return; }
      setRole(roleData);
      const { data: rs } = await supabase.from("skillfirms_role_skills")
        .select("importance, weight, skillfirms_skills(id, slug, name)").eq("role_id", roleData.id).order("weight", { ascending: false });
      const skills = (rs ?? []).filter((r) => r.skillfirms_skills).map((r) => ({ ...r.skillfirms_skills, importance: r.importance, weight: r.weight }));
      if (!active) return;
      setRoleSkills(skills);
      const [{ data: cs }, cat, before, after] = await Promise.all([
        skills.length ? supabase.from("skillfirms_course_skills").select("course_id, skill_id, coverage").in("skill_id", skills.map((s) => s.id)) : Promise.resolve({ data: [] }),
        loadCatalog().catch(() => []),
        supabase.from("skillfirms_role_progressions").select("skillfirms_career_roles!from_role_id(slug, title)").eq("to_role_id", roleData.id),
        supabase.from("skillfirms_role_progressions").select("skillfirms_career_roles!to_role_id(slug, title)").eq("from_role_id", roleData.id),
      ]);
      if (!active) return;
      setLinks(cs ?? []);
      setCatalog(cat);
      setProgression({ before: (before.data ?? []).map((b) => b.skillfirms_career_roles).filter(Boolean), after: (after.data ?? []).map((a) => a.skillfirms_career_roles).filter(Boolean) });
    })();
    return () => { active = false; };
  }, [slug]);

  useEffect(() => {
    if (!user?.id) { setMine([]); return; }
    loadMyLearning(user.id).then(setMine).catch(() => setMine([]));
  }, [user?.id]);

  // The path: for each skill (required first, most important first), the
  // published course that covers it best; each course listed once.
  const path = useMemo(() => {
    if (!catalog) return null;
    const byId = Object.fromEntries(catalog.map((c) => [c.id, c]));
    const ordered = [...roleSkills].sort((a, b) => Number(b.importance === "required") - Number(a.importance === "required") || (b.weight ?? 0) - (a.weight ?? 0));
    const out = [];
    const seen = new Set();
    for (const s of ordered) {
      const best = links.filter((l) => l.skill_id === s.id && byId[l.course_id] && l.coverage >= 0.25)
        .sort((a, b) => b.coverage - a.coverage)[0];
      if (!best) continue;
      if (seen.has(best.course_id)) { out.find((x) => x.course.id === best.course_id).skills.push(s.name); continue; }
      seen.add(best.course_id);
      out.push({ course: byId[best.course_id], skills: [s.name] });
    }
    return out;
  }, [catalog, roleSkills, links]);

  const progressBy = useMemo(() => Object.fromEntries(mine.map((e) => [e.course_id, e])), [mine]);
  const uncovered = roleSkills.filter((s) => !path?.some((p) => p.skills.includes(s.name)));
  const done = (path ?? []).filter((p) => progressBy[p.course.id]?.finished).length;
  const minutes = (path ?? []).reduce((n, p) => n + totalMinutes(p.course), 0);
  const nextStep = (path ?? []).find((p) => !progressBy[p.course.id]?.finished);
  const pct = path?.length ? Math.round((done / path.length) * 100) : 0;

  function start() {
    if (!nextStep) return;
    const e = progressBy[nextStep.course.id];
    navigate(e ? `/courses/${nextStep.course.slug}/lessons/${e.next}` : `/courses/${nextStep.course.slug}`);
  }

  if (error) return <p className="section-pad text-center text-sm text-muted-foreground">{error}. <Link to="/roles" className="font-medium text-[#1f4189] hover:underline">All career paths</Link></p>;
  if (!role || !path) return <LoadingSpinner className="py-24" />;

  return (
    <div>
      <Seo
        title={`${role.title} career path`}
        description={role.description || `${role.title}: the courses that cover what this job needs, in order.`}
        canonical={`/roles/${slug}`}
        jsonLd={{ "@context": "https://schema.org", "@type": "Occupation", name: role.title, description: role.description || undefined, occupationalCategory: role.industry || undefined, skills: roleSkills.map((r) => r.name).join(", ") || undefined }}
        breadcrumb={[{ label: "Career paths", path: "/roles" }, { label: role.title }]}
      />

      <section className="border-b border-border bg-gradient-to-b from-[#eef1ff] to-background">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
          <p className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
            <Link to="/roles" className="hover:text-foreground hover:underline">Career paths</Link><span aria-hidden="true">›</span><span>{role.industry}</span>
          </p>
          <p className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-[#1f4189]/10 px-2.5 py-1 text-xs font-semibold text-[#1f4189]"><Layers className="h-3.5 w-3.5" />Career path · {path.length} course{path.length === 1 ? "" : "s"}</p>
          <h1 className="mt-3 max-w-3xl text-3xl font-semibold leading-tight tracking-tight sm:text-[2.4rem]">{role.title}</h1>
          {role.description && <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-foreground/75">{role.description}</p>}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            {path.length > 0 && (
              <Button className="h-12 rounded-lg px-7 text-base" onClick={start} disabled={!nextStep}>
                {!nextStep ? "Path complete" : done > 0 || progressBy[nextStep.course.id] ? "Continue the path" : "Start the path"}<ArrowRight className="h-4 w-4" />
              </Button>
            )}
            <span className="text-sm text-muted-foreground">Free to start · learn at your own pace</span>
          </div>
          {user && path.length > 0 && (
            <div className="mt-5 max-w-md">
              <div className="flex justify-between text-xs"><span className="font-medium">{done} of {path.length} courses passed</span><span className="tabular-nums">{pct}%</span></div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-[#1f4189]" style={{ width: `${Math.max(2, pct)}%` }} /></div>
            </div>
          )}
        </div>
        <div className="mx-auto max-w-6xl px-4 pb-8 sm:px-6 lg:px-8">
          <div className="grid divide-y divide-border rounded-xl border border-border bg-card shadow-sm sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
            <Fact title={`${path.length} course${path.length === 1 ? "" : "s"}`} sub="In the order to take them" />
            <Fact title={`${hours(minutes)} in all`} sub="Flexible schedule, your pace" />
            <Fact title={`${roleSkills.length} skills`} sub={`${roleSkills.filter((s) => s.importance === "required").length} the job requires`} />
            <Fact title="A certificate per course" sub="Each shows on Talfirms as verified" />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <section>
            <h2 className="text-xl font-semibold tracking-tight">Courses in this path</h2>
            {path.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">No course covers these skills yet. We're looking for experts who teach them.</p>
            ) : (
              <ol className="mt-4 space-y-3">
                {path.map((p, i) => {
                  const e = progressBy[p.course.id];
                  const status = e?.finished ? "done" : e ? "doing" : "todo";
                  return (
                    <li key={p.course.id} className="flex gap-4">
                      <span className="flex flex-col items-center">
                        {status === "done" ? <CheckCircle2 className="h-6 w-6 text-success" /> : status === "doing" ? <PlayCircle className="h-6 w-6 text-[#1f4189]" /> : <Circle className="h-6 w-6 text-border" />}
                        {i < path.length - 1 && <span className="mt-1 w-px flex-1 bg-border" />}
                      </span>
                      <Link to={`/courses/${p.course.slug}`} className="group mb-1 flex min-w-0 flex-1 gap-4 rounded-xl border border-border bg-card p-3 hover:shadow-[0_10px_30px_-14px_rgba(0,4,29,0.25)]">
                        <CourseCover course={p.course} className="hidden h-20 w-32 flex-none rounded-lg sm:block" />
                        <span className="min-w-0 flex-1">
                          <span className="text-xs font-semibold text-muted-foreground">Course {i + 1}</span>
                          <span className="block text-[15px] font-semibold leading-snug group-hover:underline">{p.course.title}</span>
                          <ProviderLine course={p.course} className="mt-1" />
                          <span className="mt-1.5 block text-xs text-muted-foreground"><Clock className="mr-1 inline h-3.5 w-3.5" />{formatHours(p.course)} · Covers {p.skills.join(", ")}</span>
                          {status === "doing" && <span className="mt-2 block h-1 max-w-xs overflow-hidden rounded-full bg-secondary"><span className="block h-full rounded-full bg-[#1f4189]" style={{ width: `${Math.max(3, e.progress_percent)}%` }} /></span>}
                        </span>
                        <span className="hidden flex-none self-center text-xs font-semibold sm:block">{status === "done" ? <span className="text-success">Passed</span> : status === "doing" ? <span className="text-[#1f4189]">{Math.round(e.progress_percent)}%</span> : <span className="text-muted-foreground">Not started</span>}</span>
                      </Link>
                    </li>
                  );
                })}
                <li className="flex gap-4">
                  <span className="flex flex-col items-center"><Award className={`h-6 w-6 ${!nextStep ? "text-success" : "text-muted-foreground"}`} /></span>
                  <div className="mb-1 flex-1 rounded-xl border border-dashed border-border p-4 text-sm">
                    <p className="font-semibold">{!nextStep ? "Path complete" : "Finish line"}</p>
                    <p className="mt-0.5 text-muted-foreground">Pass every course and the capstone project below; each certificate shows on your Talfirms profile as verified, ready for {role.title} jobs.</p>
                  </div>
                </li>
              </ol>
            )}
            {uncovered.length > 0 && (
              <p className="mt-6 rounded-xl bg-secondary/60 p-4 text-sm text-muted-foreground">
                <b className="text-foreground">Not covered by a course yet:</b> {uncovered.map((s) => s.name).join(", ")}. We're looking for experts who teach these.
              </p>
            )}
            <PathProject roleId={role.id} user={user} />
          </section>

          <aside className="space-y-6">
            <div>
              <h2 className="text-base font-semibold">Skills you'll gain</h2>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {roleSkills.map((s) => (
                  <span key={s.id} className={`rounded-full px-2.5 py-1 text-xs font-medium ${s.importance === "required" ? "bg-[#1f4189]/10 text-[#1f4189]" : "bg-secondary"}`}>{s.name}</span>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">Blue: required for the job.</p>
            </div>
            {(progression.before.length > 0 || progression.after.length > 0) && (
              <div>
                <h2 className="text-base font-semibold">Where it leads</h2>
                <ul className="mt-2 space-y-1.5 text-sm">
                  {progression.before.map((b) => <li key={b.slug}><Link to={`/roles/${b.slug}`} className="text-muted-foreground hover:text-foreground hover:underline">From: {b.title}</Link></li>)}
                  {progression.after.map((a) => <li key={a.slug}><Link to={`/roles/${a.slug}`} className="hover:underline">Next: {a.title}</Link></li>)}
                </ul>
              </div>
            )}
            <div className="rounded-xl border border-border p-4">
              <Briefcase className="h-5 w-5 text-[#1f4189]" />
              <p className="mt-2 text-sm font-semibold">Jobs on Talfirms</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Each course page shows the open Talfirms jobs that ask for its skills, and your fit for each.</p>
            </div>
            <ul className="space-y-2 text-sm">
              {["Taught by people who do the job", "AI tutor beside every lesson", "Expert courses: certificates anyone can verify"].map((t) => <li key={t} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 flex-none text-[#1f4189]" />{t}</li>)}
            </ul>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Fact({ title, sub }) {
  return (
    <div className="p-4">
      <p className="text-base font-semibold">{title}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}
