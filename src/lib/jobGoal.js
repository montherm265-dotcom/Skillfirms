import { TALFIRMS_URL } from "@/lib/externalLinks";

// The Talfirms job you're learning for. Talfirms' Skill Bridge sends you
// here with ?from=talfirms&jobId=…&job=…; we remember it on this device so
// every page can point you back to that job once you've learned the skills.

const KEY = "sf_job_goal";
const MAX_AGE_MS = 60 * 24 * 60 * 60 * 1000; // 60 days
const ID_RE = /^[0-9a-f-]{8,64}$/i;

const clampPct = (v) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n > 0 && n <= 100 ? n : null;
};

// Read the goal from Skill Bridge URL params, or null if it isn't one.
export function jobGoalFromParams(params) {
  if (params.get("from") !== "talfirms") return null;
  const id = params.get("jobId") ?? "";
  const title = (params.get("job") ?? "").trim().slice(0, 120);
  if (!ID_RE.test(id) || !title) return null;
  const skills = (params.get("skills") ?? params.get("skill") ?? "")
    .split("|").map((s) => s.trim().slice(0, 60)).filter(Boolean).slice(0, 5);
  return { id, title, now: clampPct(params.get("now")), target: clampPct(params.get("target")), skills };
}

export function rememberJobGoal(goal) {
  if (!goal) return;
  try {
    const prev = readJobGoal();
    // Same job again (e.g. from a single-course link): keep the skills we already know.
    const skills = goal.skills?.length ? goal.skills : prev?.id === goal.id ? prev.skills : [];
    localStorage.setItem(KEY, JSON.stringify({ ...goal, skills, savedAt: Date.now() }));
    window.dispatchEvent(new Event("sf-job-goal"));
  } catch { /* storage off: the banner just won't show */ }
}

export function readJobGoal() {
  try {
    const g = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (!g || !ID_RE.test(g.id ?? "") || !g.title) return null;
    if (Date.now() - (g.savedAt ?? 0) > MAX_AGE_MS) return null;
    return g;
  } catch {
    return null;
  }
}

export function clearJobGoal() {
  try {
    localStorage.removeItem(KEY);
    window.dispatchEvent(new Event("sf-job-goal"));
  } catch { /* nothing to clear */ }
}

export function jobGoalUrl(goal) {
  if (!goal || !TALFIRMS_URL || !ID_RE.test(goal.id ?? "")) return null;
  return `${TALFIRMS_URL.replace(/\/$/, "")}/opportunities/${goal.id}`;
}
