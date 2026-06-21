import { reactive } from 'vue'

// Lightweight shared state for the patient-facing prototype.
// No backend — everything here is hardcoded seed data that the patient
// views read from and write back into. Using a single reactive() module
// (instead of per-component ref()) means selections persist as the patient
// navigates between pages, and shared fields like the home address stay in
// sync between Profile and MedicationCollection.
export const patientStore = reactive({
  // Identity — sourced from the logged-in session. Initialized from
  // localStorage so it survives a page refresh; login.vue keeps it in sync.
  patientId: localStorage.getItem('userId') || '',

  // 1. Profile — populated from the backend (GET /api/users/:id) on mount,
  // so it reflects the actual logged-in user rather than seed data.
  profile: {
    name: '',
    email: '',
    homeAddress: ''
  },

  // 2. Questionnaire
  questionnaire: {
    answers: {},
    submitted: false
  },

  // The active order — the source of truth for the patient journey (created at
  // Start Consultation, advanced through the lifecycle by the backend). Loaded
  // by PatientLayout and kept in sync as the patient moves through the flow.
  // `needs_medication` here drives the stepper branch, payment total, and
  // closing message (Path A = false, Path B = true, null = not declared yet).
  order: {
    order_id: null,
    status: null,
    needs_medication: null,
    collection_method: null,
    consult_fee_paid: false,
    medication_fee_paid: false,
    consultation_id: null
  },

  setOrder(o) {
    if (!o) return
    this.order.order_id = o.order_id ?? null
    this.order.status = o.status ?? null
    if (o.needs_medication !== undefined) this.order.needs_medication = o.needs_medication
    this.order.collection_method = o.collection_method ?? null
    this.order.consult_fee_paid = !!o.consult_fee_paid
    this.order.medication_fee_paid = !!o.medication_fee_paid
    this.order.consultation_id = o.consultation_id ?? null
  },

  // Live consultation queue. Kept in the shared store (not the Queue page) so
  // it survives tab navigation — the poller in PatientLayout reads/writes this,
  // which lets the patient browse other tabs and still be pulled into the call.
  queue: {
    active: false,   // currently waiting in the queue
    position: null,
    total: 0
  },

  // 3. Medication Collection
  medication: {
    method: 'self-collect' // 'self-collect' | 'delivery'
  }
  // Payment amounts/state are no longer held client-side: prices come from the
  // server (GET /api/payments/fees) and paid status lives on the order
  // (consult_fee_paid / medication_fee_paid).
})
