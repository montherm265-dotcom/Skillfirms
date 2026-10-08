import { supabase } from "@/lib/supabaseClient";

export async function enroll(courseId, userId) {
  const { data, error } = await supabase
    .from("skillfirms_enrollments")
    .upsert({ user_id: userId, course_id: courseId }, { onConflict: "user_id,course_id", ignoreDuplicates: true })
    .select()
    .maybeSingle();
  if (error) throw error;
  if (data) return data;
  const { data: existing, error: existingError } = await supabase
    .from("skillfirms_enrollments")
    .select("*")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .single();
  if (existingError) throw existingError;
  return existing;
}

// Non-quiz modules (and quiz modules with no real question content yet)
// get a plain completion mark -- this never writes proficiency, it's
// just progress tracking. Only a graded skillfirms_submit_quiz call is
// allowed to move a proficiency_source to 'assessment_based'.
export async function markModuleComplete(enrollmentId, moduleId) {
  const { error } = await supabase
    .from("skillfirms_module_progress")
    .upsert({ enrollment_id: enrollmentId, module_id: moduleId, completed_at: new Date().toISOString() }, { onConflict: "enrollment_id,module_id" });
  if (error) throw error;
}

export async function submitQuiz(moduleId, answers) {
  const { data, error } = await supabase.rpc("skillfirms_submit_quiz", { p_module_id: moduleId, p_answers: answers });
  if (error) {
    const context = await error.context?.json?.().catch(() => null);
    throw new Error(context?.message ?? error.message ?? "Couldn't submit the quiz");
  }
  return data;
}

export async function refreshEnrollmentProgress(enrollmentId, totalModules, completedModules) {
  const progressPercent = totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0;
  const patch = { progress_percent: progressPercent };
  if (progressPercent >= 100) {
    patch.status = "completed";
    patch.completed_at = new Date().toISOString();
  }
  const { error } = await supabase.from("skillfirms_enrollments").update(patch).eq("id", enrollmentId);
  if (error) throw error;
}
