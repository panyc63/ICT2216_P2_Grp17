<template>
  <div class="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans">
    <aside class="w-full md:w-64 bg-slate-900 text-white p-6 flex flex-col">
      <div class="text-xl font-extrabold tracking-tight text-indigo-400 mb-2">MediFlow Nurse</div>
      <div class="mb-8 border-b border-slate-800 pb-4">
        <p class="text-sm font-bold text-white">{{ nurseName }}</p>
      </div>
      <nav class="space-y-1 flex-1">
        <button @click="router.push({ name: 'NurseDashboard' })" class="w-full text-left px-4 py-2.5 rounded-lg font-medium text-sm transition-colors text-slate-300 hover:bg-slate-800 flex items-center gap-2">🏠 Dashboard Home</button>
        <button @click="router.push({ name: 'NurseQueueView' })" class="w-full text-left px-4 py-2.5 rounded-lg font-medium text-sm transition-colors bg-indigo-600 text-white flex items-center gap-2">📋 Live Queue Monitor</button>
        <button @click="router.push({ name: 'NurseQueueEdit' })" class="w-full text-left px-4 py-2.5 rounded-lg font-medium text-sm transition-colors text-slate-300 hover:bg-slate-800 flex items-center gap-2">⚙️ Manage & Sort Queue</button>
      </nav>
    </aside>

    <main class="flex-1 p-10">
      <div class="mb-6 flex justify-between items-center">
        <div>
          <h1 class="text-2xl font-bold text-slate-900">Live Active Patient Queue</h1>
          <p class="text-sm text-slate-500">Real-time tracker showing floor assignments and diagnostic waiting lists.</p>
        </div>
        <span class="bg-emerald-50 text-emerald-700 text-xs px-3 py-1 rounded-full font-semibold animate-pulse border border-emerald-200">System Dynamic Feed Active</span>
      </div>

      <p v-if="error" role="alert" class="mb-4 text-sm font-medium text-red-600">{{ error }}</p>

      <div class="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <table class="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead class="bg-slate-50 font-semibold text-slate-700">
            <tr>
              <th class="px-6 py-3">Sequence</th>
              <th class="px-6 py-3">Patient Identity</th>
              <th class="px-6 py-3">Assigned Provider</th>
              <th class="px-6 py-3">Triage Priority</th>
              <th class="px-6 py-3">Workflow State</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-200 text-slate-600">
            <tr v-for="(patient, index) in patientQueue" :key="patient.id" class="hover:bg-slate-50/40">
              <td class="px-6 py-4 font-mono font-bold text-slate-400">#0{{ index + 1 }}</td>
              <td class="px-6 py-4 font-semibold text-slate-900">{{ patient.patientName }}</td>
              <td class="px-6 py-4">{{ patient.assignedDoctor }}</td>
              <td class="px-6 py-4">
                <span :class="[
                  patient.priority === 'Emergency' ? 'bg-red-50 text-red-700 ring-red-600/10' :
                  patient.priority === 'Urgent' ? 'bg-amber-50 text-amber-700 ring-amber-600/10' :
                  'bg-slate-50 text-slate-600 ring-slate-600/10'
                ]" class="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset">
                  {{ patient.priority }}
                </span>
              </td>
              <td class="px-6 py-4">
                <span class="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                  <span :class="patient.status === 'In consultation' ? 'bg-indigo-600 animate-pulse' : 'bg-amber-400'" class="h-2 w-2 rounded-full"></span>
                  {{ patient.status }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </main>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { apiFetch } from '../../services/api'

const router = useRouter()

// Queue Pipeline
const patientQueue = ref([])
const nurseName = ref('Nurse')
const error = ref('')

onMounted(async () => {
  try { const me = await apiFetch('/me'); nurseName.value = me.user?.name || 'Nurse' } catch { /* not signed in */ }
  try {
    const data = await apiFetch('/nurse/queue')
    patientQueue.value = data.map((item) => ({
      id: item.triage_id,
      patientName: item.patient_name,
      assignedDoctor: item.assigned_doctor_id || 'Unassigned',
      priority: item.priority_score,
      status: item.status
    }))
  } catch (err) {
    error.value = err.message || 'Could not load the queue.'
  }
})
</script>
