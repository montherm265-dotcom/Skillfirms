import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import LoadingSpinner from "@/components/LoadingSpinner";
import EmptyState from "@/components/EmptyState";
import { Sparkles } from "lucide-react";

const SOURCE_LABEL = {
  ai_estimated: "AI-estimated proficiency",
  assessment_based: "Assessment-based proficiency",
  expert_verified: "Expert-verified proficiency",
};

export default function SkillPassport() {
  const { user } = useAuth();
  const [grouped, setGrouped] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("skillfirms_user_skill_state")
      .select("proficiency, proficiency_source, last_evaluated_at, skillfirms_skills(name, category)")
      .eq("user_id", user.id)
      .order("proficiency", { ascending: false })
      .then(({ data }) => {
        const g = {};
        for (const row of data ?? []) {
          const cat = row.skillfirms_skills.category;
          (g[cat] ??= []).push(row);
        }
        setGrouped(g);
        setLoading(false);
      });
  }, [user.id]);

  if (loading) return <LoadingSpinner className="py-24" />;
  const categories = Object.keys(grouped);

  return (
    <div className="section-pad">
      <div className="mx-auto max-w-2xl">
        <h1 className="font-display text-2xl font-bold">Skill Passport</h1>
        <p className="mt-1 text-sm text-muted-foreground">Every skill, with where the number actually came from — never one opaque score.</p>

        {categories.length === 0 ? (
          <EmptyState icon={Sparkles} title="No skills recorded yet" description="Build a career path from the homepage to get your first diagnosis." />
        ) : (
          <div className="mt-6 space-y-8">
            {categories.map((cat) => (
              <section key={cat}>
                <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{cat.replace(/_/g, " ")}</h2>
                <div className="mt-3 space-y-3">
                  {grouped[cat].map((row, i) => (
                    <div key={i}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{row.skillfirms_skills.name}</span>
                        <span className="font-display tabular-nums">{Math.round(row.proficiency * 100)}%</span>
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                        <div className="h-full rounded-full bg-mastery" style={{ width: `${Math.round(row.proficiency * 100)}%` }} />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{SOURCE_LABEL[row.proficiency_source]}</p>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
