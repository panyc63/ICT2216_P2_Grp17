<template>
  <div>
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-slate-900">Issue Medical Certificate</h1>
      <p class="text-sm text-slate-500">Issue a standalone certificate to a patient — no consultation required.</p>
    </div>

    <form @submit.prevent="submit" class="bg-white border border-slate-200 rounded-xl shadow-sm p-6 max-w-lg space-y-5">
      <div>
        <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Patient</label>
        <PatientSelect v-model="patientId" />
      </div>

      <div>
        <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Diagnosis</label>
        <input
          v-model="diagnosis"
          type="text"
          required
          placeholder="e.g. Acute Gastroenteritis"
          class="block w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>

      <div>
        <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Valid Until</label>
        <input
          v-model="validUntil"
          type="date"
          required
          class="block w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
        <p class="text-xs text-slate-400 mt-1">Issue date is set to today automatically.</p>
      </div>

      <p v-if="error" class="text-sm font-medium text-red-500">{{ error }}</p>
      <p v-if="success" class="text-sm font-medium text-emerald-600">{{ success }}</p>

      <div class="flex justify-end">
        <button
          type="submit"
          :disabled="submitting || !patientId"
          class="px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg shadow-sm hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {{ submitting ? 'Issuing…' : 'Issue Certificate' }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import axios from 'axios'
import PatientSelect from '../../components/PatientSelect.vue'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000'
const api = axios.create({ baseURL: API_BASE })
const doctorId = localStorage.getItem('userId') || ''

const defaultValidUntil = () => {
  const d = new Date()
  d.setDate(d.getDate() + 2)
  return d.toISOString().slice(0, 10)
}

const patientId = ref('')
const diagnosis = ref('')
const validUntil = ref(defaultValidUntil())
const submitting = ref(false)
const error = ref('')
const success = ref('')

const submit = async () => {
  submitting.value = true
  error.value = ''
  success.value = ''
  try {
    const { data } = await api.post('/api/medical-certificates', {
      patient_id: patientId.value,
      doctor_id: doctorId,
      diagnosis: diagnosis.value.trim(),
      valid_until: validUntil.value
    })
    success.value = `Certificate ${data.mc_id} issued.`
    // Reset for the next one (keep the date default).
    patientId.value = ''
    diagnosis.value = ''
    validUntil.value = defaultValidUntil()
  } catch (err) {
    error.value = err.response?.data?.error || 'Could not issue the certificate.'
  } finally {
    submitting.value = false
  }
}
</script>
