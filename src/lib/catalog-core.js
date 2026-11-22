// The pure parts of the course catalog, shared by the app (lib/catalog.js,
// CourseCover) and the Courses page's built-in instant list
// (scripts/shell-courses.src.js), so the two always agree.

// Course categories. Known courses are mapped by slug; new ones fall back
// to keywords in the title so they still land somewhere sensible.
export const CATEGORIES = [
  { id: "pharma", label: "Pharma & Validation", icon: "FlaskConical", hue: 200, blurb: "GMP, CQV, URS, change control, cleanrooms" },
  { id: "engineering", label: "Engineering", icon: "Cog", hue: 222, blurb: "Mechanical principles, Python, documentation" },
  { id: "projects", label: "Project Management", icon: "KanbanSquare", hue: 240, blurb: "Scope, schedule, budget, stakeholders, Agile" },
  { id: "data", label: "Data & Analytics", icon: "BarChart3", hue: 212, blurb: "SQL, statistics, Python, visual storytelling" },
  { id: "ai", label: "AI & Software", icon: "BrainCircuit", hue: 232, blurb: "Machine learning, deep learning, MLOps, algorithms" },
  { id: "product", label: "Product", icon: "Compass", hue: 192, blurb: "Strategy, user research, roadmaps" },
];

const BY_SLUG = {
  "gmp-fundamentals-for-validation": "pharma",
  "cqv-bootcamp": "pharma",
  "design-qualification-and-urs": "pharma",
  "risk-based-change-and-deviations": "pharma",
  "facilities-systems-hvac-cleanroom": "pharma",
  "technical-documentation-for-engineers": "engineering",
  "mechanical-engineering-refresher": "engineering",
  "python-programming-for-engineers": "engineering",
  "project-fundamentals-for-engineers": "projects",
  "stakeholder-and-schedule-management": "projects",
  "budget-management-for-leaders": "projects",
  "agile-methodology-in-practice": "projects",
  "sql-for-analysts": "data",
  "statistics-for-decisions": "data",
  "data-visualization-storytelling": "data",
  "python-for-data-analysis": "data",
  "machine-learning-foundations": "ai",
  "deep-learning-in-practice": "ai",
  "mlops-shipping-ml-to-production": "ai",
  "data-structures-and-algorithms": "ai",
  "product-strategy-essentials": "product",
  "user-research-methods": "product",
  "roadmapping-for-product-teams": "product",
};

const KEYWORDS = [
  ["pharma", /gmp|validation|cqv|qualification|cleanroom|deviation|pharma/i],
  ["ai", /machine learning|deep learning|mlops|\bai\b|algorithm/i],
  ["data", /data|sql|statistic|analytics/i],
  ["projects", /project|agile|scrum|budget|stakeholder|schedule/i],
  ["product", /product|roadmap|user research/i],
];

export function categoryOf(course) {
  const id = BY_SLUG[course?.slug] ?? KEYWORDS.find(([, re]) => re.test(course?.title ?? ""))?.[0] ?? "engineering";
  return CATEGORIES.find((c) => c.id === id);
}

export const LEVELS = ["beginner", "intermediate", "advanced"];

// The columns the catalog needs (also fetched early by boot.js).
export const CATALOG_SELECT = "id, slug, title, description, level, duration_hours, rating_avg, rating_count, enrollment_count, created_at, price_cents, taught_by, skillfirms_experts(display_name, headline, profile_id), skillfirms_course_modules(id, duration_minutes), skillfirms_course_skills(coverage, skillfirms_skills(slug, name))";

export function shapeCourse(c) {
  const modules = c.skillfirms_course_modules ?? [];
  const skills = [...(c.skillfirms_course_skills ?? [])]
    .filter((s) => s.skillfirms_skills)
    .sort((a, b) => (b.coverage ?? 0) - (a.coverage ?? 0))
    .map((s) => ({ ...s.skillfirms_skills, coverage: s.coverage }));
  const out = {
    ...c,
    category: categoryOf(c),
    lessons: modules.length,
    minutes: modules.reduce((n, m) => n + (m.duration_minutes ?? 0), 0),
    skills,
  };
  out.total_minutes = totalMinutes(out);
  return out;
}

// Who teaches it: a real, approved expert, or the AI basics.
export function teacherOf(course) {
  if (course?.taught_by === "expert" && course.skillfirms_experts?.profile_id) {
    return { kind: "expert", name: course.skillfirms_experts.display_name, headline: course.skillfirms_experts.headline };
  }
  return { kind: "ai", name: "AI-taught basics" };
}

export const priceLabel = (cents) => (cents ? `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}` : "Free");

// Real time to finish: each lesson's reading time plus its 10–15 minute
// exercise. (The old duration_hours figures were estimates, not this.)
export const EXERCISE_MINUTES = 15;
export function totalMinutes(course) {
  return (course?.minutes ?? 0) + (course?.lessons ?? 0) * EXERCISE_MINUTES;
}
export function formatHours(course) {
  const m = totalMinutes(course);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} hr ${rest} min` : `${h} hr`;
}

// "Best match" with no search: courses from real experts first, otherwise
// as the database returned them (a stable sort).
export const sortBest = (courses) => [...courses].sort((a, b) => Number(teacherOf(b).kind === "expert") - Number(teacherOf(a).kind === "expert"));

// A cover drawn from the course itself: its category colour and a pattern
// seeded by its slug (so every course looks different).
function seed(str) {
  let h = 2166136261;
  for (const ch of String(str)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 1000) / 1000; };
}
export function coverArt(course) {
  const hue = course.category?.hue ?? 210;
  const rnd = seed(course.slug);
  const shift = Math.round(rnd() * 16) - 8;
  const shapes = Array.from({ length: 6 }, (_, i) => ({
    cx: Math.round(rnd() * 320), cy: Math.round(rnd() * 180), r: 18 + Math.round(rnd() * 70), o: 0.08 + rnd() * 0.14, i,
  }));
  const lines = Array.from({ length: 5 }, () => Math.round(rnd() * 180));
  return { background: `linear-gradient(135deg, hsl(${hue + shift} 75% 12%), hsl(${hue - shift} 62% 30%) 58%, hsl(${hue + 6} 78% 58%))`, shapes, lines };
}
