<template>
  <div>
    <div class="flex justify-between items-center mb-6">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Payment Requests</h1>
        <p class="text-sm text-slate-500">All ad-hoc charges raised for patients.</p>
      </div>
      <button @click="fetchRequests" class="px-3 py-2 border border-slate-300 rounded-lg text-sm font-medium bg-white hover:bg-slate-50">Refresh</button>
    </div>

    <div class="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <table class="min-w-full divide-y divide-slate-200 text-left text-sm">
        <thead class="bg-slate-50 font-semibold text-slate-700">
          <tr>
            <th class="px-4 py-3">Request</th>
            <th class="px-4 py-3">Patient</th>
            <th class="px-4 py-3">Description</th>
            <th class="px-4 py-3">Amount</th>
            <th class="px-4 py-3">Status</th>
            <th class="px-4 py-3">Created</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-200 text-slate-600">
          <tr v-for="r in requests" :key="r.payment_request_id" class="hover:bg-slate-50/50">
            <td class="px-4 py-3 font-medium text-slate-900">{{ r.payment_request_id }}</td>
            <td class="px-4 py-3">{{ r.patient_name || r.patient_id }}</td>
            <td class="px-4 py-3">{{ r.description }}</td>
            <td class="px-4 py-3">{{ formatAmount(r.amount_cents, r.currency) }}</td>
            <td class="px-4 py-3">
              <span :class="statusClass(r.status)" class="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset">
                {{ r.status }}
              </span>
            </td>
            <td class="px-4 py-3 text-xs text-slate-400">{{ formatDate(r.created_at) }}</td>
          </tr>
          <tr v-if="requests.length === 0">
            <td colspan="6" class="px-6 py-10 text-center text-slate-400 italic">No payment requests yet.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <p v-if="error" class="mt-4 text-sm font-medium text-red-500">{{ error }}</p>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000'
const api = axios.create({ baseURL: API_BASE })

const requests = ref([])
const error = ref('')

const formatAmount = (cents, currency) =>
  new Intl.NumberFormat('en-SG', { style: 'currency', currency: (currency || 'sgd').toUpperCase() }).format((cents || 0) / 100)

const formatDate = (ts) => (ts ? new Date(ts).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '—')

const statusClass = (s) => {
  if (s === 'Paid') return 'bg-emerald-50 text-emerald-700 ring-emerald-600/10'
  if (s === 'Cancelled') return 'bg-slate-100 text-slate-600 ring-slate-600/10'
  return 'bg-amber-50 text-amber-700 ring-amber-600/10'
}

const fetchRequests = async () => {
  error.value = ''
  try {
    const { data } = await api.get('/api/payments/requests')
    requests.value = data
  } catch (err) {
    error.value = err.response?.data?.error || 'Unable to load payment requests.'
  }
}

onMounted(fetchRequests)
</script>
