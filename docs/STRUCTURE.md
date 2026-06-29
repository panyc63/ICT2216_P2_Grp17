# MediFlow — Source Code Organization (Report II)

How the cloned repository is laid out and where to find each piece graders look for.

```
ICT2216_P2_Grp17/
├── backend/                     # Node.js + Express REST API
│   ├── server.js                # All routes + handlers (auth, account, consultations,
│   │                            #   triage, payments, prescriptions/pharmacy, MC, chat)
│   ├── security.js              # Security primitives (see table below) — reused everywhere
│   ├── security.test.js         # Unit tests (node:test) — crypto/JWT/CSRF/validation/audit
│   ├── integration.test.js      # Integration tests against a live API + MySQL
│   ├── Dockerfile               # Hardened, non-root runtime image
│   └── .env.example             # Required environment variables
├── frontend/                    # Vue 3 + Vite + Tailwind SPA
│   ├── src/
│   │   ├── services/api.js      # apiFetch (CSRF + credentialed session), role routing
│   │   ├── router/index.js      # Routes + auth/role route guard
│   │   └── views/               # login, register, forget/reset password,
│   │       ├── patient/         #   profile, booking, questionnaire, payment, prescriptions, MC
│   │       ├── doc/             #   dashboard, consult queue, prescribe (inventory)
│   │       ├── nurse/           #   queue management
│   │       ├── pharmacist/      #   fulfilment queue + inventory
│   │       └── admin/           #   staff CRUD dashboard
│   ├── Dockerfile               # Multi-stage build -> unprivileged nginx
│   └── nginx.conf               # Serves SPA + proxies /api -> backend (single origin)
├── setup.sql                    # MySQL schema + append-only audit triggers + seed data
├── docker-compose.yml           # Local/CI stack (mysql + backend + frontend)
├── docker-compose.prod.yml      # Single-VM production stack (Caddy auto-HTTPS edge)
├── Caddyfile, deploy/README.md  # Deployment (EC2) runbook
├── docs/                        # CICD.md, SECURITY-CONTROLS.md, UML.md, STRUCTURE.md
├── .github/workflows/           # CI/CD: ci, integration-test, codeql, semgrep,
│   │                            #   dependency-review, gitleaks, container-scan, zap-dast, scorecard
│   └── dependabot.yml           # Automated dependency-update PRs
├── .semgrep/mediflow.yml        # Custom SAST rules (OWASP/ASVS-mapped)
└── eslint.config.js             # ESLint (+ eslint-plugin-security)
```

## Backend security primitives (`backend/security.js`)

| Concern | Functions |
|---|---|
| Passwords | `hashPassword`/`verifyPassword` (scrypt) |
| Sessions | `signJwt`/`verifyJwt` (15-min HS256), `set/clearSessionCookie` (HttpOnly/SameSite) |
| CSRF | `issueCsrfToken`, `csrfGuard` (double-submit) |
| Encryption at rest | `encryptText`/`decryptText`/`encryptJson` (AES-256-GCM) |
| MC non-repudiation | `generateMcKeyPair`, `signMcTokenAsym`, `verifyMcTokenAsym` (Ed25519) |
| Input validation | `assertString/Email/Enum/PositiveInteger/Password`, `scanAttachmentMetadata` |
| Rate limiting | `rateLimit` (per-endpoint windows) |
| Audit | `writeAudit` (hash-chained), `auditMetadata` (PHI redaction) |
| AuthZ | `requireRole`, `requireRecentReauth`, `canAccessPatientRecord` |

## Where each Deliverable-1 requirement is implemented

See `docs/SECURITY-CONTROLS.md` for the full requirement → code → CI-gate → test traceability
matrix, and `docs/UML.md` for the flow diagrams.

## Running

- Tests: `cd backend && npm test` (unit) and `npm run test:integration` (needs live API + DB).
- Lint: `npm run lint` (repo root).
- Local stack: `docker compose up --build`.
- Production (EC2): see `deploy/README.md`.
