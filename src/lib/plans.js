import { supabase } from "@/lib/supabaseClient";

// Skillfirms plans (migration 0031). Every number comes from the same table
// the server enforces: tutor questions, check tries, expert-course discount.
export const INCLUDED_WITH = { scholar: "Talfirms Pro", mastery: "Talfirms Ultra" };

export async function loadSkillfirmsPlans() {
  const { data, error } = await supabase.from("skillfirms_plans").select("*").order("sort");
  if (error) return null;
  return data ?? [];
}

export async function loadMyPlan() {
  const { data, error } = await supabase.rpc("my_skillfirms_plan");
  if (error || !data) return null;
  return data;
}

export async function joinPlan(plan, billing) {
  const { data, error } = await supabase.rpc("skillfirms_join_plan", { p_plan: plan, p_billing: billing });
  if (error) throw new Error("Couldn't save that. Try again.");
  return data;
}

export const dollars = (cents) => (cents == null ? "–" : `$${(cents / 100).toFixed(2).replace(/\.00$/, "")}`);

// Timed checks: start the clock (the questions only load after this).
export async function startCheck(moduleId) {
  const { data, error } = await supabase.rpc("skillfirms_start_check", { p_module_id: moduleId });
  if (error) {
    const m = error.message ?? "";
    if (m.startsWith("too_many_tries")) throw new Error("You've used today's tries for this check. Try again tomorrow.");
    if (m.startsWith("enroll_first")) throw new Error("Start the course first.");
    throw new Error("Couldn't start the check. Try again.");
  }
  return data;
}

export async function setCheckMinutes(courseId, minutes) {
  const { error } = await supabase.rpc("skillfirms_studio_set_check_minutes", { p_course_id: courseId, p_minutes: minutes || null });
  if (error) throw new Error(error.message?.startsWith("bad_minutes") ? "Pick 1 to 120 minutes." : "Couldn't save the time limit.");
}
