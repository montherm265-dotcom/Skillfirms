import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { format } from "date-fns";

// Skillfirms' real brand only: near-black navy ink + the teal mastery
// accent, on a warm cream field -- no gold, no other accent color. See
// src/index.css for the HSL tokens these hex values are converted from
// (SVG export/print can't read CSS custom properties reliably).
const NAVY = "#0F141F";
const NAVY_SOFT = "#2A3242";
const TEAL = "#1D90A5";
const TEAL_DEEP = "#146573";
const CREAM = "#F7F3E9";
const MUTED = "#5B6472";
const SLATE = "#7A8290";

const STATUS_COPY = {
  active_verified: { label: "ACTIVE — VERIFIED", color: TEAL },
  revoked: { label: "REVOKED", color: SLATE },
  superseded: { label: "SUPERSEDED", color: SLATE },
};

const SOURCE_COPY = {
  assessment_based: "Skillfirms Assessment",
  expert_verified: "Skillfirms Expert-Reviewed Assessment",
};

// Wraps onto at most maxLines -- once that many breaks have happened,
// every remaining word goes onto the final line so nothing is ever
// silently dropped (a long holder name just runs a bit wide instead of
// losing a word, which font-size scaling below mostly absorbs anyway).
function wrapLines(text, maxChars, maxLines = 2) {
  const words = text.split(" ");
  const lines = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current && lines.length < maxLines - 1) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// A rotated rounded-rect ring of microtext around the border -- true
// security-document microtext, meant to be invisible at a glance and
// confirm authenticity under close inspection (brief section 4).
const MICROTEXT_PATH = "M 96,72 H 1504 A 24,24 0 0 1 1528,96 V 1034 A 24,24 0 0 1 1504,1058 H 96 A 24,24 0 0 1 72,1034 V 96 A 24,24 0 0 1 96,72 Z";
const MICROTEXT_PHRASE = "SKILLFIRMS VERIFIED PROFESSIONAL CREDENTIAL • ";

export default function Certificate({
  holderName,
  credentialName,
  credentialCode,
  issuedAt,
  assessmentVersion,
  status = "active_verified",
  sourceType = "assessment_based",
  verifyUrl,
  className = "",
}) {
  const [qrDataUrl, setQrDataUrl] = useState(null);

  useEffect(() => {
    let active = true;
    if (!verifyUrl) return;
    QRCode.toDataURL(verifyUrl, { margin: 0, width: 300, color: { dark: NAVY, light: "#00000000" } })
      .then((url) => { if (active) setQrDataUrl(url); })
      .catch(() => {});
    return () => { active = false; };
  }, [verifyUrl]);

  const statusInfo = STATUS_COPY[status] ?? STATUS_COPY.active_verified;
  const nameLines = wrapLines(holderName ?? "", holderName && holderName.length > 24 ? 24 : 40, 1);
  const nameFontSize = (holderName ?? "").length > 28 ? 46 : (holderName ?? "").length > 18 ? 54 : 62;
  const credentialLines = wrapLines(credentialName ?? "", 42, 2);
  const showStamp = status !== "active_verified";

  return (
    <svg viewBox="0 0 1600 1130" className={className} role="img" aria-label={`Skillfirms credential: ${credentialName} awarded to ${holderName}`}>
      <defs>
        <pattern id="sf-guilloche" width="42" height="42" patternUnits="userSpaceOnUse" patternTransform="rotate(8)">
          <path d="M0,21 Q10.5,0 21,21 T42,21" fill="none" stroke={NAVY} strokeWidth="0.6" opacity="0.07" />
          <path d="M0,8 Q10.5,-13 21,8 T42,8" fill="none" stroke={NAVY} strokeWidth="0.5" opacity="0.05" />
          <path d="M0,34 Q10.5,13 21,34 T42,34" fill="none" stroke={NAVY} strokeWidth="0.5" opacity="0.05" />
        </pattern>
        <path id="sf-microtext-path" d={MICROTEXT_PATH} />
        <path id="sf-seal-ring" d="M 230,845 m -78,0 a 78,78 0 1 1 156,0 a 78,78 0 1 1 -156,0" />
        <clipPath id="sf-panel-clip"><rect x="48" y="48" width="1504" height="1034" rx="16" /></clipPath>
      </defs>

      {/* Outer authority frame */}
      <rect x="0" y="0" width="1600" height="1130" fill={NAVY} />
      <rect x="28" y="28" width="1544" height="1074" rx="18" fill="none" stroke={TEAL} strokeWidth="2" opacity="0.55" />

      {/* Paper panel */}
      <rect x="48" y="48" width="1504" height="1034" rx="16" fill={CREAM} />
      <g clipPath="url(#sf-panel-clip)">
        <rect x="48" y="48" width="1504" height="1034" fill="url(#sf-guilloche)" />
        {/* Faint SF watermark */}
        <g transform="translate(800,565) rotate(-10) scale(9)" opacity="0.045">
          <path d="M9 11.5C9 9.567 10.567 8 12.5 8H21.5L19.8 11.2H12.8C12.2 11.2 11.7 11.7 11.7 12.3C11.7 12.9 12.2 13.4 12.8 13.4H17.2C19.4 13.4 21.2 15.2 21.2 17.4C21.2 19.6 19.4 21.4 17.2 21.4H9.5L11.2 18.2H17.1C17.7 18.2 18.2 17.7 18.2 17.1C18.2 16.5 17.7 16 17.1 16H13.3C10.9 16 9 14.1 9 11.5Z" fill={NAVY} transform="translate(-15,-15)" />
        </g>
      </g>
      <rect x="66" y="66" width="1468" height="998" rx="10" fill="none" stroke={NAVY} strokeWidth="1.5" opacity="0.22" />

      {/* Microtext security ring */}
      <text fontSize="7.5" letterSpacing="1" fill={NAVY} opacity="0.3" fontFamily="ui-monospace, monospace">
        <textPath href="#sf-microtext-path">{MICROTEXT_PHRASE.repeat(14)}</textPath>
      </text>

      {status !== "active_verified" && showStamp && (
        <g transform="translate(1330,155) rotate(10)">
          <rect x="-110" y="-28" width="220" height="56" rx="8" fill="none" stroke={SLATE} strokeWidth="2.5" opacity="0.7" />
          <text x="0" y="7" textAnchor="middle" fontSize="20" fontWeight="700" letterSpacing="2" fill={SLATE} opacity="0.85" fontFamily="Outfit, sans-serif">
            {statusInfo.label.split(" ")[0]}
          </text>
        </g>
      )}

      {/* Header */}
      <g transform="translate(800,150)" textAnchor="middle">
        <g transform="translate(-170,-14)">
          <rect x="0" y="0" width="38" height="38" rx="9" fill={NAVY} />
          <path d="M9 11.5C9 9.567 10.567 8 12.5 8H21.5L19.8 11.2H12.8C12.2 11.2 11.7 11.7 11.7 12.3C11.7 12.9 12.2 13.4 12.8 13.4H17.2C19.4 13.4 21.2 15.2 21.2 17.4C21.2 19.6 19.4 21.4 17.2 21.4H9.5L11.2 18.2H17.1C17.7 18.2 18.2 17.7 18.2 17.1C18.2 16.5 17.7 16 17.1 16H13.3C10.9 16 9 14.1 9 11.5Z" fill={CREAM} transform="scale(0.85) translate(3,3)" />
        </g>
        <text x="10" y="13" fontSize="34" fontWeight="700" letterSpacing="1" fill={NAVY} fontFamily="Outfit, sans-serif">SKILLFIRMS</text>
      </g>

      <g transform="translate(800,222)" textAnchor="middle">
        <line x1="-230" y1="0" x2="-130" y2="0" stroke={TEAL} strokeWidth="1.5" opacity="0.6" />
        <text fontSize="16" fontWeight="600" letterSpacing="3.5" fill={TEAL_DEEP} fontFamily="Outfit, sans-serif">VERIFIED PROFESSIONAL CREDENTIAL</text>
        <line x1="130" y1="0" x2="230" y2="0" stroke={TEAL} strokeWidth="1.5" opacity="0.6" />
      </g>

      <text x="800" y="305" textAnchor="middle" fontSize="18" fill={MUTED} fontFamily="Inter, sans-serif">This credential is awarded to</text>

      <text x="800" y="375" textAnchor="middle" fontSize={nameFontSize} fontWeight="700" fill={NAVY} fontFamily="Outfit, sans-serif">
        {nameLines.map((line, i) => (
          <tspan key={i} x="800" dy={i === 0 ? 0 : nameFontSize + 6}>{line}</tspan>
        ))}
      </text>
      <line x1="700" y1="405" x2="900" y2="405" stroke={TEAL} strokeWidth="2" />

      <text x="800" y="450" textAnchor="middle" fontSize="18" fill={MUTED} fontFamily="Inter, sans-serif">
        for successfully completing the {SOURCE_COPY[sourceType] ?? "Skillfirms Assessment"} in
      </text>

      <text x="800" y="495" textAnchor="middle" fontSize="30" fontWeight="600" fill={NAVY} fontFamily="Outfit, sans-serif">
        {credentialLines.map((line, i) => (
          <tspan key={i} x="800" dy={i === 0 ? 0 : 38}>{line}</tspan>
        ))}
      </text>

      <line x1="140" y1="640" x2="1460" y2="640" stroke={NAVY} strokeWidth="1" opacity="0.15" />

      {/* Metadata row */}
      <g fontFamily="Outfit, sans-serif">
        {[
          ["CREDENTIAL ID", credentialCode, "ui-monospace, monospace"],
          ["ISSUE DATE", issuedAt ? format(new Date(issuedAt), "d MMMM yyyy") : "—", "Inter, sans-serif"],
          ["ASSESSMENT VERSION", assessmentVersion, "ui-monospace, monospace"],
        ].map(([label, value, fontFamily], i) => (
          <g key={label} transform={`translate(${210 + i * 400},705)`}>
            <text fontSize="11" letterSpacing="1.5" fill={TEAL_DEEP} fontWeight="600">{label}</text>
            <text y="30" fontSize="20" fontWeight="600" fill={NAVY} fontFamily={fontFamily}>{value}</text>
          </g>
        ))}
        <g transform="translate(1210,705)">
          <text fontSize="11" letterSpacing="1.5" fill={TEAL_DEEP} fontWeight="600">CREDENTIAL STATUS</text>
          <circle cx="6" cy="31" r="5" fill={statusInfo.color} />
          <text x="18" y="35" fontSize="18" fontWeight="600" fill={NAVY}>{statusInfo.label}</text>
        </g>
      </g>

      {/* Seal -- the ring text references an absolutely-positioned path
          (see defs) and must NOT live inside the circle's own translated
          group, or the two offsets compound and push it off-canvas. */}
      <g transform="translate(230,845)">
        <circle r="62" fill={NAVY} />
        <circle r="62" fill="none" stroke={TEAL} strokeWidth="3" />
        <path d="M9 11.5C9 9.567 10.567 8 12.5 8H21.5L19.8 11.2H12.8C12.2 11.2 11.7 11.7 11.7 12.3C11.7 12.9 12.2 13.4 12.8 13.4H17.2C19.4 13.4 21.2 15.2 21.2 17.4C21.2 19.6 19.4 21.4 17.2 21.4H9.5L11.2 18.2H17.1C17.7 18.2 18.2 17.7 18.2 17.1C18.2 16.5 17.7 16 17.1 16H13.3C10.9 16 9 14.1 9 11.5Z" fill={CREAM} transform="scale(2.6) translate(-14.7,-14.7)" />
      </g>
      <text fontSize="10.5" letterSpacing="3" fill={TEAL_DEEP} textAnchor="middle">
        <textPath href="#sf-seal-ring" startOffset="2%">{"SKILLFIRMS • VERIFIED CREDENTIAL • SKILLFIRMS • VERIFIED CREDENTIAL •"}</textPath>
      </text>

      {/* QR verification */}
      <g transform="translate(725,790)" textAnchor="middle">
        <rect x="0" y="0" width="150" height="150" fill="#ffffff" stroke={NAVY} strokeWidth="1" opacity="0.9" />
        {qrDataUrl && <image href={qrDataUrl} x="6" y="6" width="138" height="138" />}
        <text x="75" y="172" fontSize="12" fontWeight="600" letterSpacing="1" fill={NAVY}>SCAN TO VERIFY</text>
        <text x="75" y="190" fontSize="10.5" fill={MUTED} fontFamily="ui-monospace, monospace">{(verifyUrl ?? "").replace(/^https?:\/\//, "")}</text>
      </g>

      {/* Signature */}
      <g transform="translate(1290,850)" textAnchor="middle">
        <path d="M -120,0 C -90,-28 -60,22 -30,-10 C -10,-30 10,10 40,-6 C 60,-16 90,8 120,-4" fill="none" stroke={NAVY} strokeWidth="2" opacity="0.75" />
        <line x1="-120" y1="18" x2="120" y2="18" stroke={NAVY} strokeWidth="1" opacity="0.4" />
        <text y="42" fontSize="13" fontWeight="600" letterSpacing="1" fill={NAVY}>AUTHORIZED SIGNATURE</text>
        <text y="62" fontSize="11.5" fill={MUTED}>Skillfirms Credentialing</text>
      </g>
    </svg>
  );
}
