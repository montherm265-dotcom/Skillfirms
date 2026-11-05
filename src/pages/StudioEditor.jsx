import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, CheckCircle2, Circle, Film, Plus, Send, Trash2, Upload } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { loadStudioCourse, saveStudioCourse, submitStudioCourse, uploadCourseVideo, videoEmbed } from "@/lib/studio";
import { setCheckMinutes } from "@/lib/plans";
import VideoPlayer from "@/components/course/VideoPlayer";
import Seo from "@/components/seo/Seo";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

const blankQuestion = () => ({ question: "", choices: ["", "", "", ""], answer_index: 0 });
const blankLesson = () => ({ title: "", duration_minutes: 15, video_url: "", summary: "", sections: [{ heading: "", body: "" }], key_points: [""], questions: [blankQuestion(), blankQuestion(), blankQuestion()] });
const input = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/20";

// Build or edit an expert course: details, skills, price, lessons (video,
// text, key points, graded questions). Save as a draft; send for review.
export default function StudioEditor() {
  const { id } = useParams();
  const isNew = id === "new";
  const { user } = useAuth();
  const navigate = useNavigate();
  const [course, setCourse] = useState(isNew ? { title: "", description: "", level: "beginner", price_cents: 0, skill_ids: [], lessons: [blankLesson()] } : null);
  const [skills, setSkills] = useState([]);
  const [open, setOpen] = useState(0);
  const [busy, setBusy] = useState(null);
  const [skillFilter, setSkillFilter] = useState("");
  const [checkMinutes, setCheckMinutesState] = useState("");

  useEffect(() => {
    supabase.from("skillfirms_skills").select("id, name").order("name").then(({ data }) => setSkills(data ?? []));
    if (!isNew) loadStudioCourse(id).then((c) => setCourse({ ...c, lessons: c.lessons.length ? c.lessons.map((l) => ({ ...l, video_url: l.video_url ?? "", key_points: l.key_points.length ? l.key_points : [""], sections: l.sections.length ? l.sections : [{ heading: "", body: "" }] })) : [blankLesson()] })).catch((e) => { toast.error(e.message); navigate("/teach"); });
    if (!isNew) supabase.from("skillfirms_courses").select("check_minutes").eq("id", id).maybeSingle()
      .then(({ data, error }) => { if (!error) setCheckMinutesState(data?.check_minutes ? String(data.check_minutes) : ""); });
  }, [id, isNew, navigate]);

  const set = (patch) => setCourse((c) => ({ ...c, ...patch }));
  const setLesson = (i, patch) => setCourse((c) => ({ ...c, lessons: c.lessons.map((l, j) => (j === i ? { ...l, ...patch } : l)) }));
  const shownSkills = useMemo(() => skills.filter((s) => s.name.toLowerCase().includes(skillFilter.toLowerCase())), [skills, skillFilter]);

  const readiness = useMemo(() => {
    if (!course) return [];
    const ls = course.lessons;
    return [
      ["A title", course.title.trim().length >= 5],
      ["At least 2 lessons", ls.length >= 2],
      ["Skills this course teaches", course.skill_ids.length > 0],
      ["A video or 300+ characters in every lesson", ls.every((l) => l.video_url.trim() || l.sections.map((s) => s.body).join(" ").length >= 300)],
      ["3+ graded questions in every lesson", ls.every((l) => l.questions.filter((q) => q.question.trim() && q.choices.filter((c) => c.trim()).length >= 2).length >= 3)],
    ];
  }, [course]);

  function payload() {
    return {
      ...course,
      price_cents: Number(course.price_cents) || 0,
      lessons: course.lessons.map((l) => ({
        ...l,
        key_points: l.key_points.filter((k) => k.trim()),
        sections: l.sections.filter((s) => s.body.trim()),
        questions: l.questions.filter((q) => q.question.trim()).map((q) => {
          const kept = q.choices.map((c, i) => ({ c: c.trim(), i })).filter((x) => x.c);
          return { question: q.question, choices: kept.map((x) => x.c), answer_index: Math.max(0, kept.findIndex((x) => x.i === q.answer_index)) };
        }),
      })),
    };
  }

  async function save(thenSubmit = false) {
    setBusy(thenSubmit ? "submit" : "save");
    try {
      const newId = await saveStudioCourse(isNew ? null : id, payload());
      await setCheckMinutes(newId, Number(checkMinutes) || null);
      if (thenSubmit) { await submitStudioCourse(newId); toast.success("Sent for review. We'll check it soon."); navigate("/teach"); return; }
      toast.success("Saved");
      if (isNew) navigate(`/teach/${newId}`, { replace: true });
    } catch (e) { toast.error(e.message); } finally { setBusy(null); }
  }

  async function upload(i, file) {
    if (!file) return;
    setBusy(`up${i}`);
    try { setLesson(i, { video_url: await uploadCourseVideo(user.id, file) }); toast.success("Video uploaded"); }
    catch (e) { toast.error(e.message); } finally { setBusy(null); }
  }

  if (!course) return <div className="section-pad"><div className="mx-auto max-w-4xl space-y-3"><Skeleton className="h-10 w-1/2" /><Skeleton className="h-64 w-full" /></div></div>;
  const allReady = readiness.every(([, ok]) => ok);

  return (
    <div className="section-pad">
      <Seo title={course.title || "New course"} canonical="/teach" />
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0 space-y-6">
          <Link to="/teach" className="text-sm text-muted-foreground hover:text-foreground">← Your courses</Link>
          {course.review_state === "changes_requested" && course.review_note && <p className="rounded-xl bg-destructive/10 p-3 text-sm"><b>Changes requested:</b> {course.review_note}</p>}

          <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
            <input value={course.title} onChange={(e) => set({ title: e.target.value })} maxLength={120} placeholder="Course title" aria-label="Course title" className="w-full bg-transparent font-display text-3xl font-semibold outline-none placeholder:text-muted-foreground/50" />
            <Textarea value={course.description ?? ""} onChange={(e) => set({ description: e.target.value })} maxLength={4000} placeholder="What will people be able to do after this course? Who is it for?" className="min-h-24" />
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium">Level
                <select value={course.level} onChange={(e) => set({ level: e.target.value })} className={`mt-1 ${input}`}>
                  <option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option>
                </select>
              </label>
              <label className="text-sm font-medium">Price (USD)
                <select value={course.price_cents} onChange={(e) => set({ price_cents: Number(e.target.value) })} className={`mt-1 ${input}`}>
                  <option value={0}>Free</option>
                  {[900, 1900, 2900, 4900, 7900, 9900, 14900, 19900].map((c) => <option key={c} value={c}>${c / 100} · you earn ${(c / 200).toFixed(2).replace(/\.00$/, "")}</option>)}
                </select>
              </label>
              <label className="text-sm font-medium sm:col-span-2">Time limit for each lesson's check
                <select value={checkMinutes} onChange={(e) => setCheckMinutesState(e.target.value)} className={`mt-1 ${input}`}>
                  <option value="">No time limit</option>
                  {[2, 3, 5, 10, 15, 20, 30, 45, 60, 90, 120].map((m) => <option key={m} value={m}>{m} minutes</option>)}
                </select>
                <span className="mt-1 block text-xs font-normal text-muted-foreground">With a limit, the questions only appear when the learner presses Start, and answers after the time runs out don't count.</span>
              </label>
            </div>
            <div>
              <p className="text-sm font-medium">Skills it teaches <span className="font-normal text-muted-foreground">({course.skill_ids.length}/6)</span></p>
              <input value={skillFilter} onChange={(e) => setSkillFilter(e.target.value)} placeholder="Filter skills" className={`mt-1 ${input}`} />
              <div className="mt-2 flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
                {shownSkills.map((s) => {
                  const on = course.skill_ids.includes(s.id);
                  return <button key={s.id} type="button" aria-pressed={on} disabled={!on && course.skill_ids.length >= 6} onClick={() => set({ skill_ids: on ? course.skill_ids.filter((x) => x !== s.id) : [...course.skill_ids, s.id] })}
                    className={`rounded-full border px-2.5 py-1 text-xs ${on ? "border-mastery bg-mastery/10 font-semibold text-mastery" : "border-border disabled:opacity-40"}`}>{s.name}</button>;
                })}
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-2xl font-semibold">Lessons</h2>
            {course.lessons.map((l, i) => {
              const isOpen = open === i;
              const embed = l.video_url.trim() ? videoEmbed(l.video_url.trim()) : null;
              return (
                <div key={i} className="overflow-hidden rounded-2xl border border-border bg-card">
                  <div className="flex items-center gap-2 bg-secondary/40 px-4 py-3">
                    <button type="button" onClick={() => setOpen(isOpen ? -1 : i)} className="min-w-0 flex-1 truncate text-left font-semibold">{i + 1}. {l.title || "Untitled lesson"}{l.video_url && <Film className="ml-2 inline h-4 w-4 text-mastery" />}</button>
                    <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => setCourse((c) => { const ls = [...c.lessons]; [ls[i - 1], ls[i]] = [ls[i], ls[i - 1]]; return { ...c, lessons: ls }; })} className="p-1 text-muted-foreground disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                    <button type="button" aria-label="Move down" disabled={i === course.lessons.length - 1} onClick={() => setCourse((c) => { const ls = [...c.lessons]; [ls[i + 1], ls[i]] = [ls[i], ls[i + 1]]; return { ...c, lessons: ls }; })} className="p-1 text-muted-foreground disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                    <button type="button" aria-label="Remove lesson" disabled={course.lessons.length === 1} onClick={() => { if (window.confirm("Remove this lesson?")) setCourse((c) => ({ ...c, lessons: c.lessons.filter((_, j) => j !== i) })); }} className="p-1 text-muted-foreground hover:text-destructive disabled:opacity-30"><Trash2 className="h-4 w-4" /></button>
                  </div>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
                        <div className="space-y-4 p-4">
                          <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
                            <input value={l.title} onChange={(e) => setLesson(i, { title: e.target.value })} maxLength={200} placeholder="Lesson title" aria-label="Lesson title" className={input} />
                            <input type="number" min={1} max={240} value={l.duration_minutes} onChange={(e) => setLesson(i, { duration_minutes: Number(e.target.value) })} aria-label="Minutes" className={input} />
                          </div>
                          <div className="rounded-xl border border-dashed border-border p-3">
                            <p className="flex items-center gap-1.5 text-sm font-medium"><Film className="h-4 w-4 text-mastery" />Video <span className="font-normal text-muted-foreground">(optional)</span></p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <input value={l.video_url} onChange={(e) => setLesson(i, { video_url: e.target.value })} placeholder="Paste a YouTube, Vimeo or Loom link" className={`${input} min-w-0 flex-1`} />
                              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm hover:bg-secondary">
                                <Upload className="h-4 w-4" />{busy === `up${i}` ? "Uploading…" : "Upload (≤50 MB)"}
                                <input type="file" accept="video/mp4,video/webm,video/quicktime" className="hidden" onChange={(e) => upload(i, e.target.files?.[0])} />
                              </label>
                            </div>
                            {l.video_url.trim() && !embed && <p className="mt-1 text-xs text-destructive">That link can't be played. Use YouTube, Vimeo, Loom or an upload.</p>}
                            {embed && <div className="mt-3"><VideoPlayer url={l.video_url.trim()} title={l.title} /></div>}
                          </div>
                          <Textarea value={l.summary} onChange={(e) => setLesson(i, { summary: e.target.value })} maxLength={500} placeholder="One or two sentences: what this lesson teaches" className="min-h-16" />
                          {l.sections.map((s, k) => (
                            <div key={k} className="space-y-2 rounded-xl bg-secondary/40 p-3">
                              <input value={s.heading} onChange={(e) => setLesson(i, { sections: l.sections.map((x, m) => (m === k ? { ...x, heading: e.target.value } : x)) })} placeholder="Section heading" className={input} />
                              <Textarea value={s.body} onChange={(e) => setLesson(i, { sections: l.sections.map((x, m) => (m === k ? { ...x, body: e.target.value } : x)) })} placeholder={"Teach it. Blank line = new paragraph; lines starting with \"- \" become bullets."} className="min-h-32" />
                            </div>
                          ))}
                          <button type="button" onClick={() => setLesson(i, { sections: [...l.sections, { heading: "", body: "" }] })} className="text-sm font-medium text-mastery hover:underline">+ Add a section</button>
                          <div>
                            <p className="text-sm font-medium">Key points</p>
                            {l.key_points.map((kp, k) => <input key={k} value={kp} onChange={(e) => setLesson(i, { key_points: l.key_points.map((x, m) => (m === k ? e.target.value : x)) })} placeholder={`Key point ${k + 1}`} className={`mt-1 ${input}`} />)}
                            {l.key_points.length < 6 && <button type="button" onClick={() => setLesson(i, { key_points: [...l.key_points, ""] })} className="mt-1 text-sm font-medium text-mastery hover:underline">+ Add a key point</button>}
                          </div>
                          <div>
                            <p className="text-sm font-medium">Graded questions <span className="font-normal text-muted-foreground">(3-5; tap the circle to mark the right answer)</span></p>
                            {l.questions.map((q, k) => (
                              <div key={k} className="mt-2 space-y-2 rounded-xl border border-border p-3">
                                <div className="flex gap-2">
                                  <input value={q.question} onChange={(e) => setLesson(i, { questions: l.questions.map((x, m) => (m === k ? { ...x, question: e.target.value } : x)) })} placeholder={`Question ${k + 1}`} className={`${input} flex-1`} />
                                  {l.questions.length > 3 && <button type="button" aria-label="Remove question" onClick={() => setLesson(i, { questions: l.questions.filter((_, m) => m !== k) })} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>}
                                </div>
                                {q.choices.map((c, n) => (
                                  <div key={n} className="flex items-center gap-2">
                                    <button type="button" aria-label={`Mark choice ${n + 1} as right`} onClick={() => setLesson(i, { questions: l.questions.map((x, m) => (m === k ? { ...x, answer_index: n } : x)) })}>
                                      {q.answer_index === n ? <CheckCircle2 className="h-5 w-5 text-mastery" /> : <Circle className="h-5 w-5 text-muted-foreground" />}
                                    </button>
                                    <input value={c} onChange={(e) => setLesson(i, { questions: l.questions.map((x, m) => (m === k ? { ...x, choices: x.choices.map((y, z) => (z === n ? e.target.value : y)) } : x)) })} placeholder={`Choice ${n + 1}`} className={`${input} flex-1`} />
                                  </div>
                                ))}
                              </div>
                            ))}
                            {l.questions.length < 5 && <button type="button" onClick={() => setLesson(i, { questions: [...l.questions, blankQuestion()] })} className="mt-2 text-sm font-medium text-mastery hover:underline">+ Add a question</button>}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
            {course.lessons.length < 40 && <Button variant="outline" onClick={() => { setCourse((c) => ({ ...c, lessons: [...c.lessons, blankLesson()] })); setOpen(course.lessons.length); }}><Plus className="h-4 w-4" />Add a lesson</Button>}
          </section>
        </div>

        <aside>
          <div className="space-y-3 rounded-2xl border border-border bg-card p-5 lg:sticky lg:top-20">
            <p className="font-semibold">Ready for review?</p>
            <ul className="space-y-1.5 text-sm">
              {readiness.map(([label, ok]) => <li key={label} className="flex items-start gap-2">{ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-mastery" /> : <Circle className="mt-0.5 h-4 w-4 flex-none text-muted-foreground" />}<span className={ok ? "" : "text-muted-foreground"}>{label}</span></li>)}
            </ul>
            <Button variant="outline" className="w-full" onClick={() => save(false)} disabled={!!busy}>{busy === "save" ? "Saving…" : "Save draft"}</Button>
            <Button className="w-full" onClick={() => save(true)} disabled={!!busy || !allReady}><Send className="h-4 w-4" />{busy === "submit" ? "Sending…" : "Send for review"}</Button>
            <p className="text-xs text-muted-foreground">Skillfirms checks every course before it goes live. Once live, learners who pass every check earn a certificate that counts as verified proof on Talfirms. You earn 50% of every sale.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
