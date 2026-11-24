import { useEffect, useState } from "react";
import { Briefcase } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { TALFIRMS_URL } from "@/lib/externalLinks";
import { crossAppClick } from "@/lib/crossApp";

const usd = (c) => `$${((c ?? 0) / 100).toFixed((c ?? 0) % 100 ? 2 : 0)}`;

// Hire bonuses (Talfirms 0308): when someone who proved a job's skill with
// your course is hired through Talfirms, you earn $30 (split if several
// tutors' courses count), paid 90 days after the hire.
export default function HireBonuses() {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    supabase.rpc("my_earnings").then(({ data }) => setRows((data?.rows ?? []).filter((r) => r.kind === "hire_bonus")));
  }, []);
  if (rows == null) return null;
  const total = rows.filter((r) => r.status !== "cancelled").reduce((n, r) => n + r.amount_cents, 0);
  return (
    <section className="mt-4 rounded-2xl border border-border bg-card p-5">
      <p className="flex items-center gap-2 font-semibold"><Briefcase className="h-4 w-4 text-primary" />Hire bonuses</p>
      <p className="mt-1 text-sm text-muted-foreground">
        When someone proves a job's skill with your course and gets hired through Talfirms, you earn a $30 hire bonus (shared if other tutors' courses also counted), paid 90 days after the hire.
      </p>
      <p className="mt-3 text-sm">
        {rows.length ? <><b>{rows.length}</b> hire{rows.length === 1 ? "" : "s"} so far · <b>{usd(total)}</b> earned.</> : "No hires yet. Teach the skills companies ask for and they come."}
        {" "}<a href={`${TALFIRMS_URL}/earnings`} onClick={crossAppClick(TALFIRMS_URL, "/earnings")} className="font-semibold text-primary hover:underline">See and get paid</a>
      </p>
    </section>
  );
}
