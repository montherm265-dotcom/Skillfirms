import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { runDiagnosis, stashPendingGoal } from "@/lib/diagnosis";
import DiagnosisResult from "@/components/DiagnosisResult";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import Seo from "@/components/seo/Seo";

const EXAMPLE = "I'm a mechanical engineer with 1 year of experience and I want to work in pharmaceutical CQV within 12 months.";

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [goalText, setGoalText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!goalText.trim()) return;
    setError(null);

    if (!user) {
      stashPendingGoal(goalText.trim());
      navigate("/auth?mode=signup");
      return;
    }

    setBusy(true);
    try {
      const diagnosis = await runDiagnosis(goalText.trim(), user.id);
      setResult(diagnosis);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="section-pad">
      <Seo
        canonical="/"
        jsonLd={{
          "@context": "https://schema.org",
          "@graph": [
            { "@type": "Organization", "@id": "https://skillfirms.com/#organization", name: "Skillfirms", url: "https://skillfirms.com" },
            { "@type": "WebSite", "@id": "https://skillfirms.com/#website", name: "Skillfirms", url: "https://skillfirms.com", publisher: { "@id": "https://skillfirms.com/#organization" } },
          ],
        }}
      />
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">
          Don't search for what to learn.<br />Tell us where you want to go.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
          Skillfirms maps your skills, finds your gaps, builds your path, helps you prove what you can do,
          and connects that proof to real opportunities through Talfirms.
        </p>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground/80">
          Skillfirms is an AI career platform that diagnoses your skill gaps against a real target role, builds a learning path to close them, and verifies the result through graded assessments and expert-reviewed work.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mx-auto mt-10 max-w-xl">
        <Textarea
          value={goalText}
          onChange={(e) => setGoalText(e.target.value)}
          placeholder={EXAMPLE}
          className="min-h-28 text-base"
          maxLength={2000}
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setGoalText(EXAMPLE)}>
            Try the example
          </button>
          <Button type="submit" disabled={busy || !goalText.trim()}>
            <Sparkles className="mr-1.5 h-4 w-4" />{busy ? "Thinking…" : "Build my path"}
          </Button>
        </div>
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      </form>

      {result && (
        <div className="mx-auto mt-8 max-w-xl">
          <DiagnosisResult result={result} />
        </div>
      )}
    </div>
  );
}
