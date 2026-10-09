import Seo from "@/components/seo/Seo";

export default function Terms() {
  return (
    <div className="section-pad">
      <Seo
        title="Terms of Service"
        description="The terms that govern using Skillfirms."
        canonical="/terms"
      />
      <div className="mx-auto max-w-2xl">
        <h1 className="font-display text-3xl font-bold">Terms of Service</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: October 2026</p>

        <div className="mt-8 space-y-8 text-foreground/90">
          <section>
            <h2 className="font-display text-lg font-semibold">1. Acceptance</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              By creating an account or using skillfirms.com ("Skillfirms"), you agree to these terms.
              Skillfirms shares an account system with Talfirms (talfirms.com); using either product means
              these terms (and Talfirms' own terms, where applicable to that product) apply to your single
              shared account.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold">2. What Skillfirms is</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Skillfirms is an AI career intelligence platform. It diagnoses skill gaps against a stated career
              goal, assembles a learning path, and verifies skills at one of three tiers: AI-estimated,
              assessment-based, or expert-verified. Skillfirms is not an accredited educational institution,
              and a Skillfirms credential is not equivalent to a university degree or a government-issued
              professional license.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold">3. Accounts</h2>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
              <li>You must provide accurate information and keep your login credentials secure.</li>
              <li>You're responsible for activity under your account.</li>
              <li>One person, one account — accounts may not be shared or transferred.</li>
              <li>You must be legally able to enter a binding contract in your jurisdiction to use Skillfirms.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold">4. Honest participation</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Quizzes, missions, and expert reviews only mean something if you complete them yourself. Don't
              submit someone else's work as your own, don't share assessment answers, and don't attempt to
              manipulate AI-graded feedback into a credential you haven't earned. Doing so is a violation of
              these terms and may result in a credential being revoked and your account suspended.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold">5. Credentials and verification</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Every credential Skillfirms issues carries a verification tier (AI-estimated, assessment-based, or
              expert-verified) and a public verification page. You're responsible for how and where you share
              that link. Skillfirms may revoke a credential it determines was obtained fraudulently or in
              violation of these terms; the public verification page will reflect that.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold">6. Acceptable use</h2>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
              <li>No scraping, bulk data extraction, or automated access outside what the product's own features provide.</li>
              <li>No impersonation, harassment, or spam.</li>
              <li>No uploading malicious content or content you don't have the rights to share.</li>
              <li>No attempting to probe, bypass, or disable security or access controls, including the credential-verification system.</li>
            </ul>
            <p className="mt-2 text-sm text-muted-foreground">
              Violations may result in content removal, warnings, suspension, or termination.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold">7. Intellectual property</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              You retain ownership of the content you submit (mission write-ups, quiz responses). By submitting
              it, you grant Skillfirms a license to display, store, and use it as needed to operate the
              product (e.g. showing it to the expert reviewing it, or generating AI feedback on it). Skillfirms'
              own course content, branding, design, and underlying software belong to Skillfirms.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold">8. Disclaimers</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Skillfirms is provided "as is." We don't guarantee that completing a learning path or earning a
              credential will result in a job offer, promotion, or any particular career outcome. AI-generated
              feedback and AI-estimated skill levels are estimates, not a substitute for a graded assessment or
              expert review, and are labeled as such.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold">9. Limitation of liability</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              To the fullest extent permitted by law, Skillfirms is not liable for indirect, incidental, or
              consequential damages arising from use of the platform, including career or hiring decisions made
              using information found on it or on Talfirms.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold">10. Changes</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              We may update these terms as the product evolves. Material changes will be reflected in the
              "Last updated" date above, and significant changes will be announced in-app.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold">11. Contact</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Questions about these terms can be sent through the support channel linked in the app.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
