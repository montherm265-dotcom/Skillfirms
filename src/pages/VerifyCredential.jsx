import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ShieldCheck, ShieldOff, ShieldAlert } from "lucide-react";
import { verifyCredential, verifyUrlFor } from "@/lib/certificates";
import Certificate from "@/components/certificate/Certificate";
import LoadingSpinner from "@/components/LoadingSpinner";
import Seo from "@/components/seo/Seo";
import { Button } from "@/components/ui/button";

const STATUS_META = {
  active_verified: { icon: ShieldCheck, text: "This credential is active and verified directly by Skillfirms." },
  revoked: { icon: ShieldOff, text: "This credential has been revoked and is no longer active." },
  superseded: { icon: ShieldAlert, text: "This credential has been superseded by a newer version, but remains part of the holder's real history." },
};

export default function VerifyCredential() {
  const { code } = useParams();
  const [result, setResult] = useState(undefined);

  useEffect(() => {
    verifyCredential(code).then(setResult).catch(() => setResult(null));
  }, [code]);

  if (result === undefined) return <LoadingSpinner className="py-24" />;

  if (result === null) {
    return (
      <div className="section-pad">
        <Seo title="Credential not found" noindex />
        <div className="mx-auto max-w-lg text-center">
          <h1 className="font-display text-2xl font-bold">Credential not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            <span className="font-mono">{code}</span> doesn't match any credential Skillfirms has issued. If you scanned a QR code or followed a link, double-check it was copied correctly.
          </p>
        </div>
      </div>
    );
  }

  const meta = STATUS_META[result.status] ?? STATUS_META.active_verified;
  const Icon = meta.icon;

  return (
    <div className="section-pad">
      <Seo
        title={`${result.credentialName} — ${result.holderName}'s verified credential`}
        description={`${result.holderName} holds a Skillfirms-verified credential in ${result.credentialName}. ${meta.text}`}
        canonical={`/verify/${result.credentialCode}`}
        type="article"
      />
      <div className="mx-auto max-w-3xl">
        <div className="mx-auto flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground">
          <Icon className="h-4 w-4" />{meta.text}
        </div>
        <div className="mx-auto mt-6 w-full overflow-hidden rounded-xl shadow-lg">
          <Certificate
            holderName={result.holderName}
            credentialName={result.credentialName}
            credentialCode={result.credentialCode}
            issuedAt={result.issuedAt}
            assessmentVersion={result.assessmentVersion}
            status={result.status}
            sourceType={result.sourceType}
            verifyUrl={verifyUrlFor(result.credentialCode)}
            className="h-auto w-full"
          />
        </div>
        {result.supersededByCode && (
          <p className="mt-4 text-center text-sm text-muted-foreground">
            A newer version of this credential is available: <span className="font-mono">{result.supersededByCode}</span>
          </p>
        )}

        <div className="mx-auto mt-8 max-w-md rounded-xl border border-border bg-muted/30 p-5 text-center">
          <p className="font-display font-semibold">Want a credential like this one?</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Skillfirms verifies real skills through graded assessments and expert-reviewed work — not a certificate of attendance.
          </p>
          <Button asChild className="mt-4">
            <Link to="/">Start your own skill verification</Link>
          </Button>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          This page reflects the live record held by Skillfirms — the only authoritative source for this credential's status. Skillfirms is not accredited by any government, university, or professional standards body.
        </p>
      </div>
    </div>
  );
}
