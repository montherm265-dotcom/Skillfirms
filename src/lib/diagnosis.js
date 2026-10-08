import { supabase } from "@/lib/supabaseClient";

const PENDING_GOAL_KEY = "skillfirms_pending_goal";

export function stashPendingGoal(goalText) {
  sessionStorage.setItem(PENDING_GOAL_KEY, goalText);
}
export function takePendingGoal() {
  const goal = sessionStorage.getItem(PENDING_GOAL_KEY);
  sessionStorage.removeItem(PENDING_GOAL_KEY);
  return goal;
}

// Fetches the real skill/role catalog (never invented), sends it to the
// AI along with the person's free-text goal, cross-checks the response
// against that same catalog before trusting anything, then persists:
// a career goal row, a diagnosis log row (so "why am I X%" stays
// answerable later), and upserted user_skill_state rows explicitly
// tagged 'ai_estimated' -- never blurred into an assessment or a
// verified result.
export async function runDiagnosis(goalText, userId) {
  const [{ data: roles, error: rolesError }, { data: roleSkills, error: roleSkillsError }] = await Promise.all([
    supabase.from("skillfirms_career_roles").select("id, slug, title, description"),
    supabase.from("skillfirms_role_skills").select("role_id, importance, weight, skillfirms_career_roles(slug), skillfirms_skills(id, slug, name)"),
  ]);
  if (rolesError) throw rolesError;
  if (roleSkillsError) throw roleSkillsError;

  const roleSkillRows = roleSkills.map((rs) => ({
    roleSlug: rs.skillfirms_career_roles.slug,
    skillSlug: rs.skillfirms_skills.slug,
    skillName: rs.skillfirms_skills.name,
    importance: rs.importance,
    weight: rs.weight,
  }));

  const { data, error } = await supabase.functions.invoke("ai", {
    body: {
      feature: "skillfirms_career_diagnosis",
      input: {
        goalText,
        roles: roles.map((r) => ({ slug: r.slug, title: r.title, description: r.description })),
        roleSkills: roleSkillRows,
      },
    },
  });
  if (error) {
    const context = await error.context?.json?.().catch(() => null);
    const message = context?.message ?? context?.error ?? error.message ?? "Diagnosis failed";
    throw new Error(message);
  }

  const diagnosis = data.result;
  const matchedRole = roles.find((r) => r.slug === diagnosis.matchedRoleSlug);
  if (!matchedRole) throw new Error("The AI matched a role that isn't in our catalog -- please try rephrasing your goal.");

  const validSkillSlugs = new Set(roleSkillRows.filter((rs) => rs.roleSlug === matchedRole.slug).map((rs) => rs.skillSlug));
  const skillBySlug = new Map(roleSkills.map((rs) => [rs.skillfirms_skills.slug, rs.skillfirms_skills]));
  const estimates = diagnosis.skillEstimates.filter((e) => validSkillSlugs.has(e.skillSlug));

  if (!userId) {
    // Anonymous preview: show the real result, persist nothing.
    return { matchedRole, confidence: diagnosis.confidence, currentPositionSummary: diagnosis.currentPositionSummary, estimates, persisted: false };
  }

  const { data: goalRow, error: goalError } = await supabase
    .from("skillfirms_user_career_goals")
    .insert({ user_id: userId, raw_goal_text: goalText, target_role_id: matchedRole.id })
    .select()
    .single();
  if (goalError) throw goalError;

  if (estimates.length > 0) {
    // Goes through the guarded RPC, not a direct table write: a lower-trust
    // AI re-estimate must never be able to clobber a skill the person has
    // since passed a real assessment or had expert-reviewed.
    const { error: estimateError } = await supabase.rpc("skillfirms_record_skill_estimates", {
      p_source: "ai_estimated",
      p_estimates: estimates.map((e) => ({ skill_id: skillBySlug.get(e.skillSlug).id, proficiency: e.proficiency })),
    });
    if (estimateError) throw estimateError;
  }

  await supabase.from("skillfirms_career_diagnoses").insert({
    user_id: userId,
    goal_id: goalRow.id,
    target_role_id: matchedRole.id,
    model: data.usage?.model ?? "unknown",
    prompt_version: "1.0.0",
    gaps: estimates,
  });

  return { matchedRole, confidence: diagnosis.confidence, currentPositionSummary: diagnosis.currentPositionSummary, estimates, persisted: true, goalId: goalRow.id };
}

// Readiness for a role: weighted average of (proficiency / expectation),
// capped at 1 per skill so over-performing one skill can't mask being at
// zero on everything else. Always explainable -- see getReadinessBreakdown.
export function computeReadiness(roleSkillRows, skillStateBySlug) {
  if (roleSkillRows.length === 0) return null;
  let weightedSum = 0;
  let weightTotal = 0;
  const items = roleSkillRows.map((rs) => {
    const state = skillStateBySlug.get(rs.skillSlug);
    const proficiency = state?.proficiency ?? 0;
    const ratio = Math.min(proficiency / 1, 1);
    weightedSum += ratio * rs.weight;
    weightTotal += rs.weight;
    return { ...rs, proficiency, source: state?.proficiency_source ?? null };
  });
  const percent = weightTotal > 0 ? Math.round((weightedSum / weightTotal) * 100) : 0;
  return { percent, items: items.sort((a, b) => b.weight - a.weight) };
}
