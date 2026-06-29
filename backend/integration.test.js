// Integration security tests for the MediFlow API.
//
// These run against a *booted* backend with a seeded MySQL database (see
// .github/workflows/integration-test.yml and docker-compose.yml). They prove
// the runtime security controls from Deliverable 1: RBAC, object-level
// authorization, rate limiting, Stripe webhook signature verification,
// append-only audit logging, and minimal QR verification responses.
//
// Required environment (provided by the workflow):
//   BASE_URL      e.g. http://127.0.0.1:5000
//   JWT_SECRET    same value the server is running with (to mint test sessions)
//   DB_HOST/DB_USER/DB_PASSWORD/DB_NAME  to seed fixtures and assert audit rows
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import mysql from 'mysql2/promise';
import { signJwt, sessionPayload, hashToken } from './security.js';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:5000';
const JWT_SECRET = process.env.JWT_SECRET || 'ci-only-jwt-secret-change-me-32-bytes-minimum';

const TEST_PATIENT = { user_id: 'MH-ITEST1', email: 'itest-patient@example.com', role: 'Patient', token_version: 0 };
const SEED_PATIENT = { user_id: 'MH-U006', email: 'john@gmail.com', role: 'Patient', token_version: 0 };
const SEED_ADMIN = { user_id: 'MH-U001', email: 'admin@mediflow.com', role: 'Admin', token_version: 0 };

let db;
let ownedPaymentId;

function mintSession(user) {
  return signJwt(sessionPayload(user), JWT_SECRET);
}

async function api(path, { method = 'GET', session, csrf, body } = {}) {
  const headers = {};
  const cookies = [];
  if (session) cookies.push(`mf_session=${session}`);
  if (csrf) {
    cookies.push(`mf_csrf=${csrf}`);
    headers['X-CSRF-Token'] = csrf;
  }
  if (cookies.length) headers.Cookie = cookies.join('; ');
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  return fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

async function getCsrf() {
  const res = await fetch(`${BASE_URL}/api/csrf`);
  const json = await res.json();
  return json.csrfToken;
}

before(async () => {
  // Wait for the API to be reachable.
  for (let i = 0; i < 30; i += 1) {
    try {
      const res = await fetch(`${BASE_URL}/api/health`);
      if (res.ok) break;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }

  db = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'rootpass',
    database: process.env.DB_NAME || 'mediflow_db',
  });

  // A second Active patient so cross-tenant (object-level) checks are meaningful.
  await db.execute(
    `INSERT INTO users (user_id, name, email, password_hash, role, is_verified, status, token_version)
     VALUES (?, 'Integration Test Patient', ?, 'scrypt$16384$8$1$itestsalt000001$bm90LWEtcmVhbC1oYXNo', 'Patient', TRUE, 'Active', 0)
     ON DUPLICATE KEY UPDATE status = 'Active', token_version = 0`,
    [TEST_PATIENT.user_id, TEST_PATIENT.email]
  );

  const [rows] = await db.execute(
    "SELECT payment_id FROM payment_events WHERE patient_id = ? ORDER BY payment_id ASC LIMIT 1",
    [SEED_PATIENT.user_id]
  );
  ownedPaymentId = rows[0]?.payment_id;
});

after(async () => {
  if (db) {
    await db.execute('DELETE FROM users WHERE user_id = ?', [TEST_PATIENT.user_id]).catch(() => {});
    await db.end();
  }
});

// =========================================================================
test('health endpoint is reachable', async () => {
  const res = await api('/api/health');
  assert.equal(res.status, 200);
});

// --- RBAC -----------------------------------------------------------------
test('unauthenticated access to a protected route is rejected (401)', async () => {
  const res = await api('/api/staff');
  assert.equal(res.status, 401);
});

test('wrong role is rejected with 403 (RBAC)', async () => {
  const res = await api('/api/staff', { session: mintSession(SEED_PATIENT) });
  assert.equal(res.status, 403);
});

test('correct role is allowed (RBAC)', async () => {
  const res = await api('/api/staff', { session: mintSession(SEED_ADMIN) });
  assert.equal(res.status, 200);
  assert.equal(Array.isArray(await res.json()), true);
});

// --- Object-level authorization ------------------------------------------
test('owner can read their own payment; another patient cannot (object-level authz)', async () => {
  assert.ok(ownedPaymentId, 'expected a seeded payment for MH-U006');

  const ownerRes = await api(`/api/payments/${ownedPaymentId}`, { session: mintSession(SEED_PATIENT) });
  assert.equal(ownerRes.status, 200);

  const intruderRes = await api(`/api/payments/${ownedPaymentId}`, { session: mintSession(TEST_PATIENT) });
  assert.equal(intruderRes.status, 403);
});

// --- Rate limiting --------------------------------------------------------
test('login endpoint rate-limits brute force with 429', async () => {
  const csrf = await getCsrf();
  const statuses = [];
  for (let i = 0; i < 10; i += 1) {
    const res = await api('/api/login', {
      method: 'POST',
      csrf,
      body: { email: `nobody${Date.now()}@example.com`, password: 'wrong-password' },
    });
    statuses.push(res.status);
  }
  assert.ok(statuses.includes(429), `expected a 429 in ${JSON.stringify(statuses)}`);
});

// --- Secure payment verification (Stripe webhook signature) ---------------
test('payment webhook rejects requests without a valid signature', async () => {
  const missing = await api('/api/payments/webhook', { method: 'POST', body: { id: 'evt_test', type: 'checkout.session.completed' } });
  assert.equal(missing.status, 400);

  const forged = await fetch(`${BASE_URL}/api/payments/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'stripe-signature': 't=123,v1=deadbeef' },
    body: JSON.stringify({ id: 'evt_test2', type: 'checkout.session.completed' }),
  });
  assert.equal(forged.status, 400);
});

// --- Audit logging (append-only, recorded for sensitive events) -----------
test('failed logins are recorded in the audit log', async () => {
  const [rows] = await db.execute(
    "SELECT COUNT(*) AS n FROM security_audit_logs WHERE action_performed = 'LOGIN' AND outcome = 'FAILURE'"
  );
  assert.ok(Number(rows[0].n) > 0, 'expected at least one LOGIN/FAILURE audit row');
});

test('audit log is append-only (updates are blocked)', async () => {
  await assert.rejects(
    db.execute("UPDATE security_audit_logs SET outcome = 'SUCCESS' WHERE log_id = (SELECT log_id FROM (SELECT MIN(log_id) AS log_id FROM security_audit_logs) t)"),
    /append-only/i
  );
});

// --- Privacy / least privilege (public QR verification) -------------------
test('public MC verification returns minimal data and no PHI', async () => {
  const res = await api(`/api/verify/mc/${'x'.repeat(40)}`);
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.valid, false);
  // Must never leak diagnosis / patient identifiers on the public endpoint.
  assert.equal('diagnosis' in body, false);
  assert.equal('patient_id' in body, false);
});

// --- Phase 1: Account management self-service -----------------------------
test('profile read/update encrypts PHI at rest and round-trips', async () => {
  const session = mintSession(SEED_PATIENT);
  const csrf = await getCsrf();
  const upd = await api('/api/me/profile', {
    method: 'PATCH', session, csrf,
    body: { phone: '+65 8000 0001', address: '1 Test Avenue' },
  });
  assert.equal(upd.status, 200);

  const get = await api('/api/me/profile', { session });
  const body = await get.json();
  assert.equal(body.phone, '+65 8000 0001');
  assert.equal(body.address, '1 Test Avenue');

  // Stored value must be ciphertext, not plaintext.
  const [rows] = await db.execute('SELECT address_encrypted FROM users WHERE user_id = ?', [SEED_PATIENT.user_id]);
  assert.equal(rows[0].address_encrypted.startsWith('v1:'), true);
  assert.equal(rows[0].address_encrypted.includes('Test Avenue'), false);
});

test('forgot-password does not enumerate accounts', async () => {
  const csrf = await getCsrf();
  const real = await api('/api/forgot-password', { method: 'POST', csrf, body: { email: 'john@gmail.com' } });
  const fake = await api('/api/forgot-password', { method: 'POST', csrf, body: { email: 'nobody-here@example.com' } });
  assert.equal(real.status, 200);
  assert.equal(fake.status, 200);
  assert.deepEqual(await real.json(), await fake.json()); // identical response
});

test('reset-password accepts a valid token and rejects a bad one', async () => {
  const csrf = await getCsrf();
  // Bad token -> 400.
  const bad = await api('/api/reset-password', { method: 'POST', csrf, body: { token: 'z'.repeat(40), password: 'BrandNew123!' } });
  assert.equal(bad.status, 400);

  // Plant a known token hash for the test patient, then reset.
  const token = 'integration-reset-token-1234567890';
  await db.execute(
    'UPDATE users SET reset_token_hash = ?, reset_expires_at = DATE_ADD(NOW(), INTERVAL 10 MINUTE) WHERE user_id = ?',
    [hashToken(token), TEST_PATIENT.user_id]
  );
  const ok = await api('/api/reset-password', { method: 'POST', csrf, body: { token, password: 'BrandNew123!' } });
  assert.equal(ok.status, 200);
  // Token is single-use: it must be cleared after success.
  const [rows] = await db.execute('SELECT reset_token_hash FROM users WHERE user_id = ?', [TEST_PATIENT.user_id]);
  assert.equal(rows[0].reset_token_hash, null);
});

test('self-deactivation soft-deletes and revokes sessions but keeps the record', async () => {
  // Re-read token_version: earlier tests (e.g. reset-password) may have bumped it.
  const [cur] = await db.execute('SELECT token_version FROM users WHERE user_id = ?', [TEST_PATIENT.user_id]);
  const session = mintSession({ ...TEST_PATIENT, token_version: cur[0].token_version });
  const csrf = await getCsrf();
  const res = await api('/api/me', { method: 'DELETE', session, csrf });
  assert.equal(res.status, 200);
  const [rows] = await db.execute('SELECT status, deleted_at, token_version FROM users WHERE user_id = ?', [TEST_PATIENT.user_id]);
  assert.equal(rows[0].status, 'Deactivated');     // soft-deleted
  assert.notEqual(rows[0].deleted_at, null);        // retention timestamp set
  assert.equal(rows[0].token_version > 0, true);    // old sessions revoked
});

// --- Phase 2: Consultation booking + lifecycle ----------------------------
const SEED_DOCTOR = { user_id: 'MH-U002', email: 'doctor@mediflow.com', role: 'Doctor', token_version: 0 };

test('consultation lifecycle: patient books, doctor claims/starts/completes', async () => {
  const patient = mintSession(SEED_PATIENT);
  const doctor = mintSession(SEED_DOCTOR);
  const csrf = await getCsrf();

  const booked = await api('/api/consultations', { method: 'POST', session: patient, csrf, body: {} });
  assert.equal(booked.status, 201);
  const { consultationId } = await booked.json();

  const mine = await (await api('/api/consultations', { session: patient })).json();
  assert.equal(mine.some((c) => c.consultation_id === consultationId), true);

  // RBAC: a patient cannot drive the clinical state machine.
  const patientPatch = await api(`/api/consultations/${consultationId}`, { method: 'PATCH', session: patient, csrf, body: { action: 'start' } });
  assert.equal(patientPatch.status, 403);

  for (const action of ['claim', 'start', 'complete']) {
    const r = await api(`/api/consultations/${consultationId}`, { method: 'PATCH', session: doctor, csrf, body: { action } });
    assert.equal(r.status, 200);
  }
  const [rows] = await db.execute('SELECT doctor_id, session_status FROM consultations WHERE consultation_id = ?', [consultationId]);
  assert.equal(rows[0].doctor_id, SEED_DOCTOR.user_id);
  assert.equal(rows[0].session_status, 'Completed');
});

test('object-level: a doctor cannot act on a consultation assigned to another doctor', async () => {
  await db.execute(
    `INSERT INTO users (user_id, name, email, password_hash, role, is_verified, status, token_version)
     VALUES ('MH-DTEST', 'Other Doctor', 'other-doc@example.com', 'scrypt$16384$8$1$x$bm9o', 'Doctor', TRUE, 'Active', 0)
     ON DUPLICATE KEY UPDATE status='Active', token_version=0`
  );
  const patient = mintSession(SEED_PATIENT);
  const owner = mintSession(SEED_DOCTOR);
  const intruder = mintSession({ user_id: 'MH-DTEST', email: 'other-doc@example.com', role: 'Doctor', token_version: 0 });
  const csrf = await getCsrf();

  const { consultationId } = await (await api('/api/consultations', { method: 'POST', session: patient, csrf, body: {} })).json();
  await api(`/api/consultations/${consultationId}`, { method: 'PATCH', session: owner, csrf, body: { action: 'claim' } });
  // A different doctor must not be able to start it.
  const intruderStart = await api(`/api/consultations/${consultationId}`, { method: 'PATCH', session: intruder, csrf, body: { action: 'start' } });
  assert.equal(intruderStart.status, 403);
});

// --- Phase 3: Pharmacy inventory + fulfilment -----------------------------
const SEED_PHARMACIST = { user_id: 'MH-U004', email: 'pharmacy@mediflow.com', role: 'Pharmacist', token_version: 0 };

test('pharmacy: prescribe from inventory -> fulfil -> stock decremented', async () => {
  const doctor = mintSession(SEED_DOCTOR);
  const pharmacist = mintSession(SEED_PHARMACIST);
  const csrf = await getCsrf();

  const inv = await api('/api/inventory', { session: doctor });
  assert.equal(inv.status, 200);
  const before = (await inv.json()).find((m) => m.medication_id === 'MED-PARA500').stock_quantity;

  // Seed consultation MH-C002 = doctor MH-U002 + patient MH-U005.
  const rx = await api('/api/prescriptions', {
    method: 'POST', session: doctor, csrf,
    body: { consultationId: 'MH-C002', patientId: 'MH-U005', medicationId: 'MED-PARA500', dosage: '1 tab', frequency: 'BD' },
  });
  assert.equal(rx.status, 201);
  const { prescriptionId } = await rx.json();

  const queue = await (await api('/api/pharmacy/queue', { session: pharmacist })).json();
  assert.equal(queue.some((p) => p.prescription_id === prescriptionId), true);

  const ful = await api(`/api/prescriptions/${prescriptionId}/fulfil`, { method: 'POST', session: pharmacist, csrf });
  assert.equal(ful.status, 200);

  const [stock] = await db.execute('SELECT stock_quantity FROM medication_inventory WHERE medication_id = ?', ['MED-PARA500']);
  assert.equal(stock[0].stock_quantity, before - 1);
  const [pr] = await db.execute('SELECT status FROM prescriptions WHERE prescription_id = ?', [prescriptionId]);
  assert.equal(pr[0].status, 'Fulfilled');
});

test('pharmacy: out-of-stock medication cannot be fulfilled (oversell prevented)', async () => {
  const doctor = mintSession(SEED_DOCTOR);
  const pharmacist = mintSession(SEED_PHARMACIST);
  const csrf = await getCsrf();
  const rx = await api('/api/prescriptions', {
    method: 'POST', session: doctor, csrf,
    body: { consultationId: 'MH-C002', patientId: 'MH-U005', medicationId: 'MED-IBU400', dosage: '1 tab', frequency: 'TDS' },
  });
  const { prescriptionId } = await rx.json();
  const ful = await api(`/api/prescriptions/${prescriptionId}/fulfil`, { method: 'POST', session: pharmacist, csrf });
  assert.equal(ful.status, 409); // MED-IBU400 seeded with 0 stock
});

test('pharmacy: a patient cannot fulfil prescriptions (RBAC)', async () => {
  const csrf = await getCsrf();
  const res = await api('/api/prescriptions/RX-anything/fulfil', { method: 'POST', session: mintSession(SEED_PATIENT), csrf });
  assert.equal(res.status, 403);
});
