<template>
  <div>
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-slate-900 tracking-tight">Payment</h1>
      <p class="text-sm text-slate-500">Review your charges and complete payment for this consultation.</p>
    </div>

    <div class="bg-white border border-slate-200 rounded-2xl shadow-sm p-8 max-w-lg">
      <p v-if="error" role="alert" class="mb-4 text-sm font-medium text-red-600">{{ error }}</p>

      <dl class="space-y-3">
        <div class="flex justify-between text-sm">
          <dt class="text-slate-600">Consultation Fee</dt>
          <dd class="font-medium text-slate-900">${{ dollars(quote.consultationFeeCents) }}</dd>
        </div>
        <div class="flex justify-between text-sm">
          <dt class="text-slate-600">Medication Cost</dt>
          <dd class="font-medium text-slate-900">${{ dollars(quote.medicationCents) }}</dd>
        </div>
        <div class="border-t border-slate-200 pt-3 flex justify-between">
          <dt class="text-base font-bold text-slate-900">Total</dt>
          <dd class="text-base font-bold text-slate-900">${{ dollars(quote.amountCents) }}</dd>
        </div>
      </dl>
      <p class="mt-2 text-xs text-slate-400">Amounts are calculated server-side from your consultation and prescriptions.</p>

      <div v-if="!checkoutRef" class="mt-8">
        <button
          @click="payNow"
          :disabled="processing || loading"
          class="w-full py-3 bg-indigo-600 text-white text-sm font-semibold rounded-lg shadow-sm hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {{ processing ? 'Processing...' : `Pay Now - $${dollars(quote.amountCents)}` }}
        </button>
        <p class="mt-3 text-xs text-center text-slate-400">Payment status is confirmed by server-side webhook verification.</p>
      </div>

      <div v-else class="mt-8 rounded-xl bg-amber-50 border border-amber-200 p-5 text-center">
        <p class="text-sm font-bold text-amber-700">Checkout Created</p>
        <p class="text-xs text-amber-600 mt-1">Reference: {{ checkoutRef }}</p>
        <p class="text-xs text-amber-600 mt-1">Complete payment in the opened window; confirmation is verified server-side by webhook.</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { apiFetch } from '../../services/api'

// Totals come from the server (/payments/quote and /payments/checkout); the client
// never sets or trusts the amount.
const quote = ref({ consultationFeeCents: 0, medicationCents: 0, amountCents: 0 })
const loading = ref(true)
const processing = ref(false)
const checkoutRef = ref('')
const error = ref('')

const dollars = (cents) => (Number(cents || 0) / 100).toFixed(2)

const loadQuote = async () => {
  try {
    quote.value = await apiFetch('/payments/quote')
  } catch (err) {
    error.value = err.message || 'Could not load payment total.'
  } finally {
    loading.value = false
  }
}

const payNow = async () => {
  processing.value = true
  error.value = ''
  try {
    const data = await apiFetch('/payments/checkout', { method: 'POST', body: JSON.stringify({}) })
    quote.value = {
      consultationFeeCents: data.consultationFeeCents,
      medicationCents: data.medicationCents,
      amountCents: data.amountCents,
    }
    checkoutRef.value = data.checkoutReference
    if (data.checkoutUrl) window.open(data.checkoutUrl, '_blank', 'noopener,noreferrer')
  } catch (err) {
    error.value = err.message || 'Could not start checkout.'
  } finally {
    processing.value = false
  }
}

onMounted(loadQuote)
</script>
