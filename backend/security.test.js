import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applySecurityHeaders,
  assertEmail,
  assertEnum,
  assertPositiveInteger,
  assertString,
  auditMetadata,
  csrfGuard,
  decryptText,
  encryptText,
  hashPassword,
  hashToken,
  issueCsrfToken,
  rateLimit,
  scanAttachmentMetadata,
  signJwt,
  signMcToken,
  signMcTokenAsym,
  buildIceServers,
  generateMcKeyPair,
  decodeMcPayload,
  verifyMcTokenAsym,
  verifyJwt,
  verifyMcToken,
  verifyPassword,
} from './security.js';

const config = {
  isProduction: true,
  jwtSecret: 'unit-test-jwt-secret-with-entropy-0001',
  csrfSecret: 'unit-test-csrf-secret-with-entropy-0001',
  dataEncryptionKey: 'unit-test-data-encryption-key-with-entropy',
  mcSigningKey: 'unit-test-mc-signing-key-with-entropy',
  secureCookies: true,
};

// --- Lightweight Express-style request/response mocks ---------------------
function makeRes() {
  return {
    statusCode: 200,
    body: undefined,
    headers: {},
    cookies: [],
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    append(name, value) {
      if (name.toLowerCase() === 'set-cookie') this.cookies.push(value);
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    end() {
      return this;
    },
  };
}

// =========================================================================
// Password hashing (R: Encryption at rest / credential protection)
// =========================================================================
test('password hashes are not plaintext and verify correctly', async () => {
  const hash = await hashPassword('CorrectHorseBatteryStaple1');
  assert.notEqual(hash, 'CorrectHorseBatteryStaple1');
  assert.equal(hash.startsWith('scrypt$'), true);
  assert.equal(await verifyPassword('CorrectHorseBatteryStaple1', hash), true);
  assert.equal(await verifyPassword('wrong-password', hash), false);
});

// =========================================================================
// Session security / data integrity (JWT)
// =========================================================================
test('JWT rejects tampered payloads', () => {
  const token = signJwt({ sub: 'MH-U001', role: 'Admin', token_version: 0 }, 'secret', 60);
  assert.equal(verifyJwt(token, 'secret').sub, 'MH-U001');
  const parts = token.split('.');
  const tamperedPayload = Buffer.from(
    JSON.stringify({ sub: 'MH-U999', role: 'Admin', token_version: 0, exp: 9999999999 })
  ).toString('base64url');
  assert.throws(() => verifyJwt(`${parts[0]}.${tamperedPayload}.${parts[2]}`, 'secret'));
});

test('JWT enforces idle/session expiry', () => {
  // Token issued already-expired (negative TTL) must be rejected.
  const expired = signJwt({ sub: 'MH-U006', role: 'Patient', token_version: 0 }, 'secret', -1);
  assert.throws(() => verifyJwt(expired, 'secret'), /expired/i);
});

// =========================================================================
// Encryption at rest (AES-256-GCM)
// =========================================================================
test('field encryption round trips and changes ciphertext', () => {
  const plaintext = 'patient reports severe chest pain';
  const encrypted = encryptText(plaintext, config);
  assert.notEqual(encrypted, plaintext);
  assert.equal(decryptText(encrypted, config), plaintext);
});

test('field encryption detects ciphertext tampering (GCM auth tag)', () => {
  const encrypted = encryptText('confidential diagnosis', config);
  const segments = encrypted.split(':'); // v1:iv:tag:ciphertext
  // Corrupt the first (fully significant) char of the auth tag so the change is
  // always meaningful — the GCM verification must then reject it.
  const tag = segments[2];
  segments[2] = (tag[0] === 'A' ? 'B' : 'A') + tag.slice(1);
  assert.throws(() => decryptText(segments.join(':'), config));
});

// =========================================================================
// Cryptographic non-repudiation (MC signing / QR token)
// =========================================================================
test('MC verification token detects tampering', () => {
  const token = signMcToken({ mc_id: 'MH-MC001', patient_id: 'MH-U006' }, config.mcSigningKey);
  assert.equal(verifyMcToken(token, config.mcSigningKey).mc_id, 'MH-MC001');
  assert.throws(() => verifyMcToken(`${token}x`, config.mcSigningKey));
});

test('MC token signed with another key is rejected', () => {
  const token = signMcToken({ mc_id: 'MH-MC002' }, config.mcSigningKey);
  assert.throws(() => verifyMcToken(token, 'a-different-signing-key'));
});

test('Ed25519 MC signing verifies, detects tampering, and rejects the wrong key', () => {
  const doctorA = generateMcKeyPair();
  const doctorB = generateMcKeyPair();
  const token = signMcTokenAsym({ mc_id: 'MH-MC100', doctor_id: 'MH-U002' }, doctorA.privateKeyPem);
  assert.equal(verifyMcTokenAsym(token, doctorA.publicKeyPem).mc_id, 'MH-MC100');
  // Another doctor's public key must NOT verify (non-repudiation).
  assert.throws(() => verifyMcTokenAsym(token, doctorB.publicKeyPem));
  // Tampered token must fail.
  assert.throws(() => verifyMcTokenAsym(`${token}x`, doctorA.publicKeyPem));
  // Payload is readable (unverified) but untrusted until the signature is checked.
  assert.equal(decodeMcPayload(token).doctor_id, 'MH-U002');
});

// =========================================================================
// Input validation & payload scanning (anti-injection / upload safety)
// =========================================================================
test('attachment metadata validation blocks unsafe files', () => {
  const clean = scanAttachmentMetadata({ filename: 'rash-photo.png', mimeType: 'image/png', sizeBytes: 1024 });
  assert.equal(clean.malwareScanStatus, 'PASSED_STUB');
  assert.throws(() => scanAttachmentMetadata({ filename: 'eicar.png', mimeType: 'image/png', sizeBytes: 1024 }));
});

test('attachment metadata rejects disallowed type and oversize files', () => {
  assert.throws(() => scanAttachmentMetadata({ filename: 'payload.exe', mimeType: 'application/x-msdownload', sizeBytes: 1024 }));
  assert.throws(() => scanAttachmentMetadata({ filename: 'huge.png', mimeType: 'image/png', sizeBytes: 50 * 1024 * 1024 }));
});

test('input validators reject injection-style and malformed input', () => {
  // SQL-injection / XSS payloads must fail format/length validation, not be trusted.
  assert.throws(() => assertEmail("' OR '1'='1"));
  assert.throws(() => assertEmail('<script>alert(1)</script>@x'));
  assert.throws(() => assertEnum('Severe; DROP TABLE users', 'chestPain', ['None', 'Mild', 'Moderate', 'Severe']));
  assert.throws(() => assertPositiveInteger('1 OR 1=1', 'id'));
  assert.throws(() => assertString('x'.repeat(5000), 'note', { max: 255 }));
  // Well-formed values pass and are normalised.
  assert.equal(assertEmail('  Doctor@MediFlow.com '), 'doctor@mediflow.com');
  assert.equal(assertEnum('Severe', 'chestPain', ['None', 'Mild', 'Moderate', 'Severe']), 'Severe');
});

// =========================================================================
// Token hashing (no plaintext token storage)
// =========================================================================
test('token hashing is deterministic without exposing token value', () => {
  assert.equal(hashToken('abc'), hashToken('abc'));
  assert.notEqual(hashToken('abc'), 'abc');
});

// =========================================================================
// Security response headers (TLS/E2E defence-in-depth)
// =========================================================================
test('security headers middleware sets hardening headers', () => {
  const res = makeRes();
  let nextCalled = false;
  applySecurityHeaders(config)({}, res, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, true);
  assert.equal(res.headers['x-content-type-options'], 'nosniff');
  assert.equal(res.headers['x-frame-options'], 'DENY');
  assert.match(res.headers['content-security-policy'], /default-src 'none'/);
  // Cross-origin isolation headers (COOP always; CORP in production config).
  assert.equal(res.headers['cross-origin-opener-policy'], 'same-origin');
  assert.equal(res.headers['cross-origin-resource-policy'], 'same-origin');
  // HSTS only in production config.
  assert.match(res.headers['strict-transport-security'], /max-age=\d+/);
});

// =========================================================================
// WebRTC ICE servers
// =========================================================================
test('buildIceServers always returns STUN and adds managed TURN only when configured', () => {
  const stunOnly = buildIceServers({ turnSecret: '', turnUrls: [], turnUsername: '', turnCredential: '' });
  assert.equal(stunOnly.length, 1);
  assert.match(String(stunOnly[0].urls), /^stun:/);

  const withTurn = buildIceServers({
    turnSecret: '', turnUrls: ['turn:turn.example.com:3478'], turnUsername: 'u', turnCredential: 'c',
  });
  assert.equal(withTurn.length, 2);
  const turn = withTurn.find((s) => String(s.urls).includes('turn:'));
  assert.equal(turn.username, 'u');
  assert.equal(turn.credential, 'c');
});

// =========================================================================
// CSRF protection
// =========================================================================
test('CSRF guard accepts matching token and rejects mismatch', () => {
  const token = issueCsrfToken(makeRes(), config);

  // Matching cookie + header passes.
  const okRes = makeRes();
  let passed = false;
  csrfGuard(config)(
    { method: 'POST', path: '/api/login', cookies: { mf_csrf: token }, headers: { 'x-csrf-token': token } },
    okRes,
    () => {
      passed = true;
    }
  );
  assert.equal(passed, true);

  // Missing/mismatched header is blocked with 403.
  const badRes = makeRes();
  csrfGuard(config)(
    { method: 'POST', path: '/api/login', cookies: { mf_csrf: token }, headers: { 'x-csrf-token': 'forged' } },
    badRes,
    () => {
      throw new Error('next should not be called');
    }
  );
  assert.equal(badRes.statusCode, 403);
});

// =========================================================================
// Rate limiting (brute-force / DoS mitigation)
// =========================================================================
test('rate limiter returns 429 once the window budget is exceeded', () => {
  const limiter = rateLimit({ windowMs: 60_000, max: 2, keyPrefix: 'test' });
  const req = { ip: '203.0.113.7' };
  const statuses = [];
  for (let i = 0; i < 3; i += 1) {
    const res = makeRes();
    limiter(req, res, () => {});
    statuses.push(res.statusCode);
  }
  assert.deepEqual(statuses, [200, 200, 429]);
});

// =========================================================================
// Audit logging privacy (least-privilege metadata redaction)
// =========================================================================
test('audit metadata redacts secrets and hashes email', () => {
  const redacted = auditMetadata({
    role: 'Doctor',
    password: 'hunter2',
    otp: '123456',
    diagnosis: 'influenza',
    email: 'patient@example.com',
  });
  assert.equal(redacted.role, 'Doctor');
  assert.equal(redacted.password, '[REDACTED]');
  assert.equal(redacted.otp, '[REDACTED]');
  assert.equal(redacted.diagnosis, '[REDACTED]');
  assert.match(redacted.email, /^sha256:/);
  assert.equal(redacted.email.includes('patient@example.com'), false);
});
