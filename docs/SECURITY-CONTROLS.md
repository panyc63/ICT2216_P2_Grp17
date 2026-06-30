# MediFlow Security Controls — Traceability Matrix

This maps each **Deliverable 1** security requirement to: where it is implemented in code,
the **CI gate** that guards it, and the **automated test** that proves it. It is the
evidence base for Report II ("adopted recommended best practices, e.g. OWASP") and is
aligned to **OWASP ASVS 5.0.0**, **OWASP Top 10 2025**, **NIST SSDF v1.1**, and **PDPA**.

Legend: **U** = unit test (`backend/security.test.js`), **I** = integration test
(`backend/integration.test.js`).

## 1. Requirement → Code → CI gate → Test

| Deliverable 1 requirement | Implemented in (file → symbol) | CI gate | Automated test |
|---|---|---|---|
| **MFA** for privileged roles/actions | `backend/server.js` → `completeLoginMfa`, `createMfaChallenge`, `requireRecentReauth`; `security.js` → `getConfig.mfaRequiredRoles` | CodeQL, Semgrep | Code-reviewed; re-auth window logic exercised by `requireRecentReauth` (full email-OTP flow is E2E/manual) |
| **Cryptographic non-repudiation** (signed MC + QR) | `security.js` → `signMcToken` / `verifyMcToken`; `server.js` → `createMedicalCertificate`, `verifyMedicalCertificate` | CodeQL, Semgrep, **Gitleaks** (signing key) | **U**: MC tamper rejected; MC signed with other key rejected. **I**: minimal QR response |
| **Input validation & payload scanning** | `security.js` → `assertString/assertEmail/assertEnum/assertPositiveInteger`, `scanAttachmentMetadata` | Semgrep/CodeQL (injection) | **U**: validators reject SQLi/XSS payloads; attachment scan blocks unsafe/oversize/eicar |
| **TLS / E2E + security headers** | `security.js` → `applySecurityHeaders` (HSTS, CSP, X-Frame, nosniff); nginx `frontend/nginx.conf` | **ZAP DAST**, Trivy | **U**: required headers present |
| **Cross-origin isolation** (COOP/COEP/CORP) | `frontend/nginx.conf` (SPA edge: COOP+CORP+COEP `require-corp`); `security.js` → `applySecurityHeaders` (COOP always, CORP production-gated) | **ZAP DAST** (alert 90004) | **U**: COOP + CORP asserted in header test |
| **Secure payment verification** (Stripe webhook) | `server.js` → `handlePaymentWebhook`, `verifyStripeSignature`, idempotency via `stripe_event_id` | CodeQL, **custom Semgrep** (`trust-client-financial-status`) | **I**: webhook rejects missing/forged signature |
| **RBAC + object-level authorization** | `server.js` → `requireRole`, `canAccessPatientRecord`, `ensureAssignedDoctor`, `ensureConsultationAccess` | CodeQL, Semgrep | **I**: 401 unauthenticated; 403 wrong role; 403 cross-patient; 200 correct role/owner |
| **Rate limiting** | `security.js` → `rateLimit`; `server.js` → per-endpoint limiters (auth/login/triage/chat/payment/mc-verify) | — | **U**: limiter returns 429 over budget. **I**: login brute force → 429 |
| **Encryption at rest (AES-256-GCM)** | `security.js` → `encryptText` / `decryptText` / `encryptJson`; used in triage/chat/prescription/MC | CodeQL, Semgrep | **U**: round-trip + ciphertext≠plaintext; GCM tamper detection |
| **Session security** (15-min, re-auth) | `security.js` → `signJwt` (15-min TTL), `setSessionCookie` (HttpOnly/SameSite/maxAge); `server.js` → `authenticate`, `requireRecentReauth` | CodeQL, Semgrep | **U**: expired JWT rejected; tampered JWT rejected |
| **Audit logging** (append-only, redacted) | `server.js` → `writeAudit` (hash-chain `previous_hash`/`entry_hash`); `security.js` → `auditMetadata`; `setup.sql` → append-only triggers | — | **I**: failed login logged; UPDATE blocked (append-only). **U**: metadata redaction |
| **Data integrity & non-repudiation** | HMAC-signed JWT/MC; `token_version` revocation (`authenticate`, `logout`); hash-chained audit | CodeQL, Semgrep | **U**: JWT/MC tamper rejected. **I**: append-only audit |
| **Privacy & least privilege** | minimal QR fields (`verifyMedicalCertificate`); record reads strip `*_encrypted`/`qr_token_hash`/`signature_hash`; `auditMetadata` redaction | — | **I**: QR returns only validity/dates/revocation, no PHI. **U**: redaction |

## 2. OWASP Top 10 2025 coverage

| Category | Controls / gates |
|---|---|
| Broken Access Control | `requireRole`, object-level `canAccessPatientRecord`; **I** RBAC/cross-patient tests; CodeQL/Semgrep |
| Security Misconfiguration | `applySecurityHeaders`, strict CORS, nginx headers; Trivy misconfig + hadolint |
| Software Supply Chain / Vulnerable Components | `npm audit`, Dependency Review, Dependabot, SBOM, Trivy |
| Cryptographic Failures | scrypt password hashing, AES-256-GCM at rest, HMAC tokens; Gitleaks; **U** crypto tests |
| Injection | parameterised SQL, `assert*` validation; CodeQL/Semgrep + custom SQL rules; **U** injection-payload tests |
| Insecure Design | server-side workflows, re-auth/MFA for high-risk actions, threat-modelled controls |
| Authentication Failures | MFA, scrypt, JWT 15-min expiry, login rate limits; **U/I** auth tests |
| Software & Data Integrity Failures | Stripe webhook signature + idempotency, signed MC, append-only hash-chained audit; **I** webhook/audit tests |
| Security Logging & Monitoring Failures | `writeAudit` for sensitive events, PHI-safe redaction; **I** audit tests |
| SSRF / Server-side request issues | no user-controlled outbound URLs; egress limited to Stripe/SMTP |

## 3. OWASP ASVS 5.0.0 chapters exercised

V2 Authentication (MFA, scrypt, lockout fields), V3 Session Management (JWT TTL, HttpOnly,
revocation), V4 Access Control (RBAC, object-level), V5 Validation/Encoding (`assert*`,
parameterised SQL), V6 Stored Cryptography (AES-GCM, HMAC, signing-key isolation), V7
Error/Logging (PHI-safe structured errors, append-only audit), V13 API security
(CSRF double-submit, rate limiting, webhook signature), V14 Configuration
(secure response headers, cross-origin isolation COOP/COEP/CORP, no version disclosure).

## 4. PDPA alignment

- **Encryption at rest** of clinical/chat data (`encryptText`) and **least-privilege**
  access (RBAC + object-level) limit exposure of personal/health data.
- **Data minimisation**: public QR verification returns only validity/dates/revocation.
- **PHI-safe logging**: `auditMetadata` redacts identifiers/secrets; PHI is never logged.
- **Retention**: accounts are deactivated (soft delete), preserving medical/audit records.

## 5. Known gaps / notes for the report

- Password hashing is **scrypt** (memory-hard, ASVS-compliant), not Argon2id/bcrypt as in
  the original plan's assumptions — update the report text to match the code.
- Full **MFA email-OTP** and **frontend session** flows are best verified end-to-end
  (the frontend session workflows commit is tracked separately); CI proves the backend
  primitives and runtime authorization.
- Production-only controls (WAF, KMS, RDS encryption, Firebase rules, TLS 1.3 termination)
  are **deployment requirements** documented in the architecture, not enforced by CI.
- **DAST (OWASP ZAP baseline)** against the live site returns **0 FAIL**. The remaining
  informational warnings were triaged: `Cross-Origin-Embedder-Policy missing [90004]` is now
  addressed by the COOP/COEP/CORP isolation headers above (confirm on the post-deploy re-scan);
  `Modern Web Application [10109]` is informational (SPA detection), not a defect.

---

## Implementation update — Deliverable-1 feature build (Phases 1–8)

New functional features added since the audit, each with secure-SDLC controls + tests.

| Feature (phase) | Endpoints / code | Security controls | Tests |
|---|---|---|---|
| Account self-service (1) | `/api/me/profile`, `/api/me/password`, `/api/forgot-password`, `/api/reset-password`, `DELETE /api/me` | re-auth for sensitive ops, hashed single-use reset token (30-min, no enumeration), `token_version` revocation, PHI encrypted, audit | U + I |
| Consultation booking (2) | `POST/GET/PATCH /api/consultations` | RBAC, object-level (doctor owns consult), state-machine validation, audit | I |
| Pharmacy fulfilment (3) | `/api/inventory`, `/api/pharmacy/queue`, `/api/prescriptions/:id/fulfil` | Pharmacist RBAC, re-auth, **DB transaction + WHERE-guard prevents overselling**, immutable Rx audit | I (incl. oversell) |
| Asymmetric MC signing (6) | `signMcTokenAsym`/`verifyMcTokenAsym`, `/api/verify/mc/:token` | per-doctor **Ed25519** keys, private key encrypted at rest, public-key verification (non-repudiation), minimal QR response | U + I |

### Encryption at rest coverage (Phase 7)

AES-256-GCM (`encryptText`) protects the sensitive/PHI fields: triage answers
(`triage_submissions.answers_encrypted`), chat bodies (`chat_messages.message_body_encrypted`),
prescription instructions, MC diagnosis, patient `address`/`nric`, and the doctor's MC
**private key**. Passwords use scrypt; tokens are stored hashed.

- **Documented decision:** `email` and `name` are kept queryable identifiers (email drives
  login/uniqueness). A **blind index (HMAC) + encrypted value** is the documented future
  hardening; it was deliberately deferred to avoid destabilising authentication within scope.
- **Production at-rest:** EBS volume encryption (and/or RDS encryption) covers the whole
  datastore — see `deploy/README.md` / Phase 0.

### Deliverable-1 ↔ implementation reconciliation

- "AI triage" → implemented as a **deterministic rule-based** triage engine (no LLM); update
  the report wording. No prompt-injection surface exists.
- Security-control substitutions (student/EC2 scope): **Cloudflare** WAF (vs AWS WAF),
  **EBS encryption** (vs RDS), **app-level object authz + envelope encryption** (vs per-patient
  DB key isolation), **consent + recording metadata** (vs full media recording). See the
  reality-check table in the plan.
- Still infra-gated (delivered as code + setup docs): AWS KMS/Secrets Manager (Phase 0),
  Firebase real-time chat + ClamAV uploads (Phase 4), WebRTC + coturn (Phase 5).
