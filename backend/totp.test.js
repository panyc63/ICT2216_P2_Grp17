import { test } from 'node:test';
import assert from 'node:assert/strict';
import { base32Encode, base32Decode, generateTotpSecret, totpToken, verifyTotp, otpauthURL } from './totp.js';

// RFC 6238 Appendix B reference secret: ASCII "12345678901234567890".
const RFC_SECRET = base32Encode(Buffer.from('12345678901234567890', 'ascii'));

test('base32 round-trips arbitrary bytes', () => {
  const bytes = Buffer.from([0x00, 0x01, 0x7f, 0x80, 0xff, 0xab, 0xcd]);
  assert.deepEqual(base32Decode(base32Encode(bytes)), bytes);
});

test('base32Decode tolerates lowercase, whitespace and padding', () => {
  const canonical = base32Encode(Buffer.from('hello', 'ascii'));
  const messy = `  ${canonical.toLowerCase()}==  `;
  assert.deepEqual(base32Decode(messy), Buffer.from('hello', 'ascii'));
});

test('totpToken matches the RFC 6238 SHA-1 6-digit test vectors', () => {
  // 6-digit codes = last 6 digits of the RFC's 8-digit reference values.
  const vectors = [
    [59, '287082'],
    [1111111109, '081804'],
    [1111111111, '050471'],
    [1234567890, '005924'],
    [2000000000, '279037'],
    [20000000000, '353130'],
  ];
  for (const [seconds, expected] of vectors) {
    assert.equal(totpToken(RFC_SECRET, { timestamp: seconds * 1000 }), expected, `t=${seconds}`);
  }
});

test('verifyTotp accepts the current code and tolerates +/-1 step of skew', () => {
  const now = 1111111111 * 1000;
  assert.equal(verifyTotp('050471', RFC_SECRET, { timestamp: now }), true);
  // Previous step (t=1111111109 falls in the same 30s window as 1111111111, use one step back).
  assert.equal(verifyTotp(totpToken(RFC_SECRET, { timestamp: now - 30000 }), RFC_SECRET, { timestamp: now }), true);
  assert.equal(verifyTotp(totpToken(RFC_SECRET, { timestamp: now + 30000 }), RFC_SECRET, { timestamp: now }), true);
});

test('verifyTotp rejects wrong codes, codes outside the window, and malformed input', () => {
  const now = 1111111111 * 1000;
  assert.equal(verifyTotp('000000', RFC_SECRET, { timestamp: now }), false);
  // Two steps away is outside the +/-1 window.
  assert.equal(verifyTotp(totpToken(RFC_SECRET, { timestamp: now + 60000 }), RFC_SECRET, { timestamp: now }), false);
  assert.equal(verifyTotp('12345', RFC_SECRET, { timestamp: now }), false);
  assert.equal(verifyTotp('abcdef', RFC_SECRET, { timestamp: now }), false);
  assert.equal(verifyTotp('', RFC_SECRET, { timestamp: now }), false);
  assert.equal(verifyTotp(null, RFC_SECRET, { timestamp: now }), false);
  assert.equal(verifyTotp('050471', 'not valid base32 !!!', { timestamp: now }), false);
});

test('generateTotpSecret produces distinct decodable 160-bit secrets', () => {
  const a = generateTotpSecret();
  const b = generateTotpSecret();
  assert.notEqual(a, b);
  assert.equal(base32Decode(a).length, 20);
});

test('otpauthURL embeds the secret, issuer and standard parameters', () => {
  const uri = otpauthURL({ secret: RFC_SECRET, accountName: 'doc@mediflow.com', issuer: 'MediFlow' });
  assert.match(uri, /^otpauth:\/\/totp\/MediFlow:doc%40mediflow\.com\?/);
  assert.ok(uri.includes(`secret=${RFC_SECRET}`));
  assert.match(uri, /issuer=MediFlow/);
  assert.match(uri, /algorithm=SHA1/);
  assert.match(uri, /digits=6/);
  assert.match(uri, /period=30/);
});
