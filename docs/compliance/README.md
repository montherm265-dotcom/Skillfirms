# Security and compliance readiness

Skillfirms shares its account system and database with Talfirms, so one readiness pack covers both. It lives in the Talfirms repository at `docs/compliance/`:

- `README.md`: status of every standard, what was built, what only the owner can do
- `policies.md`, `risk-register.md`, `control-mapping.md`, `continuity-and-incident.md`
- `privacy.md`, `payments-pci.md`, `accessibility-vpat.md`, `vendor-questionnaire.md` (SIG-style answers, HIPAA and SOX applicability)

**Skillfirms holds no certification today.** The public status is on `/trust` and must stay truthful until an auditor issues a certificate.

In this repository: security headers in `public/_headers`, `public/.well-known/security.txt`, the Trust page (`src/pages/Trust.jsx`), and Settings → Your data (`src/components/privacy/YourData.jsx`).
