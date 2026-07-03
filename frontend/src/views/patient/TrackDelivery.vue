<template>
  <div>
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-slate-900 tracking-tight">Medication Status</h1>
      <p class="text-sm text-slate-500">Track each prescription from issue to collection / delivery.</p>
    </div>

    <div v-if="!prescriptions.length" class="bg-white border border-slate-200 rounded-2xl shadow-sm p-10 text-center text-slate-400 max-w-xl">
      No prescriptions to track yet.
    </div>

    <div v-else class="space-y-4 max-w-xl">
      <div v-for="p in prescriptions" :key="p.prescription_id" class="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
        <div class="flex items-center justify-between mb-1">
          <p class="text-sm font-bold text-slate-900">{{ p.medication_name }}</p>
          <span class="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset" :class="badgeClass(p)">
            {{ statusLabel(p) }}
          </span>
        </div>
        <p class="text-xs text-slate-400 mb-4">
          {{ p.collection_method === 'Delivery' ? 'Home delivery' : 'Self-collection' }}
        </p>
        <ol class="flex items-center">
          <li v-for="(step, i) in stepsFor(p)" :key="step" class="flex items-center" :class="i < stepsFor(p).length - 1 ? 'flex-1' : ''">
            <span
              class="flex h-7 w-7 items-center justify-center rounded-full border-2 text-[11px] font-bold shrink-0"
              :class="i <= stageIndex(p) ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-300 text-slate-400'"
            >
              <span v-if="i < stageIndex(p)">✓</span><span v-else>{{ i + 1 }}</span>
            </span>
            <span v-if="i < stepsFor(p).length - 1" class="h-0.5 flex-1 mx-1" :class="i < stageIndex(p) ? 'bg-indigo-600' : 'bg-slate-200'"></span>
          </li>
        </ol>
        <div class="flex justify-between mt-1.5 text-[11px] text-slate-500">
          <span v-for="step in stepsFor(p)" :key="step">{{ step }}</span>
        </div>

        <!-- Delivery orders that have been dispatched but not yet confirmed received -->
        <div v-if="p.collection_method === 'Delivery' && p.status === 'Fulfilled' && !p.delivered_at" class="mt-4">
          <button
            @click="confirmReceipt(p)"
            :disabled="confirming === p.prescription_id"
            class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50"
          >
            {{ confirming === p.prescription_id ? 'Confirming…' : 'Confirm Receipt' }}
          </button>
        </div>
      </div>
      <p v-if="error" role="alert" class="text-sm font-medium text-red-600">{{ error }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { apiFetch } from '../../services/api'
import { stepsFor, stageIndex, statusLabel, isDelivery } from '../../utils/medication.js'

const prescriptions = ref([])
const confirming = ref('')
const error = ref('')

const badgeClass = (p) => {
  if (p.status === 'Cancelled') return 'bg-red-50 text-red-700 ring-red-600/20'
  if (p.status === 'Fulfilled' && (!isDelivery(p) || p.delivered_at)) return 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
  return 'bg-amber-50 text-amber-700 ring-amber-600/20'
}

const load = async () => {
  try { prescriptions.value = await apiFetch('/patient/prescriptions') } catch { prescriptions.value = [] }
}

const confirmReceipt = async (p) => {
  error.value = ''
  confirming.value = p.prescription_id
  try {
    await apiFetch(`/patient/prescriptions/${p.prescription_id}/receipt`, { method: 'POST' })
    await load()
  } catch (err) {
    error.value = err.message || 'Could not confirm receipt.'
  } finally {
    confirming.value = ''
  }
}

onMounted(load)
</script>
