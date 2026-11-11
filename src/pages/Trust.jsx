import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Accessibility, BadgeCheck, Bug, CircleDashed, CreditCard, Database, Download, Eye, FileLock2, Fingerprint, Globe2, KeyRound, LifeBuoy, Lock, ScrollText, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import Seo from "@/components/seo/Seo";
import PageHero from "@/components/page/PageHero";
import { Button } from "@/components/ui/button";

const ease = [0.22, 1, 0.36, 1];
const PRODUCT = "Skillfirms";

// Honest status: nothing here says "certified" until an outside auditor has
// issued the certificate. "ready" = the controls and documents are in place
// and the audit hasn't started; "live" = it applies today.
const FRAMEWORKS = [
  { icon: ShieldCheck, name: "ISO/IEC 27001", what: "Information security management", status: "ready", note: "Policies, risk register and control mapping written. Certification audit not started." },
  { icon: FileLock2, name: "ISO/IEC 27018", what: "Protecting personal data in the cloud", status: "ready", note: "Personal-data controls mapped. Assessed together with ISO 27001." },
  { icon: LifeBuoy, name: "ISO 22301", what: "Business continuity", status: "ready", note: "Continuity and recovery plan written. First recovery drill still to run." },
  { icon: BadgeCheck, name: "SOC 2 Type II", what: "Audited security controls over time", status: "ready", note: "Controls mapped to the Trust Services Criteria. Needs an auditor and a 3 to 12 month observation period." },
  { icon: CreditCard, name: "PCI DSS", what: "Card payment security", status: "live", note: "Card details never touch our systems: payments run on Stripe, a PCI DSS Level 1 provider. Our own self-assessment (SAQ A) comes once payments are switched on." },
  { icon: Globe2, name: "GDPR and CCPA", what: "Privacy rights", status: "live", note: "Download your data and delete your account from Settings. No selling of personal data." },
  { icon: Globe2, name: "EU-US Data Privacy Framework", what: "Transfers of EU data to the US", status: "planned", note: "Needs self-certification by a US legal entity. Until then, transfers rely on our providers' standard contractual clauses." },
  { icon: ScrollText, name: "SIG questionnaire", what: "Vendor security review for companies", status: "ready", note: "Standard security questionnaire answers are prepared for companies buying team training." },
  { icon: FileLock2, name: "HIPAA", what: "US health information", status: "planned", note: "Skillfirms does not collect or store patient or health records. An assessment would be done with a healthcare customer that needs one." },
  { icon: ScrollText, name: "SOX", what: "Financial controls for listed companies", status: "planned", note: "Applies to publicly traded companies, which Skillfirms is not. Financial record-keeping follows the same documented controls." },
  { icon: Accessibility, name: "WCAG 2.1 AA / VPAT", what: "Accessibility", status: "ready", note: "Automated checks run on every main page; a conformance report (VPAT) is drafted. Independent testing still to do." },
];
const STATUS = {
  live: { label: "In place today", cls: "bg-[#1f4189] text-white" },
  ready: { label: "Ready for audit · not yet certified", cls: "bg-[#1f4189]/10 text-[#1f4189]" },
  planned: { label: "Planned", cls: "bg-secondary text-muted-foreground" },
};

const CONTROLS = [
  { icon: Lock, t: "Encrypted in transit and at rest", d: "Every connection uses HTTPS with strict transport security. The database and files are encrypted at rest by our hosting provider." },
  { icon: Database, t: "Each record has an access rule", d: "The database itself decides who can read or change every row, so one screen's mistake can't expose another person's data." },
  { icon: KeyRound, t: "Passwords we never see", d: "Sign-in is handled by a dedicated provider. Passwords are stored hashed, and new ones are checked against known leaked passwords." },
  { icon: CreditCard, t: "No card data on our systems", d: "Payments go straight to Stripe. We keep only a customer reference and your plan." },
  { icon: ScrollText, t: "Privileged actions are logged", d: "Admin rights, account status, plan changes, company team changes and moderation actions go to a log that can't be edited." },
  { icon: Fingerprint, t: "Certificates anyone can check", d: "Every certificate has its own code and public page, so it can't be faked or quietly changed." },
  { icon: Eye, t: "Minimal tracking", d: "No session recording, no advertising trackers, and text you type is masked from analytics." },
  { icon: ShieldCheck, t: "Hardened pages", d: "A strict content security policy, clickjacking protection and safe defaults on every page." },
];

const SUBPROCESSORS = [
  ["Supabase", "Database, sign-in, file storage", "United States"],
  ["Cloudflare", "Website delivery, video", "Global"],
  ["Stripe", "Payments", "United States"],
  ["OpenAI and Anthropic", "AI features (only the text a feature needs)", "United States"],
  ["Resend", "Email", "United States"],
  ["Sentry", "Error reports (no personal content)", "When enabled"],
  ["PostHog", "Product analytics, EU-hosted (text masked)", "When enabled"],
];

function Reveal({ children, delay = 0, className = "" }) {
  return <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-40px" }} transition={{ duration: 0.6, delay, ease }} className={className}>{children}</motion.div>;
}

function ReportForm() {
  const [f, setF] = useState({ summary: "", details: "", contact: "" });
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.rpc("submit_security_report", { p_summary: f.summary, p_details: f.details, p_contact: f.contact || null });
    setBusy(false);
    if (error) { toast.error(error.message.replace(/^[a-z_]+: /, "")); return; }
    setSent(true);
  }
  if (sent) return <p className="rounded-2xl bg-white/[0.06] p-5 text-white/85">Thank you. Your report went straight to our security queue. If you left a way to reach you, we'll reply there.</p>;
  const field = "w-full rounded-xl border border-white/15 bg-white/[0.06] px-3 py-2.5 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#6b8cff]/60";
  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block text-sm text-white/80">What did you find?
        <input required minLength={10} maxLength={200} value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })} className={`mt-1 ${field}`} placeholder="One line, e.g. I can read another person's draft" />
      </label>
      <label className="block text-sm text-white/80">How can we see it ourselves?
        <textarea required minLength={20} maxLength={8000} rows={5} value={f.details} onChange={(e) => setF({ ...f, details: e.target.value })} className={`mt-1 ${field}`} placeholder="The steps, the page or address, and what happened" />
      </label>
      <label className="block text-sm text-white/80">How can we reach you? (optional)
        <input maxLength={200} value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} className={`mt-1 ${field}`} placeholder="Email or handle" />
      </label>
      <Button type="submit" disabled={busy} className="h-11 rounded-full bg-white px-6 text-[#050b24] hover:bg-[#c9d7ff]">{busy ? "Sending…" : "Send report"}</Button>
    </form>
  );
}

export default function Trust() {
  return (
    <div>
      <Seo title="Security and compliance" description={`How ${PRODUCT} protects your data, which standards we are preparing for, and how to report a security problem.`} canonical="/trust" />
      <PageHero eyebrow="Trust Center" icon={ShieldCheck} title="Security and privacy," accent="in the open."
        sub={`What protects your data on ${PRODUCT} today, which standards we're preparing to be audited against, and exactly where each one stands.`} />

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <Reveal>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#1f4189]">Standards</p>
          <h2 className="mt-3 text-4xl font-extrabold leading-[1.05] tracking-[-0.04em] sm:text-5xl">Where each one <span className="mark">really stands.</span></h2>
          <p className="mt-4 max-w-2xl rounded-2xl border border-border bg-card p-4 text-sm leading-relaxed text-muted-foreground">
            <CircleDashed className="mr-1.5 inline h-4 w-4 text-[#1f4189]" />
            {PRODUCT} does not hold ISO or SOC certificates yet. Those are issued by independent auditors after an inspection, and ours hasn't happened. What's below is what is in place today and what is ready for that audit. We'll update this page the day a certificate is issued.
          </p>
        </Reveal>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {FRAMEWORKS.map((fw, i) => (
            <Reveal key={fw.name} delay={(i % 2) * 0.08} className="rounded-3xl border border-border bg-card p-6">
              <div className="flex items-start gap-4">
                <span className="grid h-12 w-12 flex-none place-items-center rounded-2xl bg-[#1f4189]/10 text-[#1f4189]"><fw.icon className="h-6 w-6" /></span>
                <div className="min-w-0">
                  <p className="text-lg font-bold tracking-tight">{fw.name}</p>
                  <p className="text-sm text-muted-foreground">{fw.what}</p>
                </div>
              </div>
              <span className={`mt-4 inline-block rounded-full px-3 py-1 text-xs font-bold ${STATUS[fw.status].cls}`}>{STATUS[fw.status].label}</span>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{fw.note}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="bg-[#f3f3ff] py-16 dark:bg-card">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal><h2 className="max-w-2xl text-4xl font-extrabold leading-[1.05] tracking-[-0.04em] sm:text-5xl">What protects your data today.</h2></Reveal>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {CONTROLS.map((c, i) => (
              <Reveal key={c.t} delay={(i % 4) * 0.06} className="rounded-3xl border border-border bg-card p-5">
                <c.icon className="h-6 w-6 text-[#1f4189]" />
                <p className="mt-4 font-bold tracking-tight">{c.t}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{c.d}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-8 px-4 py-16 sm:px-6 lg:grid-cols-2">
        <Reveal>
          <h2 className="text-3xl font-extrabold tracking-[-0.03em]">Your rights, in two buttons</h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">Wherever you live, you can take a copy of everything we hold about you, or delete your account. Deleting hides your profile at once and erases your personal details within 30 days.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link to="/settings" className="inline-flex items-center gap-2 rounded-full bg-[#00041d] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1f4189]"><Download className="h-4 w-4" />Open Settings → Your data</Link>
            <Link to="/privacy" className="inline-flex items-center rounded-full border border-border px-5 py-2.5 text-sm font-semibold hover:bg-secondary">Privacy policy</Link>
          </div>
        </Reveal>
        <Reveal delay={0.1}>
          <h2 className="text-3xl font-extrabold tracking-[-0.03em]">Who handles data for us</h2>
          <ul className="mt-4 divide-y divide-border rounded-2xl border border-border bg-card text-sm">
            {SUBPROCESSORS.map(([n, w, where]) => (
              <li key={n} className="flex items-center justify-between gap-3 px-4 py-3">
                <span><span className="font-semibold">{n}</span><span className="block text-muted-foreground">{w}</span></span>
                <span className="flex-none text-xs text-muted-foreground">{where}</span>
              </li>
            ))}
          </ul>
        </Reveal>
      </section>

      <section id="report" className="mx-auto max-w-6xl scroll-mt-24 px-4 sm:px-6">
        <div className="relative isolate overflow-hidden rounded-[2rem] bg-[#050b24] p-8 text-white sm:p-12">
          <div aria-hidden className="absolute -right-20 -top-24 -z-10 h-96 w-96 rounded-full blur-3xl" style={{ background: "radial-gradient(closest-side, rgba(59,108,230,0.45), transparent)" }} />
          <div className="grid gap-10 lg:grid-cols-2">
            <div>
              <Bug className="h-8 w-8 text-[#9db7ff]" />
              <h2 className="mt-4 text-4xl font-extrabold leading-[1.05] tracking-[-0.04em]">Found a security problem? <span className="bg-gradient-to-r from-[#c9d7ff] to-[#5b8ef5] bg-clip-text text-transparent">Tell us first.</span></h2>
              <p className="mt-4 max-w-md text-white/65">Reports go straight to our security queue. Please give us time to fix it before telling anyone else, don't access other people's data beyond what's needed to show the problem, and we won't take action against good-faith research.</p>
            </div>
            <ReportForm />
          </div>
        </div>
      </section>
    </div>
  );
}
