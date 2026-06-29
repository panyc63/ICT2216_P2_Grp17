# MediFlow CI/CD & Secure SDLC Pipeline

This document describes MediFlow's implemented CI/CD process and **all tools used** — it
is written to be cited directly in Report II (Secure Software Implementation). It also maps
the pipeline to **NIST SSDF v1.1**, **OWASP SAMM 2.0.3**, **OWASP ASVS 5.0.0**, and
**OWASP Top 10 2025**.

## 1. Overview

The pipeline is a **DevSecOps / shift-left** model: every push and pull request to `main`
runs build, test, and a layered set of security gates. Findings are uploaded as **SARIF**
to the GitHub **Security → Code scanning** tab. Heavier scans (DAST, Scorecard, full SAST)
also run on a weekly schedule. All workflows use **least-privilege `permissions:` blocks**
and `concurrency` cancellation.

```
push / pull_request → ┌─ CI (lint, unit tests, build, npm audit, SBOM)
                      ├─ Integration security tests (RBAC, authz, rate-limit, webhook, audit)
                      ├─ CodeQL SAST            ─┐
                      ├─ Semgrep SAST (+custom)  ├─→ SARIF → Security tab
                      ├─ Dependency Review       │
                      ├─ Gitleaks (secrets)      │
                      ├─ Trivy + hadolint        ─┘
                      ├─ DAST (OWASP ZAP)        [scheduled / PR, informational]
                      └─ OpenSSF Scorecard       [scheduled]
```

## 2. Tools and workflows

| Stage | Tool | Workflow | Trigger | Purpose | Output |
|-------|------|----------|---------|---------|--------|
| Lint | ESLint + `eslint-plugin-security`, `eslint-plugin-vue` | `ci.yml` | push/PR | Code quality + insecure-pattern lint | Job log |
| Unit tests | Node `node:test` | `ci.yml` | push/PR | Crypto/JWT/CSRF/validation/rate-limit units | Job log |
| Build | Vite | `ci.yml` | push/PR | Frontend builds cleanly | Job log |
| SCA | `npm audit` (`audit:prod`) | `ci.yml` | push/PR | Fail on high-severity deps | Job log |
| SBOM | CycloneDX | `ci.yml` | push/PR | Software bill of materials | Artifact `sbom` |
| Integration | Node `node:test` + MySQL service | `integration-test.yml` | push/PR | Runtime RBAC/authz/rate-limit/webhook/audit | Job log |
| SAST | CodeQL (`security-extended`) | `codeql.yml` | push/PR + weekly | Static vuln analysis | Security tab |
| SAST | Semgrep (`p/owasp-top-ten`, `p/security-audit`, `p/javascript` + custom) | `semgrep.yml` | push/PR + weekly | OWASP + app-specific rules | Security tab |
| SCA | Dependency Review | `dependency-review.yml` | PR | Block new high/critical deps | PR comment |
| Secrets | Gitleaks | `gitleaks.yml` | push/PR + weekly | Detect committed secrets | Job log |
| Container/IaC | Trivy + hadolint | `container-scan.yml` | push/PR + weekly | Image/dep/misconfig + Dockerfile lint | Security tab |
| DAST | OWASP ZAP baseline | `zap-dast.yml` | PR + weekly (informational) | Dynamic scan of running app | Artifact `zap-baseline-report` |
| Posture | OpenSSF Scorecard | `scorecard.yml` | push/weekly | Repo security-posture score | Security tab |
| Deps (continuous) | Dependabot | `.github/dependabot.yml` | weekly | Automated dependency-update PRs | PRs |

## 3. Dependency-check evidence (Report II)

Three complementary mechanisms — cite all three:

1. **`npm audit`** — `ci.yml` runs `npm run audit:prod` (backend) and
   `npm audit --omit=dev --audit-level=high` (frontend). Locally:
   ```bash
   cd backend && npm audit --omit=dev
   cd frontend && npm audit --omit=dev
   ```
2. **Dependency Review** (`dependency-review.yml`) — blocks a PR that introduces a
   dependency with a high/critical advisory and comments the diff.
3. **Dependabot** (`.github/dependabot.yml`) — weekly update PRs for backend, frontend,
   root tooling, and GitHub Actions.

A **CycloneDX SBOM** is produced each run (`ci.yml` → artifact `sbom`) for inventory.

## 4. Automated-testing evidence (Report II)

- **Unit tests** — `backend/security.test.js` (`npm test` → `node --test`). Cover password
  hashing, JWT tamper/expiry, AES-GCM round-trip + tamper detection, MC-token signing,
  input validation (incl. SQLi/XSS payloads), security headers, CSRF accept/reject,
  rate-limit 429, and audit-metadata redaction.
- **Integration tests** — `backend/integration.test.js` run by `integration-test.yml`
  against a booted API + seeded MySQL. Cover unauthenticated 401, wrong-role 403,
  object-level (cross-patient) 403, login rate-limit 429, Stripe webhook signature
  rejection, audit-row creation, append-only audit immutability, and minimal-PHI QR
  responses.

Run locally:
```bash
cd backend && npm test            # unit
# integration (needs a MySQL with setup.sql loaded + the server running):
#   see integration-test.yml for the exact env; then:
node --test integration.test.js
```

## 5. Running the stack locally

```bash
docker compose up --build         # mysql (seeded from setup.sql) + backend + frontend
# frontend: http://localhost:8080   backend: http://localhost:5000/api/health
```
The compose secrets are **throwaway local/CI values** — never reuse in production.

## 6. Manual repo settings (one-time, after merge)

These are GitHub settings, not files:

- **Branch protection** on `main`: require PR review (CODEOWNERS) + require status checks
  (CI, CodeQL, integration tests) to pass.
- Enable **Secret scanning + push protection** and **Dependabot alerts** (Settings →
  Code security).
- Scorecard/CodeQL/Trivy/Semgrep SARIF appears under **Security → Code scanning**.

## 7. Standards mapping (process level)

| Standard | How this pipeline addresses it |
|----------|-------------------------------|
| **NIST SSDF v1.1** | PW.7 (review via CODEOWNERS), PW.8 (testing: unit + integration), PW.4/PS.3 (dependency check: audit/Dependabot/SBOM), RV.1 (vuln scanning: CodeQL/Semgrep/Trivy/ZAP) |
| **OWASP SAMM 2.0.3** | Verification → Security Testing (SAST/DAST/IaC); Implementation → Secure Build & Defect Management; Operations → posture (Scorecard) |
| **OWASP ASVS 5.0.0** | Controls verified by automated tests (see `docs/SECURITY-CONTROLS.md`) |
| **OWASP Top 10 2025** | Covered by CodeQL/Semgrep rulesets + custom rules; see control mapping doc |
| **PDPA** | PHI-safe logging, encryption-at-rest, least-privilege audit redaction (verified by tests) |
