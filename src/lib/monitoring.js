// Error monitoring (Sentry) and product analytics (PostHog) -- both loaded
// lazily via dynamic import so neither ships in the main entry chunk or
// blocks first paint. Safe to call before either SDK has finished loading:
// identifyUser/trackEvent/captureException buffer until init resolves.

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY;
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || "https://eu.i.posthog.com";

let sentry = null;
let posthog = null;
let pendingUserId; // undefined = not yet set; null = explicitly signed out

export function initMonitoring() {
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
        capture_pageview: true,
        loaded: (loadedPh) => loadedPh.register({ product: "skillfirms" }),
      });
      posthog = ph;
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

export function trackEvent(name, props = {}) {
  if (posthog) posthog.capture(name, props);
}

export function captureException(error, context) {
  if (sentry) sentry.captureException(error, context);
  else console.error(error);
}
