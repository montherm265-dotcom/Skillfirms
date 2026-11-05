import { supabase } from "@/lib/supabaseClient";

// The lesson tutor (Edge Function skillfirms-tutor) uses Skillfirms plans:
// Free 10 questions a day within the free monthly AI allowance, Scholar 60,
// Mastery 150 (Talfirms Pro / Ultra include them). The
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
  // Skillfirms plans (0031) first; the shared Talfirms allowance before that's applied.
  const { data: sf } = await supabase.rpc("my_skillfirms_plan");
  if (sf) return { plan: sf.name ?? "Free", left: Math.max(0, (sf.tutor_per_day ?? 0) - (sf.tutor_today ?? 0)), perDay: sf.tutor_per_day ?? 0 };
  const { data, error } = await supabase.rpc("my_ai_allowance");
  if (error || !data) return null;
  return {
    plan: data.plan ?? "free",
    left: Math.max(0, (data.quick_per_day ?? 0) - (data.quick_today ?? 0)),
    perDay: data.quick_per_day ?? 0,
    freeCap: data.cost_cap_usd != null,
    capUsedPct: data.cost_cap_usd != null ? Math.min(100, Math.round((100 * Number(data.cost_this_month_usd ?? 0)) / Number(data.cost_cap_usd))) : null,
  };
}

export async function loadPlans() {
  const [{ data: limits }, { data: prices }] = await Promise.all([
    supabase.from("ai_plan_limits").select("plan, quick_per_day, light_models, monthly_cost_cap_usd").in("plan", ["free", "pro", "ultra"]),
    supabase.from("billing_plans").select("plan, monthly_price_usd_cents, yearly_price_usd_cents").eq("target", "profile"),
  ]);
  const byPlan = Object.fromEntries((limits ?? []).map((l) => [l.plan, l]));
  const priceOf = Object.fromEntries((prices ?? []).map((p) => [p.plan, p]));
  return ["free", "pro", "ultra"].map((plan) => ({ plan, ...byPlan[plan], ...priceOf[plan] }));
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
