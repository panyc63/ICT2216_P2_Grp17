<template>
  <div>
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-slate-900 tracking-tight">Payment</h1>
      <p class="text-sm text-slate-500">Review and settle charges for consultations a doctor has seen.</p>
    </div>

    <p v-if="error" role="alert" class="mb-4 text-sm font-medium text-red-600">{{ error }}</p>

    <!-- Loading -->
    <div v-if="loading" class="bg-white border border-slate-200 rounded-2xl shadow-sm p-8 max-w-lg text-sm text-slate-400">
      Loading your charges…
    </div>

    <!-- Empty state: nothing due (the normal case for a new account) -->
    <div v-else-if="outstanding.length === 0" class="bg-white border border-slate-200 rounded-2xl shadow-sm p-8 max-w-lg text-center">
      <div class="w-12 h-12 mx-auto rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl" aria-hidden="true">✓</div>
      <h2 class="mt-4 font-bold text-slate-900">You have no outstanding payments</h2>
      <p class="mt-1 text-sm text-slate-500">Charges appear here only after a doctor has seen you in a consultation. Book a consultation to get started.</p>
      <router-link to="/patient/book-consultation" class="inline-block mt-5 px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg shadow-sm hover:bg-indigo-700 transition">
        Book a consultation
      </router-link>
    </div>

    <!-- One card per unpaid consultation -->
    <div v-else class="space-y-5 max-w-lg">
      <div v-for="item in outstanding" :key="item.consultationId" class="bg-white border border-slate-200 rounded-2xl shadow-sm p-8">
        <div class="flex items-center justify-between mb-4">
          <div>
            <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Consultation</p>
            <p class="text-sm font-medium text-slate-900">{{ item.consultationId }}</p>
          </div>
          <span class="text-xs font-semibold px-2.5 py-1 rounded-full"
                :class="item.sessionStatus === 'Completed' ? 'bg-emerald-50 text-emerald-700' : 'bg-sky-50 text-sky-700'">
            {{ item.sessionStatus }}
          </span>
        </div>

        <dl class="space-y-3">
          <div class="flex justify-between text-sm">
            <dt class="text-slate-600">Consultation fee</dt>
            <dd class="font-medium text-slate-900">${{ dollars(item.consultationFeeCents) }}</dd>
          </div>
          <div class="flex justify-between text-sm">
            <dt class="text-slate-600">Medication cost</dt>
            <dd class="font-medium text-slate-900">${{ dollars(item.medicationCents) }}</dd>
          </div>
          <div class="border-t border-slate-200 pt-3 flex justify-between">
            <dt class="text-base font-bold text-slate-900">Total</dt>
            <dd class="text-base font-bold text-slate-900">${{ dollars(item.amountCents) }}</dd>
          </div>
        </dl>
        <p class="mt-2 text-xs text-slate-400">Amounts are calculated server-side from your consultation and prescriptions.</p>

        <div v-if="checkoutRefs[item.consultationId]" class="mt-6 rounded-xl bg-amber-50 border border-amber-200 p-5 text-center">
          <p class="text-sm font-bold text-amber-700">Checkout created</p>
          <p class="text-xs text-amber-600 mt-1">Reference: {{ checkoutRefs[item.consultationId] }}</p>
          <p class="text-xs text-amber-600 mt-1">Complete payment in the opened window; confirmation is verified server-side by webhook.</p>
        </div>
        <div v-else class="mt-6">
          <button
            @click="payNow(item)"
            :disabled="processingId === item.consultationId"
            class="w-full py-3 bg-indigo-600 text-white text-sm font-semibold rounded-lg shadow-sm hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition"
          >
            {{ processingId === item.consultationId ? 'Processing…' : `Pay now — $${dollars(item.amountCents)}` }}
          </button>
          <p class="mt-3 text-xs text-center text-slate-400">Payment status is confirmed by server-side webhook verification.</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { apiFetch } from '../../services/api'

// Amounts always come from the server; the client never sets or trusts a total.
const outstanding = ref([])
const loading = ref(true)
const processingId = ref('')
const checkoutRefs = reactive({})
const error = ref('')

const dollars = (cents) => (Number(cents || 0) / 100).toFixed(2)

const loadOutstanding = async () => {
  loading.value = true
  try {
    const data = await apiFetch('/patient/outstanding')
    outstanding.value = data.outstanding || []
  } catch (err) {
    error.value = err.message || 'Could not load your charges.'
  } finally {
    loading.value = false
  }
}

const payNow = async (item) => {
  processingId.value = item.consultationId
  error.value = ''
  try {
    const data = await apiFetch('/payments/checkout', {
      method: 'POST',
      body: JSON.stringify({ consultationId: item.consultationId }),
    })
    checkoutRefs[item.consultationId] = data.checkoutReference
    if (data.checkoutUrl) window.open(data.checkoutUrl, '_blank', 'noopener,noreferrer')
  } catch (err) {
    error.value = err.message || 'Could not start checkout.'
  } finally {
    processingId.value = ''
  }
}

onMounted(loadOutstanding)
</script>
