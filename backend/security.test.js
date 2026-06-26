import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decryptText,
  encryptText,
  hashPassword,
  hashToken,
  scanAttachmentMetadata,
  signJwt,
  signMcToken,
  verifyJwt,
  verifyMcToken,
  verifyPassword,
} from './security.js';

const config = {
  dataEncryptionKey: 'unit-test-data-encryption-key-with-entropy',
  mcSigningKey: 'unit-test-mc-signing-key-with-entropy',
};

test('password hashes are not plaintext and verify correctly', async () => {
  const hash = await hashPassword('CorrectHorseBatteryStaple1');
  assert.notEqual(hash, 'CorrectHorseBatteryStaple1');
  assert.equal(hash.startsWith('scrypt$'), true);
  assert.equal(await verifyPassword('CorrectHorseBatteryStaple1', hash), true);
  assert.equal(await verifyPassword('wrong-password', hash), false);
});

test('JWT rejects tampered payloads', () => {
  const token = signJwt({ sub: 'MH-U001', role: 'Admin', token_version: 0 }, 'secret', 60);
  assert.equal(verifyJwt(token, 'secret').sub, 'MH-U001');
  const parts = token.split('.');
  const tamperedPayload = Buffer.from(JSON.stringify({ sub: 'MH-U999', role: 'Admin', token_version: 0, exp: 9999999999 })).toString('base64url');
  assert.throws(() => verifyJwt(`${parts[0]}.${tamperedPayload}.${parts[2]}`, 'secret'));
});

test('field encryption round trips and changes ciphertext', () => {
  const plaintext = 'patient reports severe chest pain';
  const encrypted = encryptText(plaintext, config);
  assert.notEqual(encrypted, plaintext);
  assert.equal(decryptText(encrypted, config), plaintext);
});

test('MC verification token detects tampering', () => {
  const token = signMcToken({ mc_id: 'MH-MC001', patient_id: 'MH-U006' }, config.mcSigningKey);
  assert.equal(verifyMcToken(token, config.mcSigningKey).mc_id, 'MH-MC001');
  assert.throws(() => verifyMcToken(`${token}x`, config.mcSigningKey));
});

test('attachment metadata validation blocks unsafe files', () => {
  const clean = scanAttachmentMetadata({ filename: 'rash-photo.png', mimeType: 'image/png', sizeBytes: 1024 });
  assert.equal(clean.malwareScanStatus, 'PASSED_STUB');
  assert.throws(() => scanAttachmentMetadata({ filename: 'eicar.png', mimeType: 'image/png', sizeBytes: 1024 }));
});

test('token hashing is deterministic without exposing token value', () => {
  assert.equal(hashToken('abc'), hashToken('abc'));
  assert.notEqual(hashToken('abc'), 'abc');
});
