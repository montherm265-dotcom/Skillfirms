import Seo from "@/components/seo/Seo";

// Short, plain terms for money between people: expert interviews, course
// purchases, tutor payouts and refunds. Shared word-for-word with Skillfirms.
const H = ({ children }) => <h2 className="font-display text-xl font-semibold tracking-tight">{children}</h2>;
const L = ({ items }) => <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">{items.map((t) => <li key={t}>{t}</li>)}</ul>;

export default function PaymentTerms() {
  return (
    <div className="section-pad">
      <Seo title="Payments, refunds and tutor terms" description="How expert interviews, course purchases, refunds and tutor payouts work on Talfirms and Skillfirms." canonical="/terms/payments" />
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-extrabold tracking-[-0.03em]">Payments, refunds and tutor terms</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: November 2026. These add to the main <a href="/terms" className="text-primary hover:underline">Terms of Service</a> and apply on both Talfirms and Skillfirms.</p>
        <div className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          Card payments aren't switched on yet. Until they are, nothing here is charged and no payouts are made. These terms apply from the day payments open, and we'll say so in the app.
        </div>

        <div className="mt-8 space-y-8 text-foreground/90">
          <section>
            <H>1. Expert interviews</H>
            <L items={[
              "The price and length are shown before you request one (currently $12 for 15 minutes). The price shown when you request is the price you pay, even if it changes later.",
              "You pay when the instructor books a time. If they decline or don't reply within 7 days, nothing is charged.",
              "You pay for the interview, not for a pass. The instructor decides honestly which skills you showed; not passing is not a reason for a refund.",
              "What the instructor writes about the interview shows on your proof if you pass. It doesn't show anywhere if you don't.",
              "Nobody records the call unless both people agree at the start.",
              "Instructors only interview on skills they teach in a published course, and never interview someone they know personally or have worked with.",
            ]} />
          </section>

          <section>
            <H>2. Refunds for interviews</H>
            <L items={[
              "Full refund if the instructor cancels, doesn't show up, or the call can't happen because of a problem on their side.",
              "Full refund if you cancel 24 hours or more before the start time.",
              "No refund if you cancel less than 24 hours before, or don't show up: the instructor kept that time for you.",
              "Something went wrong? Report it within 7 days from Interviews and a person at Talfirms will look at it. If the interview wasn't fair, we refund and remove the result.",
            ]} />
          </section>

          <section>
            <H>3. Courses</H>
            <L items={[
              "Your first paid course is 20% off (when the instructor offers it).",
              "Refund within 14 days of buying if you've finished less than 30% of the course and haven't taken its final exam.",
              "A refund removes the course and any certificate or proof that came from it.",
              "Subscriptions (Pro plans) can be cancelled any time in Settings and run until the end of the period you paid for. We don't refund part-periods, except where the law says we must.",
              "If you're in the EU or UK, you agree that a course or plan starts right away when you buy it, which ends the 14-day withdrawal right for digital content once you start using it. The course refund rule above still applies.",
            ]} />
          </section>

          <section>
            <H>4. What instructors earn</H>
            <L items={[
              "Expert interviews: you keep 75% of the Net Revenue (Net Revenue is defined below). For a $12 interview paid on the web with no VAT: $12 minus the 3% fee ($0.36) = $11.64 Net Revenue; your 75% = $8.73. An interview included with Ultra is paid by Talfirms at the list price, worked out the same way.",
              "Courses: your share is a percentage of Net Revenue. You keep 60% of the Net Revenue from each sale (Skillfirms keeps 40%), or 100% of it when the buyer came through your own link. Founding instructors keep 85% for their first 6 months.",
              "Net Revenue means the gross amount the student paid, minus: applicable taxes (such as VAT or sales tax); app store commissions (Apple or Google) when the course is bought inside a phone app; payment processing, which for web sales is a flat 3% administrative and processing fee; currency conversion fees; and any refunds or chargebacks.",
              "Example: a $49 course bought on the web in a country with 15% VAT. The student pays $56.35. Minus $7.35 VAT = $49.00. Minus the 3% fee ($1.47) = $47.53 Net Revenue. Your 60% = $28.52.",
              "Every sale is listed in your Studio with each of these lines: gross price, taxes, fees, refunds, Net Revenue and your payout, so you can check the math.",
              "Your share is worked out on what the buyer actually paid, after any discount.",
              "Earnings are held for 14 days (the refund window), then paid out to you through Stripe. You need a Stripe account in your name to be paid.",
              "If a sale is refunded or charged back, that amount comes off your balance.",
              "You're responsible for your own taxes. Stripe may ask for tax details before paying you.",
            ]} />
          </section>

          <section>
            <span id="instructor-rules" />
            <H>5. Instructor rules</H>
            <L items={[
              "Teach general industry skills and public tools. Never share your employer's (or anyone's) confidential information, trade secrets, internal tools or internal workflows.",
              "Make sure your employment contract allows outside teaching and paid side work. If it needs your employer's permission, get it before you publish.",
              "Don't present a course as made, approved or endorsed by your employer, or use its logo. Your verified job can be shown as your own experience only.",
              "You confirm all three each time you send a course for review. If an employer shows a course breaks these rules, we take it down.",
              "Teach and test honestly. Passing someone who didn't show the skill, or passing for money or favours, ends your instructor account and removes every proof you signed.",
              "Show up for booked interviews. Repeated late cancellations or no-shows pause your interviews.",
              "Keep candidates' details private. Don't contact them outside Talfirms to sell something.",
            ]} />
          </section>

          <section>
            <H>6. Disputes and changes</H>
            <p className="mt-2 text-sm text-muted-foreground">
              Talk to us first through the support link in the app; most problems are fixed within a few working days. We can change prices and shares for new purchases with notice in the app. Changes never apply to something you already paid for or already earned.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
