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
import { signJwt, sessionPayload, hashToken, sha256 } from './security.js';
import { runCleanup } from './cleanup.js';
import { totpToken } from './totp.js';

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

test('staff onboarding is restricted to workplace email domains', async () => {
  await db.execute("DELETE FROM users WHERE email = 'newdoc@mediflow.com'").catch(() => {});
  const admin = mintSession(SEED_ADMIN);
  const csrf = await getCsrf();
  // A generic inbox cannot be provisioned as a privileged (Doctor) account.
  const bad = await api('/api/staff', { method: 'POST', session: admin, csrf, body: { name: 'Gmail Doc', email: 'quack@gmail.com', password: 'Password123!', role: 'Doctor' } });
  assert.equal(bad.status, 400);
  // The official workplace domain is accepted.
  const good = await api('/api/staff', { method: 'POST', session: admin, csrf, body: { name: 'Clinic Doc', email: 'newdoc@mediflow.com', password: 'Password123!', role: 'Doctor' } });
  assert.equal(good.status, 201);
});

// --- Account verification (demo mode: no email provider) ------------------
test('registration returns a verification link when email delivery is unavailable, and that link activates the account', async () => {
  const email = `itest-verify-${Date.now()}@example.com`;
  const password = 'Password123!';
  await db.execute('DELETE FROM users WHERE email = ?', [email]).catch(() => {});
  const csrf = await getCsrf();

  // The harness runs with no RESEND_API_KEY (transporter null), so registration must surface
  // the verification link in the response so the account can still be activated.
  const register = await api('/api/register', { method: 'POST', csrf, body: { name: 'Verify Me', email, password } });
  assert.equal(register.status, 201);
  const body = await register.json();
  assert.equal(body.user.status, 'PendingVerification');
  assert.ok(typeof body.verificationUrl === 'string', 'expected a verificationUrl in the response');
  assert.ok(body.verificationUrl.includes('/api/verify-email/'), `unexpected verificationUrl: ${body.verificationUrl}`);

  // Login is blocked until the email is verified.
  const preVerifyLogin = await api('/api/login', { method: 'POST', csrf: await getCsrf(), body: { email, password } });
  assert.equal(preVerifyLogin.status, 403);

  // Hitting the returned link's token activates the account (status flips to Active).
  const verifyPath = new URL(body.verificationUrl).pathname;
  const verify = await api(verifyPath);
  assert.equal(verify.status, 200);
  const [rows] = await db.execute('SELECT status, is_verified FROM users WHERE email = ?', [email]);
  assert.equal(rows[0].status, 'Active');
  assert.equal(Number(rows[0].is_verified), 1);

  // And login now succeeds for the (Patient, MFA-not-required) account.
  const postVerifyLogin = await api('/api/login', { method: 'POST', csrf: await getCsrf(), body: { email, password } });
  assert.equal(postVerifyLogin.status, 200);

  await db.execute('DELETE FROM users WHERE email = ?', [email]).catch(() => {});
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
test('login endpoint rate-limits brute force with 429 and the standardized JSON shape', async () => {
  const csrf = await getCsrf();
  const statuses = [];
  let throttledBody = null;
  let retryAfter = null;
  for (let i = 0; i < 10; i += 1) {
    const res = await api('/api/login', {
      method: 'POST',
      csrf,
      body: { email: `nobody${Date.now()}@example.com`, password: 'wrong-password' },
    });
    statuses.push(res.status);
    if (res.status === 429) {
      throttledBody = await res.json();
      retryAfter = res.headers.get('retry-after');
    }
  }
  // Crypto tier is 5 / 15 min, so 10 rapid attempts must trip the limiter.
  assert.ok(statuses.includes(429), `expected a 429 in ${JSON.stringify(statuses)}`);
  // Standardized graceful 429 payload + Retry-After header.
  assert.deepEqual(throttledBody, { status: 'error', message: 'Too many requests. Please retry later.' });
  assert.ok(Number(retryAfter) > 0, 'expected a positive Retry-After header');
});

test('session is bound to the User-Agent: same UA is accepted, a different UA is rejected (401)', async () => {
  const ua = 'Mozilla/5.0 (E2E Original Browser)';
  const token = signJwt(sessionPayload(SEED_DOCTOR, { ua_hash: sha256(ua) }), JWT_SECRET);
  const same = await fetch(`${BASE_URL}/api/me`, { headers: { Cookie: `mf_session=${token}`, 'User-Agent': ua } });
  assert.equal(same.status, 200);
  const different = await fetch(`${BASE_URL}/api/me`, { headers: { Cookie: `mf_session=${token}`, 'User-Agent': 'AttackerAgent/9.9' } });
  assert.equal(different.status, 401);
});

test('session past the 8h absolute lifetime is rejected even with a live access token', async () => {
  const ua = 'Mozilla/5.0 (E2E Original Browser)';
  const nineHoursAgo = Math.floor(Date.now() / 1000) - 9 * 60 * 60;
  // Fresh token (exp = now + 15 min) but auth_time is 9h old -> absolute cap must reject it.
  const token = signJwt(sessionPayload(SEED_DOCTOR, { auth_time: nineHoursAgo, ua_hash: sha256(ua) }), JWT_SECRET);
  const res = await fetch(`${BASE_URL}/api/me`, { headers: { Cookie: `mf_session=${token}`, 'User-Agent': ua } });
  assert.equal(res.status, 401);
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

// --- Phase 4: chat (MySQL, encrypted) object-level authorization ----------
test('chat: owner patient + assigned doctor exchange messages; a different patient is blocked', async () => {
  await db.execute(
    `INSERT INTO users (user_id, name, email, password_hash, role, is_verified, status, token_version)
     VALUES ('MH-CINTRUDER', 'Other Patient', 'other-pt@example.com', 'scrypt$16384$8$1$x$bm9o', 'Patient', TRUE, 'Active', 0)
     ON DUPLICATE KEY UPDATE status='Active', token_version=0`
  );
  const patient = mintSession(SEED_PATIENT);
  const doctor = mintSession(SEED_DOCTOR);
  const intruder = mintSession({ user_id: 'MH-CINTRUDER', email: 'other-pt@example.com', role: 'Patient', token_version: 0 });
  const csrf = await getCsrf();

  const { consultationId } = await (await api('/api/consultations', { method: 'POST', session: patient, csrf, body: {} })).json();
  await api(`/api/consultations/${consultationId}`, { method: 'PATCH', session: doctor, csrf, body: { action: 'claim' } });

  // Owner patient posts; assigned doctor reads the decrypted body.
  const sent = await api(`/api/consultations/${consultationId}/messages`, { method: 'POST', session: patient, csrf, body: { messageBody: 'Hello doctor' } });
  assert.equal(sent.status, 201);
  const docRead = await api(`/api/consultations/${consultationId}/messages`, { session: doctor });
  assert.equal(docRead.status, 200);
  assert.equal((await docRead.json()).some((m) => m.messageBody === 'Hello doctor'), true);

  // A different patient can neither read nor post (object-level authz).
  assert.equal((await api(`/api/consultations/${consultationId}/messages`, { session: intruder })).status, 403);
  const intruderPost = await api(`/api/consultations/${consultationId}/messages`, { method: 'POST', session: intruder, csrf, body: { messageBody: 'sneaky' } });
  assert.equal(intruderPost.status, 403);
});

// --- Payment: amount is computed server-side, never trusted from the client -
test('payment: checkout amount is server-derived and ignores a client-supplied amount', async () => {
  const patient = mintSession(SEED_PATIENT);
  const csrf = await getCsrf();

  const quote = await (await api('/api/payments/quote', { session: patient })).json();
  assert.equal(typeof quote.amountCents, 'number');
  assert.equal(quote.amountCents, quote.consultationFeeCents + quote.medicationCents);
  assert.ok(quote.consultationFeeCents > 0);

  // Malicious client tries to pay 1 cent; the server must ignore req.body.amountCents.
  const res = await api('/api/payments/checkout', { method: 'POST', session: patient, csrf, body: { amountCents: 1 } });
  assert.equal(res.status, 201);
  const checkout = await res.json();
  assert.equal(checkout.amountCents, quote.amountCents);
  assert.notEqual(checkout.amountCents, 1);

  const [rows] = await db.execute('SELECT amount_cents FROM payment_events WHERE checkout_reference = ?', [checkout.checkoutReference]);
  assert.equal(rows[0].amount_cents, quote.amountCents);
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

// --- Phase 6: Asymmetric (Ed25519) MC signing + public verification -------
test('MC is signed with the doctor key and publicly verifiable; tamper fails', async () => {
  const doctor = mintSession(SEED_DOCTOR);
  const csrf = await getCsrf();
  // Seed consultation MH-C001 (doctor MH-U002 + patient MH-U006) has a Paid payment.
  const issued = await api('/api/medical-certificates', {
    method: 'POST', session: doctor, csrf,
    body: { consultationId: 'MH-C001', patientId: 'MH-U006', diagnosis: 'Acute viral pharyngitis', validUntil: '2030-01-01' },
  });
  assert.equal(issued.status, 201);
  const { verificationToken } = await issued.json();
  assert.ok(verificationToken && verificationToken.includes('.'));

  // Public QR verification succeeds and returns only minimal, non-PHI fields.
  const ok = await api(`/api/verify/mc/${verificationToken}`);
  assert.equal(ok.status, 200);
  const body = await ok.json();
  assert.equal(body.valid, true);
  assert.equal('diagnosis' in body, false);

  // A tampered token must fail (different hash -> no match, or bad signature).
  const tampered = await api(`/api/verify/mc/${verificationToken}x`);
  assert.ok([400, 404].includes(tampered.status));

  // The doctor now has a stored public key (private key is encrypted at rest).
  const [rows] = await db.execute('SELECT mc_public_key, mc_private_key_encrypted FROM users WHERE user_id = ?', [SEED_DOCTOR.user_id]);
  assert.ok(rows[0].mc_public_key.includes('BEGIN PUBLIC KEY'));
  assert.equal(rows[0].mc_private_key_encrypted.startsWith('v1:'), true);
});

// --- Phase 4/5: secure uploads, realtime + WebRTC feature flags -----------
async function uploadFile(consultationId, session, csrf, bytes, name, type) {
  const form = new FormData();
  form.append('file', new Blob([bytes], { type }), name);
  return fetch(`${BASE_URL}/api/consultations/${consultationId}/attachments/upload`, {
    method: 'POST',
    headers: { Cookie: `mf_session=${session}; mf_csrf=${csrf}`, 'X-CSRF-Token': csrf },
    body: form,
  });
}

test('upload: clean file is scanned, stored, and downloadable only by participants', async () => {
  const session = mintSession(SEED_PATIENT); // patient of MH-C001
  const csrf = await getCsrf();
  const res = await uploadFile('MH-C001', session, csrf, Buffer.from('hello world'), 'rash.png', 'image/png');
  assert.equal(res.status, 201);
  const { attachmentId } = await res.json();

  const ok = await api(`/api/attachments/${attachmentId}`, { session });
  assert.equal(ok.status, 200);

  // A fresh, active patient who is not a participant must be denied (object-level authz).
  await db.execute(
    `INSERT INTO users (user_id, name, email, password_hash, role, is_verified, status, token_version)
     VALUES ('MH-ITEST2', 'Intruder Patient', 'itest2@example.com', 'scrypt$16384$8$1$x$bm9o', 'Patient', TRUE, 'Active', 0)
     ON DUPLICATE KEY UPDATE status='Active', token_version=0`
  );
  const intruderSession = mintSession({ user_id: 'MH-ITEST2', email: 'itest2@example.com', role: 'Patient', token_version: 0 });
  const intruder = await api(`/api/attachments/${attachmentId}`, { session: intruderSession });
  assert.equal(intruder.status, 403);
  await db.execute("DELETE FROM users WHERE user_id = 'MH-ITEST2'").catch(() => {});
});

test('upload: a file containing the EICAR signature is blocked (422)', async () => {
  const session = mintSession(SEED_PATIENT);
  const csrf = await getCsrf();
  const eicar = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';
  const res = await uploadFile('MH-C001', session, csrf, Buffer.from(eicar), 'rash.png', 'image/png');
  assert.equal(res.status, 422);
});

test('realtime token is 503 (Firebase unconfigured) but WebRTC ICE works via STUN (no ports)', async () => {
  const session = mintSession(SEED_PATIENT);
  const csrf = await getCsrf();
  assert.equal((await api('/api/realtime/token', { method: 'POST', session, csrf })).status, 503);
  // ICE no longer 503: public STUN is always returned so 1:1 P2P video needs no inbound ports.
  const rtc = await api('/api/consultations/MH-C001/rtc-credentials', { session });
  assert.equal(rtc.status, 200);
  const body = await rtc.json();
  assert.ok(Array.isArray(body.iceServers) && body.iceServers.length >= 1);
  assert.ok(body.iceServers.some((s) => String(s.urls).startsWith('stun:')));
});

test('signaling relay: participants exchange offer/candidate; a third party is blocked (403)', async () => {
  await db.execute(
    `INSERT INTO users (user_id, name, email, password_hash, role, is_verified, status, token_version)
     VALUES ('MH-SIGINT', 'Sig Intruder', 'sig-intruder@example.com', 'scrypt$16384$8$1$x$bm9o', 'Patient', TRUE, 'Active', 0)
     ON DUPLICATE KEY UPDATE status='Active', token_version=0`
  );
  const patient = mintSession(SEED_PATIENT);
  const doctor = mintSession(SEED_DOCTOR);
  const intruder = mintSession({ user_id: 'MH-SIGINT', email: 'sig-intruder@example.com', role: 'Patient', token_version: 0 });
  const csrf = await getCsrf();

  const { consultationId } = await (await api('/api/consultations', { method: 'POST', session: patient, csrf, body: {} })).json();
  await api(`/api/consultations/${consultationId}`, { method: 'PATCH', session: doctor, csrf, body: { action: 'claim' } });

  // Regression: the frontend's first poll is `?since=0`, which must be accepted (was a 400).
  const firstPoll = await api(`/api/consultations/${consultationId}/signal?since=0`, { session: patient });
  assert.equal(firstPoll.status, 200);

  // Doctor posts an offer; patient (peer) sees it; doctor does NOT see their own.
  assert.equal((await api(`/api/consultations/${consultationId}/signal`, { method: 'POST', session: doctor, csrf, body: { kind: 'offer', payload: '{"type":"offer"}' } })).status, 201);
  const peerView = await (await api(`/api/consultations/${consultationId}/signal?since=0`, { session: patient })).json();
  assert.equal(peerView.some((s) => s.kind === 'offer'), true);
  const selfView = await (await api(`/api/consultations/${consultationId}/signal`, { session: doctor })).json();
  assert.equal(selfView.length, 0);

  // A non-participant can neither read nor post signals.
  assert.equal((await api(`/api/consultations/${consultationId}/signal`, { session: intruder })).status, 403);
  assert.equal((await api(`/api/consultations/${consultationId}/signal`, { method: 'POST', session: intruder, csrf, body: { kind: 'candidate', payload: '{}' } })).status, 403);
});

test('a new offer wipes stale signalling so peers never replay old sessions', async () => {
  const patient = mintSession(SEED_PATIENT);
  const doctor = mintSession(SEED_DOCTOR);
  const csrf = await getCsrf();
  const { consultationId } = await (await api('/api/consultations', { method: 'POST', session: patient, csrf, body: {} })).json();
  await api(`/api/consultations/${consultationId}`, { method: 'PATCH', session: doctor, csrf, body: { action: 'claim' } });

  // Leftover signalling from a previous attempt (both sides).
  await api(`/api/consultations/${consultationId}/signal`, { method: 'POST', session: doctor, csrf, body: { kind: 'offer', payload: '{"type":"offer","gen":1}' } });
  await api(`/api/consultations/${consultationId}/signal`, { method: 'POST', session: patient, csrf, body: { kind: 'answer', payload: '{"type":"answer"}' } });
  await api(`/api/consultations/${consultationId}/signal`, { method: 'POST', session: patient, csrf, body: { kind: 'candidate', payload: '{"stale":true}' } });

  // A fresh offer clears everything and inserts only itself.
  await api(`/api/consultations/${consultationId}/signal`, { method: 'POST', session: doctor, csrf, body: { kind: 'offer', payload: '{"type":"offer","gen":2}' } });
  const [rows] = await db.execute('SELECT COUNT(*) AS n FROM signaling_messages WHERE consultation_id = ?', [consultationId]);
  assert.equal(rows[0].n, 1); // only the new offer survives
});

test('triage opens a linked consultation and shortnessOfBreath drives Emergency priority', async () => {
  const patient = mintSession(SEED_PATIENT);
  const csrf = await getCsrf();
  const res = await api('/api/triage', {
    method: 'POST', session: patient, csrf,
    body: { fever: 'No', cough: 'No', shortnessOfBreath: 'Yes', chestPain: 'None', duration: '2 days' },
  });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.priority, 'Emergency');
  assert.ok(body.consultationId);
  // The triage created a real, linked Pending consultation carrying the priority.
  const [rows] = await db.execute('SELECT session_status, priority, triage_id FROM consultations WHERE consultation_id = ?', [body.consultationId]);
  assert.equal(rows[0].session_status, 'Pending');
  assert.equal(rows[0].priority, 'Emergency');
  assert.equal(String(rows[0].triage_id), String(body.triageId));
});

test('recording is doctor-gated and requires patient consent', async () => {
  const doctor = mintSession(SEED_DOCTOR);
  const csrf = await getCsrf();
  // Patient cannot start a recording (RBAC).
  assert.equal((await api('/api/consultations/MH-C001/recording', { method: 'POST', session: mintSession(SEED_PATIENT), csrf, body: { consent: true } })).status, 403);
  // Doctor without consent -> 400; with consent -> 201.
  assert.equal((await api('/api/consultations/MH-C001/recording', { method: 'POST', session: doctor, csrf, body: { consent: false } })).status, 400);
  assert.equal((await api('/api/consultations/MH-C001/recording', { method: 'POST', session: doctor, csrf, body: { consent: true } })).status, 201);
});

// --- New endpoints: staff directory / recordings / doctor Rx history -------
test('staff directory /api/doctors is staff-only (Nurse allowed, Patient rejected)', async () => {
  const nurse = mintSession({ user_id: 'MH-U003', email: 'nurse@mediflow.com', role: 'Nurse', token_version: 0 });
  const list = await api('/api/doctors', { session: nurse });
  assert.equal(list.status, 200);
  const doctors = await list.json();
  assert.equal(Array.isArray(doctors), true);
  assert.equal(doctors.some((d) => d.user_id === SEED_DOCTOR.user_id), true);
  // Only Active doctors, and no credential columns leak.
  assert.equal('password_hash' in (doctors[0] || {}), false);
  // A patient has no business enumerating staff.
  assert.equal((await api('/api/doctors', { session: mintSession(SEED_PATIENT) })).status, 403);
});

test('recordings archive /api/recordings is Admin-only', async () => {
  assert.equal((await api('/api/recordings', { session: mintSession(SEED_ADMIN) })).status, 200);
  assert.equal((await api('/api/recordings', { session: mintSession(SEED_DOCTOR) })).status, 403);
  assert.equal((await api('/api/recordings', { session: mintSession(SEED_PATIENT) })).status, 403);
});

test('doctor prescription history /api/doctor/prescriptions is Doctor-only and scoped to the doctor', async () => {
  const res = await api('/api/doctor/prescriptions', { session: mintSession(SEED_DOCTOR) });
  assert.equal(res.status, 200);
  const rows = await res.json();
  assert.equal(Array.isArray(rows), true);
  // Every row belongs to this doctor (server scopes by doctor_id = req.user).
  assert.equal(rows.every((r) => r.patient_name !== undefined), true);
  assert.equal((await api('/api/doctor/prescriptions', { session: mintSession(SEED_PATIENT) })).status, 403);
});

// --- Security fix: a Nurse cannot drive clinical (start/complete) state -----
test('a Nurse cannot start or complete a consultation but may assign one (least privilege)', async () => {
  const nurse = mintSession({ user_id: 'MH-U003', email: 'nurse@mediflow.com', role: 'Nurse', token_version: 0 });
  const patient = mintSession(SEED_PATIENT);
  const csrf = await getCsrf();
  const { consultationId } = await (await api('/api/consultations', { method: 'POST', session: patient, csrf, body: {} })).json();

  assert.equal((await api(`/api/consultations/${consultationId}`, { method: 'PATCH', session: nurse, csrf, body: { action: 'start' } })).status, 403);
  assert.equal((await api(`/api/consultations/${consultationId}`, { method: 'PATCH', session: nurse, csrf, body: { action: 'complete' } })).status, 403);
  // Assignment is a legitimate nurse action.
  assert.equal((await api(`/api/consultations/${consultationId}`, { method: 'PATCH', session: nurse, csrf, body: { action: 'assign', doctorId: SEED_DOCTOR.user_id } })).status, 200);
});

// --- Security fix: payment object-level authz includes the assigned doctor --
test('payment: the assigned doctor may read a patient payment; an unlinked doctor may not', async () => {
  assert.ok(ownedPaymentId, 'expected a seeded payment for MH-U006');
  // The seeded payment references MH-C001, which is assigned to SEED_DOCTOR (MH-U002).
  assert.equal((await api(`/api/payments/${ownedPaymentId}`, { session: mintSession(SEED_DOCTOR) })).status, 200);
  // A different doctor with no link to this patient/consultation is refused.
  await db.execute(
    `INSERT INTO users (user_id, name, email, password_hash, role, is_verified, status, token_version)
     VALUES ('MH-DPAY', 'Unlinked Doctor', 'unlinked-doc@example.com', 'scrypt$16384$8$1$x$bm9o', 'Doctor', TRUE, 'Active', 0)
     ON DUPLICATE KEY UPDATE status='Active', token_version=0`
  );
  const other = mintSession({ user_id: 'MH-DPAY', email: 'unlinked-doc@example.com', role: 'Doctor', token_version: 0 });
  assert.equal((await api(`/api/payments/${ownedPaymentId}`, { session: other })).status, 403);
});

// --- Data coherence: triage <-> consultation stay in sync ------------------
test('nurse discharging a waiting patient cancels the linked pending consultation', async () => {
  const patient = mintSession(SEED_PATIENT);
  const nurse = mintSession({ user_id: 'MH-U003', email: 'nurse@mediflow.com', role: 'Nurse', token_version: 0 });
  const csrf = await getCsrf();
  // Triage opens a Pending consultation linked by triage_id.
  const { triageId, consultationId } = await (await api('/api/triage', {
    method: 'POST', session: patient, csrf,
    body: { fever: 'No', cough: 'No', chestPain: 'None', duration: '1 day' },
  })).json();

  const discharged = await api(`/api/nurse/queue/${triageId}`, { method: 'PATCH', session: nurse, csrf, body: { status: 'Discharged' } });
  assert.equal(discharged.status, 200);
  const [rows] = await db.execute('SELECT session_status FROM consultations WHERE consultation_id = ?', [consultationId]);
  assert.equal(rows[0].session_status, 'Cancelled');
});

test('a doctor completing a consultation marks the linked triage Completed', async () => {
  const patient = mintSession(SEED_PATIENT);
  const doctor = mintSession(SEED_DOCTOR);
  const csrf = await getCsrf();
  const { triageId, consultationId } = await (await api('/api/triage', {
    method: 'POST', session: patient, csrf,
    body: { fever: 'Yes', cough: 'No', chestPain: 'None', duration: '1 day' },
  })).json();
  for (const action of ['claim', 'start', 'complete']) {
    assert.equal((await api(`/api/consultations/${consultationId}`, { method: 'PATCH', session: doctor, csrf, body: { action } })).status, 200);
  }
  const [rows] = await db.execute('SELECT status FROM triage_submissions WHERE triage_id = ?', [triageId]);
  assert.equal(rows[0].status, 'Completed');
});

// --- Least-privilege: object-scoped MC revoke + nurse cancel boundary -------
test('MC revoke is scoped to the issuing doctor: another doctor is refused, an admin may', async () => {
  const doctor = mintSession(SEED_DOCTOR);           // MH-U002 issues the certificate
  const csrf = await getCsrf();
  const issued = await api('/api/medical-certificates', {
    method: 'POST', session: doctor, csrf,
    body: { consultationId: 'MH-C001', patientId: 'MH-U006', diagnosis: 'Tension headache', validUntil: '2030-01-01' },
  });
  assert.equal(issued.status, 201);
  const { mcId } = await issued.json();
  assert.ok(mcId);

  // A different doctor must not be able to revoke a certificate they did not issue.
  await db.execute(
    `INSERT INTO users (user_id, name, email, password_hash, role, is_verified, status, token_version)
     VALUES ('MH-DREVOKE', 'Other Doctor', 'other-revoke@example.com', 'scrypt$16384$8$1$x$bm9o', 'Doctor', TRUE, 'Active', 0)
     ON DUPLICATE KEY UPDATE status='Active', token_version=0`
  );
  const otherDoctor = mintSession({ user_id: 'MH-DREVOKE', email: 'other-revoke@example.com', role: 'Doctor', token_version: 0 });
  assert.equal((await api(`/api/medical-certificates/${mcId}/revoke`, { method: 'POST', session: otherDoctor, csrf, body: {} })).status, 403);
  let [rows] = await db.execute('SELECT is_revoked FROM medical_certificates WHERE mc_id = ?', [mcId]);
  assert.equal(Boolean(rows[0].is_revoked), false);  // the refused attempt changed nothing

  // An admin may revoke any certificate.
  const admin = mintSession({ user_id: 'MH-U001', email: 'admin@mediflow.com', role: 'Admin', token_version: 0 });
  assert.equal((await api(`/api/medical-certificates/${mcId}/revoke`, { method: 'POST', session: admin, csrf, body: {} })).status, 200);
  [rows] = await db.execute('SELECT is_revoked FROM medical_certificates WHERE mc_id = ?', [mcId]);
  assert.equal(Boolean(rows[0].is_revoked), true);
});

test('a nurse may cancel a pending consultation but not an active one (least privilege)', async () => {
  const patient = mintSession(SEED_PATIENT);
  const doctor = mintSession(SEED_DOCTOR);
  const nurse = mintSession({ user_id: 'MH-U003', email: 'nurse@mediflow.com', role: 'Nurse', token_version: 0 });
  const csrf = await getCsrf();

  // Pending consultation: a nurse cancel is allowed (equivalent to a queue discharge).
  const { consultationId: pending } = await (await api('/api/consultations', { method: 'POST', session: patient, csrf, body: {} })).json();
  assert.equal((await api(`/api/consultations/${pending}`, { method: 'PATCH', session: nurse, csrf, body: { action: 'cancel' } })).status, 200);

  // Active (in-progress clinical) consultation: a nurse cancel is refused and state is unchanged.
  const { consultationId: active } = await (await api('/api/consultations', { method: 'POST', session: patient, csrf, body: {} })).json();
  await api(`/api/consultations/${active}`, { method: 'PATCH', session: doctor, csrf, body: { action: 'claim' } });
  await api(`/api/consultations/${active}`, { method: 'PATCH', session: doctor, csrf, body: { action: 'start' } });
  assert.equal((await api(`/api/consultations/${active}`, { method: 'PATCH', session: nurse, csrf, body: { action: 'cancel' } })).status, 403);
  const [rows] = await db.execute('SELECT session_status FROM consultations WHERE consultation_id = ?', [active]);
  assert.equal(rows[0].session_status, 'Active');
});

// --- Medication collection: delivery gating + receipt confirmation ---------
test('medication: delivery needs an address, self-collect is always allowed, receipt confirms dispatch', async () => {
  await db.execute(
    `INSERT INTO users (user_id, name, email, password_hash, role, is_verified, status, token_version, address_encrypted)
     VALUES ('MH-PMED', 'Med Test Patient', 'med-pt@example.com', 'scrypt$16384$8$1$x$bm9o', 'Patient', TRUE, 'Active', 0, NULL)
     ON DUPLICATE KEY UPDATE status='Active', token_version=0, address_encrypted=NULL`
  );
  await db.execute(
    `INSERT INTO consultations (consultation_id, patient_id, doctor_id, session_status)
     VALUES ('MH-CMED', 'MH-PMED', 'MH-U002', 'Active')
     ON DUPLICATE KEY UPDATE session_status='Active'`
  );
  await db.execute(
    `INSERT INTO prescriptions (prescription_id, consultation_id, patient_id, doctor_id, medication_id, medication_name, dosage, frequency, refills, status, collection_method, delivered_at)
     VALUES ('RX-MED-1', 'MH-CMED', 'MH-PMED', 'MH-U002', 'MED-PARA500', 'Paracetamol 500mg', '1 tab', 'BD', 0, 'Issued', 'SelfCollect', NULL)
     ON DUPLICATE KEY UPDATE status='Issued', collection_method='SelfCollect', delivered_at=NULL`
  );
  const patient = mintSession({ user_id: 'MH-PMED', email: 'med-pt@example.com', role: 'Patient', token_version: 0 });
  const csrf = await getCsrf();

  // Delivery without an address on file is rejected.
  assert.equal((await api('/api/patient/prescriptions/RX-MED-1/collection', { method: 'PATCH', session: patient, csrf, body: { method: 'Delivery' } })).status, 400);
  // Self-collect is always allowed.
  assert.equal((await api('/api/patient/prescriptions/RX-MED-1/collection', { method: 'PATCH', session: patient, csrf, body: { method: 'SelfCollect' } })).status, 200);
  // Add an address, then delivery is allowed and persists.
  await api('/api/me/profile', { method: 'PATCH', session: patient, csrf, body: { address: '1 Test Ave, Singapore' } });
  assert.equal((await api('/api/patient/prescriptions/RX-MED-1/collection', { method: 'PATCH', session: patient, csrf, body: { method: 'Delivery' } })).status, 200);
  // Receipt cannot be confirmed before dispatch (still Issued).
  assert.equal((await api('/api/patient/prescriptions/RX-MED-1/receipt', { method: 'POST', session: patient, csrf })).status, 400);
  // Pharmacist fulfils (dispatch); patient then confirms receipt.
  assert.equal((await api('/api/prescriptions/RX-MED-1/fulfil', { method: 'POST', session: mintSession(SEED_PHARMACIST), csrf })).status, 200);
  assert.equal((await api('/api/patient/prescriptions/RX-MED-1/receipt', { method: 'POST', session: patient, csrf })).status, 200);
  const [rows] = await db.execute('SELECT collection_method, delivered_at FROM prescriptions WHERE prescription_id = ?', ['RX-MED-1']);
  assert.equal(rows[0].collection_method, 'Delivery');
  assert.ok(rows[0].delivered_at);
});

// --- Authenticator-app TOTP (Admin/Doctor step-up) -------------------------
test('totp: enroll options return a base32 secret + otpauth URI for a doctor; a patient is refused', async () => {
  const doctor = mintSession(SEED_DOCTOR);
  const patient = mintSession(SEED_PATIENT);
  const csrf = await getCsrf();
  // Clean slate for the seed doctor so the test is idempotent across re-runs.
  await db.execute("UPDATE users SET totp_secret_encrypted = NULL, totp_enabled = FALSE, totp_enrolled_at = NULL WHERE user_id = ?", [SEED_DOCTOR.user_id]);
  const opts = await api('/api/totp/enroll/options', { method: 'POST', session: doctor, csrf, body: {} });
  assert.equal(opts.status, 200);
  const body = await opts.json();
  assert.match(body.secret, /^[A-Z2-7]+$/);
  assert.match(body.otpauthUrl, /^otpauth:\/\/totp\//);
  // TOTP step-up is a privileged-account feature — a patient cannot use the endpoints.
  assert.equal((await api('/api/totp/enroll/options', { method: 'POST', session: patient, csrf, body: {} })).status, 403);
});

test('totp: a correct code confirms enrollment, a wrong code is rejected, and disable needs a valid code', async () => {
  const doctor = mintSession(SEED_DOCTOR);
  const csrf = await getCsrf();
  await db.execute("UPDATE users SET totp_secret_encrypted = NULL, totp_enabled = FALSE, totp_enrolled_at = NULL WHERE user_id = ?", [SEED_DOCTOR.user_id]);
  const secret = (await (await api('/api/totp/enroll/options', { method: 'POST', session: doctor, csrf, body: {} })).json()).secret;

  // Wrong code cannot confirm enrollment.
  assert.equal((await api('/api/totp/enroll/verify', { method: 'POST', session: doctor, csrf, body: { token: '000000' } })).status, 400);
  // The genuine current code confirms it and flips the DB flag.
  const confirm = await api('/api/totp/enroll/verify', { method: 'POST', session: doctor, csrf, body: { token: totpToken(secret) } });
  assert.equal(confirm.status, 200);
  assert.equal((await confirm.json()).enabled, true);
  const [rows] = await db.execute("SELECT totp_enabled FROM users WHERE user_id = ?", [SEED_DOCTOR.user_id]);
  assert.equal(Number(rows[0].totp_enabled), 1);

  // Step-up with a live code succeeds; a bad code is forbidden.
  assert.equal((await api('/api/totp/verify', { method: 'POST', session: doctor, csrf, body: { token: totpToken(secret) } })).status, 200);
  assert.equal((await api('/api/totp/verify', { method: 'POST', session: doctor, csrf, body: { token: '000000' } })).status, 403);

  // Disable is possession-gated: wrong code refused, correct code removes the authenticator.
  assert.equal((await api('/api/totp/disable', { method: 'POST', session: doctor, csrf, body: { token: '000000' } })).status, 403);
  assert.equal((await api('/api/totp/disable', { method: 'POST', session: doctor, csrf, body: { token: totpToken(secret) } })).status, 200);
  const [after] = await db.execute("SELECT totp_enabled, totp_secret_encrypted FROM users WHERE user_id = ?", [SEED_DOCTOR.user_id]);
  assert.equal(Number(after[0].totp_enabled), 0);
  assert.equal(after[0].totp_secret_encrypted, null);
});

// --- SITBank-parity: active DB state cleanup -------------------------------
test('state cleanup purges expired/dead rows and leaves live data intact', async () => {
  // Old WebRTC signalling (3 days) + an expired reset token should be purged.
  await db.execute("INSERT INTO signaling_messages (consultation_id, sender_id, kind, payload, created_at) VALUES ('MH-C001','MH-U006','candidate','{}', NOW() - INTERVAL 3 DAY)");
  await db.execute("UPDATE users SET reset_token_hash = 'deadbeef', reset_expires_at = NOW() - INTERVAL 1 HOUR WHERE user_id = 'MH-U006'");
  // A fresh signal must survive.
  await db.execute("INSERT INTO signaling_messages (consultation_id, sender_id, kind, payload) VALUES ('MH-C001','MH-U006','offer','{\"fresh\":true}')");

  const summary = await runCleanup(db);
  assert.ok(typeof summary.old_signaling === 'number');

  const [stale] = await db.execute("SELECT COUNT(*) AS n FROM signaling_messages WHERE consultation_id='MH-C001' AND created_at < (NOW() - INTERVAL 1 DAY)");
  assert.equal(stale[0].n, 0); // old signal gone
  const [fresh] = await db.execute("SELECT COUNT(*) AS n FROM signaling_messages WHERE consultation_id='MH-C001' AND payload LIKE '%fresh%'");
  assert.equal(fresh[0].n, 1); // recent signal kept
  const [u] = await db.execute("SELECT reset_token_hash FROM users WHERE user_id='MH-U006'");
  assert.equal(u[0].reset_token_hash, null); // expired reset token cleared
});
