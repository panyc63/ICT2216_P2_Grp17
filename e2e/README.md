# End-to-end browser tests (Playwright)

Real-browser smoke tests that drive the **built** MediFlow SPA against a live backend +
database — the same code that ships to production, exercised through Chromium. Deep
API-level RBAC/flow coverage lives in `backend/integration.test.js`; this layer proves the
UI actually wires to the API in a browser (login, cookies/CSRF, triage booking, doctor queue).

## What it covers
- Homepage renders (hero + auth entry points).
- Patient signs in and is routed to the patient portal.
- Patient books a consultation end-to-end through the triage questionnaire (`POST /api/triage` → 201).
- Doctor signs in and loads the doctor-scoped consultation queue (`GET /api/consultations` → 200).

## Prerequisites
- Node 22, a running **MySQL/MariaDB** reachable via `DB_*` env vars.
- Chromium: uses Playwright's bundled build. In the managed/CI image it is preinstalled
  (`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`, `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`); elsewhere
  run `npx --prefix e2e playwright install chromium` once.

## Run
From the repo root, with a database already running:

```bash
npm --prefix e2e install          # installs @playwright/test (skips browser download if preinstalled)
bash scripts/e2e-up.sh            # seeds DB, builds SPA, boots backend + preview, runs the suite
```

`scripts/e2e-up.sh` seeds the DB from `setup.sql`, resets the seeded **patient**
(`john@gmail.com`) and **doctor** (`doctor@mediflow.com`) to a known password
(`E2ePassw0rd!`) so the tests can log in — the seeded hashes' plaintexts are intentionally
unknown — then serves the SPA with a same-origin `/api` proxy to the backend (mirroring the
production nginx topology, so cookies/CSRF behave identically).

## Configuration (env)
| Var | Default | Purpose |
|-----|---------|---------|
| `DB_HOST`/`DB_PORT`/`DB_USER`/`DB_PASSWORD`/`DB_NAME` | `127.0.0.1`/`3306`/`root`/`rootpass`/`mediflow_db` | database connection |
| `BACKEND_PORT` / `PREVIEW_PORT` | `5000` / `4180` | local ports |
| `E2E_BASE_URL` | `http://localhost:4180` | point the suite at any running instance |
| `E2E_PASSWORD` | `E2ePassw0rd!` | password set on the two test accounts |

To run the suite against an already-running site (skipping the boot script), set
`E2E_BASE_URL` and call `npm --prefix e2e test` directly.
