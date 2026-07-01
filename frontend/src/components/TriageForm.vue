<template>
  <form @submit.prevent="submitAnswers" class="space-y-6">
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

    <div class="flex items-center gap-4 pt-2">
      <button
        type="submit"
        :disabled="submitting"
        class="px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg shadow-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {{ submitting ? 'Submitting…' : 'Submit & Open Consultation' }}
      </button>
      <button
        v-if="cancellable"
        type="button"
        @click="$emit('cancel')"
        class="text-sm font-medium text-slate-500 hover:text-slate-700"
      >
        Cancel
      </button>
      <p v-if="error" role="alert" class="text-sm font-medium text-red-600">{{ error }}</p>
    </div>
  </form>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { patientStore } from '../store/patientStore'
import { apiFetch } from '../services/api'

// Booking always starts here: submitting the questionnaire runs triage, which opens
// the linked, prioritized consultation. The parent listens for `submitted`.
defineProps({ cancellable: { type: Boolean, default: false } })
const emit = defineEmits(['submitted', 'cancel'])

const questions = [
  { id: 'fever', label: 'Do you have a fever?', type: 'yesno' },
  { id: 'cough', label: 'Do you have a cough?', type: 'yesno' },
  { id: 'shortnessOfBreath', label: 'Do you have shortness of breath?', type: 'yesno' },
  { id: 'chestPain', label: 'Are you experiencing chest pain?', type: 'scale' },
  { id: 'duration', label: 'How long have you had these symptoms?', type: 'text', placeholder: 'e.g. 3 days' }
]

// Seed local answers from the store so previously entered values reappear.
const answers = reactive({
  fever: patientStore.questionnaire.answers.fever || '',
  cough: patientStore.questionnaire.answers.cough || '',
  shortnessOfBreath: patientStore.questionnaire.answers.shortnessOfBreath || '',
  chestPain: patientStore.questionnaire.answers.chestPain || '',
  duration: patientStore.questionnaire.answers.duration || ''
})

const submitting = ref(false)
const error = ref('')

const submitAnswers = async () => {
  error.value = ''
  submitting.value = true
  try {
    const result = await apiFetch('/triage', {
      method: 'POST',
      body: JSON.stringify({ ...answers })
    })
    patientStore.questionnaire.answers = { ...answers }
    patientStore.questionnaire.submitted = true
    emit('submitted', result)
  } catch (err) {
    error.value = err.message || 'Could not submit your questionnaire.'
  } finally {
    submitting.value = false
  }
}
</script>
