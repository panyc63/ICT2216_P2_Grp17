import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applySecurityHeaders,
  assertEmail,
  assertEnum,
  assertOptionalString,
  assertPassword,
  assertStaffEmail,
  assertPositiveInteger,
  assertNonNegativeInteger,
  assertString,
  auditMetadata,
  csrfGuard,
  decryptText,
  decryptJson,
  encryptText,
  encryptJson,
  hashPassword,
  hashToken,
  issueCsrfToken,
  makeTurnCredentials,
  rateLimit,
  resolveMailerConfig,
  randomToken,
  safeEqual,
  scanAttachmentMetadata,
  sessionPayload,
  sha256,
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
test('resolveMailerConfig: SMTP > Resend > none precedence and auth shaping', () => {
  // SMTP host wins even when a Resend key is present.
  const smtp = resolveMailerConfig({
    smtpHost: 'smtp-relay.brevo.com', smtpPort: 587, smtpSecure: false,
    smtpUser: 'user@x', smtpPass: 'k', resendApiKey: 'rk',
  });
  assert.deepEqual(smtp, { host: 'smtp-relay.brevo.com', port: 587, secure: false, auth: { user: 'user@x', pass: 'k' } });
  // No SMTP user => no auth block (relay-by-IP style).
  assert.equal(resolveMailerConfig({ smtpHost: 'mail.local', smtpPort: 25, smtpSecure: false, smtpUser: '' }).auth, undefined);
  // Falls back to Resend when no SMTP host.
  const resend = resolveMailerConfig({ smtpHost: '', resendApiKey: 'rk' });
  assert.equal(resend.host, 'smtp.resend.com');
  assert.equal(resend.secure, true);
  assert.equal(resend.auth.pass, 'rk');
  // Nothing configured => null (demo mode).
  assert.equal(resolveMailerConfig({ smtpHost: '', resendApiKey: '' }), null);
});

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

// =========================================================================
// Timing-safe comparison (used for Stripe webhook + CSRF + reset tokens)
// =========================================================================
test('safeEqual is true only for identical values and never throws on length mismatch', () => {
  assert.equal(safeEqual('abc123', 'abc123'), true);
  assert.equal(safeEqual('abc123', 'abc124'), false);
  // Different lengths must return false rather than throwing (timingSafeEqual would throw).
  assert.equal(safeEqual('short', 'a-much-longer-value'), false);
  assert.equal(safeEqual('', ''), true);
});

// =========================================================================
// Additional input-validation edge cases
// =========================================================================
test('assertPassword enforces the minimum length policy', () => {
  assert.throws(() => assertPassword('short'), /password/);
  assert.equal(assertPassword('LongEnough1!'), 'LongEnough1!');
});

test('assertStaffEmail allows workplace domains and blocks generic inboxes', () => {
  const domains = ['mediflow.com', 'hospital.sg'];
  assert.equal(assertStaffEmail('Dr.House@Mediflow.com', domains), 'dr.house@mediflow.com');
  assert.equal(assertStaffEmail('nurse@hospital.sg', domains), 'nurse@hospital.sg');
  assert.throws(() => assertStaffEmail('someone@gmail.com', domains), /workplace/);
  // A lookalike domain must not slip through.
  assert.throws(() => assertStaffEmail('evil@notmediflow.com', domains), /workplace/);
});

test('assertOptionalString maps empty/undefined to null but validates when present', () => {
  assert.equal(assertOptionalString(undefined, 'phone', { min: 3, max: 30 }), null);
  assert.equal(assertOptionalString('', 'phone', { min: 3, max: 30 }), null);
  assert.throws(() => assertOptionalString('12', 'phone', { min: 3, max: 30 }));
  assert.equal(assertOptionalString(' +65 91234567 ', 'phone', { min: 3, max: 30 }), '+65 91234567');
});

test('assertPositiveInteger enforces an upper bound and rejects non-positive values', () => {
  assert.equal(assertPositiveInteger('42', 'id'), 42);
  assert.throws(() => assertPositiveInteger('0', 'id'));
  assert.throws(() => assertPositiveInteger('-5', 'id'));
  assert.throws(() => assertPositiveInteger('9999', 'id', { max: 100 }));
});

test('assertNonNegativeInteger allows 0 (WebRTC ?since=0) but rejects negatives/junk', () => {
  assert.equal(assertNonNegativeInteger('0', 'since'), 0);
  assert.equal(assertNonNegativeInteger('7', 'since'), 7);
  assert.throws(() => assertNonNegativeInteger('-1', 'since'));
  assert.throws(() => assertNonNegativeInteger('1 OR 1=1', 'since'));
});

test('assertString enforces a supplied character pattern', () => {
  const ok = assertString('MH-C-123', 'consultationId', { pattern: /^[\w-]+$/ });
  assert.equal(ok, 'MH-C-123');
  assert.throws(() => assertString('drop; table', 'consultationId', { pattern: /^[\w-]+$/ }));
});

test('assertEnum accepts only members of the allowed set', () => {
  assert.equal(assertEnum('Delivery', 'method', ['SelfCollect', 'Delivery']), 'Delivery');
  assert.throws(() => assertEnum('Teleport', 'method', ['SelfCollect', 'Delivery']));
});

// =========================================================================
// JSON field encryption (PHI at rest)
// =========================================================================
test('encryptJson/decryptJson round-trips structured PHI and is not plaintext', () => {
  const answers = { chestPain: 'Severe', fever: 'Yes', note: 'radiating to left arm' };
  const ciphertext = encryptJson(answers, config);
  assert.equal(ciphertext.startsWith('v1:'), true);
  assert.equal(ciphertext.includes('Severe'), false);
  assert.deepEqual(decryptJson(ciphertext, config), answers);
});

// =========================================================================
// Token/hash primitives
// =========================================================================
test('sha256 is deterministic hex and randomToken is unique base64url', () => {
  assert.equal(sha256('abc'), sha256('abc'));
  assert.match(sha256('abc'), /^[a-f0-9]{64}$/);
  const a = randomToken(32);
  const b = randomToken(32);
  assert.notEqual(a, b);
  assert.match(a, /^[A-Za-z0-9_-]+$/);
});

// =========================================================================
// Session payload shape (JWT claims)
// =========================================================================
test('sessionPayload carries the identity/role claims and honours overrides', () => {
  const payload = sessionPayload({ user_id: 'MH-U006', email: 'john@gmail.com', role: 'Patient', token_version: 3 });
  assert.equal(payload.sub, 'MH-U006');
  assert.equal(payload.role, 'Patient');
  assert.equal(payload.token_version, 3);
  const reauth = sessionPayload({ user_id: 'MH-U006', email: 'john@gmail.com', role: 'Patient', token_version: 3 }, { reauth_at: 1234 });
  assert.equal(reauth.reauth_at, 1234);
});

// =========================================================================
// TURN credential derivation (managed/self-hosted relay)
// =========================================================================
test('makeTurnCredentials returns null without config and HMAC creds when a secret is set', () => {
  assert.equal(makeTurnCredentials({ turnSecret: '', turnUrls: [] }), null);
  const creds = makeTurnCredentials({ turnSecret: 'shared-turn-secret', turnUrls: ['turn:t.example.com:3478'] }, 600);
  assert.ok(creds);
  assert.equal(typeof creds.username, 'string');
  assert.equal(typeof creds.credential, 'string');
  assert.equal(creds.ttl, 600);
  assert.deepEqual(creds.urls, ['turn:t.example.com:3478']);
});
