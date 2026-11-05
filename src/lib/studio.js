import { supabase } from "@/lib/supabaseClient";

// Expert course studio (migration 0030). Every write goes through checked
// database functions; nothing is public until an admin approves it.
const friendly = (error, fallback) => {
  const m = String(error?.message ?? "");
  const known = m.match(/^[a-z_]+: (.+)$/);
  return new Error(known ? known[1] : fallback);
};

export async function loadStudioCourses() {
  const { data, error } = await supabase.rpc("skillfirms_studio_courses");
  if (error) throw friendly(error, "Couldn't load your courses.");
  return data ?? [];
}

export async function loadStudioCourse(id) {
  const { data, error } = await supabase.rpc("skillfirms_studio_course", { p_course_id: id });
  if (error) throw friendly(error, "Couldn't open this course.");
  return data;
}

export async function saveStudioCourse(id, course) {
  const { data, error } = await supabase.rpc("skillfirms_studio_save", { p_course_id: id ?? null, p_course: course });
  if (error) throw friendly(error, "Couldn't save. Try again.");
  return data;
}

export async function submitStudioCourse(id) {
  const { error } = await supabase.rpc("skillfirms_studio_submit", { p_course_id: id });
  if (error) throw friendly(error, "Couldn't send it for review.");
}

export async function uploadCourseVideo(userId, file) {
  if (file.size > 50 * 1024 * 1024) throw new Error("Uploads can be up to 50 MB. For longer videos, put them on YouTube (unlisted), Vimeo or Loom and paste the link.");
  const ext = (file.name.split(".").pop() || "mp4").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("course-videos").upload(path, file, { contentType: file.type || "video/mp4", upsert: false });
  if (error) throw new Error("Upload failed. Try again, or paste a YouTube/Vimeo/Loom link instead.");
  return supabase.storage.from("course-videos").getPublicUrl(path).data.publicUrl;
}

export async function buyCourse(courseId) {
  const { data, error } = await supabase.rpc("skillfirms_buy_course", { p_course_id: courseId });
  if (error) throw friendly(error, "Couldn't start the purchase.");
  return data;
}

export async function loadMyPurchase(userId, courseId) {
  if (!userId) return null;
  const { data } = await supabase.from("skillfirms_course_purchases").select("status, payment_status").eq("user_id", userId).eq("course_id", courseId).maybeSingle();
  return data ?? null;
}

// A video link to something we can embed.
export function videoEmbed(url) {
  if (!url) return null;
  let u;
  try { u = new URL(url); } catch { return null; }
  const host = u.hostname.replace(/^www\./, "");
  if (host === "youtube.com" || host === "m.youtube.com") {
    const id = u.searchParams.get("v") || (u.pathname.startsWith("/shorts/") ? u.pathname.split("/")[2] : null);
    return id ? { kind: "iframe", src: `https://www.youtube-nocookie.com/embed/${id}` } : null;
  }
  if (host === "youtu.be") return { kind: "iframe", src: `https://www.youtube-nocookie.com/embed/${u.pathname.slice(1)}` };
  if (host === "vimeo.com") { const id = u.pathname.split("/").filter(Boolean)[0]; return /^\d+$/.test(id ?? "") ? { kind: "iframe", src: `https://player.vimeo.com/video/${id}` } : null; }
  if (host === "player.vimeo.com") return { kind: "iframe", src: url };
  if (host === "loom.com") { const id = u.pathname.split("/").filter(Boolean)[1]; return id ? { kind: "iframe", src: `https://www.loom.com/embed/${id}` } : null; }
  if (/\.(mp4|webm|mov)(\?|$)/i.test(u.pathname) || host.endsWith("supabase.co")) return { kind: "video", src: url };
  return null;
}
