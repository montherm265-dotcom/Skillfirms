import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, Briefcase, PartyPopper, X } from "lucide-react";
import { clearJobGoal, jobGoalUrl, readJobGoal } from "@/lib/jobGoal";
import { signedLinkClick } from "@/lib/crossApp";

export function useJobGoal() {
  const [goal, setGoal] = useState(() => readJobGoal());
  useEffect(() => {
    const sync = () => setGoal(readJobGoal());
    window.addEventListener("sf-job-goal", sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener("sf-job-goal", sync); window.removeEventListener("storage", sync); };
  }, []);
  return goal;
}

// "You're learning for <job> on Talfirms" — with a signed link back to it.
// `finished` switches it to the "go see your new fit" version.
export default function JobGoalBanner({ finished = false, className = "" }) {
  const goal = useJobGoal();
  const href = jobGoalUrl(goal);
  if (!goal || !href) return null;
  const Icon = finished ? PartyPopper : Briefcase;
  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={`relative overflow-hidden rounded-2xl border p-4 ${finished ? "border-mastery/40 bg-mastery/10" : "border-border bg-card"} ${className}`}>
      <motion.span aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-mastery/15 blur-2xl"
        animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }} />
      <div className="relative flex flex-wrap items-center gap-3">
        <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-mastery/15 text-mastery"><Icon className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{finished ? "Ready to go back" : "Your Talfirms job goal"}</p>
          <p className="font-semibold">
            {finished ? <>Your new proof is on Talfirms. See your fit for {goal.title} now.</> : goal.title}
          </p>
          {!finished && (goal.skills?.length || goal.target) ? (
            <p className="text-xs text-muted-foreground">
              {goal.skills?.length ? <>Learning {goal.skills.join(", ")}</> : null}
              {goal.target ? <>{goal.skills?.length ? " · " : ""}{goal.now ? `${goal.now}% fit now, ` : ""}up to {goal.target}% with them</> : null}
            </p>
          ) : null}
        </div>
        <a href={href} onClick={signedLinkClick(href)} target="_blank" rel="noopener noreferrer"
          className="inline-flex flex-none items-center gap-1.5 rounded-full bg-foreground px-3.5 py-2 text-sm font-semibold text-background hover:opacity-90">
          {finished ? "See my fit" : "Back to the job"}<ArrowUpRight className="h-4 w-4" />
        </a>
        <button type="button" onClick={clearJobGoal} aria-label="Forget this job goal" className="absolute -right-1 -top-1 rounded-full p-1 text-muted-foreground hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </motion.div>
  );
}
