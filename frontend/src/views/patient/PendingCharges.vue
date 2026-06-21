<template>
  <div>
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-slate-900 tracking-tight">Pending Charges</h1>
      <p class="text-sm text-slate-500">Ad-hoc charges raised for you. Pay any that are outstanding.</p>
    </div>

    <!-- Confirming after returning from Stripe -->
    <div v-if="confirming" class="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 max-w-3xl mb-4">
      <div class="flex items-center justify-center gap-2">
        <span class="h-3 w-3 rounded-full bg-indigo-600 animate-ping"></span>
        <span class="text-sm font-semibold text-indigo-700">Confirming payment…</span>
      </div>
    </div>

    <div v-if="loading" class="bg-white border border-slate-200 rounded-2xl shadow-sm p-8 max-w-3xl text-center text-sm text-slate-500">
      Loading…
    </div>

    <div v-else-if="error" class="bg-white border border-slate-200 rounded-2xl shadow-sm p-8 max-w-3xl text-center text-sm text-red-500">
      {{ error }}
    </div>

    <div v-else-if="charges.length === 0" class="bg-white border border-slate-200 rounded-2xl shadow-sm p-10 max-w-3xl text-center">
      <div class="text-3xl mb-3">💳</div>
      <p class="text-sm font-semibold text-slate-900">No pending charges</p>
      <p class="text-xs text-slate-500 mt-1">Any charges a doctor or admin raises for you will appear here.</p>
    </div>

    <div v-else class="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden max-w-3xl">
      <table class="min-w-full divide-y divide-slate-200 text-left text-sm">
        <thead class="bg-slate-50 font-semibold text-slate-700">
          <tr>
            <th class="px-6 py-3">Description</th>
            <th class="px-6 py-3">Amount</th>
            <th class="px-6 py-3">Status</th>
            <th class="px-6 py-3 text-right">Action</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 text-slate-600">
          <tr v-for="c in charges" :key="c.payment_request_id" class="hover:bg-slate-50/50">
            <td class="px-6 py-4 font-medium text-slate-900">{{ c.description }}</td>
            <td class="px-6 py-4">{{ formatAmount(c.amount_cents, c.currency) }}</td>
            <td class="px-6 py-4">
              <span :class="statusClass(c.status)" class="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset">
                {{ c.status }}
              </span>
            </td>
            <td class="px-6 py-4 text-right">
              <button
                v-if="c.status === 'Pending'"
                @click="pay(c)"
                :disabled="payingId === c.payment_request_id"
                class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm disabled:opacity-60"
              >
                {{ payingId === c.payment_request_id ? 'Redirecting…' : 'Pay' }}
              </button>
              <span v-else class="text-xs text-slate-400">—</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import axios from 'axios'
import { patientStore } from '../../store/patientStore'

const route = useRoute()

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000'
const api = axios.create({ baseURL: API_BASE })
const patientId = patientStore.patientId || localStorage.getItem('userId') || ''

const charges = ref([])
const loading = ref(true)
const error = ref('')
const payingId = ref('')
const confirming = ref(false)

const formatAmount = (cents, currency) =>
  new Intl.NumberFormat('en-SG', { style: 'currency', currency: (currency || 'sgd').toUpperCase() }).format((cents || 0) / 100)

const statusClass = (s) => {
  if (s === 'Paid') return 'bg-emerald-50 text-emerald-700 ring-emerald-600/10'
  if (s === 'Cancelled') return 'bg-slate-100 text-slate-600 ring-slate-600/10'
  return 'bg-amber-50 text-amber-700 ring-amber-600/10'
}

const fetchCharges = async () => {
  try {
    const { data } = await api.get(`/api/payments/requests/patient/${patientId}`)
    charges.value = data
  } catch (err) {
    error.value = err.response?.data?.error || 'Unable to load your charges.'
  } finally {
    loading.value = false
  }
}

const pay = async (c) => {
  payingId.value = c.payment_request_id
  error.value = ''
  try {
    const { data } = await api.post(`/api/payments/requests/${c.payment_request_id}/checkout`)
    if (data.already_paid) {
      await fetchCharges()
      payingId.value = ''
      return
    }
    window.location.href = data.url
  } catch (err) {
    error.value = err.response?.data?.error || 'Could not start checkout. Please try again.'
    payingId.value = ''
  }
}

// After returning from Stripe, the webhook marks the request Paid — which can lag
// a beat. Poll the list until no charge is still pending (or a short cap).
let pollTimer = null
let attempts = 0
const MAX_ATTEMPTS = 8

const stopPolling = () => {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
}

onMounted(async () => {
  if (!patientId) {
    error.value = 'No patient session found.'
    loading.value = false
    return
  }
  await fetchCharges()

  if (route.query.status === 'success') {
    confirming.value = true
    pollTimer = setInterval(async () => {
      attempts += 1
      await fetchCharges()
      if (attempts >= MAX_ATTEMPTS) {
        stopPolling()
        confirming.value = false
      }
    }, 2000)
  }
})

onUnmounted(stopPolling)
</script>
