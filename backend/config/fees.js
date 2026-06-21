// Single source of truth for payment amounts. Amounts are server-side only —
// the client never sends or is trusted for a price. Stored in the smallest
// currency unit (cents) so they can be passed straight to Stripe in Phase 3b/3c.
export const FEES = {
    currency: 'sgd',
    consult: { amount_cents: 4500 },     // S$45.00 consultation fee
    medication: { amount_cents: 2850 }   // S$28.50 medication fee (Path B only)
};
