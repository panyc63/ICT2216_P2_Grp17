<template>
  <div>
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-slate-900 tracking-tight">Active Prescription</h1>
      <p class="text-sm text-slate-500">Medication prescribed for you in your most recent consultation.</p>
    </div>

    <div class="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden max-w-3xl">
      <div class="bg-slate-900 text-white px-6 py-4 flex justify-between items-center">
        <div>
          <p class="text-sm font-semibold">Your Prescriptions</p>
          <p class="text-xs text-slate-400">{{ prescriptions.length }} on record</p>
        </div>
      </div>

      <table class="min-w-full divide-y divide-slate-200 text-left text-sm">
        <thead class="bg-slate-50 font-semibold text-slate-700">
          <tr>
            <th class="px-6 py-3">Medication</th>
            <th class="px-6 py-3">Dosage</th>
            <th class="px-6 py-3">Frequency</th>
            <th class="px-6 py-3">Status</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 text-slate-600">
          <tr v-for="item in prescriptions" :key="item.prescription_id">
            <td class="px-6 py-4 font-medium text-slate-900">{{ item.medication_name }}</td>
            <td class="px-6 py-4">{{ item.dosage }}</td>
            <td class="px-6 py-4">{{ item.frequency }}</td>
            <td class="px-6 py-4">
              <span class="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset"
                :class="item.status === 'Fulfilled' ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' : 'bg-amber-50 text-amber-700 ring-amber-600/20'">
                {{ item.status }}
              </span>
            </td>
          </tr>
          <tr v-if="prescriptions.length === 0">
            <td colspan="4" class="px-6 py-10 text-center text-slate-400">No prescriptions on record.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { apiFetch } from '../../services/api'

const prescriptions = ref([])

onMounted(async () => {
  try { prescriptions.value = await apiFetch('/patient/prescriptions') } catch { prescriptions.value = [] }
})
</script>
