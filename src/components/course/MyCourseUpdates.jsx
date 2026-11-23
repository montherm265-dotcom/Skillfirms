import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Megaphone, Video } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

// Learner dashboard (0050): upcoming live sessions and recent messages from
// the tutors of every course you're enrolled in.
const when = (t) => new Date(t).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export default function MyCourseUpdates() {
  const [d, setD] = useState(null);
  useEffect(() => { supabase.rpc("sf_my_updates").then(({ data }) => setD(data)); }, []);
  if (!d || (!d.sessions.length && !d.announcements.length)) return null;
  return (
    <section className="mt-8 rounded-2xl border border-border bg-card p-5">
      <h2 className="text-lg font-bold">From your tutors</h2>
      <ul className="mt-3 space-y-2">
        {d.sessions.map((s) => (
          <li key={s.id} className="flex items-start gap-2 text-sm">
            <Video className="mt-0.5 h-4 w-4 flex-none text-mastery" />
            <span><b>{s.title}</b> · {when(s.starts_at)} · <Link to={`/courses/${s.slug}`} className="text-[#1f4189] hover:underline">{s.course}</Link>{s.mine ? " · you're coming" : ""}</span>
          </li>
        ))}
        {d.announcements.map((a) => (
          <li key={a.id} className="flex items-start gap-2 text-sm">
            <Megaphone className="mt-0.5 h-4 w-4 flex-none text-mastery" />
            <span><Link to={`/courses/${a.slug}`} className="font-semibold text-[#1f4189] hover:underline">{a.course}</Link>: <span className="line-clamp-2 inline">{a.body}</span></span>
          </li>
        ))}
      </ul>
    </section>
  );
}
