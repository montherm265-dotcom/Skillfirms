# Skillfirms

**Don't just learn. Become capable.**

Skillfirms is an AI career-intelligence product: tell it where you want your career to go, and it
figures out where you are, what's missing, builds a path, has you practice and prove real competence,
and connects that proof to real opportunities through Talfirms.

Skillfirms is its own product — own repo, own frontend, own brand — not a tab inside Talfirms.

## Stack

React + Vite + Tailwind CSS (shadcn/ui + Radix primitives), matching Talfirms' stack for shared
engineering conventions. Supabase for the backend.

## How "shared accounts with Talfirms" actually works

Skillfirms points at the **exact same Supabase project** as Talfirms (same `VITE_SUPABASE_URL` /
`VITE_SUPABASE_ANON_KEY`). That's deliberate, not a shortcut:

- Signing up on Skillfirms creates a real row in the same `auth.users` table Talfirms uses, and the
  same `handle_new_user()` trigger creates a real `public.profiles` row — so the same email/password
  works to sign in on either product. No separate account system, no sync job, no token exchange.
- Skillfirms' own data — skills graph, career roles, skill evidence, courses, missions, portfolio —
  lives in its own Postgres schema, `skillfirms`, inside that same project. It never writes to
  Talfirms' `public.*` tables; it only reads `public.profiles` for identity (display name, avatar).
- Sessions are still per-origin (browser storage doesn't cross domains), so logging in on Talfirms
  doesn't automatically log you into Skillfirms — "shared accounts" means the same credentials work
  on both, not automatic cross-domain SSO. A signed handoff link is a reasonable future upgrade, not
  built yet.
- The Talfirms repo's existing `ai` Edge Function (OpenAI-backed, `OPENAI_API_KEY`) is reused for
  Skillfirms' AI features too, via new prompt modules — one AI integration, not two.

This keeps both apps genuinely independently deployable (different domains, different repos,
different release cycles) while sharing the one thing that actually needs to be shared: who the user is.

### The Talfirms connection (verified credentials -> Talfirms profile)

A Skillfirms Verified credential is always individually checkable by anyone who has its code
(`/verify/:code`, no login needed) — that's the point of a credential. Showing someone's *whole*
credential list on their Talfirms profile without them asking is a bigger disclosure, so it's a
separate, explicit, off-by-default opt-in: `/settings` → "Share verified credentials with Talfirms"
(`skillfirms_user_settings.share_credentials_with_talfirms`). Only currently `active_verified`
credentials from an opted-in user are publicly readable — a superseded or revoked one, or anything
from someone who hasn't opted in, stays visible only to its holder.

Talfirms reads `skillfirms_credentials` directly (same Supabase project, no API needed) to render
that section on a profile. Set `VITE_TALFIRMS_URL` (Skillfirms) and `VITE_SKILLFIRMS_URL` (Talfirms)
once each app has a real deployed domain — the cross-product CTAs stay hidden until then rather than
linking to a guessed URL.

Pulling target-job requirements *from* Talfirms back into Skillfirms' diagnosis (the other direction
in the brief) isn't built yet — this is Skillfirms-to-Talfirms only, for now.

## What's built so far

Frontend scaffold only — routing, auth (shared with Talfirms), design tokens derived from the
Skillfirms mark. The skills graph, career role graph, AI diagnosis, and the rest of the product are
being built next; this file will track real progress as each piece lands.
