import { Star } from "lucide-react";

export default function Stars({ value = 0, size = "h-3.5 w-3.5", onPick, className = "" }) {
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`} role={onPick ? "radiogroup" : "img"} aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = Math.max(0, Math.min(1, value - (i - 1)));
        const star = (
          <span className="relative inline-block">
            <Star className={`${size} text-warning/30`} fill="currentColor" strokeWidth={0} />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star className={`${size} text-warning`} fill="currentColor" strokeWidth={0} />
            </span>
          </span>
        );
        return onPick ? (
          <button key={i} type="button" role="radio" aria-checked={Math.round(value) === i} aria-label={`${i} star${i > 1 ? "s" : ""}`} onClick={() => onPick(i)} className="transition-transform hover:scale-110">{star}</button>
        ) : <span key={i}>{star}</span>;
      })}
    </span>
  );
}

// Real ratings only. A course nobody has rated yet says so.
export function RatingLine({ course, className = "" }) {
  if (!course.rating_count) return <span className={`text-xs font-medium text-mastery ${className}`}>New</span>;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs ${className}`}>
      <span className="font-bold text-warning">{Number(course.rating_avg).toFixed(1)}</span>
      <Stars value={Number(course.rating_avg)} />
      <span className="text-muted-foreground">({course.rating_count})</span>
    </span>
  );
}
