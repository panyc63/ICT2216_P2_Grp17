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
          {{ processing ? 'Processing…' : `Pay Now — $${total.toFixed(2)}` }}
        </button>
        <p class="mt-3 text-xs text-center text-slate-400">Secure payment simulation — no real card is charged.</p>
      </div>

      <div v-else class="mt-8 rounded-xl bg-emerald-50 border border-emerald-200 p-5 text-center">
        <div class="text-2xl mb-1">✅</div>
        <p class="text-sm font-bold text-emerald-700">Payment Successful</p>
        <p class="text-xs text-emerald-600 mt-1">Reference: {{ reference }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { patientStore } from '../../store/patientStore'

const payment = patientStore.payment

const total = computed(() => payment.consultationFee + payment.medicationCost)

const processing = ref(false)
const reference = ref('')

const payNow = () => {
  processing.value = true
  // Simulate a short payment round-trip, then mark as paid in shared state.
  setTimeout(() => {
    payment.paid = true
    reference.value = 'MF-' + Date.now().toString().slice(-8)
    processing.value = false
  }, 900)
}
</script>
