import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import LoadingSpinner from "@/components/LoadingSpinner";

export default function Settings() {
  const { user } = useAuth();
  const [shareCredentials, setShareCredentials] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from("skillfirms_user_settings")
      .select("share_credentials_with_talfirms")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setShareCredentials(data?.share_credentials_with_talfirms ?? false);
        setLoading(false);
      });
  }, [user.id]);

  async function handleToggle(checked) {
    setSaving(true);
    setShareCredentials(checked);
    const { error } = await supabase
      .from("skillfirms_user_settings")
      .upsert({ user_id: user.id, share_credentials_with_talfirms: checked, updated_at: new Date().toISOString() });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      setShareCredentials(!checked);
      return;
    }
    toast.success(checked ? "Your active verified credentials will now show on your Talfirms profile." : "Your credentials are no longer shared with Talfirms.");
  }

  if (loading) return <LoadingSpinner className="py-24" />;

  return (
    <div className="section-pad">
      <div className="mx-auto max-w-2xl">
        <h1 className="font-display text-2xl font-bold">Settings</h1>

        <div className="mt-6 card-soft p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-medium">Share verified credentials with Talfirms</p>
              <p className="mt-1 text-sm text-muted-foreground">
                When on, anyone viewing your Talfirms profile can see your currently active Skillfirms Verified credentials, each linking back to its own public verification page here. Off by default — this is a separate decision from anyone checking one credential code you've already handed them, which always works regardless of this setting.
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                A credential that's later superseded or revoked stops showing on Talfirms immediately, even though nothing is ever deleted from your history on this page.
              </p>
            </div>
            <label className="relative inline-flex flex-shrink-0 cursor-pointer items-center">
              <input
                type="checkbox"
                className="peer sr-only"
                checked={shareCredentials}
                disabled={saving}
                onChange={(e) => handleToggle(e.target.checked)}
              />
              <span className="h-6 w-11 rounded-full bg-secondary transition peer-checked:bg-mastery peer-disabled:opacity-50" />
              <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
