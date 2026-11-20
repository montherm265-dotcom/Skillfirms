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

export default function CourseCard({ course, saved, onToggleSave, progress, hiring }) {
  const skills = course.skills ?? [];
  const isExpert = teacherOf(course).kind === "expert";
  return (
    <div className="group relative h-full">
      <Link to={`/courses/${course.slug}`} className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card transition-shadow duration-200 hover:shadow-[0_10px_30px_-12px_rgba(0,4,29,0.25)]">
        <div className="relative overflow-hidden">
          <CourseCover course={course} className="aspect-[16/9] w-full transition-transform duration-500 group-hover:scale-[1.03]" />
          {hiring?.length > 0 && <span className="absolute bottom-2 left-2 rounded-md bg-warning px-2 py-0.5 text-[11px] font-bold text-black shadow">Hiring: {hiring.slice(0, 2).join(", ")}</span>}
        </div>
        <div className="flex flex-1 flex-col p-4">
          <ProviderLine course={course} />
          <h3 className="mt-2 line-clamp-2 text-[15px] font-semibold leading-snug group-hover:underline">{course.title}</h3>
          {skills.length > 0 && (
            <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-muted-foreground">
              <span className="font-semibold text-foreground/80">Skills you'll gain: </span>{skills.slice(0, 4).map((s) => s.name).join(", ")}
            </p>
          )}
          <div className="mt-auto pt-3">
            {progress != null ? (
              <>
                <p className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{progress >= 100 ? "Completed" : `${Math.round(progress)}% complete`}</span>
                  {progress >= 100 && <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />}
                </p>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-[#1f4189]" style={{ width: `${Math.max(3, Math.min(100, progress))}%` }} /></div>
              </>
            ) : (
              <>
                <Rating course={course} />
                <p className="mt-1 text-xs text-muted-foreground">
                  {[LEVEL[course.level] ?? "All levels", "Course", formatHours(course), isExpert ? priceLabel(course.price_cents) : "Free"].join(" · ")}
                </p>
              </>
            )}
          </div>
        </div>
      </Link>
      {onToggleSave && (
        <button type="button" onClick={(e) => { e.preventDefault(); onToggleSave(course); }}
          aria-label={saved ? "Remove from saved" : "Save for later"} aria-pressed={saved}
          className="absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-[#00041d] shadow-sm transition hover:bg-white">
          {saved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
        </button>
      )}
    </div>
  );
}
