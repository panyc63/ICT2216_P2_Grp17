# MediFlow Security Implementation Notes

This repository implements the SSD security plan against these baselines:

- OWASP ASVS 5.0.0: authentication, session, access-control, validation, logging, and data-protection controls.
- OWASP Top 10 2025: broken access control, cryptographic failures, injection, insecure design, vulnerable configuration, and logging gaps.
- NIST SP 800-218 SSDF: secure defaults, threat-driven implementation, dependency checks, and verification.
- OWASP SAMM: governance, design, implementation, verification, and operations practices.
- Singapore PDPA: minimization, least privilege, protected health data handling, and retention-aware account deactivation.

## Implemented Controls

- Passwords use Node `crypto.scrypt` hashes with per-user salts. The code upgrades legacy plaintext hashes after successful login.
- Sessions use signed 15-minute JWTs stored in `HttpOnly`, `SameSite=Lax` cookies. Logout increments `token_version` to revoke active sessions.
- CSRF protection uses a double-submit cookie and `X-CSRF-Token` header for state-changing API calls.
- Server-side RBAC protects patient, doctor, nurse, admin, and pharmacist routes. Object checks prevent cross-patient clinical record access.
- Security audit logs are append-only at the database layer and chained with `previous_hash` / `entry_hash`.
- Triage answers, chat bodies, prescription instructions, and MC diagnoses are encrypted with AES-256-GCM before storage.
- Payment state is only updated through a signed webhook path. Client redirects or frontend state never mark payment as paid.
- Medical certificates use signed verification tokens, token hashes at rest, revocation support, and minimal public verification responses.
- Inputs are validated before use and all SQL access uses parameterized queries.

## Required Environment

Production must set strong unique values for:

- `JWT_SECRET`
- `CSRF_SECRET`
- `DATA_ENCRYPTION_KEY`
- `MC_SIGNING_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `RESEND_API_KEY`
- `CORS_ORIGINS`

The server refuses to start in production if required security secrets are missing. Local development uses explicit development fallbacks only so students can run the prototype.

## Deployment Controls

Production deployment must terminate HTTPS with TLS 1.3, place the backend behind WAF/rate-limiting controls, keep MySQL/RDS in private subnets, enable database encryption at rest, keep signing/encryption secrets in KMS or Secrets Manager, configure Firebase rules to match the backend RBAC model, and retain audit logs in append-only storage such as S3 Object Lock or CloudWatch with restricted write access.

## Verification

Run:

```bash
cd backend
node --test security.test.js
npm audit --omit=dev

cd ../frontend
npm run build
npm audit --omit=dev
```

Document any dependency audit findings that cannot be remediated immediately, including the affected package, exploitability in this app, and compensating control.
