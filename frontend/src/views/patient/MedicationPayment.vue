<template>
  <div>
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-slate-900 tracking-tight">Medication Payment</h1>
      <p class="text-sm text-slate-500">Pay for the medication prescribed in your consultation.</p>
    </div>

    <div class="bg-white border border-slate-200 rounded-2xl shadow-sm p-8 max-w-lg">
      <dl class="space-y-3">
        <div class="flex justify-between">
          <dt class="text-base font-bold text-slate-900">Medication Cost</dt>
          <dd class="text-base font-bold text-slate-900">{{ formattedAmount }}</dd>
        </div>
      </dl>

      <!-- Confirming payment after returning from Stripe (?status=success) -->
      <div v-if="confirming" class="mt-8">
        <div class="rounded-xl bg-indigo-50 border border-indigo-100 p-5 text-center">
          <div class="flex items-center justify-center gap-2 mb-2">
            <span class="h-3 w-3 rounded-full bg-indigo-600 animate-ping"></span>
            <span class="text-sm font-semibold text-indigo-700">Confirming payment…</span>
          </div>
          <p class="text-xs text-indigo-600">This takes a moment while we verify with the payment provider.</p>
        </div>
        <button
          v-if="confirmTimedOut"
          @click="pollMedicationPaid(true)"
          class="mt-4 w-full py-2.5 border border-slate-300 text-slate-700 text-sm font-semibold rounded-lg bg-white hover:bg-slate-50"
        >
          Check again
        </button>
      </div>

      <!-- Not yet paid -->
      <div v-else-if="!paid" class="mt-8">
        <p v-if="cancelled" class="mb-4 text-sm font-medium text-amber-600 text-center">Payment was cancelled. You can try again below.</p>
        <button
          @click="payNow"
          :disabled="processing || !orderId"
          class="w-full py-3 bg-indigo-600 text-white text-sm font-semibold rounded-lg shadow-sm hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {{ processing ? 'Redirecting…' : `Pay ${formattedAmount}` }}
        </button>
        <p class="mt-3 text-xs text-center text-slate-400">You'll be taken to Stripe's secure checkout to pay.</p>
        <p v-if="error" class="mt-3 text-sm font-medium text-red-500 text-center">{{ error }}</p>
      </div>

      <!-- Paid -->
      <div v-else class="mt-8">
        <div class="rounded-xl bg-emerald-50 border border-emerald-200 p-5 text-center">
          <div class="text-2xl mb-1">✅</div>
          <p class="text-sm font-bold text-emerald-700">Medication paid</p>
        </div>
        <button
          @click="goToClosing"
          class="mt-4 w-full py-3 bg-indigo-600 text-white text-sm font-semibold rounded-lg shadow-sm hover:bg-indigo-700"
        >
          Continue
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import { patientStore } from '../../store/patientStore'

const route = useRoute()
const router = useRouter()

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000'
const api = axios.create({ baseURL: API_BASE })
const patientId = patientStore.patientId || localStorage.getItem('userId') || ''

const orderId = computed(() => patientStore.order.order_id)
const paid = computed(() => patientStore.order.medication_fee_paid === true)

const amountCents = ref(0)
const currency = ref('sgd')
const processing = ref(false)
const error = ref('')

const confirming = ref(false)      // returned from Stripe with ?status=success
const confirmTimedOut = ref(false) // webhook hasn't landed within the poll window
const cancelled = ref(false)       // returned with ?status=cancelled

const formattedAmount = computed(() =>
  amountCents.value
    ? new Intl.NumberFormat('en-SG', { style: 'currency', currency: currency.value.toUpperCase() }).format(amountCents.value / 100)
    : '—'
)

const goToClosing = () => router.push('/patient/closing')

// Redirect to Stripe-hosted Checkout. The amount is decided server-side.
const payNow = async () => {
  if (!orderId.value) return
  processing.value = true
  error.value = ''
  try {
    const { data } = await api.post('/api/payments/medication/checkout', { order_id: orderId.value })
    if (data.already_paid) {
      router.push('/patient/closing')
      return
    }
    window.location.href = data.url
  } catch (err) {
    error.value = err.response?.data?.error || 'Could not start checkout. Please try again.'
    processing.value = false
  }
}

// After returning from Stripe, the webhook (source of truth) marks the order
// paid and advances it to AwaitingDelivery — which can lag a beat. Poll until
// medication_fee_paid flips, then continue. `once` is the "Check again" retry.
let pollTimer = null
let attempts = 0
const MAX_ATTEMPTS = 8 // ~16s at 2s intervals

const stopPolling = () => {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
}

const checkOrder = async () => {
  try {
    const { data } = await api.get(`/api/orders/active/${patientId}`)
    patientStore.setOrder(data)
    if (data.medication_fee_paid) {
      stopPolling()
      confirming.value = false
      router.push('/patient/closing')
    }
  } catch (err) {
    // 404 (order already terminal) or transient — keep polling until the cap.
  }
}

const pollMedicationPaid = async (once = false) => {
  confirming.value = true
  confirmTimedOut.value = false
  await checkOrder()
  if (paid.value || once) return
  attempts = 0
  stopPolling()
  pollTimer = setInterval(async () => {
    attempts += 1
    await checkOrder()
    if (attempts >= MAX_ATTEMPTS) {
      stopPolling()
      confirmTimedOut.value = true
    }
  }, 2000)
}

onMounted(async () => {
  // Path A has no medication fee — there's nothing to pay here.
  if (patientStore.order.needs_medication === false) {
    router.push('/patient/closing')
    return
  }

  try {
    const { data } = await api.get('/api/payments/fees')
    amountCents.value = data.medication.amount_cents
    currency.value = data.currency
  } catch (err) {
    error.value = 'Unable to load the medication fee.'
  }

  // Recover the order on a hard refresh / return from Stripe.
  if (!orderId.value && patientId) {
    try {
      const { data } = await api.get(`/api/orders/active/${patientId}`)
      patientStore.setOrder(data)
    } catch (err) {
      // No active order — fall through; the button stays disabled.
    }
  }

  const status = route.query.status
  if (status === 'success') {
    if (paid.value) { router.push('/patient/closing'); return }
    pollMedicationPaid()
  } else if (status === 'cancelled') {
    cancelled.value = true
  }
})

onUnmounted(stopPolling)
</script>
