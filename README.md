# MediFlow

A teleconsultation platform with patient, doctor, nurse, pharmacist, and admin roles.
Patients pay a consultation fee, join a live queue, connect to a doctor over a WebRTC
video call, and (if medication is needed) pay for and collect/receive their prescription.
Doctors/admins work from a single unified dashboard.

- **Frontend:** Vue 3 + Vite + Tailwind CSS
- **Backend:** Node.js + Express
- **Databases:** MySQL (users, orders, consultations, prescriptions, certificates, payment requests, audit logs) and Firebase Realtime Database (live queue + WebRTC signaling)
- **Payments:** Stripe Checkout (test mode) with server-side webhook verification

---

## Prerequisites

Install/create these before starting:

- [Node.js](https://nodejs.org/) (v18 or newer) — includes `npm`
- [MySQL Server](https://dev.mysql.com/downloads/mysql/) + [MySQL Workbench](https://dev.mysql.com/downloads/workbench/)
- A Firebase project with **Realtime Database** enabled (live queue + video signaling)
- A free [Stripe](https://dashboard.stripe.com/register) account (we only use **test mode**)
- The [Stripe CLI](https://docs.stripe.com/stripe-cli) (to forward payment webhooks to your local backend)

---

## Project structure

```
ICT2216_P2_Grp17/
├── backend/            # Express API (port 5000)
│   ├── config/         # db.js (MySQL), firebase.js (Realtime DB), fees.js, firebase-adminsdk.json (you add this)
│   ├── routes/         # queue, consultations, orders, prescriptions, medical-certificates, payments, users
│   ├── services/       # orderService, ids, audit
│   └── server.js
├── frontend/           # Vue 3 app (port 5173)
│   └── src/            # views/ (patient, doc, admin), components/, composables/, store/, utils/
├── migrations/         # incremental SQL migrations
└── setup.sql           # full schema + seed data (run this for a fresh DB)
```

---

## Setup

### 1. Clone and install dependencies

```bash
git clone <repo-url>
cd ICT2216_P2_Grp17

cd backend && npm install
cd ../frontend && npm install
```

> **Windows PowerShell note:** if `npm` fails with *"running scripts is disabled on this system"*, run PowerShell **as Administrator** once:
> ```powershell
> Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
> ```

### 2. Create the MySQL database

Open **`setup.sql`** (repo root) in MySQL Workbench and run the whole file. It creates
`mediflow_db`, all tables, and seed data (test accounts, sample orders/consultations).

> ⚠️ `setup.sql` **truncates and reseeds** every table — only run it on a fresh/disposable DB.
> If you already have a DB and just need newer tables, run the files in `migrations/` instead.

### 3. Configure backend environment

```bash
cd backend
cp .env.example .env
```

Fill in `.env`:

```env
PORT=5000
DB_HOST=127.0.0.1
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=mediflow_db

STRIPE_SECRET_KEY=sk_test_...      # REQUIRED — backend won't start without it (step 5)
STRIPE_WEBHOOK_SECRET=whsec_...    # from `stripe listen` (step 5)
# FRONTEND_URL=http://localhost:5173      # optional, this is the default
# FIREBASE_DB_URL=...                     # optional, only for a non-default RTDB region
```

> ❗ **The backend will crash on startup if `STRIPE_SECRET_KEY` is missing** — the Stripe
> client is created when the server loads. Set a test key (step 5) before running it.

### 4. Configure frontend environment + Firebase

```bash
cd frontend
cp .env.example .env
```

Fill in the Firebase **Web SDK** config (Firebase Console → Project Settings → your Web app):

```env
VITE_API_URL=http://localhost:5000
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_DATABASE_URL=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
# VITE_IDLE_LIMIT_MS=15000          # optional, shrink to test idle auto-logout quickly
```

**Backend service account key** — the backend reaches the Realtime Database with a service
account key (git-ignored, add manually):
1. Firebase Console → Project Settings → **Service Accounts** → **Generate new private key**
2. Save it as **`backend/config/firebase-adminsdk.json`**

**Realtime Database rules** — the WebRTC signaling nodes under `/rooms` are read/written by the
browser (the queue uses the Admin SDK and bypasses rules). In Firebase Console → Realtime
Database → Rules, allow `/rooms`:
```json
{ "rules": { "rooms": { ".read": true, ".write": true } } }
```

### 5. Stripe (test mode)

1. Stripe Dashboard → **Developers → API keys** (test mode) → copy the **Secret key**
   (`sk_test_…`) into `STRIPE_SECRET_KEY` in `backend/.env`.
2. Install the Stripe CLI and log in once: `stripe login`.
3. Start webhook forwarding (leave this running whenever you test payments):
   ```bash
   stripe listen --forward-to localhost:5000/api/payments/webhook
   ```
   It prints a signing secret (`whsec_…`) — copy it into `STRIPE_WEBHOOK_SECRET` in
   `backend/.env`, then restart the backend.
4. Pay with the test card **`4242 4242 4242 4242`**, any future expiry, any CVC.

---

## Running the app

Open up to **three terminals** (the Stripe one is only needed to test payments):

```bash
# Terminal 1 — backend
cd backend && node server.js
```
```bash
# Terminal 2 — frontend
cd frontend && npm run dev
```
```bash
# Terminal 3 — Stripe webhooks (only for payment flows)
stripe listen --forward-to localhost:5000/api/payments/webhook
```

Backend terminal should print:
```
Successfully connected to the Firebase Realtime Database.
Successfully connected to the MySQL database.
Backend server is running.
```

Then open **http://localhost:5173**.

> 🔁 **After pulling new code, restart the backend** (`node server.js` does not hot-reload —
> new routes will 404 until you restart it).

---

## Test accounts

All seeded with password `1234`.

| Role       | Email                   | Lands on            |
| ---------- | ----------------------- | ------------------- |
| Admin      | `admin@mediflow.com`    | `/admin-dashboard`  |
| Doctor     | `doctor@mediflow.com`   | `/admin-dashboard`  |
| Nurse      | `nurse@mediflow.com`    | `/admin-dashboard`* |
| Pharmacist | `pharmacy@mediflow.com` | home*               |
| Patient    | `jane@gmail.com`        | `/patient/profile`  |
| Patient    | `john@gmail.com`        | `/patient/profile`  |

\* Doctor and Admin share one **unified dashboard** (the "doctor = admin" simplifying
assumption; no role-based access control yet). Nurse/Pharmacist portals are not fully built.

---

## How to test the main flows

> Use **two separate browser sessions** for anything involving a live call (e.g. a normal
> Chrome window for the patient + an Incognito window for the doctor), so both stay logged in.
> Camera/mic only work over a secure context — use `http://localhost`, **not** a LAN IP.

### A. Full consultation + payment
1. **Patient** (`jane@gmail.com`): Profile → **Start Consultation** → Questionnaire (choose
   *Yes* for medication to exercise the Path B flow) → **Hardware Check** → **Consult Payment**
   (Stripe `4242…`) → you land in the **Queue**.
2. **Doctor** (`doctor@mediflow.com`): the dashboard opens on **Live Patient Queue** →
   **Accept & Start** → both video feeds connect → **End Consultation** (returns to the queue;
   the order is now `AwaitingFinalization`).
3. **Admin/Doctor:** **Order Management** tab → **Finalize** on that order → enter diagnosis +
   valid-until (and medication lines for Path B) → submit. Order advances to `Completed`
   (Path A) or `AwaitingPayment` (Path B).
4. **Patient (Path B):** Prescription → choose collection → **Medication Payment**
   (Stripe `4242…`) → Closing. The order is now `AwaitingDelivery`; admin can **Mark Delivered**.

### B. Standalone tools (no consultation needed)
- **Issue MC** tab → pick a patient, diagnosis, valid-until → issue. It appears in that
  patient's **Profile → Medical Certificates**.
- **Request Payment** tab → pick a patient, description, amount → create. The patient pays it
  under **Profile → Pending Charges** (Stripe `4242…`); status flips to `Paid`.
- **Payment Requests** tab → oversight list of all ad-hoc charges.

### C. Resume / recovery
- **Patient → Profile → My Consultations → Resume** returns you to the page matching the
  order's status. An abandoned `InCall` order self-heals (advances to `AwaitingFinalization`).
- **Admin → Order Management:** an `InCall` row shows **Mark call ended** (recover an orphaned
  call), then **Finalize**.

---

## Database schema (overview)

Defined in `setup.sql`; key tables:

- **users** — accounts (roles, name, home address).
- **orders** + **order_status_history** — the patient-journey lifecycle and its audit trail
  (the source of truth for the flow: `Pending → InQueue → InCall → AwaitingFinalization →
  AwaitingPayment → AwaitingDelivery → Completed`, plus `Cancelled`/`Refunded`).
- **consultations** — the clinical session (linked to an order; doubles as the WebRTC room id).
- **prescriptions** — one row per medication line.
- **medical_certificates** — issued per-consultation or standalone (`consultation_id` nullable).
- **payment_requests** — ad-hoc doctor/admin charges, separate from the order fee flow.
- **security_audit_logs** — records sensitive actions (standalone MC issuance, payment-request creation).

---

## Troubleshooting

| Problem | Fix |
| --- | --- |
| Backend exits immediately with *"Neither apiKey nor config.authenticator provided"* | `STRIPE_SECRET_KEY` is missing/blank in `backend/.env` — set a `sk_test_…` key (setup step 5) |
| New API route returns 404 even though it's in the code | Restart the backend — `node server.js` doesn't hot-reload |
| Payment page stuck on *"Confirming payment…"* | The Stripe CLI (`stripe listen`) isn't running, or `STRIPE_WEBHOOK_SECRET` is wrong — webhooks aren't reaching the backend |
| `npm` blocked on Windows: *"running scripts is disabled"* | `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned` (admin PowerShell) |
| Backend: *"Error connecting to the MySQL database"* | Check `backend/.env` credentials, that MySQL is running, and that `mediflow_db` exists (run `setup.sql`) |
| Backend crashes reading `firebase-adminsdk.json` | The service account key is missing — see setup step 4 |
| Video call connects but no remote video / camera blocked | Both users must allow camera/mic; access via `localhost`, not a LAN IP |
| Port already in use (`EADDRINUSE`) | Another server is on 5000/5173 — stop it, or change `PORT` / Vite's port |
| Build warning: *"Some chunks are larger than 500 kB"* | Harmless size warning, not an error |
