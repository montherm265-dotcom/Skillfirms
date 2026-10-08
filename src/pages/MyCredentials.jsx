import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Award } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import LoadingSpinner from "@/components/LoadingSpinner";
import EmptyState from "@/components/EmptyState";
import { Badge } from "@/components/ui/badge";

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

  if (credentials === null) return <LoadingSpinner className="py-24" />;

  return (
    <div className="section-pad">
      <div className="mx-auto max-w-2xl">
        <h1 className="font-display text-2xl font-bold">Your credentials</h1>
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
                <Badge variant={c.status === "active_verified" ? "default" : "outline"}>{STATUS_LABEL[c.status]}</Badge>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
