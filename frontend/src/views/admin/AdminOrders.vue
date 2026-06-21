<template>
  <div>
    <div class="flex justify-between items-center mb-6">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Order Management</h1>
        <p class="text-sm text-slate-500">View patient orders and process refunds, cancellations, and deliveries.</p>
      </div>
      <div class="flex items-center gap-2">
        <label class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</label>
        <select v-model="filter" @change="fetchOrders" class="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white">
          <option value="">All</option>
          <option v-for="s in ALL_STATUSES" :key="s" :value="s">{{ s }}</option>
        </select>
      </div>
    </div>

    <div class="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <table class="min-w-full divide-y divide-slate-200 text-left text-sm">
        <thead class="bg-slate-50 font-semibold text-slate-700">
          <tr>
            <th class="px-4 py-3">Order</th>
            <th class="px-4 py-3">Patient</th>
            <th class="px-4 py-3">Status</th>
            <th class="px-4 py-3">Med?</th>
            <th class="px-4 py-3">Collection</th>
            <th class="px-4 py-3">Consult $</th>
            <th class="px-4 py-3">Med $</th>
            <th class="px-4 py-3">Created</th>
            <th class="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-200 text-slate-600">
          <tr v-for="order in orders" :key="order.order_id" class="hover:bg-slate-50/50">
            <td class="px-4 py-3 font-medium text-slate-900">{{ order.order_id }}</td>
            <td class="px-4 py-3">{{ order.patient_name || order.patient_id }}</td>
            <td class="px-4 py-3">
              <span :class="statusClass(order.status)" class="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset">
                {{ order.status }}
              </span>
            </td>
            <td class="px-4 py-3">{{ order.needs_medication === null ? '—' : (order.needs_medication ? 'Yes' : 'No') }}</td>
            <td class="px-4 py-3">{{ order.collection_method || '—' }}</td>
            <td class="px-4 py-3">{{ order.consult_fee_paid ? '✓' : '—' }}</td>
            <td class="px-4 py-3">{{ order.medication_fee_paid ? '✓' : '—' }}</td>
            <td class="px-4 py-3 text-xs text-slate-400">{{ formatDate(order.created_at) }}</td>
            <td class="px-4 py-3 text-right whitespace-nowrap">
              <button
                v-for="t in transitionsFor(order.status)"
                :key="t.to"
                @click="openAction(order, t)"
                :class="t.danger ? 'text-red-600 hover:text-red-800' : 'text-indigo-600 hover:text-indigo-800'"
                class="text-xs font-semibold ml-3"
              >
                {{ t.label }}
              </button>
              <button @click="openHistory(order)" class="text-xs font-medium text-slate-400 hover:text-slate-600 ml-3">History</button>
            </td>
          </tr>
          <tr v-if="orders.length === 0">
            <td colspan="9" class="px-6 py-10 text-center text-slate-400 italic">No orders found.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <p v-if="error" class="mt-4 text-sm font-medium text-red-500">{{ error }}</p>

    <!-- Action modal -->
    <div v-if="action" class="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50">
      <div class="bg-white p-6 rounded-xl border border-slate-200 w-full max-w-sm shadow-xl">
        <h3 class="text-lg font-bold text-slate-900 mb-1">{{ action.transition.label }}</h3>
        <p class="text-sm text-slate-500 mb-4">{{ action.order.order_id }} → <span class="font-semibold">{{ action.transition.to }}</span></p>
        <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
          Note <span v-if="noteRequired" class="text-red-500">*</span>
        </label>
        <textarea v-model="note" rows="3" class="block w-full px-3 py-2 border border-slate-300 rounded-md text-sm" :placeholder="noteRequired ? 'Required for refund/cancellation' : 'Optional'"></textarea>
        <p v-if="actionError" class="mt-2 text-sm font-medium text-red-500">{{ actionError }}</p>
        <div class="flex justify-end gap-2 mt-4">
          <button @click="closeAction" :disabled="submitting" class="px-3 py-1.5 border border-slate-300 text-slate-700 text-sm font-medium rounded-md bg-white">Cancel</button>
          <button @click="submitAction" :disabled="submitting" class="px-3 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-md disabled:opacity-60">
            {{ submitting ? 'Saving…' : 'Confirm' }}
          </button>
        </div>
      </div>
    </div>

    <!-- History modal -->
    <div v-if="historyOrder" class="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50">
      <div class="bg-white p-6 rounded-xl border border-slate-200 w-full max-w-md shadow-xl">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-lg font-bold text-slate-900">History — {{ historyOrder.order_id }}</h3>
          <button @click="historyOrder = null" class="text-slate-400 hover:text-slate-600 text-sm font-semibold">Close</button>
        </div>
        <ol class="space-y-3 max-h-80 overflow-y-auto">
          <li v-for="h in history" :key="h.history_id" class="border-l-2 border-indigo-200 pl-3">
            <p class="text-sm font-semibold text-slate-900">{{ h.status }}</p>
            <p v-if="h.note" class="text-xs text-slate-600">{{ h.note }}</p>
            <p class="text-xs text-slate-400">{{ formatDate(h.changed_at) }}</p>
          </li>
          <li v-if="history.length === 0" class="text-sm text-slate-400 italic">No history.</li>
        </ol>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000'
const api = axios.create({ baseURL: API_BASE })

const ALL_STATUSES = [
  'Pending', 'InQueue', 'InCall', 'AwaitingFinalization', 'AwaitingPayment',
  'AwaitingDelivery', 'Completed', 'PendingRefund', 'Refunded', 'Cancelled'
]

// Mirror of the backend's allowed transitions, with display labels.
const TRANSITIONS = {
  Pending: [{ to: 'PendingRefund', label: 'Request Refund' }, { to: 'Cancelled', label: 'Cancel', danger: true }],
  InQueue: [{ to: 'PendingRefund', label: 'Request Refund' }, { to: 'Cancelled', label: 'Cancel', danger: true }],
  InCall: [{ to: 'PendingRefund', label: 'Request Refund' }, { to: 'Cancelled', label: 'Cancel', danger: true }],
  AwaitingFinalization: [{ to: 'PendingRefund', label: 'Request Refund' }, { to: 'Cancelled', label: 'Cancel', danger: true }],
  AwaitingPayment: [{ to: 'PendingRefund', label: 'Request Refund' }, { to: 'Cancelled', label: 'Cancel', danger: true }],
  AwaitingDelivery: [{ to: 'Completed', label: 'Mark Delivered' }, { to: 'PendingRefund', label: 'Request Refund' }, { to: 'Cancelled', label: 'Cancel', danger: true }],
  PendingRefund: [{ to: 'Refunded', label: 'Mark Refunded' }, { to: 'Cancelled', label: 'Cancel', danger: true }]
}
const NOTE_REQUIRED = ['Refunded', 'Cancelled']

const orders = ref([])
const filter = ref('')
const error = ref('')

const action = ref(null)        // { order, transition }
const note = ref('')
const actionError = ref('')
const submitting = ref(false)

const historyOrder = ref(null)
const history = ref([])

const noteRequired = computed(() => action.value && NOTE_REQUIRED.includes(action.value.transition.to))

const transitionsFor = (status) => TRANSITIONS[status] || []

const formatDate = (ts) => (ts ? new Date(ts).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '—')

const statusClass = (s) => {
  if (['Completed'].includes(s)) return 'bg-emerald-50 text-emerald-700 ring-emerald-600/10'
  if (['Refunded', 'Cancelled'].includes(s)) return 'bg-slate-100 text-slate-600 ring-slate-600/10'
  if (['PendingRefund', 'Pending'].includes(s)) return 'bg-amber-50 text-amber-700 ring-amber-600/10'
  return 'bg-indigo-50 text-indigo-700 ring-indigo-600/10'
}

const fetchOrders = async () => {
  error.value = ''
  try {
    const { data } = await api.get('/api/orders', { params: filter.value ? { status: filter.value } : {} })
    orders.value = data
  } catch (err) {
    error.value = err.response?.data?.error || 'Unable to load orders.'
  }
}

const openAction = (order, transition) => {
  action.value = { order, transition }
  note.value = ''
  actionError.value = ''
}
const closeAction = () => { action.value = null }

const submitAction = async () => {
  if (noteRequired.value && !note.value.trim()) {
    actionError.value = 'A note is required for refunds and cancellations.'
    return
  }
  submitting.value = true
  actionError.value = ''
  try {
    await api.patch(`/api/orders/${action.value.order.order_id}/status`, {
      status: action.value.transition.to,
      note: note.value.trim() || undefined
    })
    action.value = null
    await fetchOrders()
  } catch (err) {
    actionError.value = err.response?.data?.error || 'Could not update the order.'
  } finally {
    submitting.value = false
  }
}

const openHistory = async (order) => {
  historyOrder.value = order
  history.value = []
  try {
    const { data } = await api.get(`/api/orders/${order.order_id}/history`)
    history.value = data
  } catch (err) {
    // non-fatal
  }
}

onMounted(fetchOrders)
</script>
