// Shared order-flow logic: the single source of truth for how an order's status
// maps to the patient's stepper position and to a "resume" destination. Used by
// the status-driven stepper (PatientLayout) and the order-history Resume button,
// so the mapping lives in exactly one place.

// An order is finished once it reaches one of these — no resume, no further steps.
export const TERMINAL_STATUSES = ['Completed', 'Cancelled', 'Refunded']

export const isTerminal = (status) => TERMINAL_STATUSES.includes(status)

// Human-readable label for a raw status enum (for the history view / anywhere
// the patient sees a status).
const STATUS_LABELS = {
  Pending: 'Getting ready',
  InQueue: 'In queue',
  InCall: 'In consultation',
  AwaitingFinalization: "Awaiting doctor's notes",
  AwaitingPayment: 'Payment required',
  AwaitingDelivery: 'Awaiting delivery',
  Completed: 'Completed',
  Cancelled: 'Cancelled',
  Refunded: 'Refunded',
  PendingRefund: 'Refund pending'
}

export const statusLabel = (status) => STATUS_LABELS[status] || status || '—'

// Universal stepper (same for Path A and Path B). The patient's *active* guided
// journey ends when the call ends — so "Done" highlights the moment the order
// leaves InCall, covering every post-call status. Everything after the call
// (finalization, medication payment, delivery) is on-demand via My Consultations,
// not a forced linear step.
export const STEPS = [
  { label: 'Get Ready', statuses: ['Pending'] },
  { label: 'Queue', statuses: ['InQueue'] },
  { label: 'Consultation', statuses: ['InCall'] },
  { label: 'Done', statuses: ['AwaitingFinalization', 'AwaitingPayment', 'AwaitingDelivery', 'Completed'] }
]

// Same steps for every order now (kept as a function for call-site stability).
export const stepsForOrder = () => STEPS

// Index of the step matching the order's current status. -1 for no order or a
// terminal-exception status (Cancelled/Refunded/PendingRefund), so every step
// renders as upcoming.
export const currentStepIndex = (order) => {
  const status = order && order.status
  if (!status) return -1
  return stepsForOrder(order).findIndex((step) => step.statuses.includes(status))
}

// The page a patient should land on to resume a non-terminal order, derived from
// its status (plus sub-state for Pending / AwaitingFinalization). Returns null
// for terminal orders (nothing to resume).
export const resumeRouteForOrder = (order) => {
  if (!order || isTerminal(order.status)) return null

  switch (order.status) {
    case 'Pending':
      if (order.needs_medication === null || order.needs_medication === undefined) {
        return '/patient/questionnaire'        // hasn't declared Path A/B yet
      }
      if (!order.consult_fee_paid) {
        return '/patient/consult-payment'      // declared, fee still owed (D1)
      }
      return '/patient/queue'                  // paid but not yet in the queue
    case 'InQueue':
      return '/patient/queue'
    case 'InCall':
      // Reconnect to the live call. InCall is normally handled by
      // useOrderResume (which self-heals an orphaned call); this is the
      // fallback for any direct caller, and includes the room id so the
      // video page can actually connect.
      return { path: '/patient/video-consultation', query: { room: order.consultation_id } }
    case 'AwaitingFinalization':
      return order.needs_medication === true ? '/patient/prescription' : '/patient/closing'
    case 'AwaitingPayment':
      // Resume to Prescription (not straight to payment) so the collection-method
      // choice isn't skipped — Prescription leads on to Medication Payment.
      return '/patient/prescription'
    case 'AwaitingDelivery':
      return '/patient/closing'                // delivery tracking lives on Profile (D3)
    default:
      return '/patient/profile'                // PendingRefund / unknown — nowhere to resume
  }
}
