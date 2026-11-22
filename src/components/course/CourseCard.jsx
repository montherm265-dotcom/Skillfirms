import { Link } from "react-router-dom";
import { Bookmark, BookmarkCheck, CheckCircle2, Star } from "lucide-react";
import CourseCover from "@/components/course/CourseCover";
import { formatHours, priceLabel, teacherOf } from "@/lib/catalog";
import { SF_MARK_PATH, SF_MARK_VIEWBOX } from "@/components/brand/sfMark";

const LEVEL = { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" };

// Who it's from: the expert's initial, or the Skillfirms mark for AI basics.
export function ProviderLine({ course, className = "" }) {
  const t = teacherOf(course);
  return (
    <p className={`flex items-center gap-1.5 text-xs text-muted-foreground ${className}`}>
      {t.kind === "expert" ? (
        <span className="flex h-5 w-5 flex-none items-center justify-center rounded bg-[#1f4189] text-[10px] font-bold text-white">{(t.name ?? "?").slice(0, 1)}</span>
      ) : (
        <span className="flex h-5 w-5 flex-none items-center justify-center rounded border border-border bg-white">
          <svg viewBox={SF_MARK_VIEWBOX} className="h-2.5 w-auto" fill="#00041d" aria-hidden="true"><path d={SF_MARK_PATH} /></svg>
        </span>
      )}
      <span className="truncate">{t.kind === "expert" ? t.name : "Skillfirms · AI-taught basics"}</span>
    </p>
  );
}

// Real ratings only; a course nobody has rated yet says "New".
function Rating({ course }) {
  if (!course.rating_count) return <span className="rounded bg-[#1f4189]/10 px-1.5 py-0.5 text-[11px] font-semibold text-[#1f4189]">New</span>;
  return (
    <span className="inline-flex items-center gap-1 text-xs">
      <Star className="h-3.5 w-3.5 text-warning" fill="currentColor" strokeWidth={0} aria-hidden="true" />
      <span className="font-semibold">{Number(course.rating_avg).toFixed(1)}</span>
      <span className="text-muted-foreground">· {course.rating_count.toLocaleString()} review{course.rating_count === 1 ? "" : "s"}</span>
    </span>
  );
}

// A compact tile: a small cover square beside the title, then the facts
// that decide a click (level, hours, price, rating). No big image block.
export default function CourseCard({ course, saved, onToggleSave, progress, hiring }) {
  const skills = course.skills ?? [];
  const isExpert = teacherOf(course).kind === "expert";
  return (
    <div className="group relative h-full min-w-0">
      <Link to={`/courses/${course.slug}`} className="flex h-full min-w-0 gap-3.5 rounded-xl border border-border bg-card p-3 transition-colors duration-200 hover:border-[#1f4189]/40 hover:bg-[#1f4189]/[0.02]">
        <CourseCover course={course} size="sm" className="h-[84px] w-[84px] flex-none rounded-lg" />
        <div className="flex min-w-0 flex-1 flex-col pr-7">
          <ProviderLine course={course} className="!text-[11px]" />
          <h3 className="mt-1 line-clamp-2 text-[14px] font-semibold leading-snug group-hover:text-[#1f4189]">{course.title}</h3>
          {progress != null ? (
            <div className="mt-auto pt-2">
              <p className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">{progress >= 100 ? "Completed" : `${Math.round(progress)}% complete`}</span>
                {progress >= 100 && <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />}
              </p>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-[#1f4189]" style={{ width: `${Math.max(3, Math.min(100, progress))}%` }} /></div>
            </div>
          ) : (
            <>
              {skills.length > 0 && <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{skills.slice(0, 3).map((s) => s.name).join(" · ")}</p>}
              <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-0.5 pt-1.5 text-[11px] text-muted-foreground">
                <Rating course={course} />
                <span>{[LEVEL[course.level] ?? "All levels", formatHours(course), isExpert ? priceLabel(course.price_cents) : "Free"].join(" · ")}</span>
              </div>
              {hiring?.length > 0 && <p className="mt-1 truncate text-[11px] font-semibold text-[#8a5a00]">Hiring: {hiring.slice(0, 2).join(", ")}</p>}
            </>
          )}
        </div>
      </Link>
      {onToggleSave && (
        <button type="button" onClick={(e) => { e.preventDefault(); onToggleSave(course); }}
          aria-label={saved ? "Remove from saved" : "Save for later"} aria-pressed={saved}
          className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-[#00041d]">
          {saved ? <BookmarkCheck className="h-4 w-4 text-[#1f4189]" /> : <Bookmark className="h-4 w-4" />}
        </button>
      )}
    </div>
  );
}
