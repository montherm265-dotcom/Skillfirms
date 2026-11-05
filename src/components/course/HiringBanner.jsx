import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ArrowUpRight, Award, Briefcase, CheckCircle2, Lock, MapPin, Send } from "lucide-react";
import { sendCertificate } from "@/lib/catalog";
import { TALFIRMS_URL } from "@/lib/externalLinks";
import { crossAppClick } from "@/lib/crossApp";
import { Button } from "@/components/ui/button";

// Companies hiring through this course. Passing it unlocks a one-tap
// "send my certificate", which reaches them as an application marked
// "passed the course", shown first.
export default function HiringBanner({ hiring, user, hasCertificate, lessons, onSent }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(null);
  const [sent, setSent] = useState({});
  if (!hiring?.length) return null;

  async function send(h) {
    if (!user) { navigate(`/auth?next=${encodeURIComponent(window.location.pathname)}`); return; }
    setBusy(h.campaign_id);
    try {
      const res = await sendCertificate(h.campaign_id);
      setSent((s) => ({ ...s, [h.campaign_id]: res }));
      toast.success(`Sent to ${h.company}`);
      onSent?.();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section id="hiring" className="mt-8 overflow-hidden rounded-2xl border border-warning/40 bg-gradient-to-br from-warning/10 via-card to-card">
      <div className="p-5 sm:p-6">
        <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground"><Briefcase className="h-3.5 w-3.5 text-warning" />Sponsored · learn this, we're hiring</p>
        <ul className="mt-3 space-y-4">
          {hiring.map((h) => {
            const done = h.sent || sent[h.campaign_id];
            const jobPath = `/opportunities/${h.opportunity_id}`;
            return (
              <motion.li key={h.campaign_id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display text-xl font-semibold">{h.company} is hiring: {h.job_title}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
                      {h.city && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{h.city}</span>}
                      {h.remote_ok && <span>Remote possible</span>}
                      <a href={`${TALFIRMS_URL}${jobPath}`} onClick={crossAppClick(TALFIRMS_URL, jobPath)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 font-medium text-foreground hover:underline">See the job<ArrowUpRight className="h-3.5 w-3.5" /></a>
                    </p>
                    {h.headline && <p className="mt-1.5 text-sm">"{h.headline}"</p>}
                  </div>
                  <div className="flex-none">
                    {done ? (
                      <p className="flex items-center gap-1.5 rounded-xl bg-mastery/10 px-3 py-2 text-sm font-semibold text-mastery"><CheckCircle2 className="h-4 w-4" />Certificate sent</p>
                    ) : hasCertificate ? (
                      <Button onClick={() => send(h)} disabled={busy === h.campaign_id} className="bg-warning text-black hover:bg-warning/90"><Send className="h-4 w-4" />{busy === h.campaign_id ? "Sending…" : `Send my certificate to ${h.company}`}</Button>
                    ) : (
                      <p className="flex items-center gap-1.5 rounded-xl bg-secondary px-3 py-2 text-sm text-muted-foreground"><Lock className="h-4 w-4" />Pass all {lessons} lessons to send your certificate</p>
                    )}
                  </div>
                </div>
                {done && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    It reached them as an application marked "Passed the course", shown at the top of their list. Track it in <a href={`${TALFIRMS_URL}/introductions`} onClick={crossAppClick(TALFIRMS_URL, "/introductions")} target="_blank" rel="noreferrer" className="font-medium text-foreground hover:underline">My Applications on Talfirms</a>.
                    {sent[h.campaign_id]?.has_questions && <> They have a few questions for applicants: <a href={`${TALFIRMS_URL}${jobPath}`} onClick={crossAppClick(TALFIRMS_URL, jobPath)} target="_blank" rel="noreferrer" className="font-medium text-foreground hover:underline">answer them on the job</a>.</>}
                  </p>
                )}
              </motion.li>
            );
          })}
        </ul>
        {!hasCertificate && <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground"><Award className="h-3.5 w-3.5" />Your certificate is only sent when you tap the button.</p>}
      </div>
    </section>
  );
}
