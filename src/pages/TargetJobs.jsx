import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Check, Crosshair, Map as MapIcon, Play, X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import { crossAppClick } from "@/lib/crossApp";
import { TALFIRMS_URL } from "@/lib/externalLinks";
import EmptyState from "@/components/EmptyState";
import Seo from "@/components/seo/Seo";

const LEVEL = { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" };

// Fit today, as a ring.
function FitRing({ score }) {
  const r = 26, c = 2 * Math.PI * r;
  const pct = score ?? 0;
  const color = pct >= 70 ? "#16a34a" : pct >= 40 ? "#1f4189" : "#94a3b8";
  return (
    <div className="relative h-16 w-16 flex-none" aria-label={score == null ? "Fit not known yet" : `${score}% fit`}>
      <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90" aria-hidden="true">
        <circle cx="32" cy="32" r={r} fill="none" strokeWidth="6" className="stroke-secondary" />
        {score != null && <circle cx="32" cy="32" r={r} fill="none" strokeWidth="6" strokeLinecap="round" stroke={color} strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} />}
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold tabular-nums">{score == null ? "–" : `${score}%`}</span>
    </div>
  );
}

function CourseRow({ course }) {
  const done = course.enrollment === "completed";
  const started = course.enrollment === "active";
  const price = course.taught_by === "expert" ? (course.price_cents ? `$${(course.price_cents / 100).toFixed(0)}` : "Expert") : "Free · AI-taught";
  return (
    <li className="flex items-center gap-3 py-2.5">
      <span className="min-w-0 flex-1">
        <Link to={`/courses/${course.slug}`} className="block truncate text-sm font-medium hover:underline">{course.title}</Link>
        <span className="block text-xs text-muted-foreground">
          {[LEVEL[course.level], course.hours ? `${Number(course.hours)} h` : null, price].filter(Boolean).join(" · ")}
        </span>
        {started && (
          <span className="mt-1.5 block h-1 w-40 overflow-hidden rounded-full bg-secondary">
            <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.round(course.progress ?? 0)}%` }} />
          </span>
        )}
      </span>
      {done ? (
        <span className="inline-flex flex-none items-center gap-1 text-xs font-semibold text-success"><Check className="h-3.5 w-3.5" />Passed</span>
      ) : (
        <Link to={`/courses/${course.slug}`} className={`inline-flex h-8 flex-none items-center gap-1 rounded-full px-3 text-xs font-semibold ${started ? "bg-primary text-primary-foreground" : "border border-border hover:bg-secondary"}`}>
          {started ? <><Play className="h-3 w-3" />Continue</> : "Start"}
        </Link>
      )}
    </li>
  );
}

function TargetCard({ job, onRemove }) {
  const gaps = job.gaps ?? [];
  return (
    <article className="rounded-xl border border-border bg-card">
      <header className="flex items-start gap-4 border-b border-border p-5">
        <FitRing score={job.score} />
        <div className="min-w-0 flex-1">
          <a href={`${TALFIRMS_URL}/opportunities/${job.id}`} onClick={crossAppClick(TALFIRMS_URL, `/opportunities/${job.id}`)}
            className="group inline-flex items-center gap-1 text-base font-semibold leading-snug hover:underline">
            {job.title}<ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          </a>
          <p className="mt-0.5 text-[13px] text-muted-foreground">{[job.company, job.city, job.remote_ok ? "Remote OK" : null].filter(Boolean).join(" · ")}</p>
          <p className="mt-2 text-[13px]">
            {!job.open ? <span className="text-muted-foreground">This job has closed. Its skills are still worth having.</span>
              : job.score == null ? <span className="text-muted-foreground">Add your skills on Talfirms to see your fit.</span>
              : gaps.length === 0 ? <span className="font-medium text-success">You have every skill this job lists.</span>
              : <span>{gaps.length} skill{gaps.length === 1 ? "" : "s"} to close{job.projected ? <> · up to <b>{job.projected}%</b> fit once your listed skills are proven</> : ""}</span>}
          </p>
        </div>
        <button type="button" onClick={() => onRemove(job.id)} aria-label={`Remove ${job.title} from target jobs`} title="Remove"
          className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </header>
      {job.company_note && (
        <p className="border-b border-border bg-[#1f4189]/[0.03] px-5 py-3 text-[13px] leading-5"><span className="font-semibold">{job.company}: </span><span className="text-foreground/80">{job.company_note}</span></p>
      )}
      {gaps.length > 0 && (
        <div className="divide-y divide-border">
          {gaps.map((g) => (
            <section key={g.id} className="px-5 py-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                {g.label}
                {g.required && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">Required</span>}
                {g.also_wanted && <span className="rounded-full border border-[#1f4189]/25 bg-[#1f4189]/[0.06] px-2 py-0.5 text-[11px] font-semibold text-[#1f4189]" title={`${job.company} asks for this on top of the usual skills`}>{job.company}'s extra</span>}
                {g.partial && <span className="text-[11px] font-normal text-muted-foreground">partly there</span>}
              </h3>
              {g.courses.length > 0 ? (
                <ul className="divide-y divide-border/60">{g.courses.map((c) => <CourseRow key={c.id} course={c} />)}</ul>
              ) : (
                <p className="py-2 text-xs text-muted-foreground">No course teaches this yet. We're looking for an expert who does.</p>
              )}
            </section>
          ))}
        </div>
      )}
      {job.other_gaps > 0 && (
        <p className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
          Also {job.other_gaps} requirement{job.other_gaps === 1 ? "" : "s"} a course can't cover (experience or certificates): see the job.
        </p>
      )}
    </article>
  );
}

// My target jobs: the jobs you saved on Talfirms, what you're missing for
// each, and the courses that close the gap.
export default function TargetJobs() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setError(null);
    supabase.rpc("my_target_jobs").then(({ data, error: err }) => {
      if (err) { setError("Couldn't load your target jobs. Try again."); setJobs([]); return; }
      setJobs(data ?? []);
    });
  }, []);
  useEffect(() => { if (user) load(); }, [user, load]);

  async function remove(id) {
    setJobs((list) => list.filter((j) => j.id !== id));
    const { error: err } = await supabase.rpc("save_job", { p_opportunity_id: id, p_saved: false });
    if (err) load();
  }

  const findJobs = (
    <a href={`${TALFIRMS_URL}/discover`} onClick={crossAppClick(TALFIRMS_URL, "/discover")}
      className="inline-flex h-10 items-center gap-1.5 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
      Find jobs to save on Talfirms<ArrowUpRight className="h-4 w-4" />
    </a>
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <Seo title="Target jobs" description="The jobs you want, the skills you're missing for each, and the courses that close the gap." canonical="/targets" />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Target jobs</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">The jobs you saved on Talfirms. Pass a course and the skill shows on your Talfirms profile as proven, so your fit goes up.</p>
        </div>
        <Link to="/roles" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"><MapIcon className="h-4 w-4" />Career paths</Link>
      </div>

      <div className="mt-6 space-y-4">
        {!user ? (
          <EmptyState icon={Crosshair} title="Aim at a real job" description="Save jobs on Talfirms. Here you'll see your fit for each, what you're missing, and the courses that teach it."
            action={<Link to="/auth" className="inline-flex h-10 items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground">Sign in</Link>} />
        ) : jobs == null ? (
          [0, 1].map((i) => <div key={i} className="h-40 animate-pulse rounded-xl border border-border bg-secondary/40" />)
        ) : error ? (
          <p className="py-10 text-center text-sm text-destructive">{error}</p>
        ) : jobs.length === 0 ? (
          <EmptyState icon={Crosshair} title="No target jobs yet" description="Tap Save on any job on Talfirms. It shows up here with the skills you're missing and the courses that teach them." action={findJobs} />
        ) : (
          jobs.map((j) => <TargetCard key={j.id} job={j} onRemove={remove} />)
        )}
      </div>
    </div>
  );
}
