<template>
  <div>
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-slate-900 tracking-tight">Your prescriptions</h1>
      <p class="text-sm text-slate-500 mt-1">Medication your doctor has prescribed for you.</p>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="bg-white border border-slate-200 rounded-2xl shadow-sm p-8 max-w-3xl text-sm text-slate-400">
      Loading your prescriptions…
    </div>

    <!-- Empty -->
    <div v-else-if="prescriptions.length === 0" class="bg-white border border-slate-200 rounded-2xl shadow-sm p-10 text-center max-w-3xl">
      <div class="w-14 h-14 mx-auto rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-2xl" aria-hidden="true">💊</div>
      <h2 class="mt-4 font-bold text-slate-900">No prescriptions yet</h2>
      <p class="mt-1.5 text-sm text-slate-500 max-w-md mx-auto">
        Anything your doctor prescribes during a consultation will appear here.
      </p>
    </div>

    <!-- List -->
    <div v-else class="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden max-w-3xl">
      <div class="px-6 py-4 border-b border-slate-100 bg-indigo-50/50 flex justify-between items-center">
        <div>
          <p class="text-sm font-bold text-slate-900">Prescribed medication</p>
          <p class="text-xs text-slate-500">{{ prescriptions.length }} {{ prescriptions.length === 1 ? 'item' : 'items' }} on record</p>
        </div>
        <span class="text-2xl" aria-hidden="true">💊</span>
      </div>

      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead class="bg-slate-50 text-xs uppercase tracking-wider font-semibold text-slate-500">
            <tr>
              <th class="px-6 py-3">Medication</th>
              <th class="px-6 py-3">Dosage</th>
              <th class="px-6 py-3">Frequency</th>
              <th class="px-6 py-3">Status</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 text-slate-600">
            <tr v-for="item in prescriptions" :key="item.prescription_id" class="hover:bg-slate-50/60 transition-colors">
              <td class="px-6 py-4 font-semibold text-slate-900">{{ item.medication_name }}</td>
              <td class="px-6 py-4">{{ item.dosage }}</td>
              <td class="px-6 py-4">{{ item.frequency }}</td>
              <td class="px-6 py-4">
                <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset"
                  :class="item.status === 'Fulfilled' ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' : 'bg-amber-50 text-amber-700 ring-amber-600/20'">
                  {{ item.status }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { apiFetch } from '../../services/api'

const prescriptions = ref([])
const loading = ref(true)

onMounted(async () => {
  try { prescriptions.value = await apiFetch('/patient/prescriptions') } catch { prescriptions.value = [] }
  finally { loading.value = false }
})
</script>
