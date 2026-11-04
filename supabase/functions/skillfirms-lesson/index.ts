// Writes a Skillfirms lesson the first time anyone opens it, then keeps it
// for everyone (migrations 0024/0025).
//
//   POST { module_id }  (signed in)
//   -> { status: "ready", lesson } | { status: "generating" } | { error }
//
// The lesson is drafted by AI from the course outline (course, lesson
// title/description, the other lessons, the skills the course teaches) and
// stored with source = 'ai_drafted' until an expert reviews it; the app
// says so on every lesson. A lesson with no knowledge check also gets 3
// multiple-choice questions, graded by skillfirms_submit_quiz (the right
// answers are never readable by the browser).
//
// Cost: one model call per lesson, ever (~2–3k output tokens), not per
// learner. Each person can cause at most 100 new lessons a day; every lesson is written only once, so total cost is bounded by the catalogue.

import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const OPENAI_BASE_URL = Deno.env.get("OPENAI_BASE_URL") ?? "https://api.openai.com/v1";
const MODEL = Deno.env.get("OPENAI_MODEL_DEFAULT") ?? "gpt-6.1-terra";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const SYSTEM = `You write lessons for Skillfirms, a site where working professionals learn job skills and prove them.
Write one lesson in plain, clear English for someone doing this job for real. Be practical: what to do, why, how it goes wrong, what good looks like.
Accuracy rules:
- Only state well-established practice. Never invent statistics, studies, quotes, dates or regulation clause numbers.
- Name a standard, regulation or guideline (e.g. "EU GMP Annex 15", "ISPE Baseline Guide", "ISO 9001") only if you are certain it exists and is relevant; otherwise describe the idea without naming a source.
- Where practice varies between companies or countries, say so.
Return ONLY a JSON object with exactly these keys:
{
  "summary": "1–2 sentences: what this lesson teaches and why it matters on the job",
  "sections": [ { "heading": "...", "body": "..." } ],   // 3 to 5 sections, 700–1100 words in total
  "example": { "title": "...", "body": "..." },          // one worked, realistic example from the job
  "key_points": [ "..." ],                               // 3 to 5 short takeaways
  "try_it": "...",                                        // one short exercise the reader can do in 10–15 minutes
  "quiz": [ { "question": "...", "choices": ["...", "...", "...", "..."], "answer_index": 0 } ]  // exactly 3 questions, 4 choices each, one clearly correct answer that tests understanding, not trivia
}
In "body" texts: separate paragraphs with a blank line; a line starting with "- " is a bullet. No markdown headings, no HTML.`;

type Lesson = {
  summary: string;
  sections: { heading: string; body: string }[];
  example: { title: string; body: string };
  key_points: string[];
  try_it: string;
  quiz: { question: string; choices: string[]; answer_index: number }[];
};

function valid(x: any): x is Lesson {
  const str = (v: unknown, max = 8000) => typeof v === "string" && v.trim().length > 0 && v.length <= max;
  return x && str(x.summary, 600)
    && Array.isArray(x.sections) && x.sections.length >= 2 && x.sections.length <= 7 && x.sections.every((s: any) => str(s?.heading, 160) && str(s?.body))
    && x.example && str(x.example.title, 200) && str(x.example.body)
    && Array.isArray(x.key_points) && x.key_points.length >= 2 && x.key_points.length <= 7 && x.key_points.every((k: any) => str(k, 400))
    && str(x.try_it, 1500)
    && Array.isArray(x.quiz) && x.quiz.length === 3
    && x.quiz.every((q: any) => str(q?.question, 400) && Array.isArray(q.choices) && q.choices.length === 4 && q.choices.every((c: any) => str(c, 300))
      && Number.isInteger(q.answer_index) && q.answer_index >= 0 && q.answer_index < 4);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: userData } = await admin.auth.getUser(jwt);
  const user = userData?.user;
  if (!user) return json({ error: "sign_in_to_open_lessons" }, 401);

  let moduleId: string;
  try { moduleId = (await req.json()).module_id; } catch { return json({ error: "bad_request" }, 400); }
  if (!moduleId || !/^[0-9a-f-]{36}$/i.test(moduleId)) return json({ error: "bad_request" }, 400);

  const { data: mod } = await admin.from("skillfirms_course_modules")
    .select("id, title, description, order_index, duration_minutes, course_id, skillfirms_courses(title, description, level, status)")
    .eq("id", moduleId).maybeSingle();
  if (!mod || (mod as any).skillfirms_courses?.status !== "published") return json({ error: "not_found" }, 404);

  const { data: claim, error: claimError } = await admin.rpc("skillfirms_claim_lesson", { p_module_id: moduleId, p_user: user.id });
  if (claimError) return json({ error: "could_not_start" }, 500);
  if (claim === "ready") {
    const { data: ready } = await admin.from("skillfirms_lessons").select("body, source, generated_at, reviewed_at").eq("module_id", moduleId).single();
    return json({ status: "ready", lesson: ready });
  }
  if (claim === "busy") return json({ status: "generating" });
  if (claim === "limit") return json({ error: "daily_limit" }, 429);
  if (!OPENAI_API_KEY) {
    await admin.from("skillfirms_lessons").update({ status: "failed", error: "not_configured" }).eq("module_id", moduleId);
    return json({ error: "not_configured" }, 503);
  }

  const course = (mod as any).skillfirms_courses;
  const [{ data: siblings }, { data: skills }, { count: existingQuestions }] = await Promise.all([
    admin.from("skillfirms_course_modules").select("order_index, title").eq("course_id", mod.course_id).order("order_index"),
    admin.from("skillfirms_course_skills").select("skillfirms_skills(name)").eq("course_id", mod.course_id),
    admin.from("skillfirms_module_quiz_questions").select("id", { count: "exact", head: true }).eq("module_id", moduleId),
  ]);
  const outline = (siblings ?? []).map((s: any) => `${s.order_index + 1}. ${s.title}${s.order_index === mod.order_index ? "  <- THIS LESSON" : ""}`).join("\n");
  const userPrompt = [
    `Course: ${course.title} (${course.level ?? "all levels"})`,
    course.description ? `About the course: ${course.description}` : "",
    `Skills the course builds: ${(skills ?? []).map((s: any) => s.skillfirms_skills?.name).filter(Boolean).join(", ") || "n/a"}`,
    `Course outline:\n${outline}`,
    `Write lesson ${mod.order_index + 1}: "${mod.title}"${mod.description ? ` — ${mod.description}` : ""}.`,
    `It should take about ${mod.duration_minutes ?? 20} minutes. Cover this lesson only; don't repeat what other lessons in the outline cover.`,
  ].filter(Boolean).join("\n\n");

  let lesson: Lesson | null = null;
  let lastError = "";
  for (let attempt = 0; attempt < 2 && !lesson; attempt++) {
    try {
      const res = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${OPENAI_API_KEY}` },
        body: JSON.stringify({
          model: MODEL,
          max_completion_tokens: 6000,
          response_format: { type: "json_object" },
          messages: [{ role: "system", content: SYSTEM }, { role: "user", content: userPrompt }],
        }),
      });
      if (!res.ok) { lastError = `provider_${res.status}`; continue; }
      const body = await res.json();
      const parsed = JSON.parse(body.choices?.[0]?.message?.content ?? "{}");
      if (valid(parsed)) lesson = parsed; else lastError = "invalid_shape";
    } catch (e) {
      lastError = String((e as Error).message ?? e).slice(0, 200);
    }
  }
  if (!lesson) {
    await admin.from("skillfirms_lessons").update({ status: "failed", error: lastError }).eq("module_id", moduleId);
    return json({ error: "could_not_write_lesson" }, 502);
  }

  const { quiz, ...stored } = lesson;
  if (!existingQuestions) {
    await admin.from("skillfirms_module_quiz_questions").insert(
      quiz.map((q, i) => ({ module_id: moduleId, order_index: i, question: q.question.trim(), choices: q.choices.map((c) => c.trim()), correct_index: q.answer_index })),
    );
    await admin.from("skillfirms_course_modules").update({ has_quiz: true }).eq("id", moduleId);
  }
  await admin.from("skillfirms_lessons").update({ status: "ready", body: stored, model: MODEL, source: "ai_drafted", generated_at: new Date().toISOString(), error: null }).eq("module_id", moduleId);
  return json({ status: "ready", lesson: { body: stored, source: "ai_drafted", generated_at: new Date().toISOString(), reviewed_at: null } });
});
