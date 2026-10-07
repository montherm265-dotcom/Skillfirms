import { useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import AuthLayout from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function Auth() {
  const [params] = useSearchParams();
  const [mode, setMode] = useState(params.get("mode") === "signup" ? "signup" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/dashboard";

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === "signup") {
        const result = await signUp({ email, password, displayName });
        if (result.needsEmailConfirmation) {
          setMode("signin");
          setPassword("");
          setError("Account created — check your email to confirm it, then sign in.");
        } else {
          navigate(from, { replace: true });
        }
      } else {
        await signIn({ email, password });
        navigate(from, { replace: true });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="section-pad">
      <AuthLayout
        title={mode === "signup" ? "Build your career path" : "Sign in to Skillfirms"}
        subtitle={
          mode === "signup"
            ? "One account — this also works on Talfirms."
            : "Welcome back."
        }
        footer={
          <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => setMode((m) => (m === "signup" ? "signin" : "signup"))}>
            {mode === "signup" ? "Already have an account? Sign in" : "New here? Create an account"}
          </button>
        }
      >
        {!isSupabaseConfigured && (
          <p className="mb-4 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
            No live backend is connected yet.
          </p>
        )}
        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === "signup" && (
            <Input placeholder="Your name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required maxLength={60} />
          )}
          <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={submitting} className="w-full">{submitting ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}</Button>
        </form>
      </AuthLayout>
    </div>
  );
}
