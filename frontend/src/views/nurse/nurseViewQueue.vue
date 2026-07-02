<template>
  <div class="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans">
    <aside class="w-full md:w-64 bg-slate-900 text-white p-5 flex md:flex-col md:min-h-screen">
      <div class="flex items-center gap-2.5 mb-8">
        <div class="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black shrink-0">M</div>
        <div class="leading-tight">
          <p class="text-sm font-extrabold tracking-tight text-white">MediFlow</p>
          <p class="text-[11px] font-medium text-indigo-300">Nurse Console</p>
        </div>
      </div>

      <div class="mb-6 hidden md:block rounded-xl bg-slate-800/60 border border-slate-800 px-3 py-3">
        <p class="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Signed in as</p>
        <p class="text-sm font-bold text-white mt-0.5 truncate">{{ nurseName }}</p>
      </div>

      <nav class="space-y-1 flex-1">
        <button
          @click="router.push({ name: 'NurseDashboard' })"
          class="w-full text-left px-3 py-2.5 rounded-lg font-medium text-sm transition-colors flex items-center gap-2.5 text-slate-400 hover:bg-slate-800 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
        >
          <span aria-hidden="true">🏠</span> Dashboard
        </button>
        <button
          @click="router.push({ name: 'NurseQueueView' })"
          class="w-full text-left px-3 py-2.5 rounded-lg font-medium text-sm transition-colors flex items-center gap-2.5 bg-indigo-600 text-white shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
        >
          <span aria-hidden="true">📋</span> Live queue
        </button>
        <button
          @click="router.push({ name: 'NurseQueueEdit' })"
          class="w-full text-left px-3 py-2.5 rounded-lg font-medium text-sm transition-colors flex items-center gap-2.5 text-slate-400 hover:bg-slate-800 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
        >
          <span aria-hidden="true">⚙️</span> Manage queue
        </button>
      </nav>
    </aside>

    <main class="flex-1 p-6 sm:p-10 overflow-y-auto">
      <div class="max-w-5xl mf-animate-in">
        <div class="mb-6 flex flex-wrap gap-3 justify-between items-start">
          <div>
            <h1 class="text-2xl font-bold text-slate-900 tracking-tight">Live queue</h1>
            <p class="text-sm text-slate-500 mt-1">Everyone currently waiting, shown in priority order.</p>
          </div>
          <span class="inline-flex items-center gap-1.5 bg-white text-slate-600 text-xs px-3 py-1.5 rounded-full font-semibold border border-slate-200">
            <span class="h-2 w-2 rounded-full bg-emerald-500"></span>
            {{ patientQueue.length }} in queue
          </span>
        </div>

        <p v-if="error" role="alert" class="mb-4 text-sm font-medium text-rose-600">{{ error }}</p>

        <div class="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <table class="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead class="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th class="px-6 py-3">#</th>
                <th class="px-6 py-3">Patient</th>
                <th class="px-6 py-3">Doctor</th>
                <th class="px-6 py-3">Priority</th>
                <th class="px-6 py-3">Status</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 text-slate-600">
              <tr v-for="(patient, index) in patientQueue" :key="patient.id" class="hover:bg-slate-50/60 transition-colors">
                <td class="px-6 py-4 font-mono font-semibold text-slate-400">{{ String(index + 1).padStart(2, '0') }}</td>
                <td class="px-6 py-4 font-semibold text-slate-900">{{ patient.patientName }}</td>
                <td class="px-6 py-4">
                  <span v-if="patient.hasDoctor" class="text-slate-700">{{ patient.assignedDoctor }}</span>
                  <span v-else class="text-slate-400">Unassigned</span>
                </td>
                <td class="px-6 py-4">
                  <span :class="[
                    patient.priority === 'Emergency' ? 'bg-rose-50 text-rose-700 ring-rose-600/10' :
                    patient.priority === 'Urgent' ? 'bg-amber-50 text-amber-700 ring-amber-600/10' :
                    'bg-slate-50 text-slate-600 ring-slate-600/10'
                  ]" class="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset">
                    {{ patient.priority }}
                  </span>
                </td>
                <td class="px-6 py-4">
                  <span class="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                    <span :class="[statusMeta(patient.status).dot, statusMeta(patient.status).pulse ? 'animate-pulse' : '']" class="h-2 w-2 rounded-full"></span>
                    {{ statusMeta(patient.status).label }}
                  </span>
                </td>
              </tr>
              <tr v-if="!patientQueue.length && !error">
                <td colspan="5" class="px-6 py-14 text-center">
                  <div class="text-3xl mb-2">🕊️</div>
                  <p class="text-sm font-semibold text-slate-700">The queue is clear</p>
                  <p class="text-xs text-slate-400 mt-0.5">Patients appear here after they submit the pre-consultation questionnaire.</p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
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
      hasDoctor: !!item.assigned_doctor_id,
      assignedDoctor: item.assigned_doctor_id || 'Unassigned',
      priority: item.priority_score,
      status: item.status
    }))
  } catch (err) {
    error.value = err.message || 'Could not load the queue.'
  }
})

// Map the real triage statuses (Waiting / Called / InConsultation) to a friendly
// label and status dot. Purely presentational — does not change queue data.
const statusMeta = (status) => {
  switch (status) {
    case 'Called': return { label: 'Called in', dot: 'bg-sky-500', pulse: true }
    case 'InConsultation': return { label: 'In consultation', dot: 'bg-indigo-600', pulse: true }
    case 'Waiting': return { label: 'Waiting', dot: 'bg-amber-400', pulse: false }
    default: return { label: status || 'Unknown', dot: 'bg-slate-400', pulse: false }
  }
}
</script>
