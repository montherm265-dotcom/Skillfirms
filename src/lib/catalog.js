import { supabase } from "@/lib/supabaseClient";

import { CATALOG_SELECT, shapeCourse, teacherOf, totalMinutes } from "@/lib/catalog-core";
export { CATEGORIES, categoryOf, LEVELS, shapeCourse, teacherOf, priceLabel, EXERCISE_MINUTES, totalMinutes, formatHours } from "@/lib/catalog-core";

// Every published course with what a learner needs to choose it: lessons,
// minutes, skills, real learners and real ratings (never invented).
export async function loadCatalog() {
  // The Courses page asked for this already, before the app loaded (boot.js).
  const early = typeof window !== "undefined" ? window.__catalog : null;
  if (early?.promise && !early.used) {
    early.used = true;
    try { return (await early.promise).map(shapeCourse); } catch { /* ask again below */ }
  }
  const { data, error } = await supabase
    .from("skillfirms_courses")
    .select(CATALOG_SELECT)
    .eq("status", "published");
  if (error) throw error;
  return (data ?? []).map(shapeCourse);
}

export function searchCourses(courses, q) {
  const words = String(q ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return courses;
  return courses
    .map((c) => {
      const hay = [c.title, c.description, c.category?.label, c.level, ...c.skills.map((s) => s.name)].join(" ").toLowerCase();
      const title = c.title.toLowerCase();
      let score = 0;
      for (const w of words) {
        if (!hay.includes(w)) return null;
        score += title.includes(w) ? 3 : 1;
      }
      return { c, score };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.c);
}

// Optional features (migration 0026). If the table isn't there yet the
// feature quietly hides instead of breaking the page.
export function missingTable(error) {
  return Boolean(error) && ["42P01", "PGRST205", "PGRST202", "42883"].includes(error.code);
}

export async function loadSaved(userId) {
  if (!userId) return { ids: new Set(), available: false };
  const { data, error } = await supabase.from("skillfirms_saved_courses").select("course_id").eq("user_id", userId);
  if (error) return { ids: new Set(), available: !missingTable(error) };
  return { ids: new Set((data ?? []).map((r) => r.course_id)), available: true };
}

export async function setSaved(userId, courseId, on) {
  const q = supabase.from("skillfirms_saved_courses");
  const { error } = on
    ? await q.upsert({ user_id: userId, course_id: courseId }, { onConflict: "user_id,course_id", ignoreDuplicates: true })
    : await q.delete().eq("user_id", userId).eq("course_id", courseId);
  if (error) throw error;
}

export async function loadReviews(courseId) {
  const { data, error } = await supabase.rpc("skillfirms_course_reviews_for", { p_course_id: courseId });
  if (error) return null;
  return data;
}

export async function saveReview(courseId, rating, body) {
  const { error } = await supabase.rpc("skillfirms_review_course", { p_course_id: courseId, p_rating: rating, p_body: body || null });
  if (error) throw new Error(error.message?.startsWith("pass_a_lesson_first") ? "Pass at least one lesson's check before rating this course." : "Couldn't save your review. Try again.");
}

export async function loadNote(userId, moduleId) {
  const { data, error } = await supabase.from("skillfirms_lesson_notes").select("body, updated_at").eq("user_id", userId).eq("module_id", moduleId).maybeSingle();
  if (error) return missingTable(error) ? { unavailable: true } : { body: "" };
  return { body: data?.body ?? "", updated_at: data?.updated_at ?? null };
}

export async function saveNote(userId, moduleId, body) {
  const { error } = await supabase.from("skillfirms_lesson_notes")
    .upsert({ user_id: userId, module_id: moduleId, body, updated_at: new Date().toISOString() }, { onConflict: "user_id,module_id" });
  if (error) throw error;
}

// The open Talfirms jobs that ask for a course's skills (Talfirms 0229).
export async function loadCourseJobs(courseId) {
  const { data, error } = await supabase.rpc("skillfirms_course_bridge", { p_course_id: courseId });
  if (error) return null;
  return data;
}

// Signed-in learner's courses with progress.
export async function loadMyLearning(userId) {
  const { data, error } = await supabase
    .from("skillfirms_enrollments")
    .select("id, course_id, progress_percent, enrolled_at, completed_at, skillfirms_courses(id, slug, title, description, level, duration_hours, rating_avg, rating_count, enrollment_count, price_cents, taught_by, skillfirms_experts(display_name, headline, profile_id), skillfirms_course_modules(id, order_index, duration_minutes), skillfirms_course_skills(coverage, skillfirms_skills(slug, name)))")
    .eq("user_id", userId);
  if (error) throw error;
  const enrollIds = (data ?? []).map((e) => e.id);
  const { data: progress } = enrollIds.length
    ? await supabase.from("skillfirms_module_progress").select("enrollment_id, module_id, completed_at").in("enrollment_id", enrollIds)
    : { data: [] };
  return (data ?? []).filter((e) => e.skillfirms_courses).map((e) => {
    const course = shapeCourse(e.skillfirms_courses);
    const passed = new Set((progress ?? []).filter((p) => p.enrollment_id === e.id && p.completed_at).map((p) => p.module_id));
    const ordered = [...(e.skillfirms_courses.skillfirms_course_modules ?? [])].sort((a, b) => a.order_index - b.order_index);
    const firstOpen = ordered.findIndex((m) => !passed.has(m.id));
    return { ...e, course, done: passed.size, next: firstOpen === -1 ? 1 : firstOpen + 1, finished: ordered.length > 0 && firstOpen === -1 };
  });
}

// "Learn this, we're hiring" (Talfirms migration 0230): companies hiring
// through a course. Sponsored, and always labelled so.
export async function loadCourseHiring(courseId) {
  const { data, error } = await supabase.rpc("skillfirms_course_hiring", { p_course_id: courseId });
  if (error) return [];
  return data ?? [];
}

let hiringCache = null;
export function loadHiringCourses() {
  if (!hiringCache) {
    hiringCache = supabase.rpc("skillfirms_hiring_courses").then(({ data, error }) => (error ? {} : data ?? {}));
  }
  return hiringCache;
}

export async function sendCertificate(campaignId) {
  const { data, error } = await supabase.rpc("skillfirms_send_certificate", { p_campaign_id: campaignId });
  if (error) {
    const m = error.message ?? "";
    if (m.startsWith("pass_the_course_first")) throw new Error("Pass every lesson's check to earn the certificate first.");
    if (m.startsWith("not_hiring")) throw new Error("This company isn't hiring through this course any more.");
    throw new Error("Couldn't send it. Try again.");
  }
  return data;
}
