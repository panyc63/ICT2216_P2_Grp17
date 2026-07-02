import test from 'node:test';
import assert from 'node:assert/strict';
import { registrationOptions, authenticationOptions } from './webauthn.js';

// The ceremony-option builders are deterministic and offline-safe; the assertion/attestation
// verification (verifyRegistration/verifyAuthentication) needs a real or virtual authenticator
// signature, so it is exercised via the endpoints + a browser/device rather than here.
const rp = { rpID: 'localhost', rpName: 'MediFlow', origin: 'http://localhost:4180' };

test('webauthn registration options carry an RP-bound challenge', async () => {
  const opts = await registrationOptions(rp, { user_id: 'MH-U002', email: 'doctor@mediflow.com', name: 'Dr Rivera' }, []);
  assert.ok(opts.challenge && opts.challenge.length > 20);
  assert.equal(opts.rp.id, 'localhost');
  assert.equal(opts.user.name, 'doctor@mediflow.com');
});

test('webauthn registration excludes already-registered credentials', async () => {
  const opts = await registrationOptions(rp, { user_id: 'MH-U002', email: 'doctor@mediflow.com' },
    [{ credential_id: 'Y3JlZElk', transports: 'internal' }]);
  assert.equal(opts.excludeCredentials.length, 1);
});

test('webauthn authentication options include the allowed credentials + a challenge', async () => {
  const opts = await authenticationOptions(rp, [{ credential_id: 'Y3JlZElk', transports: 'internal' }]);
  assert.ok(opts.challenge && opts.challenge.length > 20);
  assert.equal(opts.allowCredentials.length, 1);
});
