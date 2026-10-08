import { supabase } from "@/lib/supabaseClient";

export async function submitMission(missionId, userId, submissionText) {
  const { data, error } = await supabase
    .from("skillfirms_mission_submissions")
    .insert({ user_id: userId, mission_id: missionId, submission_text: submissionText })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Calls the shared ai Edge Function, cross-checks the response against
// the mission's REAL skill list (never trusts an invented slug), then
// persists the evaluation and the resulting proficiency -- always at the
// ai_estimated tier, same as the career diagnosis, never higher. A
// verified result only ever comes from a real expert review.
export async function runAiEvaluation(submission, mission) {
  const { data: missionSkills, error: skillsError } = await supabase
    .from("skillfirms_mission_skills")
    .select("coverage, skillfirms_skills(id, slug, name)")
    .eq("mission_id", mission.id);
  if (skillsError) throw skillsError;

  const { data, error } = await supabase.functions.invoke("ai", {
    body: {
      feature: "skillfirms_mission_evaluation",
      input: {
        missionTitle: mission.title,
        missionBrief: mission.brief,
        deliverableInstructions: mission.deliverable_instructions,
        skills: missionSkills.map((ms) => ({ slug: ms.skillfirms_skills.slug, name: ms.skillfirms_skills.name })),
        submissionText: submission.submission_text,
      },
    },
  });
  if (error) {
    const context = await error.context?.json?.().catch(() => null);
    throw new Error(context?.message ?? context?.error ?? error.message ?? "Evaluation failed");
  }

  const result = data.result;
  const skillBySlug = new Map(missionSkills.map((ms) => [ms.skillfirms_skills.slug, ms.skillfirms_skills]));
  const validScores = result.skillScores.filter((s) => skillBySlug.has(s.skillSlug));

  const { error: evalError } = await supabase.from("skillfirms_mission_evaluations").insert({
    submission_id: submission.id,
    evaluator_type: "ai",
    overall_score: result.overallScore,
    feedback: result.summary,
    strengths: result.strengths,
    improvements: result.improvements,
    model: data.usage?.model ?? "unknown",
    prompt_version: "1.0.0",
  });
  if (evalError) throw evalError;

  if (validScores.length > 0) {
    const { error: estimateError } = await supabase.rpc("skillfirms_record_skill_estimates", {
      p_source: "ai_estimated",
      p_estimates: validScores.map((s) => ({ skill_id: skillBySlug.get(s.skillSlug).id, proficiency: s.score })),
    });
    if (estimateError) throw estimateError;
  }

  await supabase.from("skillfirms_mission_submissions").update({ status: "ai_evaluated" }).eq("id", submission.id);

  return { overallScore: result.overallScore, summary: result.summary, strengths: result.strengths, improvements: result.improvements, skillScores: validScores };
}

export async function requestExpertReview(submissionId) {
  const { error } = await supabase.from("skillfirms_mission_submissions").update({ status: "expert_requested" }).eq("id", submissionId);
  if (error) throw error;
}
