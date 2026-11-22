import { coverArt } from "@/lib/catalog-core";
import { BarChart3, BrainCircuit, Cog, Compass, FlaskConical, KanbanSquare } from "lucide-react";

const ICONS = { FlaskConical, Cog, KanbanSquare, BarChart3, BrainCircuit, Compass };

// A cover drawn from the course itself (coverArt, lib/catalog-core.js): its
// category colour, a pattern seeded by its slug, and its icon.
export default function CourseCover({ course, className = "", size = "md" }) {
  const cat = course.category;
  const Icon = ICONS[cat?.icon] ?? Cog;
  const { background, shapes, lines } = coverArt(course);
  return (
    <div className={`relative overflow-hidden ${className}`} style={{ background }}>
      <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" aria-hidden="true">
        {shapes.map((s) => <circle key={s.i} cx={s.cx} cy={s.cy} r={s.r} fill="white" opacity={s.o} />)}
        {lines.map((y, i) => <line key={i} x1="0" x2="320" y1={y} y2={y + 40 - i * 20} stroke="white" strokeOpacity="0.08" strokeWidth="1" />)}
      </svg>
      <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
      <Icon className={`absolute text-white/90 drop-shadow ${size === "lg" ? "bottom-5 right-5 h-14 w-14" : size === "sm" ? "left-1/2 top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2" : "bottom-3 right-3 h-9 w-9"}`} strokeWidth={1.5} />
      {size !== "sm" && <span className={`absolute left-3 top-3 rounded-full bg-black/25 px-2 py-0.5 font-medium text-white backdrop-blur ${size === "lg" ? "text-xs" : "text-[10px]"}`}>{cat?.label}</span>}
    </div>
  );
}
