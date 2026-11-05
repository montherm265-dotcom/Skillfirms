import { supabase } from "@/lib/supabaseClient";

// The lesson tutor (Edge Function skillfirms-tutor): free questions each day
// (Free 10 within the free monthly AI allowance; Talfirms Pro 50, Ultra 120),
// then saved questions from packs you bought, kept for any course. The
// lesson itself is loaded on the server; we only send which lesson, the
// question and recent turns.
export async function askTutor({ moduleId, question, history, mode = "ask", job }) {
  const { data, error } = await supabase.functions.invoke("skillfirms-tutor", {
    body: { moduleId, question, mode, job, history: history.slice(-6).map((m) => ({ role: m.role, text: m.text })) },
  });
  if (error) {
    const status = error.context?.status;
    const body = await error.context?.json?.().catch(() => null);
    const message = String(body?.error ?? "");
    if (status === 429 || message.startsWith("ai_limit")) {
      const err = new Error(message.replace(/^ai_limit_\w+:\s*/, "") || "You've used today's tutor questions.");
      err.code = "limit";
      throw err;
    }
    if (status === 501) throw Object.assign(new Error("The tutor isn't switched on yet."), { code: "off" });
    if (status === 409) throw new Error("This lesson is still being written. Try again in a minute.");
    throw new Error("The tutor couldn't answer just now. Try again.");
  }
  return data.result;
}

export async function loadAllowance() {
  const [{ data, error }, { data: wallet }] = await Promise.all([supabase.rpc("my_ai_allowance"), supabase.rpc("my_tutor_wallet")]);
  if (error || !data) return null;
  return {
    left: Math.max(0, (data.quick_per_day ?? 0) - (data.quick_today ?? 0)),
    perDay: data.quick_per_day ?? 0,
    saved: Number(wallet?.balance ?? 0),
  };
}


const KEY = (moduleId) => `sf_tutor_${moduleId}`;
export function loadChat(moduleId) {
  try { return JSON.parse(localStorage.getItem(KEY(moduleId)) ?? "[]"); } catch { return []; }
}
export function saveChat(moduleId, messages) {
  try { localStorage.setItem(KEY(moduleId), JSON.stringify(messages.slice(-20))); } catch { /* storage off */ }
}
export function loadJob() {
  try { return localStorage.getItem("sf_tutor_job") ?? ""; } catch { return ""; }
}
export function saveJob(job) {
  try { localStorage.setItem("sf_tutor_job", job); } catch { /* storage off */ }
}
