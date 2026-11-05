import { supabase } from "@/lib/supabaseClient";

// Skillfirms money (migration 0032). Learning is free. The AI tutor has free
// questions each day, then question packs you buy once and keep (saved for
// any course). Experts set their own prices and keep 70% of marketplace
// sales, 97% through their own link, and share 50% of team-training money.
export const EXPERT_SHARE = { marketplace: 70, expert_link: 97, team_pool: 50 };
export const UDEMY_SHARE = { marketplace: 37, expert_link: 97, team_pool: 15 };

export const dollars = (cents) => (cents == null ? "–" : `$${(cents / 100).toFixed(2).replace(/\.00$/, "")}`);

export async function loadPacks() {
  const { data, error } = await supabase.from("skillfirms_credit_packs").select("*").order("sort");
  if (error) return null;
  return data ?? [];
}

export async function loadWallet() {
  const { data, error } = await supabase.rpc("my_tutor_wallet");
  if (error || !data) return null;
  return data;
}

export async function buyPack(pack) {
  const { data, error } = await supabase.rpc("skillfirms_buy_credits", { p_pack: pack });
  if (error) throw new Error("Couldn't save that. Try again.");
  return data;
}

// Timed checks: start the clock (the questions only load after this).
export async function startCheck(moduleId) {
  const { data, error } = await supabase.rpc("skillfirms_start_check", { p_module_id: moduleId });
  if (error) {
    const m = error.message ?? "";
    if (m.startsWith("too_many_tries")) throw new Error("You've used today's 5 tries for this check. Try again tomorrow.");
    if (m.startsWith("enroll_first")) throw new Error("Start the course first.");
    throw new Error("Couldn't start the check. Try again.");
  }
  return data;
}

// Expert studio
export async function setCheckMinutes(courseId, minutes) {
  const { error } = await supabase.rpc("skillfirms_studio_set_check_minutes", { p_course_id: courseId, p_minutes: minutes || null });
  if (error) throw new Error(error.message?.startsWith("bad_minutes") ? "Pick 1 to 120 minutes." : "Couldn't save the time limit.");
}

export async function setCoursePrice(courseId, cents) {
  const { error } = await supabase.rpc("skillfirms_studio_set_price", { p_course_id: courseId, p_price_cents: cents });
  if (error) throw new Error(error.message?.startsWith("bad_price") ? "Pick free, or a price from $9 to $199." : "Couldn't save the price.");
}

export async function loadMyRefCode() {
  const { data, error } = await supabase.rpc("skillfirms_my_ref_code");
  return error ? null : data;
}

export async function loadTeamMinutes() {
  const { data, error } = await supabase.rpc("skillfirms_studio_team_minutes");
  return error ? {} : data ?? {};
}

// "$49" or "49.99" typed by an expert -> cents; null if it isn't a valid price.
export function parsePrice(text) {
  const t = String(text ?? "").trim().replace(/^\$/, "");
  if (t === "" || t === "0" || /^free$/i.test(t)) return 0;
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(t)) return null;
  const cents = Math.round(Number(t) * 100);
  return cents >= 900 && cents <= 19900 ? cents : null;
}

// A learner who arrives with an expert's link (?ref=CODE) keeps it for that course.
export function rememberRef(slug, ref) {
  if (!slug || !ref || !/^[0-9a-f]{8}$/i.test(ref)) return;
  try { localStorage.setItem(`sf_ref_${slug}`, ref); } catch { /* storage off */ }
}
export function readRef(slug) {
  try { return localStorage.getItem(`sf_ref_${slug}`); } catch { return null; }
}
