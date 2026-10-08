import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowRight, Clock } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import { assemblePath, getPathForGoal } from "@/lib/path";
import LoadingSpinner from "@/components/LoadingSpinner";
import EmptyState from "@/components/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function LearningPath() {
  const { goalId } = useParams();
  const { user } = useAuth();
  const [roleTitle, setRoleTitle] = useState(null);
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const existing = await getPathForGoal(goalId);
      if (existing && existing.items.length > 0) {
        setRoleTitle(existing.role?.title ?? null);
        setItems(existing.items.map((i) => ({ course: i.skillfirms_courses, skillName: i.skillfirms_skills?.name, gapWeight: i.gap_weight })));
        return;
      }

      const { data: goal, error: goalError } = await supabase
        .from("skillfirms_user_career_goals")
        .select("target_role_id, skillfirms_career_roles(title)")
        .eq("id", goalId)
        .single();
      if (goalError || !goal) throw new Error("Couldn't find that goal.");

      const assembled = await assemblePath({ userId: user.id, goalId, targetRoleId: goal.target_role_id });
      setRoleTitle(goal.skillfirms_career_roles?.title ?? null);
      setItems(assembled.items.map((i) => ({ course: i.course, skillName: i.primarySkillName, gapWeight: i.gapWeight })));
    } catch (err) {
      setError(err.message);
    }
  }, [goalId, user.id]);

  useEffect(() => { load(); }, [load]);

  if (error) return <p className="section-pad text-center text-sm text-destructive">{error}</p>;
  if (items === null) return <LoadingSpinner className="py-24" />;

  return (
    <div className="section-pad">
      <div className="mx-auto max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your learning path{roleTitle ? ` — toward ${roleTitle}` : ""}</p>
        <h1 className="mt-1 font-display text-2xl font-bold">Your path, assembled — not a course catalog</h1>
        <p className="mt-2 text-sm text-muted-foreground">Each course below was picked because it closes a specific gap between where you are now and what this role actually requires.</p>

        {items.length === 0 ? (
          <EmptyState title="No gaps left to close" description="Your recorded skills already cover what this role requires." />
        ) : (
          <div className="mt-6 space-y-3">
            {items.map((item, i) => (
              <Link key={item.course.id} to={`/courses/${item.course.slug}`} className="card-soft block p-4 transition hover:border-mastery/40">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Step {i + 1} · Closes: {item.skillName?.replace(/_/g, " ")}</p>
                    <p className="mt-1 font-display font-semibold">{item.course.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{item.course.skillfirms_experts?.display_name}</p>
                  </div>
                  <Badge variant="outline" className="capitalize">{item.course.level}</Badge>
                </div>
                <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3.5 w-3.5" />{item.course.duration_hours}h</p>
              </Link>
            ))}
          </div>
        )}

        {items.length > 0 && (
          <Link to={`/courses/${items[0].course.slug}`}>
            <Button className="mt-6">Start step 1<ArrowRight className="ml-1.5 h-4 w-4" /></Button>
          </Link>
        )}
      </div>
    </div>
  );
}
