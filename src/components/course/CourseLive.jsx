import { useEffect, useState } from "react";
import { CalendarPlus, Megaphone, Video } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { downloadIcs, googleCalendarUrl } from "@/lib/calendar";
import { Button } from "@/components/ui/button";

// On a course page (0050): the tutor's live sessions and messages. The
// meeting link and messages are for enrolled learners only.
const when = (t) => new Date(t).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export default function CourseLive({ courseId, courseTitle }) {
  const [d, setD] = useState(null);
  const load = () => supabase.rpc("sf_course_updates", { p_course_id: courseId }).then(({ data }) => setD(data));
  useEffect(() => { load(); }, [courseId]);
  if (!d || (!d.sessions.length && !d.announcements.length)) return null;

  async function rsvp(id, going) {
    const { error } = await supabase.rpc("sf_rsvp", { p_session_id: id, p_going: going });
    if (error) { toast.error(error.message.replace(/^[a-z_]+: /, "")); return; }
    load();
  }
  return (
    <section className="mt-10">
      {d.sessions.length > 0 && (
        <>
          <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight"><Video className="h-5 w-5 text-mastery" />Live with the tutor</h2>
          <ul className="mt-3 space-y-3">
            {d.sessions.map((s) => {
              const ev = { id: s.id, title: `${s.title} (${courseTitle})`, start: s.starts_at, minutes: s.duration_minutes, details: s.details ?? "", location: s.meeting_url ?? "" };
              const live = new Date(s.starts_at).getTime() - Date.now() < 15 * 60000;
              return (
                <li key={s.id} className="rounded-xl border border-border bg-card p-4">
                  <p className="font-semibold">{s.title}</p>
                  <p className="text-sm text-muted-foreground">{when(s.starts_at)} · {s.duration_minutes} min · {s.going} coming{s.capacity ? ` of ${s.capacity} seats` : ""}</p>
                  {s.details && <p className="mt-1 text-sm">{s.details}</p>}
                  {d.enrolled ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {s.mine ? <Button size="sm" variant="outline" onClick={() => rsvp(s.id, false)}>I can't come</Button>
                        : <Button size="sm" onClick={() => rsvp(s.id, true)}>I'm coming</Button>}
                      {s.meeting_url && (s.mine || live) && <a href={s.meeting_url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-[#1f4189] hover:underline">Join link</a>}
                      {s.mine && (
                        <span className="flex items-center gap-2 text-xs">
                          <CalendarPlus className="h-3.5 w-3.5 text-[#1f4189]" />
                          <a href={googleCalendarUrl(ev)} target="_blank" rel="noopener noreferrer" className="text-[#1f4189] hover:underline">Google Calendar</a>
                          <button type="button" onClick={() => downloadIcs(ev)} className="text-[#1f4189] hover:underline">Apple / Outlook</button>
                        </span>
                      )}
                    </div>
                  ) : !d.owner && <p className="mt-2 text-xs text-muted-foreground">Included with the course. Enrol to join.</p>}
                </li>
              );
            })}
          </ul>
        </>
      )}
      {d.announcements.length > 0 && (
        <div className="mt-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><Megaphone className="h-5 w-5 text-mastery" />From your tutor</h2>
          <ul className="mt-2 space-y-2">
            {d.announcements.slice(0, 5).map((a) => (
              <li key={a.id} className="rounded-lg bg-secondary/50 p-3 text-sm"><span className="block text-xs text-muted-foreground">{when(a.at)}</span><span className="whitespace-pre-wrap">{a.body}</span></li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
