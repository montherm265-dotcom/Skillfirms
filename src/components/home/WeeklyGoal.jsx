import { useEffect, useState } from "react";
import { Flame, Pencil, Target } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

const DAYS = ["M", "T", "W", "T", "F", "S", "S"];
const iso = (d) => d.toISOString().slice(0, 10);

// Your learning week: a goal (1-7 days), this week's days as dots, a ring
// that fills as you go, and how many weeks in a row you've hit it.
export default function WeeklyGoal({ userId }) {
  const [week, setWeek] = useState(null);
  const [editing, setEditing] = useState(false);

  const load = () => supabase.rpc("skillfirms_my_week").then(({ data }) => setWeek(data ?? null));
  useEffect(() => { load(); }, [userId]);

  async function setGoal(n) {
    setEditing(false);
    setWeek((w) => ({ ...(w ?? {}), goal: n }));
    await supabase.from("skillfirms_learning_goals").upsert({ user_id: userId, days_per_week: n, updated_at: new Date().toISOString() });
    load();
  }

  if (!week) return <div className="h-40 animate-pulse rounded-2xl bg-secondary/60" />;
  const done = new Set(week.days ?? []);
  const monday = new Date(`${week.monday}T00:00:00Z`);
  const count = done.size;
  const goal = week.goal;
  const pct = goal ? Math.min(1, count / goal) : 0;
  const r = 34, c = 2 * Math.PI * r;
  const met = goal && count >= goal;
  const todayIdx = Math.round((new Date(`${week.today}T00:00:00Z`) - monday) / 86400000);
  const daysLeft = 7 - todayIdx;

  if (!goal || editing) {
    return (
      <div className="rounded-2xl border border-border bg-gradient-to-br from-[#eef1ff] via-card to-card p-5">
        <p className="flex items-center gap-2 text-base font-semibold"><Target className="h-5 w-5 text-[#1f4189]" />{goal ? "Change your weekly goal" : "Set a weekly goal"}</p>
        <p className="mt-1 text-sm text-muted-foreground">A small, steady goal is easier to keep. How many days a week will you learn?</p>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {[1, 2, 3, 4, 5, 6, 7].map((n) => (
            <button key={n} type="button" onClick={() => setGoal(n)}
              className={`flex h-11 w-11 flex-col items-center justify-center rounded-xl border text-sm font-semibold transition-all hover:-translate-y-0.5 hover:border-[#1f4189] ${goal === n ? "border-[#1f4189] bg-[#1f4189] text-white" : "border-border bg-card"}`}>
              {n}<span className="text-[9px] font-normal opacity-70">{n === 1 ? "day" : "days"}</span>
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{goal ? <button type="button" onClick={() => setEditing(false)} className="hover:underline">Keep {goal} days</button> : "3 days is a great start."}</p>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-2xl border p-5 ${met ? "border-success/40 bg-gradient-to-br from-success/10 via-card to-card" : "border-border bg-card"}`}>
      <div className="flex items-center gap-5">
        <div className="relative h-20 w-20 flex-none">
          <svg viewBox="0 0 80 80" className="h-20 w-20 -rotate-90" aria-hidden="true">
            <circle cx="40" cy="40" r={r} fill="none" strokeWidth="8" className="stroke-secondary" />
            <circle cx="40" cy="40" r={r} fill="none" strokeWidth="8" strokeLinecap="round" stroke={met ? "hsl(var(--success))" : "#1f4189"}
              strokeDasharray={c} strokeDashoffset={c * (1 - pct)} style={{ transition: "stroke-dashoffset 800ms cubic-bezier(.22,1,.36,1)" }} />
          </svg>
          <span className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-bold tabular-nums leading-none">{count}<span className="text-sm font-medium text-muted-foreground">/{goal}</span></span>
            <span className="text-[10px] text-muted-foreground">days</span>
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-base font-semibold">
            {met ? "Weekly goal reached" : "This week"}
            <button type="button" onClick={() => setEditing(true)} aria-label="Change goal" className="text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
          </p>
          <p className="text-sm text-muted-foreground">
            {met ? "Anything more is a bonus." : goal - count > daysLeft ? "Try a smaller goal next week; every day counts." : `${goal - count} more day${goal - count === 1 ? "" : "s"} to hit your goal${daysLeft ? `, ${daysLeft} day${daysLeft === 1 ? "" : "s"} left` : ""}.`}
          </p>
          <div className="mt-3 flex gap-1.5">
            {DAYS.map((d, i) => {
              const day = new Date(monday.getTime() + i * 86400000);
              const on = done.has(iso(day));
              return (
                <span key={i} title={day.toDateString()} className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold ${on ? "bg-[#1f4189] text-white" : i === todayIdx ? "border-2 border-[#1f4189] text-[#1f4189]" : "bg-secondary text-muted-foreground"}`}>{d}</span>
              );
            })}
          </div>
        </div>
        {week.weeks_in_a_row > 0 && (
          <div className="hidden flex-none flex-col items-center sm:flex">
            <Flame className="h-7 w-7 text-orange-500" fill="currentColor" />
            <span className="text-lg font-bold tabular-nums">{week.weeks_in_a_row}</span>
            <span className="text-[10px] text-muted-foreground">week{week.weeks_in_a_row === 1 ? "" : "s"} in a row</span>
          </div>
        )}
      </div>
    </div>
  );
}
