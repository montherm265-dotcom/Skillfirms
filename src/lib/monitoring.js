// Error monitoring (Sentry) and product analytics (PostHog) -- both loaded
// lazily via dynamic import so neither ships in the main entry chunk or
// blocks first paint. Safe to call before either SDK has finished loading:
// identifyUser/trackEvent/captureException buffer until init resolves.

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
// The PostHog project key is public by design (it can only send events),
// so it ships with the site; VITE_POSTHOG_KEY can override it.
const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY || "phc_A5uNxcxc4xjPvmRgVtpcVaLjEFJjAxH7eorz7b9x8PvD";
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || "https://eu.i.posthog.com";

let sentry = null;
let posthog = null;
let pendingUserId; // undefined = not yet set; null = explicitly signed out

// Start only after the page has loaded and the browser is idle, so neither
// SDK competes with first paint.
export function initMonitoring() {
  if (typeof window === "undefined") return;
  const go = () => (window.requestIdleCallback ? window.requestIdleCallback(startMonitoring, { timeout: 4000 }) : setTimeout(startMonitoring, 1500));
  if (document.readyState === "complete") go();
  else window.addEventListener("load", go, { once: true });
}

let started = false;
function startMonitoring() {
  if (started) return;
  started = true;
  if (SENTRY_DSN) {
    import("@sentry/react").then((Sentry) => {
      Sentry.init({
        dsn: SENTRY_DSN,
        environment: import.meta.env.MODE,
        // No session replay, no default PII (IP/cookies), no console
        // breadcrumbs -- an error report should carry a stack trace, not a
        // user's goal text, mission submissions, or anything else they
        // typed into the product.
        sendDefaultPii: false,
        integrations: [],
        tracesSampleRate: 0.1,
        beforeSend(event) {
          if (event.request) delete event.request.cookies;
          return event;
        },
      });
      sentry = Sentry;
      if (pendingUserId !== undefined) Sentry.setUser(pendingUserId ? { id: pendingUserId } : null);
    });
  }

  if (POSTHOG_KEY) {
    import("posthog-js").then(({ default: ph }) => {
      ph.init(POSTHOG_KEY, {
        api_host: POSTHOG_HOST,
        person_profiles: "identified_only",
        // Autocapture would otherwise pick up free-text fields (career
        // goals, mission submissions) -- mask all text and keep
        // autocapture to clicks/changes only.
        autocapture: { dom_event_allowlist: ["click", "change"] },
        mask_all_text: true,
        disable_session_recording: true,
        // No cookies: an anonymous id in this browser's storage only, and
        // nothing at all for people who ask sites not to track them.
        persistence: "localStorage",
        respect_dnt: true,
        // Only page views and our own events: no surveys or feature flags to load.
        disable_surveys: true,
        advanced_disable_flags: true,
        advanced_disable_decide: true,
        capture_pageview: true,
        loaded: (loadedPh) => loadedPh.register({ product: "skillfirms" }),
      });
      posthog = ph;
      queued.splice(0).forEach(([n, p]) => ph.capture(n, p));
      if (pendingUserId !== undefined) {
        if (pendingUserId) ph.identify(pendingUserId);
        else ph.reset();
      }
    });
  }
}

export function identifyUser(userId) {
  pendingUserId = userId ?? null;
  if (sentry) sentry.setUser(userId ? { id: userId } : null);
  if (posthog) {
    if (userId) posthog.identify(userId);
    else posthog.reset();
  }
}

// Events before PostHog has loaded wait in a short queue (never personal
// details: ids, counts and yes/no only).
const queued = [];
export function trackEvent(name, props = {}) {
  if (posthog) posthog.capture(name, props);
  else if (queued.length < 50) queued.push([name, props]);
}

export function captureException(error, context) {
  if (sentry) sentry.captureException(error, context);
  else console.error(error);
}
