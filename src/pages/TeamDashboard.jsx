import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { AlertTriangle, Award, Copy, Download, RefreshCw, Trash2, UserMinus, Users } from "lucide-react";
import { loadCatalog } from "@/lib/catalog";
import { assignCourse, loadMyTeams, loadTeamDashboard, removeMember, teamInviteCode, trainingRecordCsv, unassign } from "@/lib/team";
import Seo from "@/components/seo/Seo";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

// A company's training: seats, invite link, assignments, and the live
// training record (exportable).
export default function TeamDashboard() {
  const { slug } = useParams();
  const [team, setTeam] = useState(undefined);
  const [data, setData] = useState(null);
  const [code, setCode] = useState(null);
  const [courses, setCourses] = useState([]);
  const [form, setForm] = useState({ course: "", person: "", due: "" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (t) => {
    try { setData(await loadTeamDashboard(t.id)); } catch (e) { toast.error(e.message); }
  }, []);

  useEffect(() => {
    loadMyTeams().then((ts) => {
      const t = ts.find((x) => x.slug === slug && x.manager) ?? null;
      setTeam(t);
      if (t) { load(t); teamInviteCode(t.id).then(setCode).catch(() => {}); }
    });
    loadCatalog().then(setCourses).catch(() => {});
  }, [slug, load]);

  const link = code ? `${window.location.origin}/join/${code}` : "";
  const stats = useMemo(() => {
    const all = (data?.members ?? []).flatMap((m) => m.courses);
    return { assigned: all.length, done: all.filter((c) => c.certificate).length, overdue: all.filter((c) => c.overdue).length };
  }, [data]);

  async function assign(e) {
    e.preventDefault();
    if (!form.course) return;
    setBusy(true);
    try {
      await assignCourse(team.id, form.course, form.person, form.due);
      toast.success("Assigned. They're enrolled.");
      setForm({ course: "", person: "", due: "" });
      load(team);
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  }

  async function newLink() {
    if (!window.confirm("Make a new link? The old one stops working.")) return;
    try { setCode(await teamInviteCode(team.id, true)); toast.success("New link ready."); } catch (e) { toast.error(e.message); }
  }

  function exportCsv() {
    const blob = new Blob([trainingRecordCsv(data)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${slug}-training-record-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  if (team === null) return <p className="section-pad text-center text-sm text-muted-foreground">Only this company's managers can open its training. <Link to="/team" className="font-medium text-mastery hover:underline">Back to teams</Link></p>;
  if (!team || !data) return <div className="section-pad"><div className="mx-auto max-w-6xl space-y-3"><Skeleton className="h-10 w-1/3" /><Skeleton className="h-48 w-full" /></div></div>;

  const used = data.members.length;
  const limit = data.company.seat_limit;
  return (
    <div className="section-pad">
      <Seo title={`${data.company.name} training`} canonical={`/team/${slug}`} />
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Link to="/team" className="text-sm text-muted-foreground hover:text-foreground">← Teams</Link>
            <h1 className="mt-1 text-3xl font-extrabold tracking-[-0.03em]">{data.company.name} training</h1>
          </div>
          <dl className="flex gap-6 text-right">
            <div><dt className="text-xs text-muted-foreground">People</dt><dd className="text-2xl font-extrabold tracking-[-0.03em]">{used}<span className="text-base text-muted-foreground">/{limit}</span></dd></div>
            <div><dt className="text-xs text-muted-foreground">Certificates</dt><dd className="text-2xl font-extrabold tracking-[-0.03em]">{stats.done}<span className="text-base text-muted-foreground">/{stats.assigned}</span></dd></div>
            <div><dt className="text-xs text-muted-foreground">Overdue</dt><dd className={`text-2xl font-extrabold tracking-[-0.03em] ${stats.overdue ? "text-destructive" : ""}`}>{stats.overdue}</dd></div>
          </dl>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border border-border bg-card p-5">
            <p className="font-semibold">Invite your people</p>
            <p className="mt-1 text-sm text-muted-foreground">Anyone with this link can join (they agree that you see their progress in the courses you assign).</p>
            <div className="mt-3 flex gap-2">
              <input readOnly value={link} aria-label="Invite link" className="min-w-0 flex-1 rounded-lg border border-input bg-secondary/50 px-3 py-2 text-sm" />
              <Button size="sm" onClick={() => navigator.clipboard?.writeText(link).then(() => toast.success("Link copied"))}><Copy className="h-4 w-4" />Copy</Button>
              <Button size="sm" variant="ghost" onClick={newLink} aria-label="Make a new link"><RefreshCw className="h-4 w-4" /></Button>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {used >= limit ? <span className="font-medium text-destructive">All {limit} seats are used. </span> : `${limit - used} seat${limit - used === 1 ? "" : "s"} left. `}
              Need more? Paid seats (${(data.seat_price_cents / 100).toFixed(0)} per person a month) open soon.
            </p>
          </section>

          <form onSubmit={assign} className="rounded-2xl border border-border bg-card p-5">
            <p className="font-semibold">Assign a course</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <select value={form.course} onChange={(e) => setForm({ ...form, course: e.target.value })} aria-label="Course" className="rounded-lg border border-input bg-background px-2 py-2 text-sm sm:col-span-3">
                <option value="">Choose a course…</option>
                {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
              <select value={form.person} onChange={(e) => setForm({ ...form, person: e.target.value })} aria-label="Who" className="rounded-lg border border-input bg-background px-2 py-2 text-sm sm:col-span-2">
                <option value="">Everyone (and anyone who joins later)</option>
                {data.members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <input type="date" value={form.due} onChange={(e) => setForm({ ...form, due: e.target.value })} aria-label="Due date" className="rounded-lg border border-input bg-background px-2 py-2 text-sm" />
            </div>
            <Button type="submit" className="mt-3" disabled={!form.course || busy}>{busy ? "Assigning…" : "Assign"}</Button>
            {data.assignments.length > 0 && (
              <ul className="mt-4 space-y-1 text-sm">
                {data.assignments.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate">{a.title} · <span className="text-muted-foreground">{a.person ?? "Everyone"}{a.due_on ? ` · due ${a.due_on}` : ""}</span></span>
                    <button type="button" aria-label="Remove assignment" onClick={async () => { await unassign(a.id).catch((e) => toast.error(e.message)); load(team); }} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                  </li>
                ))}
              </ul>
            )}
          </form>
        </div>

        <section className="mt-8">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h2 className="text-2xl font-extrabold tracking-[-0.03em]">Training record</h2>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={!stats.assigned}><Download className="h-4 w-4" />Export (CSV)</Button>
          </div>
          {data.members.length === 0 ? (
            <div className="mt-3 rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground"><Users className="mx-auto mb-2 h-6 w-6" />Nobody has joined yet. Share your invite link.</div>
          ) : (
            <div className="mt-3 overflow-x-auto rounded-2xl border border-border">
              <table className="w-full min-w-[40rem] text-sm">
                <thead className="bg-secondary/50 text-left text-xs text-muted-foreground"><tr><th className="p-3">Person</th><th className="p-3">Course</th><th className="p-3">Progress</th><th className="p-3">Due</th><th className="p-3">Certificate</th><th className="p-3" /></tr></thead>
                <tbody>
                  {data.members.map((m) => (m.courses.length ? m.courses : [null]).map((c, i) => (
                    <tr key={`${m.id}-${c?.course_id ?? "none"}`} className="border-t border-border">
                      {i === 0 && <td className="p-3 align-top font-medium" rowSpan={Math.max(1, m.courses.length)}>{m.name}</td>}
                      {c ? (
                        <>
                          <td className="p-3">{c.title}</td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-24 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-mastery" style={{ width: `${(100 * c.passed) / Math.max(1, c.lessons)}%` }} /></div>
                              <span className="tabular-nums text-xs text-muted-foreground">{c.passed}/{c.lessons}</span>
                            </div>
                          </td>
                          <td className="p-3">{c.overdue ? <span className="inline-flex items-center gap-1 text-destructive"><AlertTriangle className="h-3.5 w-3.5" />{c.due_on}</span> : c.due_on ?? "–"}</td>
                          <td className="p-3">{c.certificate ? <Link to={`/verify/${c.certificate.code}`} className="inline-flex items-center gap-1 font-medium text-mastery hover:underline"><Award className="h-3.5 w-3.5" />{c.certificate.code}</Link> : <span className="text-muted-foreground">–</span>}</td>
                        </>
                      ) : <td className="p-3 text-muted-foreground" colSpan={4}>No courses assigned yet</td>}
                      {i === 0 && (
                        <td className="p-3 align-top text-right" rowSpan={Math.max(1, m.courses.length)}>
                          <button type="button" aria-label={`Remove ${m.name}`} onClick={async () => { if (!window.confirm(`Remove ${m.name} from the team?`)) return; await removeMember(team.id, m.id).catch((e) => toast.error(e.message)); load(team); }} className="text-muted-foreground hover:text-destructive"><UserMinus className="h-4 w-4" /></button>
                        </td>
                      )}
                    </tr>
                  )))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-2 text-xs text-muted-foreground">You see progress only in the courses you assign. Certificates need every lesson's graded check passed, and anyone can verify them by code.</p>
        </section>
      </div>
    </div>
  );
}
