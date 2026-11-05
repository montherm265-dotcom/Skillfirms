import { supabase } from "@/lib/supabaseClient";

// Team training (migration 0028). Every call goes through checked
// database functions: managers see only assigned courses for people who
// joined their team; staff see what they've been assigned.
const friendly = (error, fallback) => {
  const m = String(error?.message ?? "");
  const known = m.match(/^[a-z_]+: (.+)$/);
  if (known) return new Error(known[1]);
  if (m === "managers_only") return new Error("Only the company's managers can do this.");
  return new Error(fallback);
};

export async function loadMyTeams() {
  const { data, error } = await supabase.rpc("skillfirms_my_teams");
  if (error) return [];
  return data ?? [];
}

export async function loadTeamDashboard(companyId) {
  const { data, error } = await supabase.rpc("skillfirms_team_dashboard", { p_company_id: companyId });
  if (error) throw friendly(error, "Couldn't load your team.");
  return data;
}

export async function teamInviteCode(companyId, fresh = false) {
  const { data, error } = await supabase.rpc("skillfirms_team_invite_link", { p_company_id: companyId, p_new: fresh });
  if (error) throw friendly(error, "Couldn't make an invite link.");
  return data;
}

export async function inviteInfo(code) {
  const { data, error } = await supabase.rpc("skillfirms_team_invite_info", { p_code: code });
  if (error) return null;
  return data;
}

export async function joinTeam(code) {
  const { data, error } = await supabase.rpc("skillfirms_team_join", { p_code: code });
  if (error) throw friendly(error, "Couldn't join. Try again.");
  return data;
}

export async function leaveTeam(companyId) {
  const { error } = await supabase.rpc("skillfirms_team_leave", { p_company_id: companyId });
  if (error) throw friendly(error, "Couldn't leave the team.");
}

export async function removeMember(companyId, profileId) {
  const { error } = await supabase.rpc("skillfirms_team_remove", { p_company_id: companyId, p_profile_id: profileId });
  if (error) throw friendly(error, "Couldn't remove them.");
}

export async function assignCourse(companyId, courseId, profileId, dueOn) {
  const { error } = await supabase.rpc("skillfirms_team_assign", { p_company_id: companyId, p_course_id: courseId, p_profile_id: profileId || null, p_due_on: dueOn || null });
  if (error) throw friendly(error, "Couldn't assign the course.");
}

export async function unassign(assignmentId) {
  const { error } = await supabase.rpc("skillfirms_team_unassign", { p_assignment_id: assignmentId });
  if (error) throw friendly(error, "Couldn't remove the assignment.");
}

export async function loadMyAssignments() {
  const { data, error } = await supabase.rpc("skillfirms_my_assignments");
  if (error) return [];
  return data ?? [];
}

// The training record as a CSV an auditor can open in Excel.
export function trainingRecordCsv(dashboard) {
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = [["Person", "Course", "Lessons passed", "Lessons", "Due", "Status", "Certificate", "Certificate issued", "Verify at"]];
  for (const m of dashboard.members) {
    for (const c of m.courses) {
      const status = c.certificate ? "Complete" : c.overdue ? "Overdue" : c.passed > 0 ? "In progress" : "Not started";
      rows.push([m.name, c.title, c.passed, c.lessons, c.due_on ?? "", status, c.certificate?.code ?? "",
        c.certificate?.issued_at ? new Date(c.certificate.issued_at).toISOString().slice(0, 10) : "",
        c.certificate ? `${window.location.origin}/verify/${c.certificate.code}` : ""]);
    }
  }
  return rows.map((r) => r.map(esc).join(",")).join("\r\n");
}
