// Cross-product links use an env var rather than a hardcoded domain --
// neither app has a fixed production URL yet, and guessing one would be
// worse than just hiding the CTA until it's configured.
export const TALFIRMS_URL = import.meta.env.VITE_TALFIRMS_URL || null;
