import { supabase } from "@/lib/supabaseClient";

// A lesson (migration 0024): kept once written; written by the
// skillfirms-lesson Edge Function the first time a signed-in person opens it.
export async function loadLesson(moduleId) {
  const { data } = await supabase.from("skillfirms_lessons").select("body, source, generated_at, reviewed_at").eq("module_id", moduleId).maybeSingle();
  return data?.body ? data : null;
}

export async function writeLesson(moduleId) {
  const { data, error } = await supabase.functions.invoke("skillfirms-lesson", { body: { module_id: moduleId } });
  if (error) {
    const context = await error.context?.json?.().catch(() => null);
    const code = context?.error ?? "could_not_write_lesson";
    throw new Error(code);
  }
  return data;
}

// Open a lesson: read it if it's written, otherwise write it (polling while
// someone else is already writing it).
export async function openLesson(moduleId, { signedIn }) {
  const existing = await loadLesson(moduleId);
  if (existing) return existing;
  if (!signedIn) return null;
  for (let i = 0; i < 30; i++) {
    const res = await writeLesson(moduleId);
    if (res?.status === "ready") return res.lesson;
    await new Promise((r) => setTimeout(r, 4000));
    const now = await loadLesson(moduleId);
    if (now) return now;
  }
  throw new Error("could_not_write_lesson");
}

// Lesson text: blank lines separate paragraphs; "- " lines are bullets.
export function toBlocks(text) {
  const blocks = [];
  for (const chunk of String(text ?? "").split(/\n\s*\n/)) {
    const lines = chunk.split("\n").map((l) => l.trimEnd()).filter((l) => l.trim());
    if (!lines.length) continue;
    if (lines.every((l) => /^\s*[-•*]\s+/.test(l))) {
      blocks.push({ type: "list", items: lines.map((l) => l.replace(/^\s*[-•*]\s+/, "")) });
    } else if (lines.some((l) => /^\s*[-•*]\s+/.test(l))) {
      const lead = lines.filter((l) => !/^\s*[-•*]\s+/.test(l));
      if (lead.length) blocks.push({ type: "p", text: lead.join(" ") });
      blocks.push({ type: "list", items: lines.filter((l) => /^\s*[-•*]\s+/.test(l)).map((l) => l.replace(/^\s*[-•*]\s+/, "")) });
    } else {
      blocks.push({ type: "p", text: lines.join(" ") });
    }
  }
  return blocks;
}

export function readingMinutes(body) {
  if (!body) return null;
  const text = [body.summary, ...(body.sections ?? []).map((s) => `${s.heading} ${s.body}`), body.example?.body, ...(body.key_points ?? []), body.try_it].join(" ");
  return Math.max(3, Math.round(text.split(/\s+/).length / 220));
}
