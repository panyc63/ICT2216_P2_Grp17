<template>
  <div>
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-slate-900 tracking-tight">Medication Status</h1>
      <p class="text-sm text-slate-500">Track each prescription from issue to collection / dispatch.</p>
    </div>

    <div v-if="!prescriptions.length" class="bg-white border border-slate-200 rounded-2xl shadow-sm p-10 text-center text-slate-400 max-w-xl">
      No prescriptions to track yet.
    </div>

    <div v-else class="space-y-4 max-w-xl">
      <div v-for="p in prescriptions" :key="p.prescription_id" class="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
        <div class="flex items-center justify-between mb-4">
          <p class="text-sm font-bold text-slate-900">{{ p.medication_name }}</p>
          <span class="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset" :class="badgeClass(p.status)">
            {{ p.status }}
          </span>
        </div>
        <ol class="flex items-center">
          <li v-for="(step, i) in steps" :key="step" class="flex items-center" :class="i < steps.length - 1 ? 'flex-1' : ''">
            <span
              class="flex h-7 w-7 items-center justify-center rounded-full border-2 text-[11px] font-bold shrink-0"
              :class="i <= stageIndex(p.status) ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-300 text-slate-400'"
            >
              <span v-if="i < stageIndex(p.status)">✓</span><span v-else>{{ i + 1 }}</span>
            </span>
            <span v-if="i < steps.length - 1" class="h-0.5 flex-1 mx-1" :class="i < stageIndex(p.status) ? 'bg-indigo-600' : 'bg-slate-200'"></span>
          </li>
        </ol>
        <div class="flex justify-between mt-1.5 text-[11px] text-slate-500">
          <span v-for="step in steps" :key="step">{{ step }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { apiFetch } from '../../services/api'

const prescriptions = ref([])
const steps = ['Prescribed', 'Preparing', 'Ready']

// Derive progress from the real prescription status (Cancelled stays at the start).
const stageIndex = (status) => (status === 'Fulfilled' ? 2 : status === 'Cancelled' ? 0 : 1)
const badgeClass = (status) =>
  status === 'Fulfilled'
    ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
    : status === 'Cancelled'
      ? 'bg-red-50 text-red-700 ring-red-600/20'
      : 'bg-amber-50 text-amber-700 ring-amber-600/20'

onMounted(async () => {
  try { prescriptions.value = await apiFetch('/patient/prescriptions') } catch { prescriptions.value = [] }
})
</script>
