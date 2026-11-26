import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Bug, Lightbulb, HelpCircle, MessageSquare, CheckCircle2, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import Seo from "@/components/seo/Seo";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const KINDS = [
  ["bug", Bug, "Something's broken"],
  ["confusing", HelpCircle, "Something's confusing"],
  ["idea", Lightbulb, "An idea"],
  ["other", MessageSquare, "Something else"],
];
const STATUS = { new: "Waiting", seen: "Seen by the team", fixed: "Fixed", wont_fix: "Not changing" };

// A short line about the device, so a bug can be reproduced. No IDs, no IP.
function deviceLine() {
  const ua = navigator.userAgent;
  const os = /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Mac OS/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "Other";
  const br = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Other";
  return `${os} · ${br} · ${window.innerWidth}×${window.innerHeight} · ${document.documentElement.lang || "en"}`;
}

export default function Feedback() {
  const { user } = useAuth();
  const { state } = useLocation();
  const [kind, setKind] = useState("bug");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [mine, setMine] = useState(null);
  const from = state?.from || document.referrer.replace(window.location.origin, "") || "";

  const load = () => supabase.rpc("my_feedback").then(({ data }) => setMine(data ?? []));
  useEffect(() => { if (user) load(); }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function send(e) {
    e.preventDefault();
    if (msg.trim().length < 3) { toast.error("Tell us a little more."); return; }
    setBusy(true);
    const { error } = await supabase.rpc("send_feedback", { p_kind: kind, p_message: msg, p_page: from.slice(0, 300) || null, p_device: deviceLine(), p_site: "skillfirms" });
    setBusy(false);
    if (error) { toast.error(/rate_limit/.test(error.message) ? "That's a lot for one day. Try again tomorrow." : error.message.replace(/^[a-z_]+: /, "")); return; }
    setMsg(""); toast.success("Thanks! The team reads every message."); load();
  }

  return (
    <div className="section-pad mx-auto max-w-2xl">
      <Seo title="Send feedback" canonical="/feedback" />
      <h1 className="text-3xl font-extrabold tracking-[-0.03em]">Send feedback</h1>
      <p className="mt-1 text-muted-foreground">Found a bug, got stuck, or have an idea? Tell us. A person reads every message, and you'll see here what happened to it.</p>

      {!user ? (
        <div className="mt-6 rounded-3xl border border-border bg-card p-6">
          <p>Sign in so we can follow up with you.</p>
          <Button asChild className="mt-3"><Link to="/auth?next=/feedback">Sign in</Link></Button>
        </div>
      ) : (
        <form onSubmit={send} className="mt-6 rounded-3xl border border-border bg-card p-5 sm:p-6">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="What kind of feedback">
            {KINDS.map(([k, Icon, label]) => (
              <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)}
                className={`flex flex-col items-center gap-1 rounded-2xl border p-3 text-xs font-medium transition ${kind === k ? "border-primary bg-primary/5 text-primary" : "border-border hover:bg-muted"}`}>
                <Icon className="h-5 w-5" />{label}
              </button>
            ))}
          </div>
          <label htmlFor="fb-msg" className="mt-4 block text-sm font-medium">{kind === "bug" ? "What happened, and what did you expect?" : kind === "idea" ? "What would make Skillfirms better for you?" : "Tell us more"}</label>
          <Textarea id="fb-msg" value={msg} onChange={(e) => setMsg(e.target.value)} maxLength={2000} rows={5} className="mt-1.5" placeholder={kind === "bug" ? "I tapped Apply on a job and nothing happened…" : ""} />
          <p className="mt-1.5 text-xs text-muted-foreground">We also attach {from ? <>the page you came from (<code>{from.slice(0, 60)}</code>) and </> : ""}your device type and screen size. Nothing else.</p>
          <Button type="submit" className="mt-4 gap-1.5" disabled={busy}><Send className="h-4 w-4" />{busy ? "Sending…" : "Send"}</Button>
        </form>
      )}

      {mine?.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-lg font-semibold">What you've sent</h2>
          <ul className="mt-3 space-y-2">
            {mine.map((f) => (
              <li key={f.id} className="rounded-2xl border border-border bg-card p-4 text-sm">
                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>{new Date(f.created_at).toLocaleDateString()} · {KINDS.find(([k]) => k === f.kind)?.[2]}</span>
                  <span className={`flex items-center gap-1 font-semibold ${f.status === "fixed" ? "text-emerald-600" : ""}`}>{f.status === "fixed" && <CheckCircle2 className="h-3.5 w-3.5" />}{STATUS[f.status]}</span>
                </div>
                <p className="mt-1 whitespace-pre-line">{f.message}</p>
                {f.admin_note && <p className="mt-2 rounded-xl bg-muted/60 p-2 text-xs"><b>Skillfirms:</b> {f.admin_note}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
