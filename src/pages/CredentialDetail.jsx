import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { toPng } from "html-to-image";
import { toast } from "sonner";
import { Download, Printer, Link as LinkIcon } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import { verifyUrlFor } from "@/lib/certificates";
import Certificate from "@/components/certificate/Certificate";
import LoadingSpinner from "@/components/LoadingSpinner";
import { Button } from "@/components/ui/button";

export default function CredentialDetail() {
  const { code } = useParams();
  const { user, profile } = useAuth();
  const [credential, setCredential] = useState(null);
  const [error, setError] = useState(null);
  const certRef = useRef(null);

  useEffect(() => {
    supabase
      .from("skillfirms_credentials")
      .select("*")
      .eq("user_id", user.id)
      .eq("credential_code", code)
      .maybeSingle()
      .then(({ data, error: err }) => {
        if (err || !data) { setError("Credential not found"); return; }
        setCredential(data);
      });
  }, [user.id, code]);

  async function handleDownload() {
    if (!certRef.current) return;
    try {
      const dataUrl = await toPng(certRef.current, { pixelRatio: 2 });
      const link = document.createElement("a");
      link.download = `${code}-skillfirms-credential.png`;
      link.href = dataUrl;
      link.click();
    } catch {
      toast.error("Couldn't generate the image. Try printing to PDF instead.");
    }
  }

  async function handleCopyLink() {
    await navigator.clipboard.writeText(verifyUrlFor(code));
    toast.success("Verification link copied.");
  }

  if (error) return <p className="section-pad text-center text-sm text-destructive">{error}</p>;
  if (!credential) return <LoadingSpinner className="py-24" />;

  return (
    <div className="section-pad">
      <div className="mx-auto max-w-4xl">
        <div ref={certRef} className="mx-auto w-full max-w-3xl overflow-hidden rounded-xl shadow-lg">
          <Certificate
            holderName={profile?.display_name ?? "Skillfirms member"}
            credentialName={credential.credential_name}
            credentialCode={credential.credential_code}
            issuedAt={credential.issued_at}
            assessmentVersion={credential.assessment_version}
            status={credential.status}
            sourceType={credential.source_type}
            verifyUrl={verifyUrlFor(credential.credential_code)}
            className="h-auto w-full"
          />
        </div>

        <div className="mt-6 flex flex-wrap justify-center gap-2 print:hidden">
          <Button onClick={handleDownload}><Download className="mr-1.5 h-4 w-4" />Download image</Button>
          <Button variant="outline" onClick={() => window.print()}><Printer className="mr-1.5 h-4 w-4" />Print / save PDF</Button>
          <Button variant="outline" onClick={handleCopyLink}><LinkIcon className="mr-1.5 h-4 w-4" />Copy verification link</Button>
        </div>
      </div>
    </div>
  );
}
