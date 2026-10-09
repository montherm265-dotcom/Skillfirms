import Seo from "@/components/seo/Seo";

export default function Privacy() {
  return (
    <div className="section-pad">
      <Seo
        title="Privacy Policy"
        description="What Skillfirms collects, why, how it's used, and the choices you have."
        canonical="/privacy"
      />
      <div className="mx-auto max-w-2xl">
        <h1 className="font-display text-3xl font-bold">Privacy Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: October 2026</p>

        <div className="mt-8 space-y-8 text-foreground/90">
          <section>
            <h2 className="font-display text-lg font-semibold">What this covers</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              This policy explains what Skillfirms collects when you use skillfirms.com, why we collect it, who
              can see it, and the choices you have. Skillfirms is operated as a sole proprietorship, as a
              sister product to Talfirms (talfirms.com) — the two share the same underlying account system, so
              signing up on either one gives you a single identity usable on both. If you have questions about
              this policy or your data, contact us through the email address on your account confirmation
              message or via the support channel linked in the app.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold">Information you provide directly</h2>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
              <li><strong>Account credentials</strong> — your email address and password, handled by our authentication provider (Supabase Auth). We never see or store your raw password. This account is shared with Talfirms.</li>
              <li><strong>Profile information</strong> — your display name and the basic profile fields stored in the shared account record used by both Skillfirms and Talfirms.</li>
              <li><strong>Career goals</strong> — the free-text goal you describe (e.g. "I want to work in pharmaceutical CQV within 12 months") when you ask Skillfirms to diagnose your skill gaps.</li>
              <li><strong>Skill &amp; course activity</strong> — courses you enroll in, quiz answers and scores, mission submissions, and the AI and/or expert feedback generated on them.</li>
              <li><strong>Credential sharing choice</strong> — whether a credential you've earned is marked as shared to Talfirms (visible on your public Talfirms profile) or hidden. You control this per credential, at any time.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold">How skill levels are determined — and why that matters for your data</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Every skill level Skillfirms records is tagged with how it was determined: <strong>AI-estimated</strong>
              (inferred from your stated goal and background, not tested), <strong>assessment-based</strong>
              (you completed a graded quiz or mission), or <strong>expert-verified</strong> (a human expert
              reviewed real work). We store this label alongside the skill level itself so the provenance of any
              claim about your skills is never blurred — including on the public credential-verification page
              described below.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold">AI-assisted features</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Skillfirms' career diagnosis, mission feedback, and related features send your goal text, relevant
              profile context, and the real skill/role catalog to an AI provider (OpenAI, via a shared backend
              function also used by Talfirms) to generate a response. We don't send more than the feature needs,
              and this text isn't used by Skillfirms to train any model.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold">Public credential verification</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              When you earn a credential, it gets a public verification page (skillfirms.com/verify/&lt;code&gt;)
              showing your name, the credential name, and its verification tier. This page is intentionally
              public and shareable — e.g. in an email signature or on a résumé — so that anyone who receives a
              link to it can check it's real. Don't share a credential link if you don't want its holder-name and
              credential details to be publicly viewable.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold">What we don't do</h2>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
              <li>We don't run third-party advertising trackers, ad pixels, or sell your personal data to data brokers or advertisers.</li>
              <li>We don't use cookies for cross-site ad tracking. The only external request made on page load is to Google Fonts, to load the typefaces used in the interface.</li>
              <li>We don't push your Skillfirms activity to Talfirms beyond the specific credential-sharing choice you make — a course enrollment or quiz attempt is never shown on Talfirms unless it results in a credential you've chosen to share.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold">Data retention and deletion</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              We keep your account data for as long as your account is active. You can hide any credential from
              Talfirms, or stop sharing, directly from Settings. To request full account deletion, contact us —
              this deletes your shared account, used by both Skillfirms and Talfirms.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold">Security</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Data is stored with Supabase (PostgreSQL) behind row-level security policies that scope every
              query to what you're actually allowed to see or change. No system is perfectly secure, but we
              treat access-control correctness as a first-class engineering concern, not an afterthought.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold">Changes to this policy</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              If this policy changes materially, we'll update the "Last updated" date above and, for
              significant changes, notify account holders in-app.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
