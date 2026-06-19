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

  // 1. Profile
  profile: {
    name: 'Tan Wei Ming',
    email: 'weiming.tan@example.com',
    nric: 'S9123456A',
    homeAddress: '123 Bukit Timah Road, #08-21, Singapore 589456'
  },

  // 2. Book Consultation
  booking: {
    selectedSlotId: null
  },

  // 3. Questionnaire
  questionnaire: {
    answers: {},
    submitted: false
  },

  // 4. Medication Collection
  medication: {
    method: 'self-collect' // 'self-collect' | 'delivery'
  },

  // 5. Payment
  payment: {
    consultationFee: 45.0,
    medicationCost: 28.5,
    paid: false
  }
})
