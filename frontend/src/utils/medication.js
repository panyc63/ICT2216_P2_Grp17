// Pure medication-collection / delivery-tracking helpers.
//
// Kept framework-free so they can be unit-tested with Node's built-in test
// runner (no browser, no Vue) and reused by the patient views.

export const DELIVERY_STEPS = ['Prescribed', 'Preparing', 'Out for Delivery', 'Delivered'];
export const COLLECT_STEPS = ['Prescribed', 'Preparing', 'Ready for Collection'];

export function isDelivery(prescription) {
  return prescription?.collection_method === 'Delivery';
}

export function stepsFor(prescription) {
  return isDelivery(prescription) ? DELIVERY_STEPS : COLLECT_STEPS;
}

// Progress index into stepsFor(prescription). Cancelled stays at the start.
export function stageIndex(prescription) {
  if (!prescription || prescription.status === 'Cancelled') return 0;
  if (prescription.status !== 'Fulfilled') return 1; // Issued -> Preparing
  if (isDelivery(prescription)) return prescription.delivered_at ? 3 : 2;
  return 2; // self-collect Fulfilled -> Ready for Collection
}

export function statusLabel(prescription) {
  if (!prescription) return '';
  if (prescription.status === 'Cancelled') return 'Cancelled';
  if (prescription.status !== 'Fulfilled') return 'In Progress';
  if (isDelivery(prescription)) return prescription.delivered_at ? 'Delivered' : 'Out for Delivery';
  return 'Ready for Collection';
}

// A delivery choice is only valid once the patient has an address on file.
export function canChooseDelivery(address) {
  return typeof address === 'string' && address.trim().length > 0;
}

// Whether the "Confirm Receipt" action should be offered for a delivery order.
export function canConfirmReceipt(prescription) {
  return isDelivery(prescription) && prescription.status === 'Fulfilled' && !prescription.delivered_at;
}
