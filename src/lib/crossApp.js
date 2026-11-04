import { supabase } from "@/lib/supabaseClient";

// One sign-in for Talfirms and Skillfirms (cross-app-sso Edge Function,
// migration 0228). Following a link to the sister site while signed in
// carries a one-time code (valid 2 minutes, single use) in the URL
// fragment, which the other site's /sso page trades for its own sign-in.
// Signed out, it's just a normal link.

async function handoffToken() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) return null;
  try {
    const { data: res, error } = await supabase.functions.invoke("cross-app-sso", { body: { action: "create" } });
    return error ? null : res?.token ?? null;
  } catch {
    return null;
  }
}

// The final address for a link into the sister site at `base` + `path`.
export async function crossAppHref(base, path = "/") {
  const root = String(base).replace(/\/$/, "");
  const target = new URL(path, `${root}/`);
  const next = `${target.pathname}${target.search}${target.hash}`;
  const token = await handoffToken();
  return token ? `${root}/sso#t=${encodeURIComponent(token)}&next=${encodeURIComponent(next)}` : target.toString();
}

// Open the sister site signed in. The new tab is opened straight away (so
// it isn't blocked as a pop-up) and pointed at the signed link once ready.
export function openCrossApp(base, path = "/", { newTab = true } = {}) {
  const tab = newTab ? window.open("", "_blank") : null;
  crossAppHref(base, path).then((href) => {
    if (tab) {
      tab.opener = null;
      tab.location.href = href;
    } else {
      window.location.assign(href);
    }
  });
}

// For <a onClick>: keeps normal behaviour for ctrl/cmd/middle clicks.
export function crossAppClick(base, path, options) {
  return (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    openCrossApp(base, path, options);
  };
}

// The /sso landing: trade the one-time code for a sign-in, then go on.
export async function completeCrossAppSignIn() {
  const params = new URLSearchParams(window.location.hash.slice(1));
  const token = params.get("t");
  const rawNext = params.get("next") || "/";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";
  // Never leave the code in the address bar or history.
  window.history.replaceState(null, "", window.location.pathname);
  if (!token) return { next, signedIn: false };
  try {
    const { data, error } = await supabase.functions.invoke("cross-app-sso", { body: { action: "redeem", token } });
    if (error || !data?.token_hash) return { next, signedIn: false };
    const { error: verifyError } = await supabase.auth.verifyOtp({ token_hash: data.token_hash, type: "magiclink" });
    return { next, signedIn: !verifyError };
  } catch {
    return { next, signedIn: false };
  }
}

// Same, for a full sister-site URL: <a href={url} onClick={signedLinkClick(url)}>.
export function signedLinkClick(url, options) {
  if (!url) return undefined;
  const u = new URL(url);
  return crossAppClick(u.origin, `${u.pathname}${u.search}${u.hash}`, options);
}
