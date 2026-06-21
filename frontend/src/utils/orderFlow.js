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

// Stepper definitions, branched by Path A (no medication) / Path B (medication).
export const PATH_A_STEPS = [
  { label: 'Get Ready', statuses: ['Pending'] },
  { label: 'Queue', statuses: ['InQueue'] },
  { label: 'Consultation', statuses: ['InCall', 'AwaitingFinalization'] },
  { label: 'Done', statuses: ['Completed'] }
]

export const PATH_B_STEPS = [
  { label: 'Get Ready', statuses: ['Pending'] },
  { label: 'Queue', statuses: ['InQueue'] },
  { label: 'Consultation', statuses: ['InCall', 'AwaitingFinalization'] },
  { label: 'Payment', statuses: ['AwaitingPayment'] },
  { label: 'Delivery', statuses: ['AwaitingDelivery'] },
  { label: 'Done', statuses: ['Completed'] }
]

// Path B when medication is requested; Path A otherwise (false or not yet declared).
export const stepsForOrder = (order) =>
  order && order.needs_medication === true ? PATH_B_STEPS : PATH_A_STEPS

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
      return '/patient/video-consultation'     // best-effort (D2)
    case 'AwaitingFinalization':
      return order.needs_medication === true ? '/patient/prescription' : '/patient/closing'
    case 'AwaitingPayment':
      return '/patient/medication-payment'
    case 'AwaitingDelivery':
      return '/patient/closing'                // delivery tracking lives on Profile (D3)
    default:
      return '/patient/profile'                // PendingRefund / unknown — nowhere to resume
  }
}
