import { describe, expect, it } from "vitest";
import { categoryOf, formatHours, searchCourses, shapeCourse } from "./catalog";

const make = (slug, title, skills = []) => shapeCourse({
  slug, title, description: "", level: "beginner", duration_hours: 6,
  skillfirms_course_modules: [{ id: 1, duration_minutes: 30 }, { id: 2, duration_minutes: 45 }],
  skillfirms_course_skills: skills.map((name, i) => ({ coverage: 1 - i / 10, skillfirms_skills: { slug: name, name } })),
});

describe("catalog", () => {
  it("puts courses in a category, known or new", () => {
    expect(categoryOf({ slug: "cqv-bootcamp" }).id).toBe("pharma");
    expect(categoryOf({ slug: "new-one", title: "Intro to SQL dashboards" }).id).toBe("data");
    expect(categoryOf({ slug: "x", title: "Welding" }).id).toBe("engineering");
  });
  it("counts lessons and minutes", () => {
    const c = make("sql-for-analysts", "SQL for Analysts");
    expect(c.lessons).toBe(2);
    expect(c.minutes).toBe(75);
    expect(formatHours(c)).toBe("1 hr 45 min"); // 75 min reading + 2 × 15 min exercises
  });
  it("searches titles first, then skills, needing every word", () => {
    const a = make("a", "SQL for Analysts", ["Joins"]);
    const b = make("b", "Data Storytelling", ["SQL reporting"]);
    expect(searchCourses([b, a], "sql").map((c) => c.slug)).toEqual(["a", "b"]);
    expect(searchCourses([a, b], "sql joins").map((c) => c.slug)).toEqual(["a"]);
    expect(searchCourses([a, b], "")).toHaveLength(2);
  });
});
