import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const CONFIDENCE_LABEL = { high: "High confidence match", medium: "Medium confidence match", low: "Low confidence match" };

export default function DiagnosisResult({ result }) {
  const { matchedRole, confidence, currentPositionSummary, estimates, persisted, goalId } = result;
  const sorted = [...estimates].sort((a, b) => a.proficiency - b.proficiency);

  return (
    <div className="card-soft p-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your goal</p>
      <h3 className="mt-1 font-display text-2xl font-bold">{matchedRole.title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{CONFIDENCE_LABEL[confidence]}</p>

      <p className="mt-4 text-sm text-foreground/90">{currentPositionSummary}</p>
      <p className="mt-1 text-xs italic text-muted-foreground">AI-estimated from what you wrote — not a real assessment yet.</p>

      {sorted.length > 0 && (
        <div className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your skill gaps</p>
          <div className="mt-3 space-y-3">
            {sorted.map((e) => (
              <div key={e.skillSlug}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{e.skillSlug.replace(/_/g, " ")}</span>
                  <span className="font-display tabular-nums text-muted-foreground">{Math.round(e.proficiency * 100)}%</span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                  <div className="h-full rounded-full bg-mastery" style={{ width: `${Math.round(e.proficiency * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {persisted && goalId && (
        <Link to={`/path/${goalId}`}>
          <Button className="mt-6">Build my learning path<ArrowRight className="ml-1.5 h-4 w-4" /></Button>
        </Link>
      )}
    </div>
  );
}
