import { supabase } from "@/lib/supabaseClient";

export function verifyUrlFor(code) {
  return `${window.location.origin}/verify/${code}`;
}

export async function verifyCredential(code) {
  const { data, error } = await supabase.rpc("skillfirms_verify_credential", { p_credential_code: code });
  if (error) throw error;
  return data; // null if the code doesn't exist -- never throws for "not found"
}
