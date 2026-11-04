// Matches a skill name coming from Talfirms (its own capability labels)
// to the closest Skillfirms skill, so "GMP" finds "Good Manufacturing
// Practice (GMP)" and "HVAC" finds "HVAC Systems". Returns null when
// nothing is a confident match -- better to say "no course yet" than to
// send someone to the wrong course.
const STOP = new Set(["and", "for", "the", "with", "skills", "skill", "basics", "fundamentals", "management", "systems", "knowledge"]);

const norm = (s) => (s ?? "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9+#]+/g, " ").trim();

function variants(name) {
  const out = new Set([norm(name)]);
  const inParens = name.match(/\(([^)]+)\)/);
  if (inParens) {
    out.add(norm(inParens[1]));
    out.add(norm(name.replace(/\([^)]*\)/g, "")));
  }
  return [...out].filter(Boolean);
}

const tokens = (s) => norm(s).split(" ").filter((t) => t.length >= 3 && !STOP.has(t));

export function matchSkill(label, skills) {
  const wanted = variants(label);
  let best = null;
  let bestScore = 0;
  for (const skill of skills) {
    const names = variants(skill.name);
    let score = 0;
    if (names.some((n) => wanted.includes(n))) score = 100;
    else if (names.some((n) => wanted.some((w) => (w.length >= 3 && n.includes(w)) || (n.length >= 3 && w.includes(n))))) score = 50;
    else {
      // Shared words, with the label's first word (its subject: "HVAC" in
      // "HVAC Design") counting extra, so "HVAC Design" finds HVAC Systems
      // rather than Design Qualification.
      const a = new Set(wanted.flatMap(tokens));
      const subject = tokens(label)[0];
      const shared = new Set(names.flatMap(tokens).filter((t) => a.has(t)));
      if (shared.size > 0) score = shared.size * 10 + (subject && shared.has(subject) ? 5 : 0);
    }
    if (score > bestScore) { best = skill; bestScore = score; }
  }
  return bestScore >= 10 ? best : null;
}
