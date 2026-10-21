import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Award } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import EmptyState from "@/components/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const STATUS_LABEL = { active_verified: "Active — Verified", revoked: "Revoked", superseded: "Superseded" };

export default function MyCredentials() {
  const { user } = useAuth();
  const [credentials, setCredentials] = useState(null);

  useEffect(() => {
    supabase
      .from("skillfirms_credentials")
      .select("*")
      .eq("user_id", user.id)
      .order("issued_at", { ascending: false })
      .then(({ data }) => setCredentials(data ?? []));
  }, [user.id]);

  async function toggleHidden(credential, e) {
    e.preventDefault();
    e.stopPropagation();
    const nextHidden = !credential.hidden_from_talfirms;
    setCredentials((prev) => prev.map((c) => (c.id === credential.id ? { ...c, hidden_from_talfirms: nextHidden } : c)));
    const { error } = await supabase.from("skillfirms_credentials").update({ hidden_from_talfirms: nextHidden }).eq("id", credential.id);
    if (error) {
      setCredentials((prev) => prev.map((c) => (c.id === credential.id ? { ...c, hidden_from_talfirms: !nextHidden } : c)));
      toast.error(error.message);
      return;
    }
    toast.success(nextHidden ? "Hidden from your Talfirms profile." : "Visible on your Talfirms profile again.");
  }

  if (credentials === null) {
    return (
      <div className="section-pad">
        <div className="mx-auto max-w-2xl">
          <Skeleton className="h-8 w-52" />
          <Skeleton className="mt-2 h-4 w-full" />
          <div className="mt-6 space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="card-soft flex items-center justify-between p-4">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-6 w-28 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="section-pad">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold">Your credentials</h1>
          <Link to="/settings" className="text-sm font-medium text-mastery hover:underline">Manage Talfirms sharing</Link>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">Every Skillfirms Verified credential you've earned, with a permanent record even if one is later superseded by a newer version.</p>

        {credentials.length === 0 ? (
          <EmptyState icon={Award} title="No credentials yet" description="Pass a course assessment or get a mission expert-reviewed to earn your first one." />
        ) : (
          <div className="mt-6 space-y-3">
            {credentials.map((c) => (
              <Link key={c.id} to={`/credentials/${c.credential_code}`} className="card-soft flex items-center justify-between p-4 transition hover:border-mastery/40">
                <div>
                  <p className="font-display font-semibold">{c.credential_name}</p>
                  <p className="mt-0.5 font-mono text-xs text-muted-foreground">{c.credential_code}</p>
                </div>
                <div className="flex items-center gap-2">
                  {c.status === "active_verified" && (
                    <button
                      type="button"
                      onClick={(e) => toggleHidden(c, e)}
                      className="text-xs font-medium text-muted-foreground hover:text-mastery hover:underline"
                    >
                      {c.hidden_from_talfirms ? "Hidden — show on Talfirms" : "Hide from Talfirms"}
                    </button>
                  )}
                  <Badge variant={c.status === "active_verified" ? "default" : "outline"}>{STATUS_LABEL[c.status]}</Badge>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
