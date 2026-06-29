import express from 'express';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import multer from 'multer';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  ROLES,
  STAFF_ROLES,
  applyCors,
  applySecurityHeaders,
  assertEmail,
  assertEnum,
  assertOptionalString,
  assertPassword,
  assertPositiveInteger,
  assertString,
  asyncHandler,
  auditMetadata,
  badRequest,
  clearSessionCookie,
  csrfGuard,
  currentUnixSeconds,
  decryptJson,
  decryptText,
  encryptJson,
  encryptText,
  forbidden,
  getConfig,
  getSessionToken,
  hashPassword,
  hashToken,
  isPasswordHash,
  issueCsrfToken,
  notFound,
  parseCookies,
  randomToken,
  rateLimit,
  scanAttachmentMetadata,
  sessionPayload,
  setSessionCookie,
  sha256,
  signJwt,
  signMcTokenAsym,
  generateMcKeyPair,
  decodeMcPayload,
  verifyMcTokenAsym,
  scanBufferForMalware,
  mintFirebaseCustomToken,
  makeTurnCredentials,
  verifyJwt,
  verifyPassword,
} from './security.js';

dotenv.config();

const config = getConfig();
const app = express();
app.set('trust proxy', 1);

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

const transporter = config.resendApiKey
  ? nodemailer.createTransport({
      host: 'smtp.resend.com',
      port: 465,
      secure: true,
      auth: {
        user: 'resend',
        pass: config.resendApiKey,
      },
    })
  : null;

const authLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, keyPrefix: 'auth' });
const loginLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 8, keyPrefix: 'login' });
const triageLimit = rateLimit({ windowMs: 5 * 60 * 1000, max: 10, keyPrefix: 'triage' });
const chatLimit = rateLimit({ windowMs: 60 * 1000, max: 30, keyPrefix: 'chat' });
const paymentLimit = rateLimit({ windowMs: 5 * 60 * 1000, max: 10, keyPrefix: 'payment' });
const verificationLimit = rateLimit({ windowMs: 60 * 1000, max: 20, keyPrefix: 'mc-verify' });

// In-memory upload (max 5 MB) so the buffer can be malware-scanned before it ever touches disk.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

app.use(applySecurityHeaders(config));
app.use(applyCors(config));
app.use(parseCookies);

app.post(
  '/api/payments/webhook',
  paymentLimit,
  express.raw({ type: 'application/json', limit: '100kb' }),
  asyncHandler(handlePaymentWebhook)
);

app.use(express.json({ limit: '100kb' }));

app.get('/api/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.get('/api/csrf', (req, res) => {
  const csrfToken = issueCsrfToken(res, config);
  res.status(200).json({ csrfToken });
});

app.use(csrfGuard(config));

app.post('/api/register', authLimit, asyncHandler(registerPatient));
app.get('/api/verify-email/:token', authLimit, asyncHandler(verifyEmail));
app.post('/api/login', loginLimit, asyncHandler(login));
app.post('/api/login/mfa', loginLimit, asyncHandler(completeLoginMfa));
app.post('/api/logout', asyncHandler(authenticate), asyncHandler(logout));
app.get('/api/me', asyncHandler(authenticate), asyncHandler(me));
app.post('/api/auth/reauth', loginLimit, asyncHandler(authenticate), asyncHandler(reauthenticate));

// Account self-service (Deliverable 1: Account Management - Read/Update/Delete)
app.get('/api/me/profile', asyncHandler(authenticate), asyncHandler(getMyProfile));
app.patch('/api/me/profile', asyncHandler(authenticate), asyncHandler(updateMyProfile));
app.post('/api/me/password', asyncHandler(authenticate), requireRecentReauth, asyncHandler(changeMyPassword));
app.delete('/api/me', asyncHandler(authenticate), requireRecentReauth, asyncHandler(deleteMyAccount));
app.post('/api/forgot-password', authLimit, asyncHandler(requestPasswordReset));
app.post('/api/reset-password', authLimit, asyncHandler(resetPassword));

app.get('/api/staff', asyncHandler(authenticate), requireRole('Admin'), asyncHandler(listStaff));
app.post('/api/staff', asyncHandler(authenticate), requireRole('Admin'), requireRecentReauth, asyncHandler(createStaff));
app.patch('/api/staff/:id', asyncHandler(authenticate), requireRole('Admin'), requireRecentReauth, asyncHandler(updateStaff));
app.delete('/api/staff/:id', asyncHandler(authenticate), requireRole('Admin'), requireRecentReauth, asyncHandler(deactivateStaff));

app.post('/api/consultations', asyncHandler(authenticate), requireRole('Patient'), asyncHandler(bookConsultation));
app.get('/api/consultations', asyncHandler(authenticate), asyncHandler(listConsultations));
app.patch('/api/consultations/:id', asyncHandler(authenticate), requireRole('Doctor', 'Nurse', 'Admin'), asyncHandler(updateConsultation));

app.post('/api/triage', triageLimit, asyncHandler(authenticate), requireRole('Patient'), asyncHandler(submitTriage));
app.get('/api/nurse/queue', asyncHandler(authenticate), requireRole('Nurse', 'Doctor', 'Admin'), asyncHandler(listQueue));
app.patch('/api/nurse/queue/:id', asyncHandler(authenticate), requireRole('Nurse', 'Admin'), asyncHandler(updateQueue));

app.post('/api/payments/checkout', paymentLimit, asyncHandler(authenticate), requireRole('Patient'), asyncHandler(createCheckout));
app.get('/api/payments/:id', asyncHandler(authenticate), asyncHandler(getPayment));

app.post('/api/prescriptions', asyncHandler(authenticate), requireRole('Doctor'), requireRecentReauth, asyncHandler(createPrescription));
app.get('/api/prescriptions/:id', asyncHandler(authenticate), asyncHandler(getPrescription));
app.get('/api/inventory', asyncHandler(authenticate), requireRole('Doctor', 'Pharmacist', 'Admin'), asyncHandler(listInventory));
app.get('/api/pharmacy/queue', asyncHandler(authenticate), requireRole('Pharmacist', 'Admin'), asyncHandler(listPharmacyQueue));
app.post('/api/prescriptions/:id/fulfil', asyncHandler(authenticate), requireRole('Pharmacist'), requireRecentReauth, asyncHandler(fulfilPrescription));
app.get('/api/patient/prescriptions', asyncHandler(authenticate), requireRole('Patient'), asyncHandler(listPatientPrescriptions));

app.post('/api/medical-certificates', asyncHandler(authenticate), requireRole('Doctor'), requireRecentReauth, asyncHandler(createMedicalCertificate));
app.get('/api/medical-certificates/:id', asyncHandler(authenticate), asyncHandler(getMedicalCertificate));
app.get('/api/patient/medical-certificates/latest', asyncHandler(authenticate), requireRole('Patient'), asyncHandler(getLatestPatientMedicalCertificate));
app.post('/api/medical-certificates/:id/revoke', asyncHandler(authenticate), requireRole('Doctor', 'Admin'), requireRecentReauth, asyncHandler(revokeMedicalCertificate));
app.get('/api/verify/mc/:token', verificationLimit, asyncHandler(verifyMedicalCertificate));

app.get('/api/consultations/:id/messages', chatLimit, asyncHandler(authenticate), asyncHandler(listMessages));
app.post('/api/consultations/:id/messages', chatLimit, asyncHandler(authenticate), asyncHandler(createMessage));
app.post('/api/consultations/:id/attachments', chatLimit, asyncHandler(authenticate), asyncHandler(registerAttachment));
// Secure file upload: malware-scanned (ClamAV, or EICAR stub when not configured) before storage.
app.post('/api/consultations/:id/attachments/upload', chatLimit, asyncHandler(authenticate), upload.single('file'), asyncHandler(uploadAttachment));
app.get('/api/attachments/:id', asyncHandler(authenticate), asyncHandler(downloadAttachment));

// Realtime (Phase 4): mint a Firebase custom token (role-claimed) for chat/queue/signaling.
app.post('/api/realtime/token', asyncHandler(authenticate), asyncHandler(issueRealtimeToken));
// WebRTC (Phase 5): short-lived TURN credentials + consent-gated recording metadata.
app.get('/api/consultations/:id/rtc-credentials', asyncHandler(authenticate), asyncHandler(getRtcCredentials));
app.post('/api/consultations/:id/recording', asyncHandler(authenticate), requireRole('Doctor', 'Admin'), asyncHandler(startRecordingSession));

app.use((err, req, res, _next) => {
  const status = err.status || 500;
  if (status >= 500) {
    console.error('Unhandled API error:', err.message);
  }
  res.status(status).json({ error: status >= 500 ? 'Internal server error.' : err.message });
});

async function query(sql, params = []) {
  const [rows] = await db.execute(sql, params);
  return rows;
}

async function execute(sql, params = []) {
  const [result] = await db.execute(sql, params);
  return result;
}

async function sendMail({ to, subject, html }) {
  if (!transporter) return { skipped: true };
  await transporter.sendMail({
    from: '"MediFlow Security" <onboarding@resend.dev>',
    to,
    subject,
    html,
  });
  return { skipped: false };
}

async function writeAudit(req, { actorId = null, action, resourceType, resourceId = null, outcome, metadata = {} }) {
  try {
    const rows = await query('SELECT entry_hash FROM security_audit_logs ORDER BY log_id DESC LIMIT 1');
    const previousHash = rows[0]?.entry_hash || 'GENESIS';
    const safeMetadata = auditMetadata(metadata);
    const canonical = JSON.stringify({
      previousHash,
      actorId,
      action,
      resourceType,
      resourceId,
      outcome,
      metadata: safeMetadata,
      ip: req.ip,
      userAgent: req.get('user-agent') || '',
    });
    const entryHash = sha256(canonical);
    await execute(
      `INSERT INTO security_audit_logs
       (actor_id, action_performed, resource_type, resource_id, outcome, metadata_json, ip_address, user_agent, previous_hash, entry_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        actorId,
        action,
        resourceType,
        resourceId,
        outcome,
        JSON.stringify(safeMetadata),
        req.ip,
        req.get('user-agent') || '',
        previousHash,
        entryHash,
      ]
    );
  } catch (error) {
    console.error('Audit write failed:', error.message);
  }
}

async function getUserByEmail(email) {
  const rows = await query('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
  return rows[0] || null;
}

async function getUserById(userId) {
  const rows = await query('SELECT * FROM users WHERE user_id = ? LIMIT 1', [userId]);
  return rows[0] || null;
}

async function nextUserId() {
  const rows = await query("SELECT user_id FROM users WHERE user_id LIKE 'MH-U%' ORDER BY CAST(SUBSTRING(user_id, 5) AS UNSIGNED) DESC LIMIT 1");
  const last = rows[0]?.user_id || 'MH-U000';
  const next = Number(last.replace('MH-U', '')) + 1;
  return `MH-U${String(next).padStart(3, '0')}`;
}

function publicUser(user) {
  return {
    user_id: user.user_id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
  };
}

function issueSession(res, user, overrides = {}) {
  const token = signJwt(sessionPayload(user, overrides), config.jwtSecret);
  setSessionCookie(res, token, config);
  return {
    user: publicUser(user),
    expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  };
}

async function authenticate(req, res, next) {
  const token = getSessionToken(req);
  if (!token) return res.status(401).json({ error: 'Authentication required.' });

  let payload;
  try {
    payload = verifyJwt(token, config.jwtSecret);
  } catch {
    clearSessionCookie(res, config);
    return res.status(401).json({ error: 'Session expired or invalid.' });
  }

  const user = await getUserById(payload.sub);
  if (!user || user.status !== 'Active' || Number(user.token_version || 0) !== Number(payload.token_version || 0)) {
    clearSessionCookie(res, config);
    return res.status(401).json({ error: 'Session revoked.' });
  }

  req.user = {
    ...publicUser(user),
    token_version: user.token_version || 0,
    auth_time: payload.auth_time,
    reauth_at: payload.reauth_at,
    mfa_at: payload.mfa_at,
  };
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient role privileges.' });
    }
    next();
  };
}

function requireRecentReauth(req, res, next) {
  const recentAt = req.user?.reauth_at || req.user?.auth_time || 0;
  if (currentUnixSeconds() - Number(recentAt) > 5 * 60) {
    return res.status(403).json({ error: 'Recent re-authentication is required for this operation.' });
  }
  next();
}

async function registerPatient(req, res) {
  const name = assertString(req.body.name, 'name', { min: 2, max: 120 });
  const email = assertEmail(req.body.email);
  const password = assertPassword(req.body.password);
  const existing = await getUserByEmail(email);
  if (existing) {
    await writeAudit(req, {
      action: 'REGISTER_PATIENT',
      resourceType: 'USER',
      outcome: 'FAILURE',
      metadata: { email, reason: 'duplicate' },
    });
    return res.status(400).json({ error: 'Email is already registered.' });
  }

  const userId = await nextUserId();
  const verificationToken = randomToken();
  const verificationHash = hashToken(verificationToken);
  const passwordHash = await hashPassword(password);
  await execute(
    `INSERT INTO users
     (user_id, name, email, password_hash, role, is_verified, status, email_verification_hash, email_verification_expires_at)
     VALUES (?, ?, ?, ?, 'Patient', FALSE, 'PendingVerification', ?, DATE_ADD(NOW(), INTERVAL 24 HOUR))`,
    [userId, name, email, passwordHash, verificationHash]
  );

  const verificationUrl = `${config.backendPublicUrl}/api/verify-email/${verificationToken}`;
  await sendMail({
    to: email,
    subject: 'Verify your MediFlow account',
    html: `<p>Welcome to MediFlow.</p><p>Verify your account: <a href="${verificationUrl}">Verify email</a></p>`,
  });

  await writeAudit(req, {
    actorId: userId,
    action: 'REGISTER_PATIENT',
    resourceType: 'USER',
    resourceId: userId,
    outcome: 'SUCCESS',
    metadata: { email },
  });

  res.status(201).json({
    message: 'User registered successfully. Please verify your email address.',
    user: { user_id: userId, role: 'Patient', status: 'PendingVerification' },
  });
}

async function verifyEmail(req, res) {
  const verificationHash = hashToken(req.params.token);
  const rows = await query(
    `SELECT user_id FROM users
     WHERE email_verification_hash = ? AND email_verification_expires_at > NOW() AND status = 'PendingVerification'
     LIMIT 1`,
    [verificationHash]
  );
  if (!rows[0]) {
    return res.status(404).send('<h1>Verification Failed</h1><p>The link is invalid or expired.</p>');
  }

  await execute(
    `UPDATE users
     SET is_verified = TRUE, status = 'Active', email_verification_hash = NULL, email_verification_expires_at = NULL
     WHERE user_id = ?`,
    [rows[0].user_id]
  );
  await writeAudit(req, {
    actorId: rows[0].user_id,
    action: 'VERIFY_EMAIL',
    resourceType: 'USER',
    resourceId: rows[0].user_id,
    outcome: 'SUCCESS',
  });

  res.send(`
    <div style="font-family: sans-serif; text-align: center; padding-top: 50px;">
      <h1 style="color: #4f46e5;">Email Verified Successfully</h1>
      <p>Your MediFlow account is active.</p>
      <a href="${config.frontendUrl}/login" style="background: #4f46e5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 8px; font-weight: bold;">Go to Login</a>
    </div>
  `);
}

async function login(req, res) {
  const email = assertEmail(req.body.email);
  const password = assertString(req.body.password, 'password', { min: 1, max: 128 });
  const user = await getUserByEmail(email);

  if (!user || user.status === 'Deactivated') {
    await writeAudit(req, { action: 'LOGIN', resourceType: 'USER', outcome: 'FAILURE', metadata: { email, reason: 'not_found' } });
    return res.status(401).json({ error: 'Invalid email or password credentials.' });
  }

  const passwordMatches = await verifyPassword(password, user.password_hash);
  if (!passwordMatches) {
    await writeAudit(req, { actorId: user.user_id, action: 'LOGIN', resourceType: 'USER', resourceId: user.user_id, outcome: 'FAILURE', metadata: { reason: 'bad_password' } });
    return res.status(401).json({ error: 'Invalid email or password credentials.' });
  }

  if (!isPasswordHash(user.password_hash)) {
    await execute('UPDATE users SET password_hash = ? WHERE user_id = ?', [await hashPassword(password), user.user_id]);
  }

  if (!user.is_verified || user.status !== 'Active') {
    await writeAudit(req, { actorId: user.user_id, action: 'LOGIN', resourceType: 'USER', resourceId: user.user_id, outcome: 'FAILURE', metadata: { reason: 'unverified' } });
    return res.status(403).json({ error: 'Please verify your email address before signing in.' });
  }

  if (config.mfaRequiredRoles.includes(user.role)) {
    const challenge = await createMfaChallenge(user, 'Login verification');
    await writeAudit(req, { actorId: user.user_id, action: 'LOGIN_MFA_CHALLENGE', resourceType: 'USER', resourceId: user.user_id, outcome: 'SUCCESS' });
    return res.status(202).json({
      requiresMfa: true,
      challengeId: challenge.challengeId,
      message: 'MFA code sent to registered email.',
    });
  }

  await execute('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE user_id = ?', [user.user_id]);
  await writeAudit(req, { actorId: user.user_id, action: 'LOGIN', resourceType: 'USER', resourceId: user.user_id, outcome: 'SUCCESS' });
  res.status(200).json({ message: 'Login successful.', ...issueSession(res, user) });
}

async function createMfaChallenge(user, subject) {
  const challengeId = randomToken(16);
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  await execute(
    `UPDATE users
     SET mfa_challenge_id = ?, mfa_otp_hash = ?, mfa_expires_at = DATE_ADD(NOW(), INTERVAL 5 MINUTE)
     WHERE user_id = ?`,
    [challengeId, hashToken(otp), user.user_id]
  );
  await sendMail({
    to: user.email,
    subject,
    html: `<p>Your MediFlow verification code is <strong>${otp}</strong>.</p><p>This code expires in 5 minutes.</p>`,
  });
  return { challengeId, otp };
}

async function completeLoginMfa(req, res) {
  const email = assertEmail(req.body.email);
  const challengeId = assertString(req.body.challengeId, 'challengeId', { min: 10, max: 128 });
  const otp = assertString(req.body.otp, 'otp', { min: 6, max: 6, pattern: /^\d{6}$/ });
  const user = await getUserByEmail(email);
  if (!user || user.mfa_challenge_id !== challengeId || user.mfa_otp_hash !== hashToken(otp)) {
    await writeAudit(req, { action: 'LOGIN_MFA', resourceType: 'USER', outcome: 'FAILURE', metadata: { email } });
    return res.status(401).json({ error: 'Invalid MFA code.' });
  }

  const rows = await query('SELECT mfa_expires_at > NOW() AS valid FROM users WHERE user_id = ?', [user.user_id]);
  if (!rows[0]?.valid) {
    return res.status(401).json({ error: 'MFA code expired.' });
  }

  await execute(
    'UPDATE users SET mfa_challenge_id = NULL, mfa_otp_hash = NULL, mfa_expires_at = NULL, last_login = CURRENT_TIMESTAMP WHERE user_id = ?',
    [user.user_id]
  );
  await writeAudit(req, { actorId: user.user_id, action: 'LOGIN_MFA', resourceType: 'USER', resourceId: user.user_id, outcome: 'SUCCESS' });
  const now = currentUnixSeconds();
  res.status(200).json({ message: 'Login successful.', ...issueSession(res, user, { mfa_at: now, reauth_at: now }) });
}

async function logout(req, res) {
  await execute('UPDATE users SET token_version = token_version + 1 WHERE user_id = ?', [req.user.user_id]);
  clearSessionCookie(res, config);
  await writeAudit(req, { actorId: req.user.user_id, action: 'LOGOUT', resourceType: 'USER', resourceId: req.user.user_id, outcome: 'SUCCESS' });
  res.status(200).json({ message: 'Logged out.' });
}

async function me(req, res) {
  res.status(200).json({
    user: req.user,
    expiresAt: new Date((verifyJwt(getSessionToken(req), config.jwtSecret).exp || currentUnixSeconds()) * 1000).toISOString(),
  });
}

async function reauthenticate(req, res) {
  const user = await getUserById(req.user.user_id);
  const password = assertString(req.body.password, 'password', { min: 1, max: 128 });
  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) {
    await writeAudit(req, { actorId: user.user_id, action: 'REAUTH', resourceType: 'USER', resourceId: user.user_id, outcome: 'FAILURE' });
    return res.status(401).json({ error: 'Invalid credentials.' });
  }

  if (config.mfaRequiredRoles.includes(user.role) && !req.body.otp) {
    const challenge = await createMfaChallenge(user, 'MediFlow re-authentication');
    return res.status(202).json({
      requiresMfa: true,
      challengeId: challenge.challengeId,
    });
  }

  if (config.mfaRequiredRoles.includes(user.role)) {
    const challengeId = assertString(req.body.challengeId, 'challengeId', { min: 10, max: 128 });
    const otp = assertString(req.body.otp, 'otp', { min: 6, max: 6, pattern: /^\d{6}$/ });
    if (user.mfa_challenge_id !== challengeId || user.mfa_otp_hash !== hashToken(otp)) {
      return res.status(401).json({ error: 'Invalid MFA code.' });
    }
  }

  const now = currentUnixSeconds();
  await execute('UPDATE users SET mfa_challenge_id = NULL, mfa_otp_hash = NULL, mfa_expires_at = NULL WHERE user_id = ?', [user.user_id]);
  await writeAudit(req, { actorId: user.user_id, action: 'REAUTH', resourceType: 'USER', resourceId: user.user_id, outcome: 'SUCCESS' });
  res.status(200).json({ message: 'Re-authentication successful.', ...issueSession(res, user, { reauth_at: now, mfa_at: now }) });
}

async function getMyProfile(req, res) {
  const user = await getUserById(req.user.user_id);
  if (!user) throw notFound('Account not found.');
  res.status(200).json({
    user_id: user.user_id,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone || '',
    address: decryptText(user.address_encrypted, config) || '',
    nric: decryptText(user.nric_encrypted, config) || '',
  });
}

async function updateMyProfile(req, res) {
  const fields = [];
  const params = [];
  if (req.body.name !== undefined) {
    fields.push('name = ?');
    params.push(assertString(req.body.name, 'name', { min: 2, max: 120 }));
  }
  if (req.body.phone !== undefined) {
    fields.push('phone = ?');
    params.push(assertOptionalString(req.body.phone, 'phone', { min: 3, max: 30, pattern: /^[+0-9 ()-]+$/ }));
  }
  if (req.body.address !== undefined) {
    const address = assertOptionalString(req.body.address, 'address', { min: 0, max: 300 });
    fields.push('address_encrypted = ?');
    params.push(address ? encryptText(address, config) : null);
  }
  if (req.body.nric !== undefined) {
    const nric = assertOptionalString(req.body.nric, 'nric', { min: 0, max: 20, pattern: /^[A-Za-z0-9]*$/ });
    fields.push('nric_encrypted = ?');
    params.push(nric ? encryptText(nric, config) : null);
  }
  if (fields.length === 0) throw badRequest('No supported profile fields supplied.');
  params.push(req.user.user_id);
  await execute(`UPDATE users SET ${fields.join(', ')} WHERE user_id = ?`, params);
  await writeAudit(req, { actorId: req.user.user_id, action: 'UPDATE_PROFILE', resourceType: 'USER', resourceId: req.user.user_id, outcome: 'SUCCESS' });
  res.status(200).json({ message: 'Profile updated.' });
}

async function changeMyPassword(req, res) {
  const currentPassword = assertString(req.body.currentPassword, 'currentPassword', { min: 1, max: 128 });
  const newPassword = assertPassword(req.body.newPassword);
  const user = await getUserById(req.user.user_id);
  if (!user || !(await verifyPassword(currentPassword, user.password_hash))) {
    await writeAudit(req, { actorId: req.user.user_id, action: 'CHANGE_PASSWORD', resourceType: 'USER', resourceId: req.user.user_id, outcome: 'FAILURE' });
    return res.status(401).json({ error: 'Current password is incorrect.' });
  }
  // Rotate the password and revoke all existing sessions via token_version bump.
  await execute('UPDATE users SET password_hash = ?, token_version = token_version + 1 WHERE user_id = ?', [await hashPassword(newPassword), user.user_id]);
  await writeAudit(req, { actorId: user.user_id, action: 'CHANGE_PASSWORD', resourceType: 'USER', resourceId: user.user_id, outcome: 'SUCCESS' });
  clearSessionCookie(res, config);
  res.status(200).json({ message: 'Password changed. Please sign in again.' });
}

async function deleteMyAccount(req, res) {
  // Soft delete: deactivate but RETAIN medical/audit records (retention override).
  await execute(
    "UPDATE users SET status = 'Deactivated', deleted_at = CURRENT_TIMESTAMP, token_version = token_version + 1 WHERE user_id = ?",
    [req.user.user_id]
  );
  await writeAudit(req, { actorId: req.user.user_id, action: 'DELETE_ACCOUNT', resourceType: 'USER', resourceId: req.user.user_id, outcome: 'SUCCESS' });
  clearSessionCookie(res, config);
  res.status(200).json({ message: 'Account deactivated. Medical records are retained per policy.' });
}

async function requestPasswordReset(req, res) {
  const email = assertEmail(req.body.email);
  const user = await getUserByEmail(email);
  // Always respond 200 to avoid account enumeration.
  if (user && user.status === 'Active') {
    const token = randomToken();
    await execute(
      'UPDATE users SET reset_token_hash = ?, reset_expires_at = DATE_ADD(NOW(), INTERVAL 30 MINUTE) WHERE user_id = ?',
      [hashToken(token), user.user_id]
    );
    const resetUrl = `${config.frontendUrl}/reset-password?token=${token}`;
    await sendMail({
      to: email,
      subject: 'Reset your MediFlow password',
      html: `<p>A password reset was requested for your account.</p><p><a href="${resetUrl}">Reset your password</a> (valid for 30 minutes).</p><p>If you did not request this, you can ignore this email.</p>`,
    });
    await writeAudit(req, { actorId: user.user_id, action: 'FORGOT_PASSWORD', resourceType: 'USER', resourceId: user.user_id, outcome: 'SUCCESS' });
  } else {
    await writeAudit(req, { action: 'FORGOT_PASSWORD', resourceType: 'USER', outcome: 'FAILURE', metadata: { email } });
  }
  res.status(200).json({ message: 'If an account exists for that email, a reset link has been sent.' });
}

async function resetPassword(req, res) {
  const token = assertString(req.body.token, 'token', { min: 20, max: 200 });
  const newPassword = assertPassword(req.body.password);
  const rows = await query(
    "SELECT user_id FROM users WHERE reset_token_hash = ? AND reset_expires_at > NOW() AND status = 'Active' LIMIT 1",
    [hashToken(token)]
  );
  if (!rows[0]) {
    await writeAudit(req, { action: 'RESET_PASSWORD', resourceType: 'USER', outcome: 'FAILURE' });
    return res.status(400).json({ error: 'Invalid or expired reset token.' });
  }
  await execute(
    'UPDATE users SET password_hash = ?, reset_token_hash = NULL, reset_expires_at = NULL, token_version = token_version + 1 WHERE user_id = ?',
    [await hashPassword(newPassword), rows[0].user_id]
  );
  await writeAudit(req, { actorId: rows[0].user_id, action: 'RESET_PASSWORD', resourceType: 'USER', resourceId: rows[0].user_id, outcome: 'SUCCESS' });
  res.status(200).json({ message: 'Password reset successful. Please sign in.' });
}

async function listStaff(_req, res) {
  const rows = await query(
    "SELECT user_id, name, email, role, status, last_login FROM users WHERE role != 'Patient' AND status != 'Deactivated' ORDER BY CAST(SUBSTRING(user_id, 5) AS UNSIGNED) ASC"
  );
  res.status(200).json(rows);
}

async function createStaff(req, res) {
  const email = assertEmail(req.body.email);
  const name = assertString(req.body.name || email.split('@')[0], 'name', { min: 2, max: 120 });
  const role = assertEnum(req.body.role, 'role', STAFF_ROLES.filter((candidate) => candidate !== 'Admin'));
  const password = assertPassword(req.body.password);
  if (await getUserByEmail(email)) return res.status(400).json({ error: 'Email is already registered.' });

  const userId = await nextUserId();
  await execute(
    `INSERT INTO users (user_id, name, email, password_hash, role, is_verified, status)
     VALUES (?, ?, ?, ?, ?, TRUE, 'Active')`,
    [userId, name, email, await hashPassword(password), role]
  );
  await writeAudit(req, { actorId: req.user.user_id, action: 'CREATE_STAFF', resourceType: 'USER', resourceId: userId, outcome: 'SUCCESS', metadata: { email, role } });
  res.status(201).json({ message: 'Staff account provisioned.', user: { user_id: userId, name, email, role, status: 'Active' } });
}

async function updateStaff(req, res) {
  const userId = assertString(req.params.id, 'id', { min: 4, max: 36 });
  const role = req.body.role ? assertEnum(req.body.role, 'role', STAFF_ROLES) : null;
  const status = req.body.status ? assertEnum(req.body.status, 'status', ['Active', 'Deactivated']) : null;
  const fields = [];
  const params = [];
  if (role) {
    fields.push('role = ?');
    params.push(role);
  }
  if (status) {
    fields.push('status = ?');
    params.push(status);
  }
  if (fields.length === 0) throw badRequest('No supported staff fields supplied.');
  params.push(userId);
  await execute(`UPDATE users SET ${fields.join(', ')} WHERE user_id = ? AND role != 'Patient'`, params);
  await writeAudit(req, { actorId: req.user.user_id, action: 'UPDATE_STAFF', resourceType: 'USER', resourceId: userId, outcome: 'SUCCESS', metadata: { role, status } });
  res.status(200).json({ message: 'Staff account updated.' });
}

async function deactivateStaff(req, res) {
  const userId = assertString(req.params.id, 'id', { min: 4, max: 36 });
  if (userId === req.user.user_id) throw badRequest('Administrators cannot deactivate their own session account.');
  await execute(
    "UPDATE users SET status = 'Deactivated', deleted_at = CURRENT_TIMESTAMP, token_version = token_version + 1 WHERE user_id = ? AND role != 'Patient'",
    [userId]
  );
  await writeAudit(req, { actorId: req.user.user_id, action: 'DEACTIVATE_STAFF', resourceType: 'USER', resourceId: userId, outcome: 'SUCCESS' });
  res.status(200).json({ message: 'Staff account deactivated.' });
}

async function bookConsultation(req, res) {
  const consultationId = `MH-C-${Date.now()}`;
  await execute(
    "INSERT INTO consultations (consultation_id, patient_id, doctor_id, session_status) VALUES (?, ?, NULL, 'Pending')",
    [consultationId, req.user.user_id]
  );
  await writeAudit(req, { actorId: req.user.user_id, action: 'BOOK_CONSULTATION', resourceType: 'CONSULTATION', resourceId: consultationId, outcome: 'SUCCESS' });
  res.status(201).json({ consultationId, status: 'Pending' });
}

async function listConsultations(req, res) {
  let rows;
  if (req.user.role === 'Patient') {
    rows = await query(
      `SELECT c.consultation_id, c.session_status, c.created_at, c.completed_at, d.name AS doctor_name
       FROM consultations c LEFT JOIN users d ON d.user_id = c.doctor_id
       WHERE c.patient_id = ? ORDER BY c.created_at DESC`,
      [req.user.user_id]
    );
  } else if (req.user.role === 'Doctor') {
    // Assigned to me, plus the unclaimed pending pool.
    rows = await query(
      `SELECT c.consultation_id, c.patient_id, p.name AS patient_name, c.doctor_id, c.session_status, c.created_at
       FROM consultations c JOIN users p ON p.user_id = c.patient_id
       WHERE c.doctor_id = ? OR (c.doctor_id IS NULL AND c.session_status = 'Pending')
       ORDER BY FIELD(c.session_status, 'Active', 'Pending', 'Completed'), c.created_at`,
      [req.user.user_id]
    );
  } else {
    // Nurse / Admin: active workload.
    rows = await query(
      `SELECT c.consultation_id, c.patient_id, p.name AS patient_name, c.doctor_id, d.name AS doctor_name, c.session_status, c.created_at
       FROM consultations c JOIN users p ON p.user_id = c.patient_id LEFT JOIN users d ON d.user_id = c.doctor_id
       WHERE c.session_status IN ('Pending', 'Active') ORDER BY c.created_at`
    );
  }
  res.status(200).json(rows);
}

async function updateConsultation(req, res) {
  const id = assertString(req.params.id, 'consultation id', { min: 4, max: 36 });
  const action = assertEnum(req.body.action, 'action', ['claim', 'assign', 'start', 'complete', 'cancel']);
  const rows = await query('SELECT * FROM consultations WHERE consultation_id = ? LIMIT 1', [id]);
  const consultation = rows[0];
  if (!consultation) throw notFound('Consultation not found.');

  // Doctors may only act on consultations assigned to them (except claiming a free one).
  const isOwningDoctor = req.user.role === 'Doctor' && consultation.doctor_id === req.user.user_id;

  if (action === 'claim') {
    if (req.user.role !== 'Doctor') throw forbidden('Only doctors can claim a consultation.');
    if (consultation.session_status !== 'Pending' || consultation.doctor_id) throw badRequest('Consultation is not available to claim.');
    await execute("UPDATE consultations SET doctor_id = ? WHERE consultation_id = ? AND doctor_id IS NULL", [req.user.user_id, id]);
  } else if (action === 'assign') {
    if (!['Nurse', 'Admin'].includes(req.user.role)) throw forbidden();
    const doctorId = assertString(req.body.doctorId, 'doctorId', { min: 4, max: 36 });
    await execute("UPDATE consultations SET doctor_id = ? WHERE consultation_id = ?", [doctorId, id]);
  } else if (action === 'start') {
    if (req.user.role === 'Doctor' && !isOwningDoctor) throw forbidden();
    if (consultation.session_status !== 'Pending') throw badRequest('Only a pending consultation can start.');
    await execute("UPDATE consultations SET session_status = 'Active' WHERE consultation_id = ?", [id]);
  } else if (action === 'complete') {
    if (req.user.role === 'Doctor' && !isOwningDoctor) throw forbidden();
    if (consultation.session_status !== 'Active') throw badRequest('Only an active consultation can be completed.');
    await execute("UPDATE consultations SET session_status = 'Completed', completed_at = CURRENT_TIMESTAMP WHERE consultation_id = ?", [id]);
  } else if (action === 'cancel') {
    if (req.user.role === 'Doctor' && !isOwningDoctor) throw forbidden();
    if (consultation.session_status === 'Completed') throw badRequest('Completed consultations cannot be cancelled.');
    await execute("UPDATE consultations SET session_status = 'Cancelled' WHERE consultation_id = ?", [id]);
  }

  await writeAudit(req, { actorId: req.user.user_id, action: `CONSULTATION_${action.toUpperCase()}`, resourceType: 'CONSULTATION', resourceId: id, outcome: 'SUCCESS' });
  res.status(200).json({ message: `Consultation ${action} successful.` });
}

function triagePriority(answers) {
  if (answers.chestPain === 'Severe' || answers.shortnessOfBreath === 'Yes') return 'Emergency';
  if (answers.chestPain === 'Moderate' || answers.fever === 'Yes') return 'Urgent';
  return 'Routine';
}

async function submitTriage(req, res) {
  const answers = {
    fever: assertEnum(req.body.fever, 'fever', ['Yes', 'No']),
    cough: assertEnum(req.body.cough, 'cough', ['Yes', 'No']),
    chestPain: assertEnum(req.body.chestPain, 'chestPain', ['None', 'Mild', 'Moderate', 'Severe']),
    duration: assertString(req.body.duration, 'duration', { min: 1, max: 120 }),
    shortnessOfBreath: req.body.shortnessOfBreath ? assertEnum(req.body.shortnessOfBreath, 'shortnessOfBreath', ['Yes', 'No']) : 'No',
  };
  const priority = triagePriority(answers);
  const result = await execute(
    `INSERT INTO triage_submissions (patient_id, answers_encrypted, priority_score, status)
     VALUES (?, ?, ?, 'Waiting')`,
    [req.user.user_id, encryptJson(answers, config), priority]
  );
  await writeAudit(req, { actorId: req.user.user_id, action: 'SUBMIT_TRIAGE', resourceType: 'TRIAGE', resourceId: String(result.insertId), outcome: 'SUCCESS', metadata: { priority } });
  res.status(201).json({ triageId: result.insertId, priority, status: 'Waiting' });
}

async function listQueue(req, res) {
  const rows = await query(
    `SELECT t.triage_id, t.patient_id, u.name AS patient_name, t.priority_score, t.status, t.assigned_doctor_id, t.created_at
     FROM triage_submissions t
     JOIN users u ON u.user_id = t.patient_id
     WHERE t.status IN ('Waiting', 'Called', 'InConsultation')
     ORDER BY FIELD(t.priority_score, 'Emergency', 'Urgent', 'Routine'), t.created_at ASC`
  );
  res.status(200).json(rows);
}

async function updateQueue(req, res) {
  const triageId = assertPositiveInteger(req.params.id, 'triage id');
  const priority = req.body.priority ? assertEnum(req.body.priority, 'priority', ['Routine', 'Urgent', 'Emergency']) : null;
  const status = req.body.status ? assertEnum(req.body.status, 'status', ['Waiting', 'Called', 'InConsultation', 'Completed', 'Discharged']) : null;
  const assignedDoctorId = assertOptionalString(req.body.assignedDoctorId, 'assignedDoctorId', { min: 4, max: 36 });
  const fields = [];
  const params = [];
  if (priority) {
    fields.push('priority_score = ?');
    params.push(priority);
  }
  if (status) {
    fields.push('status = ?');
    params.push(status);
  }
  if (assignedDoctorId) {
    fields.push('assigned_doctor_id = ?');
    params.push(assignedDoctorId);
  }
  if (fields.length === 0) throw badRequest('No supported queue fields supplied.');
  params.push(triageId);
  await execute(`UPDATE triage_submissions SET ${fields.join(', ')} WHERE triage_id = ?`, params);
  await writeAudit(req, { actorId: req.user.user_id, action: 'UPDATE_QUEUE', resourceType: 'TRIAGE', resourceId: String(triageId), outcome: 'SUCCESS', metadata: { priority, status, assignedDoctorId } });
  res.status(200).json({ message: 'Queue updated.' });
}

async function createCheckout(req, res) {
  const consultationId = assertOptionalString(req.body.consultationId, 'consultationId', { min: 4, max: 36 });
  const amountCents = 7350;
  const reference = `MF-CHK-${Date.now()}`;
  const result = await execute(
    `INSERT INTO payment_events (patient_id, consultation_id, checkout_reference, amount_cents, currency, status)
     VALUES (?, ?, ?, ?, 'SGD', 'Pending')`,
    [req.user.user_id, consultationId, reference, amountCents]
  );
  await writeAudit(req, { actorId: req.user.user_id, action: 'CREATE_CHECKOUT', resourceType: 'PAYMENT', resourceId: String(result.insertId), outcome: 'SUCCESS', metadata: { amountCents, consultationId } });
  res.status(201).json({
    paymentId: result.insertId,
    checkoutReference: reference,
    amountCents,
    currency: 'SGD',
    status: 'Pending',
    checkoutUrl: `https://checkout.stripe.com/c/pay/${reference}`,
  });
}

async function handlePaymentWebhook(req, res) {
  if (!config.stripeWebhookSecret) {
    return res.status(503).json({ error: 'Stripe webhook secret is not configured.' });
  }

  const signatureHeader = req.get('stripe-signature') || '';
  const rawBody = req.body.toString('utf8');
  if (!verifyStripeSignature(rawBody, signatureHeader)) {
    return res.status(400).json({ error: 'Invalid Stripe signature.' });
  }

  const event = JSON.parse(rawBody);
  const eventId = assertString(event.id, 'event.id', { min: 5, max: 120 });
  const existing = await query('SELECT payment_id FROM payment_events WHERE stripe_event_id = ? LIMIT 1', [eventId]);
  if (existing.length > 0) {
    return res.status(200).json({ received: true, duplicate: true });
  }

  if (event.type === 'checkout.session.completed') {
    const object = event.data?.object || {};
    const paymentId = assertPositiveInteger(object.metadata?.payment_id, 'payment_id');
    await execute(
      `UPDATE payment_events
       SET status = 'Paid', stripe_event_id = ?, paid_at = CURRENT_TIMESTAMP
       WHERE payment_id = ? AND status = 'Pending'`,
      [eventId, paymentId]
    );
    await writeAudit({ ...req, ip: req.ip, get: req.get.bind(req) }, { action: 'PAYMENT_WEBHOOK_PAID', resourceType: 'PAYMENT', resourceId: String(paymentId), outcome: 'SUCCESS', metadata: { eventId } });
  }

  res.status(200).json({ received: true });
}

function verifyStripeSignature(rawBody, signatureHeader) {
  const fields = Object.fromEntries(
    signatureHeader
      .split(',')
      .map((part) => part.split('='))
      .filter((part) => part.length === 2)
  );
  if (!fields.t || !fields.v1) return false;
  const payload = `${fields.t}.${rawBody}`;
  const expected = cryptoHmac(payload, config.stripeWebhookSecret);
  return expected === fields.v1;
}

function cryptoHmac(value, secret) {
  return crypto.createHmac('sha256', secret).update(value).digest('hex');
}

async function getPayment(req, res) {
  const paymentId = assertPositiveInteger(req.params.id, 'payment id');
  const rows = await query('SELECT * FROM payment_events WHERE payment_id = ? LIMIT 1', [paymentId]);
  const payment = rows[0];
  if (!payment) throw notFound('Payment not found.');
  if (req.user.role === 'Patient' && payment.patient_id !== req.user.user_id) throw forbidden();
  res.status(200).json(payment);
}

async function createPrescription(req, res) {
  const consultationId = assertString(req.body.consultationId, 'consultationId', { min: 4, max: 36 });
  const patientId = assertString(req.body.patientId, 'patientId', { min: 4, max: 36 });
  const dosage = assertString(req.body.dosage, 'dosage', { min: 1, max: 80 });
  const frequency = assertString(req.body.frequency, 'frequency', { min: 1, max: 80 });
  const refills = Number(req.body.refills || 0);
  const instructions = assertOptionalString(req.body.instructions, 'instructions', { min: 0, max: 500 });

  // Prefer selecting from the MySQL inventory; fall back to free-text medication name.
  let medicationId = assertOptionalString(req.body.medicationId, 'medicationId', { min: 3, max: 40 });
  let medication = assertOptionalString(req.body.medication, 'medication', { min: 2, max: 120 });
  if (medicationId) {
    const meds = await query('SELECT name FROM medication_inventory WHERE medication_id = ? LIMIT 1', [medicationId]);
    if (!meds[0]) throw badRequest('Selected medication is not in the inventory.');
    medication = meds[0].name;
  } else if (!medication) {
    throw badRequest('A medication (id or name) is required.');
  } else {
    medicationId = null;
  }

  await ensureAssignedDoctor(consultationId, req.user.user_id, patientId);

  const prescriptionId = `RX-${Date.now()}`;
  await execute(
    `INSERT INTO prescriptions
     (prescription_id, consultation_id, patient_id, doctor_id, medication_id, medication_name, dosage, frequency, refills, instructions_encrypted, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Issued')`,
    [prescriptionId, consultationId, patientId, req.user.user_id, medicationId, medication, dosage, frequency, refills, encryptText(instructions || '', config)]
  );
  await writeAudit(req, { actorId: req.user.user_id, action: 'ISSUE_PRESCRIPTION', resourceType: 'PRESCRIPTION', resourceId: prescriptionId, outcome: 'SUCCESS', metadata: { consultationId, patientId, medication } });
  res.status(201).json({ prescriptionId, status: 'Issued' });
}

async function listInventory(_req, res) {
  const rows = await query('SELECT medication_id, name, form, stock_quantity, unit_price_cents FROM medication_inventory ORDER BY name');
  res.status(200).json(rows);
}

async function listPharmacyQueue(_req, res) {
  const rows = await query(
    `SELECT p.prescription_id, p.patient_id, u.name AS patient_name, p.medication_name, p.dosage, p.frequency, p.status, p.issued_at,
            i.stock_quantity
     FROM prescriptions p
     JOIN users u ON u.user_id = p.patient_id
     LEFT JOIN medication_inventory i ON i.medication_id = p.medication_id
     WHERE p.status = 'Issued'
     ORDER BY p.issued_at ASC`
  );
  res.status(200).json(rows);
}

async function listPatientPrescriptions(req, res) {
  const rows = await query(
    `SELECT prescription_id, medication_name, dosage, frequency, refills, status, issued_at, fulfilled_at
     FROM prescriptions WHERE patient_id = ? ORDER BY issued_at DESC`,
    [req.user.user_id]
  );
  res.status(200).json(rows);
}

async function fulfilPrescription(req, res) {
  const prescriptionId = assertString(req.params.id, 'prescription id', { min: 3, max: 50 });
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    // Lock the prescription row for the duration of the fulfilment.
    const [pres] = await connection.execute('SELECT * FROM prescriptions WHERE prescription_id = ? FOR UPDATE', [prescriptionId]);
    const prescription = pres[0];
    if (!prescription) throw notFound('Prescription not found.');
    if (prescription.status !== 'Issued') throw badRequest('Only issued prescriptions can be fulfilled.');

    if (prescription.medication_id) {
      // Atomically decrement stock; the WHERE guard prevents overselling.
      const [result] = await connection.execute(
        'UPDATE medication_inventory SET stock_quantity = stock_quantity - 1 WHERE medication_id = ? AND stock_quantity > 0',
        [prescription.medication_id]
      );
      if (result.affectedRows === 0) {
        await connection.rollback();
        return res.status(409).json({ error: 'Medication is out of stock.' });
      }
    }

    await connection.execute(
      "UPDATE prescriptions SET status = 'Fulfilled', fulfilled_by = ?, fulfilled_at = CURRENT_TIMESTAMP WHERE prescription_id = ?",
      [req.user.user_id, prescriptionId]
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  await writeAudit(req, { actorId: req.user.user_id, action: 'FULFIL_PRESCRIPTION', resourceType: 'PRESCRIPTION', resourceId: prescriptionId, outcome: 'SUCCESS' });
  res.status(200).json({ message: 'Prescription fulfilled.', status: 'Fulfilled' });
}

async function getPrescription(req, res) {
  const prescriptionId = assertString(req.params.id, 'prescription id', { min: 3, max: 50 });
  const rows = await query('SELECT * FROM prescriptions WHERE prescription_id = ? LIMIT 1', [prescriptionId]);
  const prescription = rows[0];
  if (!prescription) throw notFound('Prescription not found.');
  if (!canAccessPatientRecord(req.user, prescription.patient_id, prescription.doctor_id, { allowPharmacist: true })) throw forbidden();
  prescription.instructions = decryptText(prescription.instructions_encrypted, config);
  delete prescription.instructions_encrypted;
  await writeAudit(req, { actorId: req.user.user_id, action: 'READ_PRESCRIPTION', resourceType: 'PRESCRIPTION', resourceId: prescriptionId, outcome: 'SUCCESS' });
  res.status(200).json(prescription);
}

async function createMedicalCertificate(req, res) {
  const consultationId = assertString(req.body.consultationId, 'consultationId', { min: 4, max: 36 });
  const patientId = assertString(req.body.patientId, 'patientId', { min: 4, max: 36 });
  const diagnosis = assertString(req.body.diagnosis, 'diagnosis', { min: 3, max: 300 });
  const validUntil = assertString(req.body.validUntil, 'validUntil', { min: 10, max: 10, pattern: /^\d{4}-\d{2}-\d{2}$/ });
  await ensureAssignedDoctor(consultationId, req.user.user_id, patientId);
  const paid = await query(
    "SELECT payment_id FROM payment_events WHERE patient_id = ? AND (consultation_id = ? OR consultation_id IS NULL) AND status = 'Paid' LIMIT 1",
    [patientId, consultationId]
  );
  if (paid.length === 0) throw forbidden('Verified payment is required before MC release.');

  // Lazily provision this doctor's Ed25519 signing keypair (private key encrypted at rest).
  const doctorRows = await query('SELECT mc_public_key, mc_private_key_encrypted FROM users WHERE user_id = ?', [req.user.user_id]);
  let privateKeyPem = doctorRows[0]?.mc_private_key_encrypted ? decryptText(doctorRows[0].mc_private_key_encrypted, config) : null;
  if (!privateKeyPem || !doctorRows[0]?.mc_public_key) {
    const keyPair = generateMcKeyPair();
    privateKeyPem = keyPair.privateKeyPem;
    await execute('UPDATE users SET mc_public_key = ?, mc_private_key_encrypted = ? WHERE user_id = ?', [keyPair.publicKeyPem, encryptText(keyPair.privateKeyPem, config), req.user.user_id]);
  }

  const mcId = `MH-MC-${Date.now()}`;
  // Sign with the doctor's PRIVATE key (asymmetric non-repudiation).
  const token = signMcTokenAsym({ mc_id: mcId, patient_id: patientId, doctor_id: req.user.user_id, issue_date: new Date().toISOString().slice(0, 10) }, privateKeyPem);
  await execute(
    `INSERT INTO medical_certificates
     (mc_id, consultation_id, doctor_id, patient_id, issue_date, valid_until, diagnosis_encrypted, qr_token_hash, signature_hash, is_revoked)
     VALUES (?, ?, ?, ?, CURRENT_DATE, ?, ?, ?, ?, FALSE)`,
    [mcId, consultationId, req.user.user_id, patientId, validUntil, encryptText(diagnosis, config), hashToken(token), sha256(token)]
  );
  await writeAudit(req, { actorId: req.user.user_id, action: 'ISSUE_MC', resourceType: 'MEDICAL_CERTIFICATE', resourceId: mcId, outcome: 'SUCCESS', metadata: { consultationId, patientId } });
  res.status(201).json({ mcId, verificationToken: token, status: 'Issued' });
}

async function getMedicalCertificate(req, res) {
  const mcId = assertString(req.params.id, 'mc id', { min: 4, max: 60 });
  const rows = await query('SELECT * FROM medical_certificates WHERE mc_id = ? LIMIT 1', [mcId]);
  const mc = rows[0];
  if (!mc) throw notFound('Medical certificate not found.');
  if (!canAccessPatientRecord(req.user, mc.patient_id, mc.doctor_id)) throw forbidden();
  mc.diagnosis = decryptText(mc.diagnosis_encrypted, config);
  delete mc.diagnosis_encrypted;
  delete mc.qr_token_hash;
  delete mc.signature_hash;
  await writeAudit(req, { actorId: req.user.user_id, action: 'READ_MC', resourceType: 'MEDICAL_CERTIFICATE', resourceId: mcId, outcome: 'SUCCESS' });
  res.status(200).json(mc);
}

async function getLatestPatientMedicalCertificate(req, res) {
  const rows = await query(
    `SELECT * FROM medical_certificates
     WHERE patient_id = ?
     ORDER BY issue_date DESC, mc_id DESC
     LIMIT 1`,
    [req.user.user_id]
  );
  if (!rows[0]) throw notFound('No medical certificate found.');
  rows[0].diagnosis = decryptText(rows[0].diagnosis_encrypted, config);
  delete rows[0].diagnosis_encrypted;
  delete rows[0].qr_token_hash;
  delete rows[0].signature_hash;
  res.status(200).json(rows[0]);
}

async function revokeMedicalCertificate(req, res) {
  const mcId = assertString(req.params.id, 'mc id', { min: 4, max: 60 });
  await execute('UPDATE medical_certificates SET is_revoked = TRUE, revoked_at = CURRENT_TIMESTAMP WHERE mc_id = ?', [mcId]);
  await writeAudit(req, { actorId: req.user.user_id, action: 'REVOKE_MC', resourceType: 'MEDICAL_CERTIFICATE', resourceId: mcId, outcome: 'SUCCESS' });
  res.status(200).json({ message: 'Medical certificate revoked.' });
}

async function verifyMedicalCertificate(req, res) {
  const token = assertString(req.params.token, 'token', { min: 20, max: 2000 });
  // Decode (unverified) only to locate the certificate + its signing doctor.
  let payload;
  try {
    payload = decodeMcPayload(token);
  } catch {
    return res.status(400).json({ valid: false });
  }
  const rows = await query(
    `SELECT mc.mc_id, mc.issue_date, mc.valid_until, mc.is_revoked, u.mc_public_key
     FROM medical_certificates mc
     JOIN users u ON u.user_id = mc.doctor_id
     WHERE mc.mc_id = ? AND mc.qr_token_hash = ?
     LIMIT 1`,
    [payload.mc_id, hashToken(token)]
  );
  const mc = rows[0];
  if (!mc || !mc.mc_public_key) return res.status(404).json({ valid: false });
  // Cryptographically verify the signature against the doctor's PUBLIC key.
  try {
    verifyMcTokenAsym(token, mc.mc_public_key);
  } catch {
    return res.status(400).json({ valid: false });
  }
  res.status(200).json({
    valid: !mc.is_revoked,
    issueDate: mc.issue_date,
    validUntil: mc.valid_until,
    revoked: Boolean(mc.is_revoked),
  });
}

async function listMessages(req, res) {
  const consultationId = assertString(req.params.id, 'consultation id', { min: 4, max: 36 });
  await ensureConsultationAccess(req.user, consultationId);
  const rows = await query(
    `SELECT message_id, sender_id, message_body_encrypted, sent_at
     FROM chat_messages
     WHERE consultation_id = ?
     ORDER BY sent_at ASC`,
    [consultationId]
  );
  res.status(200).json(rows.map((row) => ({ ...row, messageBody: decryptText(row.message_body_encrypted, config), message_body_encrypted: undefined })));
}

async function createMessage(req, res) {
  const consultationId = assertString(req.params.id, 'consultation id', { min: 4, max: 36 });
  await ensureConsultationAccess(req.user, consultationId);
  const messageBody = assertString(req.body.messageBody, 'messageBody', { min: 1, max: 1000 });
  const result = await execute(
    `INSERT INTO chat_messages (consultation_id, sender_id, message_body_encrypted)
     VALUES (?, ?, ?)`,
    [consultationId, req.user.user_id, encryptText(messageBody, config)]
  );
  await writeAudit(req, { actorId: req.user.user_id, action: 'CREATE_CHAT_MESSAGE', resourceType: 'CHAT_MESSAGE', resourceId: String(result.insertId), outcome: 'SUCCESS', metadata: { consultationId } });
  res.status(201).json({ messageId: result.insertId, sentAt: new Date().toISOString() });
}

async function registerAttachment(req, res) {
  const consultationId = assertString(req.params.id, 'consultation id', { min: 4, max: 36 });
  await ensureConsultationAccess(req.user, consultationId);
  const attachment = scanAttachmentMetadata(req.body);
  const result = await execute(
    `INSERT INTO message_attachments
     (consultation_id, uploader_id, filename, mime_type, size_bytes, malware_scan_status)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [consultationId, req.user.user_id, attachment.filename, attachment.mimeType, attachment.sizeBytes, attachment.malwareScanStatus]
  );
  await writeAudit(req, { actorId: req.user.user_id, action: 'REGISTER_ATTACHMENT', resourceType: 'ATTACHMENT', resourceId: String(result.insertId), outcome: 'SUCCESS', metadata: { consultationId, mimeType: attachment.mimeType, sizeBytes: attachment.sizeBytes } });
  res.status(201).json({ attachmentId: result.insertId, malwareScanStatus: attachment.malwareScanStatus });
}

async function uploadAttachment(req, res) {
  // Strict id pattern (no path-traversal chars) — defence-in-depth for the fs path below.
  const consultationId = assertString(req.params.id, 'consultation id', { min: 4, max: 36, pattern: /^[A-Za-z0-9-]+$/ });
  await ensureConsultationAccess(req.user, consultationId);
  if (!req.file) throw badRequest('A file is required.');
  // Validate type/size/name, then scan the bytes for malware before anything is stored.
  const meta = scanAttachmentMetadata({ filename: req.file.originalname, mimeType: req.file.mimetype, sizeBytes: req.file.size });
  const scan = await scanBufferForMalware(req.file.buffer, config);
  if (!scan.clean) {
    await writeAudit(req, { actorId: req.user.user_id, action: 'UPLOAD_ATTACHMENT', resourceType: 'ATTACHMENT', resourceId: consultationId, outcome: 'FAILURE', metadata: { signature: scan.signature, engine: scan.engine } });
    return res.status(422).json({ error: 'Attachment failed malware scan.' });
  }
  // Store under a server-generated name (never the client's) outside the web root.
  // Path components are validated (id pattern above; filename pattern in scanAttachmentMetadata).
  const baseDir = path.resolve(config.uploadDir);
  // nosemgrep: javascript.express.security.audit.express-path-join-resolve-traversal.express-path-join-resolve-traversal -- consultationId is regex-validated; containment asserted below
  const dir = path.join(baseDir, consultationId);
  const storedName = `${randomToken(8)}_${meta.filename}`;
  // nosemgrep: javascript.express.security.audit.express-path-join-resolve-traversal.express-path-join-resolve-traversal -- storedName is server-generated; containment asserted below
  const storagePath = path.join(dir, storedName);
  // Defence-in-depth: the resolved path must stay inside the upload root.
  if (!path.resolve(storagePath).startsWith(baseDir + path.sep)) throw badRequest('Invalid attachment path.');
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- dir validated + contained
  await fs.mkdir(dir, { recursive: true });
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- server-generated, contained path
  await fs.writeFile(storagePath, req.file.buffer, { mode: 0o600 });
  const status = scan.engine === 'clamav' ? 'PASSED' : 'PASSED_STUB';
  const result = await execute(
    `INSERT INTO message_attachments (consultation_id, uploader_id, filename, mime_type, size_bytes, malware_scan_status, storage_path)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [consultationId, req.user.user_id, meta.filename, meta.mimeType, meta.sizeBytes, status, storagePath]
  );
  await writeAudit(req, { actorId: req.user.user_id, action: 'UPLOAD_ATTACHMENT', resourceType: 'ATTACHMENT', resourceId: String(result.insertId), outcome: 'SUCCESS', metadata: { consultationId, engine: scan.engine } });
  res.status(201).json({ attachmentId: result.insertId, malwareScanStatus: status, scanEngine: scan.engine });
}

async function downloadAttachment(req, res) {
  const attachmentId = assertPositiveInteger(req.params.id, 'attachment id');
  const rows = await query('SELECT * FROM message_attachments WHERE attachment_id = ? LIMIT 1', [attachmentId]);
  const attachment = rows[0];
  if (!attachment || !attachment.storage_path) throw notFound('Attachment not found.');
  // Only participants of the consultation may download (object-level authz).
  await ensureConsultationAccess(req.user, attachment.consultation_id);
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- storage_path is server-written, never user input
  const buffer = await fs.readFile(attachment.storage_path);
  res.setHeader('Content-Type', attachment.mime_type);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Disposition', `attachment; filename="${attachment.filename.replace(/"/g, '')}"`);
  await writeAudit(req, { actorId: req.user.user_id, action: 'DOWNLOAD_ATTACHMENT', resourceType: 'ATTACHMENT', resourceId: String(attachmentId), outcome: 'SUCCESS' });
  res.status(200).send(buffer);
}

async function issueRealtimeToken(req, res) {
  const token = mintFirebaseCustomToken(req.user.user_id, { role: req.user.role }, config);
  if (!token) return res.status(503).json({ error: 'Realtime (Firebase) is not configured.' });
  await writeAudit(req, { actorId: req.user.user_id, action: 'REALTIME_TOKEN', resourceType: 'USER', resourceId: req.user.user_id, outcome: 'SUCCESS' });
  res.status(200).json({ token });
}

async function getRtcCredentials(req, res) {
  const consultationId = assertString(req.params.id, 'consultation id', { min: 4, max: 36 });
  // Only the assigned doctor/patient of the consultation may obtain TURN credentials.
  await ensureConsultationAccess(req.user, consultationId);
  const creds = makeTurnCredentials(config);
  if (!creds) return res.status(503).json({ error: 'TURN/WebRTC is not configured.' });
  res.status(200).json({ ...creds, consultationId });
}

async function startRecordingSession(req, res) {
  const consultationId = assertString(req.params.id, 'consultation id', { min: 4, max: 36 });
  await ensureConsultationAccess(req.user, consultationId);
  if (req.body.consent !== true) throw badRequest('Patient consent is required to start a recording.');
  const result = await execute(
    'INSERT INTO recording_sessions (consultation_id, started_by, patient_consent) VALUES (?, ?, TRUE)',
    [consultationId, req.user.user_id]
  );
  await writeAudit(req, { actorId: req.user.user_id, action: 'START_RECORDING', resourceType: 'RECORDING', resourceId: String(result.insertId), outcome: 'SUCCESS', metadata: { consultationId } });
  res.status(201).json({ recordingId: result.insertId, consent: true });
}

async function ensureAssignedDoctor(consultationId, doctorId, patientId) {
  const rows = await query(
    'SELECT consultation_id FROM consultations WHERE consultation_id = ? AND doctor_id = ? AND patient_id = ? LIMIT 1',
    [consultationId, doctorId, patientId]
  );
  if (rows.length === 0) throw forbidden('Doctor is not assigned to this patient consultation.');
}

async function ensureConsultationAccess(user, consultationId) {
  const rows = await query('SELECT patient_id, doctor_id FROM consultations WHERE consultation_id = ? LIMIT 1', [consultationId]);
  const consultation = rows[0];
  if (!consultation) throw notFound('Consultation not found.');
  if (!canAccessPatientRecord(user, consultation.patient_id, consultation.doctor_id)) throw forbidden();
  return consultation;
}

function canAccessPatientRecord(user, patientId, doctorId, { allowPharmacist = false } = {}) {
  if (user.role === 'Admin') return true;
  if (user.role === 'Patient') return user.user_id === patientId;
  if (user.role === 'Doctor') return user.user_id === doctorId;
  if (allowPharmacist && user.role === 'Pharmacist') return true;
  return false;
}

async function assertDatabaseConnection() {
  const connection = await db.getConnection();
  connection.release();
  console.log('Successfully connected to the MySQL database.');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  assertDatabaseConnection()
    .then(() => {
      app.listen(config.port, () => {
        console.log(`Backend server is running on port ${config.port}.`);
      });
    })
    .catch((error) => {
      console.error('Error connecting to the MySQL database:', error.message);
      process.exitCode = 1;
    });
}

export { app, db };
