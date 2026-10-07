import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import LoadingSpinner from "@/components/LoadingSpinner";

export default function CareerRoles() {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("skillfirms_career_roles").select("*").order("title").then(({ data }) => {
      setRoles(data ?? []);
      setLoading(false);
    });
  }, []);

  if (loading) return <LoadingSpinner className="py-24" />;

  return (
    <div className="section-pad">
      <div className="mx-auto max-w-4xl">
        <h1 className="font-display text-2xl font-bold">Career roles</h1>
        <p className="mt-1 text-sm text-muted-foreground">The real skill graph behind every diagnosis — browse what each role actually requires.</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {roles.map((r) => (
            <Link key={r.id} to={`/roles/${r.slug}`} className="card-soft block p-4 transition hover:border-mastery/40">
              <p className="font-display font-semibold">{r.title}</p>
              <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">{r.industry}</p>
              {r.description && <p className="mt-2 text-sm text-muted-foreground">{r.description}</p>}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
