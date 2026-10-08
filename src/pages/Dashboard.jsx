import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Target } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { runDiagnosis, takePendingGoal } from "@/lib/diagnosis";
import DiagnosisResult from "@/components/DiagnosisResult";
import LoadingSpinner from "@/components/LoadingSpinner";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const { user, profile } = useAuth();
  const [latestGoal, setLatestGoal] = useState(null);
  const [diagnosisResult, setDiagnosisResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    async function load() {
      const pending = takePendingGoal();
      if (pending) {
        try {
          const result = await runDiagnosis(pending, user.id);
          if (active) setDiagnosisResult(result);
        } catch (err) {
          if (active) setError(err.message);
        }
      }

      const { data } = await supabase
        .from("skillfirms_user_career_goals")
        .select("*, skillfirms_career_roles(slug, title, description)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (active) {
        setLatestGoal(data);
        setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [user.id]);

  if (loading) return <LoadingSpinner className="py-24" />;

  return (
    <div className="section-pad">
      <div className="mx-auto max-w-2xl">
        <h1 className="font-display text-2xl font-bold">Welcome{profile?.display_name ? `, ${profile.display_name}` : ""}</h1>

        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

        {diagnosisResult ? (
          <div className="mt-6"><DiagnosisResult result={diagnosisResult} /></div>
        ) : latestGoal ? (
          <div className="mt-6 card-soft p-6">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><Target className="h-3.5 w-3.5" />Your goal</p>
            <h2 className="mt-1 font-display text-xl font-bold">{latestGoal.skillfirms_career_roles?.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">"{latestGoal.raw_goal_text}"</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link to={`/path/${latestGoal.id}`}><Button size="sm">View my learning path</Button></Link>
              <Link to="/passport"><Button variant="outline" size="sm">View your Skill Passport</Button></Link>
            </div>
          </div>
        ) : (
          <div className="mt-6 card-soft p-6 text-center">
            <p className="text-sm text-muted-foreground">You haven't set a career goal yet.</p>
            <Link to="/"><Button size="sm" className="mt-3">Build my path</Button></Link>
          </div>
        )}
      </div>
    </div>
  );
}
