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
- One sign-in for both sites: following a link to the sister site while signed in carries a
  one-time code (2 minutes, single use) that the other site's `/sso` page trades for its own
  session (Talfirms `cross-app-sso` Edge Function, migration 0228; `src/lib/crossApp.js`).
- The Talfirms repo's existing `ai` Edge Function (OpenAI-backed, `OPENAI_API_KEY`) is reused for
  Skillfirms' AI features too, via new prompt modules — one AI integration, not two.

This keeps both apps genuinely independently deployable (different domains, different repos,
different release cycles) while sharing the one thing that actually needs to be shared: who the user is.

### The Talfirms connection

- **Proof:** a passed course (every lesson's graded check) or an expert-passed Mission becomes verified
  skill proof on the person's Talfirms profile (Talfirms migration 0229). On by default; the person can
  turn it off in Settings or hide one credential, and the proof is removed at once. Every credential can
  also be checked by anyone with its code at `/verify/:code`.
- **Jobs:** each course page lists the open Talfirms jobs that ask for its skills, and the person's fit.
- **Hiring courses:** a company can sponsor a course for one of its jobs ("learn this, we're hiring");
  people who passed send their certificate in one tap (Talfirms migration 0230).

## SEO + GEO (generative-engine optimization)

`src/components/seo/Seo.jsx` sets a real per-page `document.title`/description/OG tags/canonical via
`useEffect`, now wired into every public page (home, career roles list + detail, course detail, missions
list + detail, the public credential-verify page) — previously only the verify page had it. Each of those
also emits real `schema.org` JSON-LD: `Occupation` on career roles, `Course` on courses, `LearningResource`
on missions, `EducationalOccupationalCredential` on a verified credential.

`supabase/functions/skillfirms-sitemap` generates a real sitemap (career roles, published courses,
published missions) via the anon key so RLS does the filtering. Individual credential verify pages
(`/verify/:code`) are deliberately left out of it — there's no public "directory of every credential code,"
only the specific one someone was actually given.

`public/llms.txt` is the GEO-era equivalent of `robots.txt`: a plain, always-fetchable description of what
Skillfirms is, aimed at AI agents rather than search indexers. `robots.txt` explicitly allows the named AI
crawlers (GPTBot, ClaudeBot, PerplexityBot, Google-Extended, CCBot, anthropic-ai, etc.) rather than relying
on the wildcard alone. The homepage also states plainly what Skillfirms is in one factual sentence, next to
the existing marketing copy — AI answer engines favor an explicit, quotable definition over a tagline.

The honest limit: this is a client-rendered single-page app. The dynamic `Seo.jsx` tags (and the JSON-LD)
only reach a crawler that executes JavaScript — Google's indexing pipeline mostly does, on a delayed second
pass. Link-preview unfurling (Slack, Twitter/X, LinkedIn, email clients) does not execute JavaScript, so a
shared course or mission link still unfurls as the generic homepage card, not its own, until this has real
SSR or a prerendering step.

## What's built

- **Learning:** catalog (`/courses`), course pages, 92 AI-drafted lessons (each labelled as such) with a
  3-question graded check (2 of 3 to pass), certificates only when every lesson is passed, reviews from
  people who passed a lesson, private notes, saved courses, My learning.
- **AI tutor** in every lesson (`skillfirms-tutor` Edge Function): same plans and limits as Talfirms AI
  (Free 10 a day within the free monthly cap, Pro 50, Ultra 120); never gives check answers.
- **Missions + paid expert reviews** (migration 0027): experts apply and are approved by an admin;
  blind reviews of paid orders in their skills; pass = "Expert verified"; experts earn 60%.
- **Team training** (migration 0028): invite link, assigned courses with due dates, exportable training
  record; 3 seats free, then $15 per person a month.
- **Pro** (`/pro`) is Talfirms Pro/Ultra: one plan for both sites. Certificates are never paid.

Payments (Stripe) aren't switched on yet: paid reviews wait on a list, and admins can credit orders and
set team seats until they are.
