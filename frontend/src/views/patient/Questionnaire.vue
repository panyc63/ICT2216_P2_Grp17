<template>
  <div>
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-slate-900 tracking-tight">Pre-Consultation Questionnaire</h1>
      <p class="text-sm text-slate-500">Help the doctor prepare by sharing your current symptoms.</p>
    </div>

    <form @submit.prevent="submitAnswers" class="bg-white border border-slate-200 rounded-2xl shadow-sm p-8 max-w-2xl space-y-6">
      <div v-for="question in questions" :key="question.id">
        <label class="block text-sm font-semibold text-slate-700 mb-2">{{ question.label }}</label>

        <!-- Yes / No symptom toggles -->
        <div v-if="question.type === 'yesno'" class="flex gap-3">
          <label
            v-for="option in ['Yes', 'No']"
            :key="option"
            :class="answers[question.id] === option
              ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
              : 'border-slate-300 text-slate-600 hover:bg-slate-50'"
            class="flex-1 text-center border rounded-lg py-2 text-sm font-medium cursor-pointer transition-colors"
          >
            <input type="radio" :value="option" v-model="answers[question.id]" class="sr-only" />
            {{ option }}
          </label>
        </div>

        <!-- Severity scale -->
        <select
          v-else-if="question.type === 'scale'"
          v-model="answers[question.id]"
          class="block w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        >
          <option value="" disabled>Select severity</option>
          <option v-for="level in ['None', 'Mild', 'Moderate', 'Severe']" :key="level" :value="level">{{ level }}</option>
        </select>

        <!-- Free text (e.g. duration) -->
        <input
          v-else
          type="text"
          v-model="answers[question.id]"
          :placeholder="question.placeholder"
          class="block w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>

      <!-- Path A/B declaration. Determines the rest of the patient's flow. -->
      <div class="border-t border-slate-200 pt-6">
        <label class="block text-sm font-semibold text-slate-700 mb-2">Do you need medication for this consultation?</label>
        <div class="flex gap-3 max-w-md">
          <label
            :class="needsMedication === true
              ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
              : 'border-slate-300 text-slate-600 hover:bg-slate-50'"
            class="flex-1 text-center border rounded-lg py-2 text-sm font-medium cursor-pointer transition-colors"
          >
            <input type="radio" :value="true" v-model="needsMedication" class="sr-only" />
            Yes
          </label>
          <label
            :class="needsMedication === false
              ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
              : 'border-slate-300 text-slate-600 hover:bg-slate-50'"
            class="flex-1 text-center border rounded-lg py-2 text-sm font-medium cursor-pointer transition-colors"
          >
            <input type="radio" :value="false" v-model="needsMedication" class="sr-only" />
            No
          </label>
        </div>
      </div>

      <div class="flex items-center gap-4 pt-2">
        <button
          type="submit"
          class="px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg shadow-sm hover:bg-indigo-700"
        >
          Submit Questionnaire
        </button>
        <p v-if="formError" class="text-sm font-medium text-red-500">{{ formError }}</p>
      </div>
    </form>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { patientStore } from '../../store/patientStore'

const router = useRouter()

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000'
const api = axios.create({ baseURL: API_BASE })
const patientId = patientStore.patientId || localStorage.getItem('userId') || ''

const questions = [
  { id: 'fever', label: 'Do you have a fever?', type: 'yesno' },
  { id: 'cough', label: 'Do you have a cough?', type: 'yesno' },
  { id: 'chestPain', label: 'Are you experiencing chest pain?', type: 'scale' },
  { id: 'duration', label: 'How long have you had these symptoms?', type: 'text', placeholder: 'e.g. 3 days' }
]

// Seed local answers from the store so previously entered values reappear.
const answers = reactive({
  fever: patientStore.questionnaire.answers.fever || '',
  cough: patientStore.questionnaire.answers.cough || '',
  chestPain: patientStore.questionnaire.answers.chestPain || '',
  duration: patientStore.questionnaire.answers.duration || ''
})

// Path A/B declaration (seeded from the order so it persists if revisited).
const needsMedication = ref(patientStore.order.needs_medication)
const formError = ref('')
const submitting = ref(false)

const submitAnswers = async () => {
  if (needsMedication.value === null) {
    formError.value = 'Please indicate whether you need medication.'
    return
  }
  formError.value = ''
  submitting.value = true

  try {
    // Ensure an order exists (covers landing here without clicking Start), then
    // persist the declaration onto it — the order is the source of truth.
    let orderId = patientStore.order.order_id
    if (!orderId) {
      const created = await api.post('/api/orders', { patient_id: patientId })
      patientStore.setOrder(created.data)
      orderId = created.data.order_id
    }
    const updated = await api.patch(`/api/orders/${orderId}`, { needs_medication: needsMedication.value })
    patientStore.setOrder(updated.data)
  } catch (err) {
    formError.value = 'Could not save your response. Please try again.'
    submitting.value = false
    return
  }

  patientStore.questionnaire.answers = { ...answers }
  patientStore.questionnaire.submitted = true
  // Next: hardware check (gate) → consult payment → queue.
  router.push('/patient/hardware-check')
}
</script>
