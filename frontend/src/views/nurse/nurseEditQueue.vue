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
          class="w-full text-left px-3 py-2.5 rounded-lg font-medium text-sm transition-colors flex items-center gap-2.5 text-slate-400 hover:bg-slate-800 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
        >
          <span aria-hidden="true">📋</span> Live queue
        </button>
        <button
          @click="router.push({ name: 'NurseQueueEdit' })"
          class="w-full text-left px-3 py-2.5 rounded-lg font-medium text-sm transition-colors flex items-center gap-2.5 bg-indigo-600 text-white shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
        >
          <span aria-hidden="true">⚙️</span> Manage queue
        </button>
      </nav>

      <button @click="handleLogout" class="hidden md:flex items-center gap-2 text-left text-rose-300 hover:text-white hover:bg-rose-500/10 px-3 py-2.5 rounded-lg font-medium text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400">
        <span aria-hidden="true">↩</span> Sign out
      </button>
      <button @click="handleLogout" class="md:hidden ml-auto text-rose-300 hover:text-white px-3 py-2 rounded-lg font-medium text-sm">Sign out</button>
    </aside>

    <main class="flex-1 p-6 sm:p-10 overflow-y-auto">
      <div class="max-w-5xl space-y-6 mf-animate-in">
        <div>
          <h1 class="text-2xl font-bold text-slate-900 tracking-tight">Manage queue</h1>
          <p class="text-sm text-slate-500 mt-1">Assign a doctor, adjust priority, and move patients through triage. Patients enter the queue by submitting the pre-consultation questionnaire.</p>
        </div>

        <p v-if="error" role="alert" class="text-sm font-medium text-rose-600">{{ error }}</p>

        <div class="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-x-auto">
          <table class="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead class="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th scope="col" class="px-6 py-3">Patient</th>
                <th scope="col" class="px-6 py-3">Assigned doctor</th>
                <th scope="col" class="px-6 py-3">Priority</th>
                <th scope="col" class="px-6 py-3">Status</th>
                <th scope="col" class="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 text-slate-600">
              <tr v-for="row in queue" :key="row.triage_id" class="hover:bg-slate-50/60 transition-colors">
                <td class="px-6 py-4 font-semibold text-slate-900">{{ row.patient_name }}</td>
                <td class="px-6 py-4">
                  <select :value="row.assigned_doctor_id || ''" @change="assignDoctor(row, $event.target.value)" aria-label="Assign doctor" class="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500">
                    <option value="">Unassigned</option>
                    <option v-for="d in doctors" :key="d.user_id" :value="d.user_id">{{ d.name }}</option>
                  </select>
                </td>
                <td class="px-6 py-4">
                  <select :value="row.priority_score" @change="setPriority(row, $event.target.value)" aria-label="Set priority" class="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500">
                    <option value="Routine">Routine</option>
                    <option value="Urgent">Urgent</option>
                    <option value="Emergency">Emergency</option>
                  </select>
                </td>
                <td class="px-6 py-4">
                  <span :class="[
                    row.status === 'InConsultation' ? 'bg-indigo-50 text-indigo-700 ring-indigo-600/10' :
                    row.status === 'Called' ? 'bg-sky-50 text-sky-700 ring-sky-600/10' :
                    'bg-amber-50 text-amber-700 ring-amber-600/10'
                  ]" class="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset">
                    {{ row.status === 'InConsultation' ? 'In consultation' : row.status === 'Called' ? 'Called in' : row.status }}
                  </span>
                </td>
                <td class="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                  <button v-if="row.status === 'Waiting'" @click="setStatus(row, 'Called')" class="text-indigo-700 bg-indigo-50 hover:bg-indigo-100 text-xs font-bold px-2.5 py-1 rounded-lg transition-colors">Call in</button>
                  <button v-if="row.status === 'Called'" @click="setStatus(row, 'InConsultation')" class="text-emerald-700 bg-emerald-50 hover:bg-emerald-100 text-xs font-bold px-2.5 py-1 rounded-lg transition-colors">Start visit</button>
                  <button @click="setStatus(row, 'Discharged')" class="text-rose-600 hover:text-rose-800 hover:bg-rose-50 text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors">Discharge</button>
                </td>
              </tr>
              <tr v-if="!queue.length">
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
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { apiFetch, logout } from '../../services/api'

const router = useRouter()
const nurseName = ref('Nurse')
const queue = ref([])
const doctors = ref([])
const error = ref('')

const load = async () => {
  try {
    queue.value = await apiFetch('/nurse/queue')
  } catch (err) {
    error.value = err.message || 'Could not load the queue.'
  }
}

onMounted(async () => {
  try { const me = await apiFetch('/me'); nurseName.value = me.user?.name || 'Nurse' } catch { /* not signed in */ }
  try { doctors.value = await apiFetch('/doctors') } catch { doctors.value = [] }
  await load()
})

const patch = async (row, body) => {
  error.value = ''
  try {
    await apiFetch(`/nurse/queue/${row.triage_id}`, { method: 'PATCH', body: JSON.stringify(body) })
    await load()
  } catch (err) {
    error.value = err.message || 'Update failed.'
    await load()
  }
}
const assignDoctor = (row, doctorId) => { if (doctorId) patch(row, { assignedDoctorId: doctorId }) }
const setPriority = (row, priority) => patch(row, { priority })
const setStatus = (row, status) => patch(row, { status })

const handleLogout = () => { logout(router) }
</script>
