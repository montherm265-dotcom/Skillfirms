import { useEffect, useState } from "react";
import { BadgeCheck, Briefcase } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

// "Verified practitioner": the tutor's own job experience is confirmed on
// Talfirms. Plus how their learners' proof held up after hiring (combined,
// 5+ answers only). Both from the database (0042).
export function TutorBadge({ expertId, className = "" }) {
  const [t, setT] = useState(null);
  useEffect(() => { if (expertId) supabase.rpc("skillfirms_tutor_trust", { p_expert_id: expertId }).then(({ data }) => setT(data ?? null)); }, [expertId]);
  if (!t) return null;
  return (
    <span className={`inline-flex flex-wrap items-center gap-2 ${className}`}>
      {t.practitioner && <span className="inline-flex items-center gap-1 rounded-full bg-mastery/10 px-2 py-0.5 text-xs font-semibold text-mastery" title="Their own job experience is confirmed on Talfirms"><BadgeCheck className="h-3.5 w-3.5" />Verified practitioner</span>}
      {t.held_up && <span className="text-xs text-muted-foreground">Learners' proof held up in {t.held_up.held_up_pct}% of {t.held_up.answers} hires</span>}
    </span>
  );
}

// "X of Y certified learners were hired for these skills on Talfirms."
export function CourseOutcomes({ courseId }) {
  const [o, setO] = useState(null);
  useEffect(() => { if (courseId) supabase.rpc("skillfirms_course_outcomes", { p_course: courseId }).then(({ data }) => setO(data ?? null)); }, [courseId]);
  if (!o) return null;
  return (
    <p className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-1.5 text-sm">
      <Briefcase className="h-4 w-4 text-mastery" /><b>{o.hired}</b>&nbsp;of {o.certified} certified learners were hired for these skills on Talfirms
    </p>
  );
}
