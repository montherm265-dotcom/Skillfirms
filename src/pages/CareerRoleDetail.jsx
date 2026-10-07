import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import { computeReadiness } from "@/lib/diagnosis";
import LoadingSpinner from "@/components/LoadingSpinner";
import { Badge } from "@/components/ui/badge";

export default function CareerRoleDetail() {
  const { slug } = useParams();
  const { user } = useAuth();
  const [role, setRole] = useState(null);
  const [roleSkills, setRoleSkills] = useState([]);
  const [progression, setProgression] = useState({ before: [], after: [] });
  const [readiness, setReadiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      const { data: roleData, error: roleError } = await supabase.from("skillfirms_career_roles").select("*").eq("slug", slug).maybeSingle();
      if (!active) return;
      if (roleError || !roleData) { setError("Role not found"); setLoading(false); return; }
      setRole(roleData);

      const { data: rsData } = await supabase
        .from("skillfirms_role_skills")
        .select("importance, weight, skillfirms_skills(id, slug, name, category)")
        .eq("role_id", roleData.id)
        .order("weight", { ascending: false });
      if (!active) return;
      const rows = (rsData ?? []).map((rs) => ({ skillSlug: rs.skillfirms_skills.slug, skillName: rs.skillfirms_skills.name, skillId: rs.skillfirms_skills.id, importance: rs.importance, weight: rs.weight }));
      setRoleSkills(rows);

      const [{ data: before }, { data: after }] = await Promise.all([
        supabase.from("skillfirms_role_progressions").select("skillfirms_career_roles!from_role_id(slug, title)").eq("to_role_id", roleData.id),
        supabase.from("skillfirms_role_progressions").select("skillfirms_career_roles!to_role_id(slug, title)").eq("from_role_id", roleData.id),
      ]);
      if (!active) return;
      setProgression({ before: (before ?? []).map((b) => b.skillfirms_career_roles), after: (after ?? []).map((a) => a.skillfirms_career_roles) });

      if (user) {
        const { data: stateData } = await supabase.from("skillfirms_user_skill_state").select("*, skillfirms_skills(slug)").eq("user_id", user.id);
        if (!active) return;
        const stateBySlug = new Map((stateData ?? []).map((s) => [s.skillfirms_skills.slug, s]));
        setReadiness(computeReadiness(rows, stateBySlug));
      }
      setLoading(false);
    }
    load();
    return () => { active = false; };
  }, [slug, user]);

  if (loading) return <LoadingSpinner className="py-24" />;
  if (error) return <p className="section-pad text-center text-sm text-destructive">{error}</p>;

  return (
    <div className="section-pad">
      <div className="mx-auto max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{role.industry}</p>
        <h1 className="mt-1 font-display text-3xl font-bold">{role.title}</h1>
        {role.description && <p className="mt-2 text-muted-foreground">{role.description}</p>}

        {readiness && (
          <div className="mt-6 card-soft p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Your readiness</span>
              <span className="font-display text-2xl font-bold text-mastery">{readiness.percent}%</span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full bg-mastery" style={{ width: `${readiness.percent}%` }} />
            </div>
          </div>
        )}

        {(progression.before.length > 0 || progression.after.length > 0) && (
          <div className="mt-6 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {progression.before.map((b) => <Link key={b.slug} to={`/roles/${b.slug}`} className="hover:text-foreground">{b.title}</Link>)}
            {progression.before.length > 0 && <ArrowRight className="h-3.5 w-3.5" />}
            <span className="font-medium text-foreground">{role.title}</span>
            {progression.after.length > 0 && <ArrowRight className="h-3.5 w-3.5" />}
            {progression.after.map((a) => <Link key={a.slug} to={`/roles/${a.slug}`} className="hover:text-foreground">{a.title}</Link>)}
          </div>
        )}

        <div className="mt-8">
          <h2 className="font-display text-lg font-semibold">What this role actually requires</h2>
          <div className="mt-3 space-y-2">
            {roleSkills.map((rs) => {
              const userState = readiness?.items.find((i) => i.skillSlug === rs.skillSlug);
              return (
                <div key={rs.skillId} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{rs.skillName}</span>
                    <Badge variant={rs.importance === "required" ? "default" : "outline"} className="text-xs">{rs.importance}</Badge>
                  </div>
                  {userState != null && <span className="text-xs tabular-nums text-muted-foreground">{Math.round(userState.proficiency * 100)}% — {userState.source === "ai_estimated" ? "AI-estimated" : userState.source === "expert_verified" ? "expert-verified" : userState.source === "assessment_based" ? "assessment-based" : "no data"}</span>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
