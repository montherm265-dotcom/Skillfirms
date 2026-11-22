import { useEffect, useState } from "react";
import { Wallet } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { TALFIRMS_URL } from "@/lib/externalLinks";
import { crossAppClick } from "@/lib/crossApp";

const usd = (c) => `$${((c ?? 0) / 100).toLocaleString(undefined, { minimumFractionDigits: (c ?? 0) % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
const KIND = { course: "Course sale", interview: "Skill interview", review: "Expert review" };

// A tutor's money: earned, held for the 14-day refund window, ready to pay
// out, and what's waiting until card payments open. Read-only.
export default function EarningsCard() {
  const [e, setE] = useState(undefined);
  const [sales, setSales] = useState([]);
  useEffect(() => {
    supabase.rpc("skillfirms_my_earnings").then(({ data, error }) => setE(error ? null : data));
    supabase.rpc("skillfirms_my_sales", { p_limit: 50 }).then(({ data }) => setSales((data ?? []).filter((x) => x.net_cents != null)));
  }, []);
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
          {e.interviews_waiting > 0 && <><b>{e.interviews_waiting}</b> skill interview{e.interviews_waiting === 1 ? "" : "s"} waiting. <a href={`${TALFIRMS_URL}/interviews`} onClick={crossAppClick(TALFIRMS_URL, "/interviews", { newTab: false })} className="font-semibold underline">Open interviews</a></>}
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
      {sales.length > 0 && <SalesMath sales={sales} />}
      <p className="mt-3 text-[11px] text-muted-foreground">How shares, holds and refunds work: <a href="/terms/payments" className="underline">Payments, refunds and tutor terms</a>.</p>
    </section>
  );
}

const FEE = { web: "Processing fee (3% + $0.30)", app_store: "Apple's commission", play_store: "Google's commission" };

// Every course sale, line by line: what the student paid, what came off and
// why, the Net Revenue, and your share of it. Matches the payment terms.
function SalesMath({ sales }) {
  return (
    <div className="mt-5">
      <p className="text-xs font-semibold text-muted-foreground">Sales: the math</p>
      <ul className="mt-2 space-y-2">
        {sales.map((x) => (
          <li key={x.id} className={`rounded-xl border border-border p-3 text-sm ${x.refunded ? "opacity-70" : ""}`}>
            <p className="flex items-center justify-between gap-2"><span className="truncate font-medium">{x.course}</span><span className="flex-none text-xs text-muted-foreground">{new Date(x.at).toLocaleDateString()}</span></p>
            <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 text-xs tabular-nums">
              <dt className="text-muted-foreground">{x.included ? "Paid by Talfirms (included with Ultra)" : x.kind === "interview" ? "Candidate paid" : "Student paid"}</dt><dd className="text-right">{usd(x.gross_cents)}</dd>
              {x.tax_cents > 0 && <><dt className="text-muted-foreground">Taxes (VAT / sales tax)</dt><dd className="text-right">−{usd(x.tax_cents)}</dd></>}
              <dt className="text-muted-foreground">{FEE[x.sale_channel] ?? "Fees"}</dt><dd className="text-right">−{usd(x.platform_fee_cents)}</dd>
              {x.fx_fee_cents > 0 && <><dt className="text-muted-foreground">Currency conversion</dt><dd className="text-right">−{usd(x.fx_fee_cents)}</dd></>}
              {x.refund_cents > 0 && <><dt className="text-muted-foreground">Refund / chargeback</dt><dd className="text-right">−{usd(x.refund_cents)}</dd></>}
              <dt className="border-t border-border pt-0.5 font-semibold">Net Revenue</dt><dd className="border-t border-border pt-0.5 text-right font-semibold">{usd(x.net_cents)}</dd>
              <dt className="text-muted-foreground">Your share ({Math.round(Number(x.share_pct) * 100)}%{x.channel === "expert_link" ? ", your own link" : x.kind === "interview" ? ", interview" : ""})</dt><dd className="text-right font-bold text-mastery">{usd(x.payout_cents)}</dd>
            </dl>
          </li>
        ))}
      </ul>
    </div>
  );
}
