<template>
  <div>
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-slate-900 tracking-tight">Active Prescription</h1>
      <p class="text-sm text-slate-500">Medication prescribed for you in your most recent consultation.</p>
    </div>

    <div class="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden max-w-3xl">
      <div class="bg-slate-900 text-white px-6 py-4 flex justify-between items-center">
        <div>
          <p class="text-sm font-semibold">Prescribed by {{ prescription.doctor }}</p>
          <p class="text-xs text-slate-400">Issued {{ prescription.issuedDate }}</p>
        </div>
        <span class="inline-flex items-center rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-medium text-emerald-300 ring-1 ring-inset ring-emerald-500/30">
          Active
        </span>
      </div>

      <table class="min-w-full divide-y divide-slate-200 text-left text-sm">
        <thead class="bg-slate-50 font-semibold text-slate-700">
          <tr>
            <th class="px-6 py-3">Medication</th>
            <th class="px-6 py-3">Dosage</th>
            <th class="px-6 py-3">Frequency</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 text-slate-600">
          <tr v-for="item in prescription.items" :key="item.name">
            <td class="px-6 py-4 font-medium text-slate-900">{{ item.name }}</td>
            <td class="px-6 py-4">{{ item.dosage }}</td>
            <td class="px-6 py-4">{{ item.frequency }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const prescription = ref({
  doctor: 'Dr. John Doe',
  issuedDate: '18 Jun 2026',
  items: [
    { name: 'Amoxicillin', dosage: '500 mg', frequency: '3 times daily, after meals' },
    { name: 'Paracetamol', dosage: '500 mg', frequency: 'Every 6 hours as needed' },
    { name: 'Loratadine', dosage: '10 mg', frequency: 'Once daily' }
  ]
})
</script>
