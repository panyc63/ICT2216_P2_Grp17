import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCheckoutSessionForm } from './stripe.js';

test('buildCheckoutSessionForm encodes a server-derived Checkout Session', () => {
  const body = buildCheckoutSessionForm({
    amountCents: 4500,
    currency: 'sgd',
    paymentId: 42,
    reference: 'MF-CHK-123',
    successUrl: 'https://app.example/patient/payment?checkout=success',
    cancelUrl: 'https://app.example/patient/payment?checkout=cancelled',
  });
  const p = new URLSearchParams(body);
  assert.equal(p.get('mode'), 'payment');
  assert.equal(p.get('line_items[0][price_data][unit_amount]'), '4500');
  assert.equal(p.get('line_items[0][price_data][currency]'), 'sgd');
  assert.equal(p.get('line_items[0][quantity]'), '1');
  // The payment_id metadata is what the webhook uses to mark the row Paid.
  assert.equal(p.get('metadata[payment_id]'), '42');
  assert.equal(p.get('client_reference_id'), 'MF-CHK-123');
  assert.equal(p.get('success_url'), 'https://app.example/patient/payment?checkout=success');
});

test('buildCheckoutSessionForm rejects a non-positive amount (no client-set totals)', () => {
  assert.throws(() => buildCheckoutSessionForm({ amountCents: 0, paymentId: 1, reference: 'r', successUrl: 'a', cancelUrl: 'b' }));
  assert.throws(() => buildCheckoutSessionForm({ amountCents: -5, paymentId: 1, reference: 'r', successUrl: 'a', cancelUrl: 'b' }));
  assert.throws(() => buildCheckoutSessionForm({ amountCents: 1.5, paymentId: 1, reference: 'r', successUrl: 'a', cancelUrl: 'b' }));
});
