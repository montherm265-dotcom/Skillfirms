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

export async function submitQuiz(moduleId, answers) {
  const { data, error } = await supabase.rpc("skillfirms_submit_quiz", { p_module_id: moduleId, p_answers: answers });
  if (error) {
    const context = await error.context?.json?.().catch(() => null);
    throw new Error(context?.message ?? error.message ?? "Couldn't submit the quiz");
  }
  return data;
}

// Course progress is computed by the database (migration 0024).
