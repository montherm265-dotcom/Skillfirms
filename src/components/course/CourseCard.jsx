import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Bookmark, BookmarkCheck, CheckCircle2, Clock, ListChecks, Users } from "lucide-react";
import CourseCover from "@/components/course/CourseCover";
import { RatingLine } from "@/components/course/Stars";
import { formatHours } from "@/lib/catalog";

export default function CourseCard({ course, saved, onToggleSave, progress, compact = false, hiring }) {
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-40px" }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="group relative h-full">
      <Link to={`/courses/${course.slug}`} className="hover-lift flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card">
        <div className="relative overflow-hidden">
          <CourseCover course={course} className="aspect-[16/9] w-full transition-transform duration-500 group-hover:scale-[1.03]" />
          {hiring?.length > 0 && <span className="absolute bottom-2 left-2 rounded-md bg-warning px-2 py-0.5 text-[11px] font-bold text-black shadow">Hiring: {hiring.slice(0, 2).join(", ")}</span>}
        </div>
        <div className="flex flex-1 flex-col p-4">
          <h3 className="line-clamp-2 font-display text-[17px] font-semibold leading-snug tracking-tight">{course.title}</h3>
          {!compact && course.skills.length > 0 && (
            <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{course.skills.slice(0, 3).map((s) => s.name).join(" · ")}</p>
          )}
          <div className="mt-2"><RatingLine course={course} /></div>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{formatHours(course)}</span>
            <span className="inline-flex items-center gap-1"><ListChecks className="h-3.5 w-3.5" />{course.lessons} graded lessons</span>
            {course.enrollment_count > 0 && <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{course.enrollment_count.toLocaleString()}</span>}
          </p>
          <div className="mt-auto flex items-center justify-between gap-2 pt-3">
            <span className="rounded-md bg-secondary px-2 py-0.5 text-[11px] font-medium capitalize">{course.level ?? "All levels"}</span>
            {progress != null ? (
              <span className="text-[11px] font-semibold text-mastery">{progress >= 100 ? <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" />Completed</span> : `${Math.round(progress)}% done`}</span>
            ) : (
              <span className="text-[11px] font-semibold text-mastery">Free · Certificate</span>
            )}
          </div>
          {progress != null && progress < 100 && (
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-mastery" style={{ width: `${Math.max(3, progress)}%` }} /></div>
          )}
        </div>
      </Link>
      {onToggleSave && (
        <button type="button" onClick={(e) => { e.preventDefault(); onToggleSave(course); }}
          aria-label={saved ? "Remove from saved" : "Save for later"} aria-pressed={saved}
          className="absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur transition hover:bg-black/50">
          {saved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
        </button>
      )}
    </motion.div>
  );
}
