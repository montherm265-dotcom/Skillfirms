import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Download, ShieldCheck, Trash2, Undo2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const clean = (m) => String(m ?? "").replace(/^[a-z_]+: /, "");

// Your privacy rights in two buttons: download everything we hold about you,
// or delete your account (hidden at once, erased within 30 days).
export default function YourData({ product = "Talfirms" }) {
  const { user, signOut } = useAuth();
  const [pending, setPending] = useState(undefined);
  const [busy, setBusy] = useState(null);
  const [confirm, setConfirm] = useState(false);
  const [typed, setTyped] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!user?.id) return;
    supabase.from("privacy_requests").select("id, due_at").eq("user_id", user.id).eq("kind", "deletion").eq("status", "open").maybeSingle()
      .then(({ data }) => setPending(data ?? null));
  }, [user?.id]);

  async function download() {
    setBusy("export");
    const { data, error } = await supabase.rpc("export_my_data");
    setBusy(null);
    if (error) { toast.error(clean(error.message)); return; }
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `my-${product.toLowerCase()}-data-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast.success("Your data is downloading.");
  }

  async function requestDeletion() {
    setBusy("delete");
    const { data, error } = await supabase.rpc("request_account_deletion", { p_reason: reason || null });
    setBusy(null);
    if (error) { toast.error(clean(error.message)); return; }
    setPending(data);
    setConfirm(false);
    toast.success("Your account is hidden now and will be erased within 30 days.");
    setTimeout(() => signOut?.(), 1800);
  }

  async function cancel() {
    setBusy("cancel");
    const { error } = await supabase.rpc("cancel_account_deletion");
    setBusy(null);
    if (error) { toast.error(clean(error.message)); return; }
    setPending(null);
    toast.success("Deletion cancelled. Your profile is visible again.");
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight"><ShieldCheck className="h-5 w-5 text-[#1f4189]" />Your data</h2>
      <p className="mt-1 text-sm text-muted-foreground">One account covers Talfirms and Skillfirms. You can take a copy of everything we hold about you, or delete your account, at any time.</p>

      {pending ? (
        <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/[0.07] p-4 text-sm">
          <p className="font-semibold">Your account is set to be deleted</p>
          <p className="mt-1 text-muted-foreground">Your profile is hidden now. Your personal details are erased by {pending.due_at ? new Date(pending.due_at).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" }) : "30 days from your request"}. Changed your mind?</p>
          <Button size="sm" variant="outline" className="mt-3" onClick={cancel} disabled={busy === "cancel"}><Undo2 className="h-4 w-4" />Keep my account</Button>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" onClick={download} disabled={busy === "export"}><Download className="h-4 w-4" />{busy === "export" ? "Preparing…" : "Download my data"}</Button>
          <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => { setTyped(""); setConfirm(true); }} disabled={pending === undefined}><Trash2 className="h-4 w-4" />Delete my account</Button>
        </div>
      )}

      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
            <DialogDescription>
              Your profile is hidden straight away, on Talfirms and Skillfirms. Within 30 days your profile and personal details are erased and sign-in is closed for good. Posts and messages you sent to other people stay, shown as from “Deleted user”. Until the deadline you can sign in and cancel. After that it can't be undone.
            </DialogDescription>
          </DialogHeader>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} rows={2} placeholder="Why are you leaving? (optional)"
            className="w-full rounded-xl border border-input bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          <label className="text-sm">Type <b>DELETE</b> to confirm
            <input value={typed} onChange={(e) => setTyped(e.target.value)} className="mt-1 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" autoComplete="off" />
          </label>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setConfirm(false)}>Keep my account</Button>
            <Button className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={typed.trim() !== "DELETE" || busy === "delete"} onClick={requestDeletion}>{busy === "delete" ? "Working…" : "Delete my account"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
