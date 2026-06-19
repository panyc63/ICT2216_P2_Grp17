# MediFlow

A teleconsultation platform with patient, doctor, nurse, pharmacist, and admin roles.
Patients join a live consultation queue and connect to a doctor over a WebRTC video call.

- **Frontend:** Vue 3 + Vite + Tailwind CSS
- **Backend:** Node.js + Express
- **Databases:** MySQL (users, consultations, certificates) and Firebase Realtime Database (live queue + WebRTC signaling)

---

## Prerequisites

Install these before starting:

- [Node.js](https://nodejs.org/) (v18 or newer) — includes `npm`
- [MySQL Server](https://dev.mysql.com/downloads/mysql/) + [MySQL Workbench](https://dev.mysql.com/downloads/workbench/)
- A Firebase project with **Realtime Database** enabled (used for the queue and video signaling)

---

## Project structure

```
ICT2216_P2_Grp17/
├── backend/      # Express API (port 5000)
│   ├── config/   # db.js (MySQL), firebase.js (Realtime DB)
│   ├── routes/   # queue.js, consultations.js
│   └── server.js
└── frontend/     # Vue 3 app (port 5173)
    └── src/
```

---

## Setup

### 1. Clone and install dependencies

```bash
git clone <repo-url>
cd ICT2216_P2_Grp17

# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

> **Windows PowerShell note:** if `npm` fails with *"running scripts is disabled on this system"*, run PowerShell **as Administrator** once:
> ```powershell
> Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
> ```

### 2. Configure environment variables

**Backend** — copy the example and fill in your MySQL password:

```bash
cd backend
cp .env.example .env
```

```env
PORT=5000
DB_HOST=127.0.0.1
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=mediflow_db
```

**Frontend** — copy the example and fill in your Firebase Web SDK config
(Firebase Console → Project Settings → your Web app):

```bash
cd frontend
cp .env.example .env
```

```env
VITE_API_URL=http://localhost:5000
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_DATABASE_URL=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

### 3. Add the Firebase service account key (backend)

The backend needs a service account key to reach the Realtime Database. This file
is **git-ignored** and must be added manually:

1. Firebase Console → Project Settings → **Service Accounts** → **Generate new private key**
2. Save it as: **`backend/config/firebase-adminsdk.json`**

> If your Realtime Database is in a non-default region, set `FIREBASE_DB_URL` in `backend/.env`.

### 4. Create the MySQL database

In MySQL Workbench, run the following to create the schema and seed test data:

```sql
CREATE DATABASE IF NOT EXISTS mediflow_db;
USE mediflow_db;

CREATE TABLE IF NOT EXISTS users (
    user_id VARCHAR(36) PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('Patient', 'Nurse', 'Doctor', 'Admin', 'Pharmacist') NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS consultations (
    consultation_id VARCHAR(36) PRIMARY KEY,
    patient_id VARCHAR(36),
    doctor_id VARCHAR(36),
    session_status ENUM('Pending', 'Active', 'Completed') NOT NULL,
    FOREIGN KEY (patient_id) REFERENCES users(user_id) ON DELETE SET NULL,
    FOREIGN KEY (doctor_id) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS medical_certificates (
    mc_id VARCHAR(36) PRIMARY KEY,
    consultation_id VARCHAR(36),
    doctor_id VARCHAR(36),
    patient_id VARCHAR(36),
    issue_date DATE NOT NULL,
    valid_until DATE NOT NULL,
    is_revoked BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (consultation_id) REFERENCES consultations(consultation_id) ON DELETE CASCADE,
    FOREIGN KEY (doctor_id) REFERENCES users(user_id) ON DELETE SET NULL,
    FOREIGN KEY (patient_id) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS security_audit_logs (
    log_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    actor_id VARCHAR(36) NOT NULL,
    action_performed VARCHAR(100) NOT NULL,
    affected_resource VARCHAR(100) NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    outcome ENUM('SUCCESS', 'FAILURE') NOT NULL
);

-- Seed test accounts (password for all: 1234)
INSERT INTO users (user_id, email, password_hash, role, is_verified, last_login) VALUES
('MH-U001', 'admin@mediflow.com',    '1234', 'Admin',      TRUE,  CURRENT_TIMESTAMP),
('MH-U002', 'doctor@mediflow.com',   '1234', 'Doctor',     TRUE,  CURRENT_TIMESTAMP),
('MH-U003', 'nurse@mediflow.com',    '1234', 'Nurse',      TRUE,  CURRENT_TIMESTAMP),
('MH-U004', 'pharmacy@mediflow.com', '1234', 'Pharmacist', TRUE,  CURRENT_TIMESTAMP),
('MH-U005', 'jane@gmail.com',        '1234', 'Patient',    FALSE, NULL),
('MH-U006', 'john@gmail.com',        '1234', 'Patient',    TRUE,  CURRENT_TIMESTAMP);
```

---

## Running the app

Open **two terminals**:

```bash
# Terminal 1 — backend
cd backend
node server.js
```

```bash
# Terminal 2 — frontend
cd frontend
npm run dev
```

Then open **http://localhost:5173**.

You should see in the backend terminal:
```
Successfully connected to the MySQL database.
Successfully connected to the Firebase Realtime Database.
Backend server is running.
```

---

## Test accounts

| Role       | Email                   | Password |
| ---------- | ----------------------- | -------- |
| Admin      | `admin@mediflow.com`    | `1234`   |
| Doctor     | `doctor@mediflow.com`   | `1234`   |
| Nurse      | `nurse@mediflow.com`    | `1234`   |
| Pharmacist | `pharmacy@mediflow.com` | `1234`   |
| Patient    | `john@gmail.com`        | `1234`   |
| Patient    | `jane@gmail.com`        | `1234`   |

After login you are redirected by role (Patient → `/patient`, Admin → `/admin-dashboard`, etc.).

---

## Testing the teleconsultation video call

The video call connects two browsers via WebRTC, so you need **two separate browser sessions** —
e.g. a normal Chrome window and an Incognito window (separate sessions let both stay logged in).

1. **Patient window:** log in as `john@gmail.com`, go to **Start Consultation**, submit the
   questionnaire — this drops you into the live queue. Leave the window open.
2. **Doctor window:** log in as `doctor@mediflow.com`, then go to **http://localhost:5173/doc-consult**.
   The waiting patient appears in the queue.
3. Click **Accept & Start** on the patient. Both sides connect automatically and the two video
   feeds appear.
4. Either side can end the call; ending it on the doctor's side also ends it for the patient.

> **Camera/mic permissions:** the browser only grants these on a secure context. `http://localhost`
> is fine; accessing via a LAN IP (e.g. `http://192.168.x.x:5173`) is **not** and will block the camera.

---

## Troubleshooting

| Problem | Fix |
| --- | --- |
| `npm` blocked on Windows: *"running scripts is disabled"* | `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned` (admin PowerShell) |
| `npm install` fails with `ERESOLVE` peer dependency error | Ensure `frontend/package.json` pins `vite` to `^6.0.0` (Vite 8 is incompatible with `@vitejs/plugin-vue@5`) |
| Backend: `Error connecting to the MySQL database` | Check `backend/.env` credentials and that MySQL is running and `mediflow_db` exists |
| Backend crashes on start reading `firebase-adminsdk.json` | The service account key is missing — see setup step 3 |
| Video call connects but no remote video | Both users must allow camera/mic; access via `localhost`, not a LAN IP |
| Build warning: *"Some chunks are larger than 500 kB"* | Harmless — it's a size warning, not an error |
