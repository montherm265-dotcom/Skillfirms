import { supabase } from "@/lib/supabaseClient";

// Final exams from a tutor's question pool, the yearly course check and
// project settings (migration 0046). Everything is checked in the database.
export const errorText = (error, fallback = "Something didn't work. Try again.") => {
  const m = String(error?.message ?? "");
  const known = m.match(/^[a-z_]+: (.+)$/);
  return known ? known[1] : m === "already_passed" ? "You already passed this exam." : fallback;
};

async function call(fn, args, fallback) {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(errorText(error, fallback));
  return data;
}

// Tutor
export const loadStudioExam = (courseId) => call("skillfirms_studio_exam", { p_course: courseId }, "Couldn't load the exam.");
export const saveExamQuestion = (courseId, q) => call("skillfirms_studio_save_exam_question", {
  p_course: courseId, p_id: q.id ?? null, p_kind: q.kind, p_question: q.question,
  p_choices: q.kind === "mcq" ? q.choices : null, p_correct: q.kind === "mcq" ? q.correct_index : null,
  p_model_answer: q.model_answer ?? null, p_points: Number(q.points) || 1,
}, "Couldn't save the question.");
export const retireExamQuestion = (id) => call("skillfirms_studio_retire_exam_question", { p_id: id }, "Couldn't remove the question.");
export const setExamSettings = (courseId, s) => call("skillfirms_studio_set_exam", {
  p_course: courseId, p_size: s.size ?? null, p_minutes: s.minutes ?? null, p_pass_pct: s.pass_pct ?? 70,
  p_project_review: s.project_review ?? "tutor", p_project_monthly_spots: s.project_monthly_spots ?? null,
}, "Couldn't save the settings.");
export const confirmCourseReview = (courseId) => call("skillfirms_confirm_course_review", { p_course: courseId }, "Couldn't confirm the course.");
export const loadMarkingQueue = () => call("skillfirms_exam_marking_queue", {}, "Couldn't load exams to mark.");
export const markExam = (attemptId, marks, note) => call("skillfirms_mark_exam", { p_attempt: attemptId, p_marks: marks, p_note: note || null }, "Couldn't save the marks.");

// Learner
export const loadExamInfo = (courseId) => call("skillfirms_exam_info", { p_course: courseId }, "Couldn't load the exam.");
export const startExam = (courseId) => call("skillfirms_start_exam", { p_course: courseId }, "Couldn't start the exam.");
export const loadAttempt = (attemptId) => call("skillfirms_exam_attempt", { p_attempt: attemptId }, "Couldn't open the exam.");
export const saveAnswers = (attemptId, answers, signals) => supabase.rpc("skillfirms_save_exam_answers", { p_attempt: attemptId, p_answers: answers, p_signals: signals });
export const submitExam = (attemptId, answers, signals) => call("skillfirms_submit_exam", { p_attempt: attemptId, p_answers: answers, p_signals: signals }, "Couldn't send the exam.");

// Peer project reviews
export const loadPeerQueue = () => call("skillfirms_peer_project_queue", {}, "Couldn't load projects.");
export const peerReview = (id, pass, note) => call("skillfirms_peer_review_project", { p_id: id, p_pass: pass, p_note: note }, "Couldn't send the review.");

export const monthYear = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { month: "long", year: "numeric" }) : null);
export const shortDate = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : null);
