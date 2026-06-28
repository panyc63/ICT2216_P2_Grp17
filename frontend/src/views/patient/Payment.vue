<template>
  <div>
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-slate-900 tracking-tight">Payment</h1>
      <p class="text-sm text-slate-500">Review your charges and complete payment for this consultation.</p>
    </div>

    <div class="bg-white border border-slate-200 rounded-2xl shadow-sm p-8 max-w-lg">
      <dl class="space-y-3">
        <div class="flex justify-between text-sm">
          <dt class="text-slate-600">Consultation Fee</dt>
          <dd class="font-medium text-slate-900">${{ payment.consultationFee.toFixed(2) }}</dd>
        </div>
        <div class="flex justify-between text-sm">
          <dt class="text-slate-600">Medication Cost</dt>
          <dd class="font-medium text-slate-900">${{ payment.medicationCost.toFixed(2) }}</dd>
        </div>
        <div class="border-t border-slate-200 pt-3 flex justify-between">
          <dt class="text-base font-bold text-slate-900">Total</dt>
          <dd class="text-base font-bold text-slate-900">${{ total.toFixed(2) }}</dd>
        </div>
      </dl>

      <div v-if="!payment.paid" class="mt-8">
        <button
          @click="payNow"
          :disabled="processing"
          class="w-full py-3 bg-indigo-600 text-white text-sm font-semibold rounded-lg shadow-sm hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {{ processing ? 'Processing...' : `Pay Now - $${total.toFixed(2)}` }}
        </button>
        <p class="mt-3 text-xs text-center text-slate-400">Payment status is confirmed by server-side webhook verification.</p>
      </div>

      <div v-if="checkoutStatus && !payment.paid" class="mt-8 rounded-xl bg-amber-50 border border-amber-200 p-5 text-center">
        <p class="text-sm font-bold text-amber-700">Checkout Created</p>
        <p class="text-xs text-amber-600 mt-1">Reference: {{ reference }}</p>
      </div>

      <div v-else-if="payment.paid" class="mt-8 rounded-xl bg-emerald-50 border border-emerald-200 p-5 text-center">
        <p class="text-sm font-bold text-emerald-700">Payment Successful</p>
        <p class="text-xs text-emerald-600 mt-1">Reference: {{ reference }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { patientStore } from '../../store/patientStore'
import { apiFetch } from '../../services/api'

const payment = patientStore.payment
const total = computed(() => payment.consultationFee + payment.medicationCost)
const processing = ref(false)
const reference = ref('')
const checkoutStatus = ref('')

const payNow = async () => {
  processing.value = true
  try {
    const data = await apiFetch('/payments/checkout', {
      method: 'POST',
      body: JSON.stringify({})
    })
    payment.paid = data.status === 'Paid'
    reference.value = data.checkoutReference
    checkoutStatus.value = data.status
    window.open(data.checkoutUrl, '_blank', 'noopener,noreferrer')
  } finally {
    processing.value = false
  }
}
</script>
