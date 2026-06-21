<template>
  <div>
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-slate-900">Request Payment</h1>
      <p class="text-sm text-slate-500">Raise an ad-hoc charge for a patient, outside the normal consultation flow.</p>
    </div>

    <form @submit.prevent="submit" class="bg-white border border-slate-200 rounded-xl shadow-sm p-6 max-w-lg space-y-5">
      <div>
        <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Patient</label>
        <PatientSelect v-model="patientId" />
      </div>

      <div>
        <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Description</label>
        <input
          v-model="description"
          type="text"
          required
          placeholder="e.g. Follow-up medication top-up"
          class="block w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>

      <div>
        <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Amount (SGD)</label>
        <input
          v-model="amount"
          type="number"
          min="0.01"
          step="0.01"
          required
          placeholder="0.00"
          class="block w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>

      <p v-if="error" class="text-sm font-medium text-red-500">{{ error }}</p>
      <p v-if="success" class="text-sm font-medium text-emerald-600">{{ success }}</p>

      <div class="flex justify-end">
        <button
          type="submit"
          :disabled="submitting || !patientId"
          class="px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg shadow-sm hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {{ submitting ? 'Creating…' : 'Create Payment Request' }}
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
const requestedBy = localStorage.getItem('userId') || ''

const patientId = ref('')
const description = ref('')
const amount = ref('')
const submitting = ref(false)
const error = ref('')
const success = ref('')

const submit = async () => {
  const amountCents = Math.round(parseFloat(amount.value) * 100)
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    error.value = 'Enter a valid amount greater than zero.'
    return
  }
  submitting.value = true
  error.value = ''
  success.value = ''
  try {
    const { data } = await api.post('/api/payments/requests', {
      patient_id: patientId.value,
      requested_by: requestedBy,
      description: description.value.trim(),
      amount_cents: amountCents
    })
    success.value = `Payment request ${data.payment_request_id} created.`
    patientId.value = ''
    description.value = ''
    amount.value = ''
  } catch (err) {
    error.value = err.response?.data?.error || 'Could not create the payment request.'
  } finally {
    submitting.value = false
  }
}
</script>
