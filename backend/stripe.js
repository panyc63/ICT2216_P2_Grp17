// Stripe Checkout via direct REST calls — NO SDK/dependency (consistent with avoiding extra
// packages). Intended for the payment DEMO: use a TEST secret key (sk_test_…) and test cards
// (e.g. 4242 4242 4242 4242) so no real money moves. Amounts are computed server-side and the
// webhook (server.js handlePaymentWebhook) verifies the Stripe signature before marking Paid.

// Pure: build the application/x-www-form-urlencoded body for a Checkout Session. Kept separate
// so it is unit-testable without any network call.
export function buildCheckoutSessionForm({
  amountCents,
  currency = 'sgd',
  paymentId,
  reference,
  successUrl,
  cancelUrl,
  productName = 'MediFlow consultation',
}) {
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new Error('amountCents must be a positive integer');
  }
  const params = new URLSearchParams();
  params.set('mode', 'payment');
  params.set('success_url', successUrl);
  params.set('cancel_url', cancelUrl);
  params.set('client_reference_id', String(reference));
  params.set('metadata[payment_id]', String(paymentId));
  params.set('line_items[0][quantity]', '1');
  params.set('line_items[0][price_data][currency]', currency);
  params.set('line_items[0][price_data][unit_amount]', String(amountCents));
  params.set('line_items[0][price_data][product_data][name]', productName);
  return params.toString();
}

// Create a Checkout Session against Stripe's REST API. Returns { id, url }. Throws on non-2xx.
export async function createCheckoutSession(secretKey, form) {
  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form,
    signal: AbortSignal.timeout(8000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message || `Stripe error (${res.status})`);
  }
  return { id: data.id, url: data.url };
}
