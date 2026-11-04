import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { completeCrossAppSignIn } from "@/lib/crossApp";

// Landing page for links from the sister site: signs you in with the
// one-time code, then takes you where the link was going.
export default function Sso() {
  const navigate = useNavigate();
  const [note, setNote] = useState("Signing you in…");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    completeCrossAppSignIn().then(({ next, signedIn }) => {
      if (!signedIn) setNote("Couldn't carry your sign-in over — you may need to sign in here.");
      navigate(next, { replace: true });
    });
  }, [navigate]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">{note}</p>
    </div>
  );
}
