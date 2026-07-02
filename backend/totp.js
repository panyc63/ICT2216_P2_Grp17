// RFC 6238 TOTP (time-based one-time password) + RFC 4648 base32 — implemented on Node's
// built-in crypto with ZERO external dependencies (the WebAuthn package was removed on
// purpose). Used for authenticator-app MFA enrollment on privileged accounts (Admin/Doctor).
// The shared secret is generated here, stored encrypted at rest by the caller, and never
// leaves the server except once (at enrollment) so the user can add it to their app.
import crypto from 'node:crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

// Encode a Buffer to RFC 4648 base32 (no padding) — the format authenticator apps import.
export function base32Encode(buffer) {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

// Decode an RFC 4648 base32 string (tolerates padding, whitespace and lowercase) to a Buffer.
export function base32Decode(input) {
  const clean = String(input).toUpperCase().replace(/[\s=]/g, '');
  let bits = 0;
  let value = 0;
  const bytes = [];
  for (const char of clean) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) throw new Error('Invalid base32 character.');
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

// Generate a fresh random base32 secret (default 20 bytes = 160 bits, per RFC 4226 §5.1).
export function generateTotpSecret(bytes = 20) {
  return base32Encode(crypto.randomBytes(bytes));
}

// HOTP (RFC 4226): HMAC-SHA1 over an 8-byte big-endian counter, dynamically truncated to
// `digits` decimal digits. JS bit-ops are 32-bit, so the 64-bit counter is written as two words.
function hotp(secretBuf, counter, digits) {
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buf.writeUInt32BE(counter >>> 0, 4);
  const hmac = crypto.createHmac('sha1', secretBuf).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(binary % 10 ** digits).padStart(digits, '0');
}

// Current TOTP code for a base32 secret.
export function totpToken(secretBase32, { step = 30, digits = 6, timestamp = Date.now() } = {}) {
  const counter = Math.floor(timestamp / 1000 / step);
  return hotp(base32Decode(secretBase32), counter, digits);
}

// Verify a submitted token, allowing +/- `window` time-steps for clock skew. Compares each
// candidate in constant time; returns true on any match, false on any malformed input.
export function verifyTotp(token, secretBase32, { step = 30, digits = 6, window = 1, timestamp = Date.now() } = {}) {
  if (typeof token !== 'string') return false;
  const submitted = token.trim();
  if (submitted.length !== digits || !/^\d+$/.test(submitted)) return false;
  let secretBuf;
  try {
    secretBuf = base32Decode(secretBase32);
  } catch {
    return false;
  }
  const counter = Math.floor(timestamp / 1000 / step);
  const submittedBuf = Buffer.from(submitted);
  let matched = false;
  // Iterate the FULL window (no early return) so timing does not leak which step matched.
  for (let errorWindow = -window; errorWindow <= window; errorWindow += 1) {
    const candidate = Buffer.from(hotp(secretBuf, counter + errorWindow, digits));
    if (candidate.length === submittedBuf.length && crypto.timingSafeEqual(candidate, submittedBuf)) {
      matched = true;
    }
  }
  return matched;
}

// Build the otpauth:// provisioning URI authenticator apps import via QR or manual key entry.
export function otpauthURL({ secret, accountName, issuer = 'MediFlow', digits = 6, step = 30 }) {
  // Keep the issuer:account colon literal (otpauth label separator); encode each part.
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(accountName)}`;
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: String(digits),
    period: String(step),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
