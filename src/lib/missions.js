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

// Paid expert reviews (migration 0027). A request joins the waiting list
// (no charge) until paid reviews are switched on and an expert covers the
// mission's skills.
const reviewError = (error, fallback) => {
  const m = String(error?.message ?? "");
  const known = m.match(/^[a-z_]+: (.+)$/);
  return new Error(known ? known[1] : fallback);
};

export async function loadReviewOffer(missionId) {
  const { data, error } = await supabase.rpc("skillfirms_mission_review_offer", { p_mission_id: missionId });
  if (error) return null;
  return data;
}

export async function requestExpertReview(submissionId) {
  const { data, error } = await supabase.rpc("skillfirms_request_expert_review", { p_submission_id: submissionId });
  if (error) throw reviewError(error, "Couldn't request a review. Try again.");
  return data;
}

export async function loadExpertStatus() {
  const { data, error } = await supabase.rpc("skillfirms_my_expert_status");
  if (error) return null;
  return data;
}

export async function applyAsExpert({ headline, experience, years, skillIds, links }) {
  const { error } = await supabase.rpc("skillfirms_apply_as_expert", {
    p_headline: headline, p_experience: experience, p_years: years, p_skill_ids: skillIds, p_links: links || null,
  });
  if (error) {
    const m = String(error.message ?? "");
    if (m.includes("already_applied")) throw new Error("You've already applied. We'll let you know.");
    if (m.includes("already_an_expert")) throw new Error("You're already a Skillfirms expert.");
    if (m.includes("check constraint")) throw new Error("Please fill in every field (experience needs at least 50 characters).");
    throw new Error("Couldn't send your application. Try again.");
  }
}

export async function loadExpertQueue() {
  const { data, error } = await supabase.rpc("skillfirms_expert_queue");
  if (error) throw reviewError(error, "Couldn't load your review queue.");
  return data;
}

export async function claimReview(orderId) {
  const { error } = await supabase.rpc("skillfirms_claim_review", { p_order_id: orderId });
  if (error) throw reviewError(error, "Couldn't claim this review.");
}

export async function submitReview(orderId, { skillScores, overall, feedback, strengths, improvements, passed }) {
  const { data, error } = await supabase.rpc("skillfirms_submit_review", {
    p_order_id: orderId, p_skill_scores: skillScores, p_overall: overall, p_feedback: feedback,
    p_strengths: strengths, p_improvements: improvements, p_passed: passed,
  });
  if (error) throw reviewError(error, "Couldn't submit the review.");
  return data;
}
