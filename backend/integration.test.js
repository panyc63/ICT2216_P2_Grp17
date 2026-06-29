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
import { signJwt, sessionPayload } from './security.js';

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
