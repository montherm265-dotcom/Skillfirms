import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Clock } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import LoadingSpinner from "@/components/LoadingSpinner";
import { Badge } from "@/components/ui/badge";

export default function Missions() {
  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("skillfirms_missions")
      .select("*, skillfirms_mission_skills(skillfirms_skills(name))")
      .order("title")
      .then(({ data }) => {
        setMissions(data ?? []);
        setLoading(false);
      });
  }, []);

  if (loading) return <LoadingSpinner className="py-24" />;

  return (
    <div className="section-pad">
      <div className="mx-auto max-w-4xl">
        <h1 className="font-display text-2xl font-bold">Missions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Real-world work, not a quiz. Submit real output, get AI feedback immediately, and request a human expert review for proof that goes further than an estimate.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {missions.map((m) => (
            <Link key={m.id} to={`/missions/${m.slug}`} className="card-soft block p-4 transition hover:border-mastery/40">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="capitalize">{m.difficulty}</Badge>
                <p className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3.5 w-3.5" />{m.estimated_hours}h</p>
              </div>
              <p className="mt-2 font-display font-semibold">{m.title}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {m.skillfirms_mission_skills.map((ms, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">{ms.skillfirms_skills.name}</Badge>
                ))}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
