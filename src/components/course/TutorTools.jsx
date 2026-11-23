import { useEffect, useState } from "react";
import { BarChart3, CalendarPlus, Megaphone, Video } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// The tutor's tools for a course (0050): how learners are doing lesson by
// lesson, a message to everyone enrolled, and live sessions.
const when = (t) => new Date(t).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export default function TutorTools({ courseId }) {
  const [stats, setStats] = useState(null);
  const [updates, setUpdates] = useState(null);
  const [msg, setMsg] = useState("");
  const [s, setS] = useState({ title: "", details: "", at: "", minutes: 60, url: "", capacity: "" });
  const [busy, setBusy] = useState(null);
  const load = () => {
    supabase.rpc("sf_course_stats", { p_course_id: courseId }).then(({ data }) => setStats(data));
    supabase.rpc("sf_course_updates", { p_course_id: courseId }).then(({ data }) => setUpdates(data));
  };
  useEffect(() => { load(); }, [courseId]);

  async function announce() {
    setBusy("msg");
    const { error } = await supabase.rpc("sf_post_announcement", { p_course_id: courseId, p_body: msg });
    setBusy(null);
    if (error) { toast.error(error.message.replace(/^[a-z_]+: /, "")); return; }
    toast.success("Sent to everyone enrolled."); setMsg(""); load();
  }
  async function schedule() {
    setBusy("session");
    const { error } = await supabase.rpc("sf_schedule_session", {
      p_course_id: courseId, p_title: s.title, p_details: s.details, p_starts_at: new Date(s.at).toISOString(),
      p_duration_minutes: Number(s.minutes) || 60, p_meeting_url: s.url.trim(), p_capacity: s.capacity ? Number(s.capacity) : null,
    });
    setBusy(null);
    if (error) { toast.error(/meeting_url/.test(error.message) ? "Use a full https:// meeting link (Zoom, Google Meet, Teams…)." : error.message.replace(/^[a-z_]+: /, "")); return; }
    toast.success("Scheduled. Everyone enrolled has been told."); setS({ title: "", details: "", at: "", minutes: 60, url: "", capacity: "" }); load();
  }
  async function cancel(id) {
    if (!window.confirm("Cancel this session? People who said they're coming will be told.")) return;
    const { error } = await supabase.rpc("sf_cancel_session", { p_session_id: id });
    if (error) { toast.error(error.message); return; }
    load();
  }
  if (!stats) return null;
  const top = Math.max(1, stats.enrolled);
  // The lesson where the most learners stop.
  const drops = stats.lessons.map((l, i) => ({ ...l, drop: (i === 0 ? stats.enrolled : stats.lessons[i - 1].reached) - l.reached }));
  const worst = drops.reduce((a, b) => (b.drop > (a?.drop ?? 0) ? b : a), null);

  return (
    <section className="space-y-6 rounded-2xl border border-border bg-card p-5">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-extrabold tracking-[-0.03em]"><BarChart3 className="h-5 w-5 text-mastery" />How learners are doing</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[["Enrolled", stats.enrolled], ["Started", stats.started], ["Finished", stats.completed], ["Finish rate", stats.completion_pct != null ? `${stats.completion_pct}%` : "—"]].map(([l, v]) => (
            <div key={l} className="rounded-xl bg-secondary/50 p-3"><p className="text-2xl font-bold">{v}</p><p className="text-xs text-muted-foreground">{l}</p></div>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {stats.last_30_days} new in the last 30 days · Final exam: {stats.exam?.passed ?? 0} passed, {stats.exam?.failed ?? 0} not yet, {stats.exam?.marking ?? 0} waiting for your marks
          {stats.rating?.count ? ` · Rated ${stats.rating.avg} by ${stats.rating.count}` : ""}
        </p>
        {stats.lessons.length > 0 && (
          <div className="mt-4">
            <p className="text-sm font-semibold">How far learners get</p>
            <ul className="mt-2 space-y-1.5">
              {stats.lessons.map((l) => (
                <li key={l.n} className="text-xs">
                  <div className="flex justify-between gap-2"><span className="truncate">Lesson {l.n}. {l.title}</span><span className="flex-none text-muted-foreground">{l.reached}{l.quiz_avg != null ? ` · quiz ${l.quiz_avg}%` : ""}</span></div>
                  <div className="mt-0.5 h-1.5 rounded-full bg-secondary"><div className="h-1.5 rounded-full bg-mastery" style={{ width: `${Math.round((100 * l.reached) / top)}%` }} /></div>
                </li>
              ))}
            </ul>
            {worst && worst.drop > 0 && stats.enrolled >= 5 && (
              <p className="mt-2 rounded-lg bg-amber-500/10 p-2 text-xs">Most learners stop at <b>lesson {worst.n}</b> ({worst.drop} of them). A shorter lesson, an example or a video there usually helps.</p>
            )}
            {stats.enrolled < 5 && <p className="mt-2 text-xs text-muted-foreground">Where learners stop shows once 5 people have enrolled.</p>}
          </div>
        )}
      </div>

      <div className="border-t border-border pt-5">
        <h2 className="flex items-center gap-2 text-lg font-bold"><Megaphone className="h-5 w-5 text-mastery" />Message everyone enrolled</h2>
        <textarea rows={3} maxLength={3000} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="A tip, a new lesson, a reminder about the exam…"
          className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
        <Button size="sm" className="mt-2" disabled={msg.trim().length < 2 || busy === "msg"} onClick={announce}>{busy === "msg" ? "Sending…" : "Send to all learners"}</Button>
        {updates?.announcements?.length > 0 && (
          <ul className="mt-3 space-y-2">
            {updates.announcements.slice(0, 3).map((a) => <li key={a.id} className="rounded-lg bg-secondary/40 p-2 text-xs"><span className="text-muted-foreground">{when(a.at)}: </span>{a.body}</li>)}
          </ul>
        )}
      </div>

      <div className="border-t border-border pt-5">
        <h2 className="flex items-center gap-2 text-lg font-bold"><Video className="h-5 w-5 text-mastery" />Live sessions and group classes</h2>
        <p className="text-xs text-muted-foreground">Use your own Zoom, Google Meet or Teams link. Only enrolled learners see it.</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <Input placeholder="Title, e.g. Live Q&A" maxLength={140} value={s.title} onChange={(e) => setS({ ...s, title: e.target.value })} />
          <Input type="datetime-local" value={s.at} onChange={(e) => setS({ ...s, at: e.target.value })} aria-label="Starts" />
          <Input placeholder="https:// meeting link" value={s.url} onChange={(e) => setS({ ...s, url: e.target.value })} />
          <div className="flex gap-2">
            <Input type="number" min={15} max={480} value={s.minutes} onChange={(e) => setS({ ...s, minutes: e.target.value })} aria-label="Minutes" />
            <Input type="number" min={1} placeholder="Seats (optional)" value={s.capacity} onChange={(e) => setS({ ...s, capacity: e.target.value })} />
          </div>
        </div>
        <Input className="mt-2" placeholder="What you'll cover (optional)" maxLength={2000} value={s.details} onChange={(e) => setS({ ...s, details: e.target.value })} />
        <Button size="sm" className="mt-2" disabled={!s.title.trim() || !s.at || !s.url.trim() || busy === "session"} onClick={schedule}>
          <CalendarPlus className="h-4 w-4" />{busy === "session" ? "Scheduling…" : "Schedule and tell learners"}
        </Button>
        {updates?.sessions?.length > 0 && (
          <ul className="mt-3 space-y-2">
            {updates.sessions.map((x) => (
              <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-2 text-sm">
                <span><b>{x.title}</b> · {when(x.starts_at)} · {x.going} coming{x.capacity ? ` of ${x.capacity}` : ""}</span>
                <button type="button" onClick={() => cancel(x.id)} className="text-xs text-muted-foreground hover:text-destructive hover:underline">Cancel</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
