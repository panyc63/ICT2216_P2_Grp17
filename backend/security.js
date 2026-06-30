import crypto from 'crypto';
import net from 'net';

export const ROLES = ['Patient', 'Nurse', 'Doctor', 'Admin', 'Pharmacist'];
export const STAFF_ROLES = ['Nurse', 'Doctor', 'Admin', 'Pharmacist'];

const SESSION_COOKIE = 'mf_session';
const CSRF_COOKIE = 'mf_csrf';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function getConfig() {
  const isProduction = process.env.NODE_ENV === 'production';
  const missing = [];
  const requireSecret = (name, fallback) => {
    const value = process.env[name];
    if (!value) {
      if (isProduction) missing.push(name);
      return fallback;
    }
    return value;
  };

  const config = {
    isProduction,
    port: Number(process.env.PORT || 5000),
    backendPublicUrl: process.env.BACKEND_PUBLIC_URL || 'http://localhost:5000',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
    corsOrigins: (process.env.CORS_ORIGINS || process.env.FRONTEND_URL || 'http://localhost:5173')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    jwtSecret: requireSecret('JWT_SECRET', 'dev-only-change-jwt-secret-32-bytes-minimum'),
    csrfSecret: requireSecret('CSRF_SECRET', 'dev-only-change-csrf-secret-32-bytes-minimum'),
    dataEncryptionKey: requireSecret('DATA_ENCRYPTION_KEY', 'dev-only-change-data-key-32-bytes-minimum'),
    mcSigningKey: requireSecret('MC_SIGNING_KEY', 'dev-only-change-mc-signing-key-32-bytes-minimum'),
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    resendApiKey: process.env.RESEND_API_KEY || '',
    mfaRequiredRoles: (process.env.MFA_REQUIRED_ROLES || (isProduction ? STAFF_ROLES.join(',') : ''))
      .split(',')
      .map((role) => role.trim())
      .filter(Boolean),
    secureCookies: isProduction,
    // Optional integrations (feature-flagged; absent => graceful fallback / 503).
    clamdHost: process.env.CLAMD_HOST || '',
    clamdPort: Number(process.env.CLAMD_PORT || 3310),
    uploadDir: process.env.UPLOAD_DIR || 'uploads',
    firebaseClientEmail: process.env.FIREBASE_CLIENT_EMAIL || '',
    firebasePrivateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    turnSecret: process.env.TURN_SECRET || '',
    turnUrls: (process.env.TURN_URLS || '').split(',').map((u) => u.trim()).filter(Boolean),
    // Managed TURN (e.g. Cloudflare/Metered) static long-term credentials — used when
    // not self-hosting coturn. Optional: STUN-only still works for most P2P calls.
    turnUsername: process.env.TURN_USERNAME || '',
    turnCredential: process.env.TURN_CREDENTIAL || '',
  };

  if (missing.length > 0) {
    throw new Error(`Missing required production security environment variables: ${missing.join(', ')}`);
  }

  return config;
}

export function applySecurityHeaders(config) {
  return (req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"
    );
    res.setHeader('Cache-Control', 'no-store');
    // COOP isolates the browsing context group; it only affects window-opener
    // relationships, so it is safe even when the dev frontend calls cross-origin.
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    if (config.isProduction) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
      // CORP is production-only: prod is single-origin (nginx proxies /api), whereas
      // dev calls the API cross-origin (localhost:5000) where same-origin CORP would
      // block the fetch. Mirrors the HSTS production gate above.
      res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    }
    next();
  };
}

export function applyCors(config) {
  return (req, res, next) => {
    const origin = req.headers.origin;
    if (!origin || config.corsOrigins.includes(origin)) {
      if (origin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
      }
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
    }

    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }

    return next();
  };
}

export function parseCookies(req, _res, next) {
  req.cookies = {};
  const header = req.headers.cookie;
  if (header) {
    for (const pair of header.split(';')) {
      const index = pair.indexOf('=');
      if (index > -1) {
        const key = pair.slice(0, index).trim();
        const value = pair.slice(index + 1).trim();
        req.cookies[key] = decodeURIComponent(value);
      }
    }
  }
  next();
}

function cookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (options.maxAge !== undefined) parts.push(`Max-Age=${Math.floor(options.maxAge / 1000)}`);
  if (options.httpOnly) parts.push('HttpOnly');
  if (options.secure) parts.push('Secure');
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
  if (options.path) parts.push(`Path=${options.path}`);
  return parts.join('; ');
}

export function setSessionCookie(res, token, config) {
  res.append('Set-Cookie', cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'Lax',
    secure: config.secureCookies,
    path: '/',
    maxAge: 15 * 60 * 1000,
  }));
}

export function clearSessionCookie(res, config) {
  res.append('Set-Cookie', cookie(SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'Lax',
    secure: config.secureCookies,
    path: '/',
    maxAge: 0,
  }));
}

export function issueCsrfToken(res, config) {
  const token = crypto.randomBytes(32).toString('base64url');
  const signed = signCsrfToken(token, config.csrfSecret);
  res.append('Set-Cookie', cookie(CSRF_COOKIE, signed, {
    httpOnly: false,
    sameSite: 'Lax',
    secure: config.secureCookies,
    path: '/',
    maxAge: 15 * 60 * 1000,
  }));
  return signed;
}

function signCsrfToken(token, secret) {
  const mac = crypto.createHmac('sha256', secret).update(token).digest('base64url');
  return `${token}.${mac}`;
}

function verifyCsrfToken(signed, secret) {
  if (!signed || !signed.includes('.')) return false;
  const [token, mac] = signed.split('.');
  return safeEqual(signCsrfToken(token, secret), signed) && safeEqual(mac, crypto.createHmac('sha256', secret).update(token).digest('base64url'));
}

export function csrfGuard(config) {
  return (req, res, next) => {
    if (SAFE_METHODS.has(req.method) || req.path === '/api/payments/webhook') {
      return next();
    }

    const cookieToken = req.cookies?.[CSRF_COOKIE];
    const headerToken = req.headers['x-csrf-token'];
    if (!cookieToken || !headerToken || cookieToken !== headerToken || !verifyCsrfToken(cookieToken, config.csrfSecret)) {
      return res.status(403).json({ error: 'CSRF validation failed.' });
    }

    return next();
  };
}

export function getSessionToken(req) {
  return req.cookies?.[SESSION_COOKIE] || '';
}

export function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function hashToken(value) {
  return sha256(value);
}

function base64urlJson(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

export function signJwt(payload, secret, ttlSeconds = 15 * 60) {
  const now = Math.floor(Date.now() / 1000);
  const body = {
    ...payload,
    iat: now,
    exp: now + ttlSeconds,
  };
  const header = base64urlJson({ alg: 'HS256', typ: 'JWT' });
  const encodedBody = base64urlJson(body);
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${header}.${encodedBody}`)
    .digest('base64url');
  return `${header}.${encodedBody}.${signature}`;
}

export function verifyJwt(token, secret) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Malformed session token.');
  const [header, payload, signature] = parts;
  const expected = crypto.createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
  if (!safeEqual(signature, expected)) throw new Error('Invalid session signature.');
  const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  if (!parsed.exp || parsed.exp < Math.floor(Date.now() / 1000)) throw new Error('Session expired.');
  return parsed;
}

export function signMcToken(payload, secret) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

export function verifyMcToken(token, secret) {
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) throw new Error('Malformed MC token.');
  const expected = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  if (!safeEqual(signature, expected)) throw new Error('Invalid MC token signature.');
  return JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
}

// --- Asymmetric MC signing (Ed25519) -------------------------------------
// Each doctor owns a keypair; MCs are signed with the doctor's PRIVATE key and
// verified by anyone holding the PUBLIC key (true non-repudiation, matching the
// Deliverable 1 design "signed by the doctor's private cryptographic key").
export function generateMcKeyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  return {
    publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
  };
}

export function signMcTokenAsym(payload, privateKeyPem) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.sign(null, Buffer.from(encoded), privateKeyPem).toString('base64url');
  return `${encoded}.${signature}`;
}

// Decode the payload WITHOUT verifying (used only to locate the signing doctor;
// the signature is then verified cryptographically against that doctor's key).
export function decodeMcPayload(token) {
  const [encoded] = String(token).split('.');
  if (!encoded) throw new Error('Malformed MC token.');
  return JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
}

export function verifyMcTokenAsym(token, publicKeyPem) {
  const [encoded, signature] = String(token).split('.');
  if (!encoded || !signature) throw new Error('Malformed MC token.');
  const ok = crypto.verify(null, Buffer.from(encoded), publicKeyPem, Buffer.from(signature, 'base64url'));
  if (!ok) throw new Error('Invalid MC token signature.');
  return JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
}

export function isPasswordHash(value) {
  return typeof value === 'string' && value.startsWith('scrypt$');
}

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('base64url');
  const n = 16384;
  const r = 8;
  const p = 1;
  const key = await scryptAsync(password, salt, 64, { N: n, r, p, maxmem: 64 * 1024 * 1024 });
  return `scrypt$${n}$${r}$${p}$${salt}$${key.toString('base64url')}`;
}

export async function verifyPassword(password, stored) {
  if (!isPasswordHash(stored)) {
    return safeEqual(String(password), String(stored));
  }

  const [, n, r, p, salt, encodedKey] = stored.split('$');
  const key = await scryptAsync(password, salt, 64, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: 64 * 1024 * 1024,
  });
  return safeEqual(key.toString('base64url'), encodedKey);
}

function scryptAsync(password, salt, keyLength, options) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, keyLength, options, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}

export function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function rateLimit({ windowMs, max, keyPrefix }) {
  const buckets = new Map();

  return (req, res, next) => {
    const key = `${keyPrefix}:${req.ip}:${req.user?.user_id || 'anon'}`;
    const now = Date.now();
    const current = buckets.get(key);
    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    current.count += 1;
    if (current.count > max) {
      res.setHeader('Retry-After', Math.ceil((current.resetAt - now) / 1000));
      return res.status(429).json({ error: 'Too many requests. Please retry later.' });
    }

    return next();
  };
}

function getAesKey(config) {
  const raw = config.dataEncryptionKey;
  if (/^[a-f0-9]{64}$/i.test(raw)) return Buffer.from(raw, 'hex');
  if (/^[A-Za-z0-9+/=_-]{43,44}$/.test(raw)) {
    try {
      const decoded = Buffer.from(raw, 'base64url');
      if (decoded.length === 32) return decoded;
    } catch {
      // Fall through to a deterministic development key.
    }
  }
  return crypto.createHash('sha256').update(raw).digest();
}

export function encryptText(value, config) {
  if (value === null || value === undefined) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getAesKey(config), iv);
  const ciphertext = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64url')}:${tag.toString('base64url')}:${ciphertext.toString('base64url')}`;
}

export function decryptText(value, config) {
  if (!value) return null;
  if (!String(value).startsWith('v1:')) return value;
  const [, ivB64, tagB64, dataB64] = String(value).split(':');
  const decipher = crypto.createDecipheriv('aes-256-gcm', getAesKey(config), Buffer.from(ivB64, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64url')), decipher.final()]).toString('utf8');
}

export function encryptJson(value, config) {
  return encryptText(JSON.stringify(value), config);
}

export function decryptJson(value, config) {
  const plaintext = decryptText(value, config);
  if (!plaintext) return null;
  return JSON.parse(plaintext);
}

export function assertString(value, field, { min = 1, max = 255, pattern } = {}) {
  if (typeof value !== 'string') throw badRequest(`${field} must be a string.`);
  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max) {
    throw badRequest(`${field} must be between ${min} and ${max} characters.`);
  }
  if (pattern && !pattern.test(trimmed)) throw badRequest(`${field} has an invalid format.`);
  return trimmed;
}

export function assertOptionalString(value, field, options) {
  if (value === undefined || value === null || value === '') return null;
  return assertString(value, field, options);
}

export function assertEnum(value, field, allowed) {
  if (!allowed.includes(value)) throw badRequest(`${field} must be one of: ${allowed.join(', ')}.`);
  return value;
}

export function assertPositiveInteger(value, field, { max = Number.MAX_SAFE_INTEGER } = {}) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > max) {
    throw badRequest(`${field} must be a positive integer.`);
  }
  return parsed;
}

export function assertEmail(value) {
  return assertString(value, 'email', {
    min: 5,
    max: 255,
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  }).toLowerCase();
}

export function assertPassword(value) {
  return assertString(value, 'password', { min: 8, max: 128 });
}

export function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

export function forbidden(message = 'Forbidden.') {
  const error = new Error(message);
  error.status = 403;
  return error;
}

export function notFound(message = 'Resource not found.') {
  const error = new Error(message);
  error.status = 404;
  return error;
}

export function scanAttachmentMetadata({ filename, mimeType, sizeBytes }) {
  const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
  const cleanName = assertString(filename, 'filename', { min: 1, max: 160, pattern: /^[\w .()_-]+$/ });
  const cleanMime = assertString(mimeType, 'mimeType', { min: 3, max: 100 });
  const cleanSize = assertPositiveInteger(sizeBytes, 'sizeBytes', { max: 5 * 1024 * 1024 });
  if (!allowedTypes.has(cleanMime)) throw badRequest('Attachment type is not allowed.');
  if (/eicar|malware|virus/i.test(cleanName)) throw badRequest('Attachment failed malware scan.');
  return { filename: cleanName, mimeType: cleanMime, sizeBytes: cleanSize, malwareScanStatus: 'PASSED_STUB' };
}

export function auditMetadata(metadata = {}) {
  const redacted = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (/password|token|otp|secret|diagnosis|message|symptom|nric|address/i.test(key)) {
      redacted[key] = '[REDACTED]';
    } else if (/email/i.test(key)) {
      redacted[key] = `sha256:${sha256(value).slice(0, 16)}`;
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
}

export function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

export function sessionPayload(user, overrides = {}) {
  const now = Math.floor(Date.now() / 1000);
  return {
    sub: user.user_id,
    email: user.email,
    role: user.role,
    token_version: user.token_version || 0,
    auth_time: overrides.auth_time || now,
    reauth_at: overrides.reauth_at || now,
    mfa_at: overrides.mfa_at || null,
  };
}

export function currentUnixSeconds() {
  return Math.floor(Date.now() / 1000);
}

// --- Malware scanning of uploaded files (Phase 4) -------------------------
// Streams the buffer to a ClamAV daemon (clamd, INSTREAM) when CLAMD_HOST is set;
// otherwise falls back to an EICAR-signature stub so the upload pipeline is testable
// without a running antivirus engine.
export async function scanBufferForMalware(buffer, config) {
  if (!config.clamdHost) {
    const eicar = 'EICAR-STANDARD-ANTIVIRUS-TEST-FILE';
    const clean = !Buffer.from(buffer).includes(eicar);
    return { clean, engine: 'stub', signature: clean ? null : 'Eicar-Test-Signature' };
  }
  return scanWithClamd(buffer, config.clamdHost, config.clamdPort);
}

function scanWithClamd(buffer, host, port) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    let response = '';
    socket.setTimeout(15000);
    socket.on('connect', () => {
      socket.write('zINSTREAM\0');
      const size = Buffer.alloc(4);
      size.writeUInt32BE(buffer.length, 0);
      socket.write(Buffer.concat([size, Buffer.from(buffer)]));
      const terminator = Buffer.alloc(4); // zero-length chunk ends the stream
      socket.write(terminator);
    });
    socket.on('data', (chunk) => { response += chunk.toString(); });
    socket.on('timeout', () => { socket.destroy(); reject(new Error('clamd scan timed out')); });
    socket.on('error', reject);
    socket.on('end', () => {
      const found = response.match(/stream:\s+(.+)\s+FOUND/);
      resolve({ clean: /stream:\s+OK/.test(response), engine: 'clamav', signature: found ? found[1] : null });
    });
  });
}

// --- Firebase custom token (Phase 4 realtime) -----------------------------
// Mints a Firebase Auth custom token (RS256, signed with the service-account key)
// carrying uid + role claims, so Firebase security rules can enforce access. Returns
// null when Firebase is not configured (endpoint then responds 503). No SDK needed.
export function mintFirebaseCustomToken(uid, additionalClaims, config) {
  if (!config.firebaseClientEmail || !config.firebasePrivateKey) return null;
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss: config.firebaseClientEmail,
    sub: config.firebaseClientEmail,
    aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
    iat: now,
    exp: now + 3600,
    uid,
    claims: additionalClaims || {},
  })).toString('base64url');
  const signature = crypto.sign('RSA-SHA256', Buffer.from(`${header}.${payload}`), config.firebasePrivateKey).toString('base64url');
  return `${header}.${payload}.${signature}`;
}

// --- Time-limited TURN credentials (Phase 5 WebRTC) -----------------------
// coturn "use-auth-secret" scheme: username = <expiry-unixtime>, password = base64(HMAC-SHA1(secret, username)).
// Returns null when TURN is not configured.
export function makeTurnCredentials(config, ttlSeconds = 3600) {
  if (!config.turnSecret || config.turnUrls.length === 0) return null;
  const username = String(Math.floor(Date.now() / 1000) + ttlSeconds);
  const credential = crypto.createHmac('sha1', config.turnSecret).update(username).digest('base64');
  return { username, credential, ttl: ttlSeconds, urls: config.turnUrls };
}

// Builds the WebRTC iceServers list. Public STUN is always present (NAT discovery,
// outbound only — no server ports). A TURN relay is added when configured: a
// self-hosted coturn (HMAC time-limited creds) OR a managed provider (static creds).
// Media is P2P DTLS-SRTP and never traverses our server.
export function buildIceServers(config) {
  const iceServers = [{ urls: 'stun:stun.l.google.com:19302' }];
  const coturn = makeTurnCredentials(config);
  if (coturn) {
    iceServers.push({ urls: coturn.urls, username: coturn.username, credential: coturn.credential });
  } else if (config.turnUrls.length > 0 && config.turnUsername && config.turnCredential) {
    iceServers.push({ urls: config.turnUrls, username: config.turnUsername, credential: config.turnCredential });
  }
  return iceServers;
}
