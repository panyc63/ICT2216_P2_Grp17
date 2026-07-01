import { reactive } from 'vue'

// Lightweight client-side state so the questionnaire answers persist as the patient
// navigates between pages within a session. No seeded PII — every piece of patient
// data (profile, prescriptions, payments, MC) is fetched from the backend.
export const patientStore = reactive({
  questionnaire: {
    answers: {},
    submitted: false,
  },
})
