import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Award, BadgeCheck, Clock, Hourglass, ShieldCheck, UserCheck } from "lucide-react";
import { loadReviewOffer, requestExpertReview } from "@/lib/missions";
import { Button } from "@/components/ui/button";

const money = (c) => `$${(c / 100).toFixed(c % 100 ? 2 : 0)}`;

// Expert review of a mission submission: what it costs, who can do it, and
// where the learner's order stands. Honest about when it isn't open yet.
export default function ExpertReviewCard({ mission, submission, onChange }) {
  const [offer, setOffer] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { loadReviewOffer(mission.id).then(setOffer); }, [mission.id, submission?.id, submission?.status]);
  if (!offer) return null;

  const order = offer.order && offer.order.submission_id === submission?.id ? offer.order : null;

  async function request() {
    setBusy(true);
    try {
      const o = await requestExpertReview(submission.id);
      toast.success(o.status === "waitlist" ? "You're on the list. Nothing is charged." : "Requested.");
      setOffer(await loadReviewOffer(mission.id));
      onChange?.();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  const status = order?.status;
  const box = "flex items-center gap-2 rounded-xl bg-secondary px-3 py-2 text-sm";
  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-mastery/30 bg-gradient-to-br from-mastery/10 via-card to-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-mastery"><UserCheck className="h-4 w-4" />Expert review</p>
          <p className="mt-1 font-display text-xl font-semibold">Get this checked by a real expert</p>
        </div>
        <p className="font-display text-2xl font-semibold">{money(offer.price_cents)}</p>
      </div>
      <ul className="mt-3 grid gap-1.5 text-sm sm:grid-cols-2">
        <li className="flex gap-2"><BadgeCheck className="mt-0.5 h-4 w-4 flex-none text-mastery" /><span>A score for each skill, plus written feedback</span></li>
        <li className="flex gap-2"><Award className="mt-0.5 h-4 w-4 flex-none text-mastery" /><span>Pass, and you earn an "Expert verified" certificate</span></li>
        <li className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 flex-none text-mastery" /><span>Shows as verified skill proof on Talfirms</span></li>
        <li className="flex gap-2"><Clock className="mt-0.5 h-4 w-4 flex-none text-mastery" /><span>Reviewed within 7 days, or you get your money back</span></li>
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">
        Reviews are blind: the expert sees your work, not your name.{" "}
        {offer.experts > 0 ? `${offer.experts} expert${offer.experts === 1 ? "" : "s"} can review this mission.` : "We're bringing on experts for this mission now."}
      </p>

      <div className="mt-4">
        {!submission ? (
          <p className="text-sm text-muted-foreground">Submit your work below first.</p>
        ) : status === "waitlist" ? (
          <p className={box}><Hourglass className="h-4 w-4 flex-none" /><span>You're on the list for an expert review. Nothing has been charged. We'll let you know when reviews open.</span></p>
        ) : status === "awaiting_payment" ? (
          <p className={box}><Hourglass className="h-4 w-4 flex-none" /><span>Ready for payment. Paying opens here soon.</span></p>
        ) : status === "paid" ? (
          <p className={box}><Hourglass className="h-4 w-4 flex-none" /><span>Paid. Waiting for an expert to pick it up.</span></p>
        ) : status === "claimed" ? (
          <p className={box}><UserCheck className="h-4 w-4 flex-none" /><span>An expert is reviewing it now{order.due_at ? `, due by ${new Date(order.due_at).toLocaleDateString()}` : ""}.</span></p>
        ) : status === "reviewed" ? (
          <p className="flex items-center gap-2 rounded-xl bg-mastery/10 px-3 py-2 text-sm font-medium text-mastery"><BadgeCheck className="h-4 w-4 flex-none" /><span>Reviewed. The expert's feedback is above.</span></p>
        ) : status === "refund_due" ? (
          <p className={box}><span>No expert reviewed this within 7 days, so you'll get your money back.</span></p>
        ) : (
          <Button onClick={request} disabled={busy}>
            <UserCheck className="h-4 w-4" />{busy ? "Sending…" : offer.open ? `Request expert review · ${money(offer.price_cents)}` : "Join the list (no charge)"}
          </Button>
        )}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">Know this field well? <Link to="/experts" className="font-medium text-foreground hover:underline">Become a Skillfirms expert</Link> and earn 60% of every review.</p>
    </section>
  );
}
