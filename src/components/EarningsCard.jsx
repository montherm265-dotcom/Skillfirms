import { useEffect, useState } from "react";
import { Wallet } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { TALFIRMS_URL } from "@/lib/externalLinks";

const usd = (c) => `$${((c ?? 0) / 100).toLocaleString(undefined, { minimumFractionDigits: (c ?? 0) % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
const KIND = { course: "Course sale", interview: "Skill interview", review: "Expert review" };

// A tutor's money: earned, held for the 14-day refund window, ready to pay
// out, and what's waiting until card payments open. Read-only.
export default function EarningsCard() {
  const [e, setE] = useState(undefined);
  useEffect(() => { supabase.rpc("skillfirms_my_earnings").then(({ data, error }) => setE(error ? null : data)); }, []);
  if (e === undefined) return <div className="mt-6 h-36 animate-pulse rounded-2xl bg-secondary/60" />;
  if (!e) return null;
  const max = Math.max(1, ...e.by_month.map((m) => m.cents));
  const tiles = [
    ["Earned", e.earned_cents, "all time, after refunds"],
    ["Held", e.held_cents, "first 14 days, in case of a refund"],
    ["Ready to pay out", e.ready_cents, e.payments_live ? "paid to your Stripe account" : "paid out once card payments open"],
  ];
  return (
    <section className="mt-6 rounded-2xl border border-border bg-card p-5">
      <h2 className="flex items-center gap-2 font-display text-lg font-semibold"><Wallet className="h-5 w-5 text-mastery" />Earnings</h2>
      {!e.payments_live && (
        <p className="mt-1 text-xs text-muted-foreground">Card payments aren't switched on yet, so nothing has been charged. When they open, buyers on your waitlist are asked to pay first.</p>
      )}
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {tiles.map(([label, cents, note]) => (
          <div key={label} className="rounded-xl bg-secondary/50 p-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-0.5 text-2xl font-extrabold tracking-tight tabular-nums">{usd(cents)}</p>
            <p className="text-[11px] text-muted-foreground">{note}</p>
          </div>
        ))}
      </div>
      {(e.waiting_buyers > 0 || e.interviews_waiting > 0) && (
        <p className="mt-3 rounded-xl bg-mastery/10 p-3 text-sm">
          {e.waiting_buyers > 0 && <><b>{e.waiting_buyers}</b> {e.waiting_buyers === 1 ? "person is" : "people are"} waiting to buy your courses: about <b>{usd(e.waiting_cents)}</b> for you when payments open. </>}
          {e.interviews_waiting > 0 && <><b>{e.interviews_waiting}</b> skill interview{e.interviews_waiting === 1 ? "" : "s"} waiting. <a href={`${TALFIRMS_URL}/interviews`} className="font-semibold underline">Open interviews</a></>}
        </p>
      )}
      {e.by_month.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold text-muted-foreground">Last 6 months</p>
          <div className="mt-2 flex h-24 items-end gap-2">
            {e.by_month.map((m) => (
              <div key={m.month} className="flex flex-1 flex-col items-center gap-1">
                <div className="w-full rounded-t-md bg-mastery" style={{ height: `${Math.max(4, (m.cents / max) * 80)}px` }} title={usd(m.cents)} />
                <span className="text-[10px] text-muted-foreground">{new Date(`${m.month}-01`).toLocaleDateString(undefined, { month: "short" })}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {e.recent.length > 0 && (
        <ul className="mt-4 divide-y divide-border text-sm">
          {e.recent.map((r, i) => (
            <li key={i} className="flex items-center justify-between gap-3 py-2">
              <span className="min-w-0"><span className="block truncate font-medium">{r.what}</span><span className="text-xs text-muted-foreground">{KIND[r.kind]} · {new Date(r.at).toLocaleDateString()}</span></span>
              <span className={`flex-none tabular-nums ${r.refunded ? "text-muted-foreground line-through" : "font-semibold"}`}>{usd(r.cents)}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[11px] text-muted-foreground">How shares, holds and refunds work: <a href="/terms/payments" className="underline">Payments, refunds and tutor terms</a>.</p>
    </section>
  );
}
