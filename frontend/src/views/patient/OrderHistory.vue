<template>
  <div>
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-slate-900 tracking-tight">My Consultations</h1>
      <p class="text-sm text-slate-500">Your consultation history. Resume any that are still in progress.</p>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="bg-white border border-slate-200 rounded-2xl shadow-sm p-8 max-w-3xl text-center text-sm text-slate-500">
      Loading…
    </div>

    <!-- Error -->
    <div v-else-if="error" class="bg-white border border-slate-200 rounded-2xl shadow-sm p-8 max-w-3xl text-center text-sm text-red-500">
      {{ error }}
    </div>

    <!-- Empty state -->
    <div v-else-if="orders.length === 0" class="bg-white border border-slate-200 rounded-2xl shadow-sm p-10 max-w-3xl text-center">
      <div class="text-3xl mb-3">🩺</div>
      <p class="text-sm font-semibold text-slate-900">No consultations yet</p>
      <p class="text-xs text-slate-500 mt-1">Start a consultation from your Profile and it will appear here.</p>
    </div>

    <!-- List -->
    <div v-else class="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden max-w-3xl">
      <table class="min-w-full divide-y divide-slate-200 text-left text-sm">
        <thead class="bg-slate-50 font-semibold text-slate-700">
          <tr>
            <th class="px-6 py-3">Date</th>
            <th class="px-6 py-3">Status</th>
            <th class="px-6 py-3">Medication</th>
            <th class="px-6 py-3 text-right">Action</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 text-slate-600">
          <tr v-for="order in orders" :key="order.order_id" class="hover:bg-slate-50/50">
            <td class="px-6 py-4 font-medium text-slate-900">{{ formatDate(order.created_at) }}</td>
            <td class="px-6 py-4">
              <span :class="statusClass(order.status)" class="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset">
                {{ statusLabel(order.status) }}
              </span>
            </td>
            <td class="px-6 py-4">{{ order.needs_medication === null ? '—' : (order.needs_medication ? 'Yes' : 'No') }}</td>
            <td class="px-6 py-4 text-right">
              <button
                v-if="!isTerminal(order.status)"
                @click="resume(order)"
                class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm"
              >
                Resume
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
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { patientStore } from '../../store/patientStore'
import { statusLabel, isTerminal, resumeRouteForOrder } from '../../utils/orderFlow'

const router = useRouter()

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000'
const api = axios.create({ baseURL: API_BASE })
const patientId = patientStore.patientId || localStorage.getItem('userId') || ''

const orders = ref([])
const loading = ref(true)
const error = ref('')

const formatDate = (ts) => (ts ? new Date(ts).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '—')

const statusClass = (s) => {
  if (s === 'Completed') return 'bg-emerald-50 text-emerald-700 ring-emerald-600/10'
  if (['Cancelled', 'Refunded'].includes(s)) return 'bg-slate-100 text-slate-600 ring-slate-600/10'
  if (['AwaitingPayment', 'PendingRefund', 'Pending'].includes(s)) return 'bg-amber-50 text-amber-700 ring-amber-600/10'
  return 'bg-indigo-50 text-indigo-700 ring-indigo-600/10'
}

// Set the store's order first so the target page has the right order immediately
// (there is a single active order, so this matches its own /active lookup).
const resume = (order) => {
  const route = resumeRouteForOrder(order)
  if (!route) return
  patientStore.setOrder(order)
  router.push(route)
}

onMounted(async () => {
  if (!patientId) {
    error.value = 'No patient session found.'
    loading.value = false
    return
  }
  try {
    const { data } = await api.get(`/api/orders/patient/${patientId}`)
    orders.value = data
  } catch (err) {
    error.value = err.response?.data?.error || 'Unable to load your consultations.'
  } finally {
    loading.value = false
  }
})
</script>
