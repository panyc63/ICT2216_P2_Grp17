import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyTurnstile } from './turnstile.js';

// These cases exercise the branches that never make an outbound call, so they are
// deterministic and offline-safe (the live siteverify path is integration-tested only
// when a real TURNSTILE_SECRET is configured).

test('turnstile verification is a no-op bypass when the secret is unset (dev/CI/local)', async () => {
  const result = await verifyTurnstile('any-token', '', '1.2.3.4');
  assert.equal(result.success, true);
  assert.equal(result.skipped, true);
});

test('turnstile rejects a missing token when configured, without an outbound call', async () => {
  const result = await verifyTurnstile('', 'a-real-secret', '1.2.3.4');
  assert.equal(result.success, false);
  assert.equal(result.error, 'missing-input-response');
});

test('turnstile rejects a non-string token when configured', async () => {
  const result = await verifyTurnstile(undefined, 'a-real-secret');
  assert.equal(result.success, false);
});
