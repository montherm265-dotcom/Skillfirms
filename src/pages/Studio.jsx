import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { BookOpen, Building2, Clock, Link2, Pencil, Plus, Wallet } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { loadStudioCourses } from "@/lib/studio";
import { EXPERT_SHARE, UDEMY_SHARE, loadMyRefCode, loadTeamMinutes, parsePrice, setCoursePrice } from "@/lib/plans";
import Seo from "@/components/seo/Seo";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const STATE = {
  draft: ["Draft", "bg-secondary text-foreground"],
  submitted: ["Waiting for review", "bg-warning/20 text-foreground"],
  changes_requested: ["Changes requested", "bg-destructive/10 text-destructive"],
  approved: ["Live", "bg-mastery/15 text-mastery"],
};
const money = (c) => (c ? `$${(c / 100).toFixed(c % 100 ? 2 : 0)}` : "Free");

// The expert's course studio: their courses, status, sales and earnings.
export default function Studio() {
  const { expertId } = useAuth();
  const [courses, setCourses] = useState(null);
  const [error, setError] = useState(null);

  const [ref, setRef] = useState(null);
  const [teamMinutes, setTeamMinutes] = useState({});
  const reload = () => loadStudioCourses().then(setCourses).catch((e) => setError(e.message));
  useEffect(() => {
    if (!expertId) return;
    reload();
    loadMyRefCode().then(setRef);
    loadTeamMinutes().then(setTeamMinutes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expertId]);

  async function changePrice(c) {
    const text = window.prompt(`New price for "${c.title}" in USD (9 to 199). New buyers pay the new price.`, c.price_cents ? String(c.price_cents / 100) : "29");
    if (text == null) return;
    const cents = parsePrice(text);
    if (cents == null) { toast.error("Expert courses are paid: pick a price from $9 to $199."); return; }
    try { await setCoursePrice(c.id, cents); toast.success("Price updated"); reload(); } catch (e) { toast.error(e.message); }
  }

  function copyLink(c) {
    const url = `${window.location.origin}/courses/${c.slug}?ref=${ref}`;
    navigator.clipboard?.writeText(url).then(() => toast.success("Your link is copied. Sales through it pay you 97%."), () => window.prompt("Your link:", url));
  }

  if (!expertId) {
    return (
      <div className="section-pad text-center">
        <p className="font-display text-2xl font-semibold">Teach on Skillfirms</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">Approved experts build their own courses, with video, set their own price, and keep 70% of every sale (97% through their own link). Apply first; we check every application by hand.</p>
        <Link to="/experts"><Button className="mt-4">Apply to become an expert</Button></Link>
      </div>
    );
  }

  const earned = (courses ?? []).reduce((n, c) => n + Number(c.earned_cents ?? 0), 0);
  return (
    <div className="section-pad">
      <Seo title="Teach" canonical="/teach" />
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Course studio</p>
            <h1 className="mt-1 font-display text-3xl font-semibold">Your courses</h1>
            <p className="mt-1 text-sm text-muted-foreground">You set the price and can change it any time. Every course is checked by Skillfirms before it goes live.</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right"><p className="flex items-center gap-1 text-xs text-muted-foreground"><Wallet className="h-3.5 w-3.5" />Earned</p><p className="font-display text-2xl font-semibold">{money(earned) === "Free" ? "$0" : money(earned)}</p></div>
            <Link to="/teach/new"><Button><Plus className="h-4 w-4" />New course</Button></Link>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {[
            ["Skillfirms finds the learner", EXPERT_SHARE.marketplace, UDEMY_SHARE.marketplace, "of each sale"],
            ["Through your own link", EXPERT_SHARE.expert_link, UDEMY_SHARE.expert_link, "of each sale (3% covers card fees)"],
            ["Company team training", EXPERT_SHARE.team_pool, UDEMY_SHARE.team_pool, "of team money, shared by learning minutes"],
          ].map(([label, ours, udemy, note], i) => (
            <motion.div key={label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} className="rounded-2xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 font-display text-3xl font-semibold text-mastery">{ours}%</p>
              <p className="text-xs text-muted-foreground">you keep {note}. Udemy: {udemy}%</p>
            </motion.div>
          ))}
        </div>

        {error && <p className="mt-6 text-sm text-destructive">{error}</p>}
        {!courses ? <Skeleton className="mt-6 h-40 w-full" /> : courses.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-border p-10 text-center">
            <BookOpen className="mx-auto h-7 w-7 text-mastery" />
            <p className="mt-2 font-display text-xl font-semibold">Build your first course</p>
            <p className="mt-1 text-sm text-muted-foreground">Lessons with video or text, and a short graded check on each. Learners who pass get a certificate that counts as verified proof on Talfirms.</p>
            <Link to="/teach/new"><Button className="mt-4"><Plus className="h-4 w-4" />Start a course</Button></Link>
          </div>
        ) : (
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {courses.map((c, i) => {
              const [label, cls] = STATE[c.review_state ?? "draft"] ?? STATE.draft;
              return (
                <motion.li key={c.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  className="rounded-2xl border border-border bg-card p-5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-display text-lg font-semibold">{c.title}</p>
                    <span className={`flex-none rounded-md px-2 py-0.5 text-xs font-semibold ${cls}`}>{label}</span>
                  </div>
                  <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{c.lessons} lessons</span>
                    <span>{money(c.price_cents)}</span>
                    {c.status === "published" && <span>{c.learners} learners · {c.sales} sales</span>}
                    {teamMinutes?.[c.id] ? <span className="inline-flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{teamMinutes[c.id]} team minutes this month</span> : null}
                  </p>
                  {c.review_state === "changes_requested" && c.review_note && <p className="mt-2 rounded-lg bg-destructive/10 p-2 text-xs">{c.review_note}</p>}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {c.status === "published"
                      ? <Link to={`/courses/${c.slug}`}><Button size="sm" variant="outline">View live course</Button></Link>
                      : <Link to={`/teach/${c.id}`}><Button size="sm"><Pencil className="h-4 w-4" />Edit</Button></Link>}
                    <Button size="sm" variant="outline" onClick={() => changePrice(c)}>Change price</Button>
                    {c.status === "published" && ref && Number(c.price_cents) > 0 && <Button size="sm" variant="outline" onClick={() => copyLink(c)}><Link2 className="h-4 w-4" />Copy my 97% link</Button>}
                  </div>
                </motion.li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
