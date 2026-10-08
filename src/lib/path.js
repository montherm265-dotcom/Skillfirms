import { supabase } from "@/lib/supabaseClient";

const MASTERED_THRESHOLD = 0.75;
const MAX_PATH_LENGTH = 10;

// The "intelligent marketplace" (section 9): never a browse-all list.
// For each real skill gap (weight * how far the user actually is from
// mastering it), greedily pick the single best published course that
// covers it, then skip any other gap that same course already covers so
// the path doesn't pad itself with redundant entries. gap_weight is
// persisted per item so the UI can always explain "why is this here."
export async function assemblePath({ userId, goalId, targetRoleId }) {
  const [{ data: roleSkills, error: roleSkillsError }, { data: skillState, error: skillStateError }, { data: courseSkills, error: courseSkillsError }] =
    await Promise.all([
      supabase.from("skillfirms_role_skills").select("weight, importance, skillfirms_skills(id, slug, name)").eq("role_id", targetRoleId),
      supabase.from("skillfirms_user_skill_state").select("skill_id, proficiency").eq("user_id", userId),
      supabase
        .from("skillfirms_course_skills")
        .select("skill_id, coverage, skillfirms_courses(id, slug, title, level, duration_hours, rating_avg, enrollment_count, status, skillfirms_experts(display_name, headline))")
        .eq("skillfirms_courses.status", "published"),
    ]);
  if (roleSkillsError) throw roleSkillsError;
  if (skillStateError) throw skillStateError;
  if (courseSkillsError) throw courseSkillsError;

  const proficiencyBySkillId = new Map((skillState ?? []).map((s) => [s.skill_id, s.proficiency]));

  const gaps = (roleSkills ?? [])
    .map((rs) => {
      const skill = rs.skillfirms_skills;
      const proficiency = proficiencyBySkillId.get(skill.id) ?? 0;
      return { skillId: skill.id, skillSlug: skill.slug, skillName: skill.name, weight: rs.weight, proficiency, deficiency: rs.weight * (1 - proficiency) };
    })
    .filter((g) => g.proficiency < MASTERED_THRESHOLD)
    .sort((a, b) => b.deficiency - a.deficiency);

  // Candidate courses per skill, dropping rows whose course failed the
  // join filter (status != 'published') or has no joined course at all.
  const candidatesBySkillId = new Map();
  for (const cs of courseSkills ?? []) {
    if (!cs.skillfirms_courses) continue;
    const list = candidatesBySkillId.get(cs.skill_id) ?? [];
    list.push({ coverage: cs.coverage, course: cs.skillfirms_courses });
    candidatesBySkillId.set(cs.skill_id, list);
  }

  const covered = new Set();
  const items = [];
  for (const gap of gaps) {
    if (covered.has(gap.skillId) || items.length >= MAX_PATH_LENGTH) continue;
    const candidates = (candidatesBySkillId.get(gap.skillId) ?? []).filter((c) => !items.some((i) => i.course.id === c.course.id));
    if (candidates.length === 0) continue;
    candidates.sort((a, b) => (b.coverage - a.coverage) || ((b.course.rating_avg ?? 0) - (a.course.rating_avg ?? 0)) || (b.course.enrollment_count - a.course.enrollment_count));
    const best = candidates[0];
    items.push({ course: best.course, primarySkillId: gap.skillId, primarySkillSlug: gap.skillSlug, primarySkillName: gap.skillName, gapWeight: gap.deficiency });
    covered.add(gap.skillId);
    for (const cs of courseSkills) {
      if (cs.skillfirms_courses?.id === best.course.id) covered.add(cs.skill_id);
    }
  }

  if (items.length === 0) {
    return { items: [], persisted: false };
  }

  await supabase.from("skillfirms_user_learning_paths").delete().eq("user_id", userId).eq("goal_id", goalId);
  const { data: pathRow, error: pathError } = await supabase
    .from("skillfirms_user_learning_paths")
    .insert({ user_id: userId, goal_id: goalId, target_role_id: targetRoleId })
    .select()
    .single();
  if (pathError) throw pathError;

  const { error: itemsError } = await supabase.from("skillfirms_path_items").insert(
    items.map((item, index) => ({
      path_id: pathRow.id,
      course_id: item.course.id,
      order_index: index,
      primary_skill_id: item.primarySkillId,
      gap_weight: item.gapWeight,
    })),
  );
  if (itemsError) throw itemsError;

  return { pathId: pathRow.id, items, persisted: true };
}

export async function getPathForGoal(goalId) {
  const { data: pathRow } = await supabase.from("skillfirms_user_learning_paths").select("*, skillfirms_career_roles(slug, title)").eq("goal_id", goalId).maybeSingle();
  if (!pathRow) return null;

  const { data: items, error } = await supabase
    .from("skillfirms_path_items")
    .select("order_index, gap_weight, skillfirms_skills(slug, name), skillfirms_courses(id, slug, title, description, level, duration_hours, rating_avg, enrollment_count, skillfirms_experts(display_name, headline))")
    .eq("path_id", pathRow.id)
    .order("order_index");
  if (error) throw error;

  return { pathId: pathRow.id, role: pathRow.skillfirms_career_roles, items: items ?? [] };
}
