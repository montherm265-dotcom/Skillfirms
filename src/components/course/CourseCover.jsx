import { BarChart3, BrainCircuit, Cog, Compass, FlaskConical, KanbanSquare } from "lucide-react";

const ICONS = { FlaskConical, Cog, KanbanSquare, BarChart3, BrainCircuit, Compass };

// A cover drawn from the course itself: its category colour, a pattern
// seeded by its slug (so every course looks different), and its icon.
function seed(str) {
  let h = 2166136261;
  for (const ch of String(str)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 1000) / 1000; };
}

export default function CourseCover({ course, className = "", size = "md" }) {
  const cat = course.category;
  const hue = cat?.hue ?? 210;
  const Icon = ICONS[cat?.icon] ?? Cog;
  const rnd = seed(course.slug);
  const shift = Math.round(rnd() * 40) - 20;
  const shapes = Array.from({ length: 6 }, (_, i) => ({
    cx: Math.round(rnd() * 320), cy: Math.round(rnd() * 180), r: 18 + Math.round(rnd() * 70), o: 0.08 + rnd() * 0.14, i,
  }));
  const lines = Array.from({ length: 5 }, () => Math.round(rnd() * 180));
  return (
    <div className={`relative overflow-hidden ${className}`} style={{ background: `linear-gradient(135deg, hsl(${hue + shift} 70% 22%), hsl(${hue - shift} 75% 38%) 60%, hsl(${hue + 30} 80% 55%))` }}>
      <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" aria-hidden="true">
        {shapes.map((s) => <circle key={s.i} cx={s.cx} cy={s.cy} r={s.r} fill="white" opacity={s.o} />)}
        {lines.map((y, i) => <line key={i} x1="0" x2="320" y1={y} y2={y + 40 - i * 20} stroke="white" strokeOpacity="0.08" strokeWidth="1" />)}
      </svg>
      <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
      <Icon className={`absolute text-white/90 drop-shadow ${size === "lg" ? "bottom-5 right-5 h-14 w-14" : "bottom-3 right-3 h-9 w-9"}`} strokeWidth={1.5} />
      <span className={`absolute left-3 top-3 rounded-full bg-black/25 px-2 py-0.5 font-medium text-white backdrop-blur ${size === "lg" ? "text-xs" : "text-[10px]"}`}>{cat?.label}</span>
    </div>
  );
}
