<template>
  <div class="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans">
    <aside class="w-full md:w-64 bg-slate-900 text-white p-6 flex flex-col">
      <div class="text-xl font-extrabold tracking-tight text-indigo-400 mb-2">MediFlow Nurse</div>
      <div class="mb-8 border-b border-slate-800 pb-4">
        <p class="text-sm font-bold text-white">{{ nurseName }}</p>
      </div>
      <nav class="space-y-1 flex-1">
        <button @click="router.push({ name: 'NurseDashboard' })" class="w-full text-left px-4 py-2.5 rounded-lg font-medium text-sm transition-colors text-slate-300 hover:bg-slate-800 flex items-center gap-2">🏠 Dashboard Home</button>
        <button @click="router.push({ name: 'NurseQueueView' })" class="w-full text-left px-4 py-2.5 rounded-lg font-medium text-sm transition-colors text-slate-300 hover:bg-slate-800 flex items-center gap-2">📋 Live Queue Monitor</button>
        <button @click="router.push({ name: 'NurseQueueEdit' })" class="w-full text-left px-4 py-2.5 rounded-lg font-medium text-sm transition-colors bg-indigo-600 text-white flex items-center gap-2">⚙️ Manage &amp; Sort Queue</button>
      </nav>
      <button @click="handleLogout" class="text-left text-red-400 hover:bg-slate-800 px-4 py-2 rounded-lg font-medium text-sm transition-colors">Logout</button>
    </aside>

    <main class="flex-1 p-10 space-y-6">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Queue Management</h1>
        <p class="text-sm text-slate-500">Assign a doctor, adjust priority, and move patients through triage. Patients enter the queue by submitting the pre-consultation questionnaire.</p>
      </div>

      <p v-if="error" role="alert" class="text-sm font-medium text-red-600">{{ error }}</p>

      <div class="bg-white border border-slate-200 rounded-xl shadow-sm overflow-x-auto">
        <table class="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead class="bg-slate-100 font-semibold text-slate-600">
            <tr>
              <th scope="col" class="px-6 py-3">Patient</th>
              <th scope="col" class="px-6 py-3">Assigned Doctor</th>
              <th scope="col" class="px-6 py-3">Priority</th>
              <th scope="col" class="px-6 py-3">Status</th>
              <th scope="col" class="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-200 text-slate-600">
            <tr v-for="row in queue" :key="row.triage_id" class="hover:bg-slate-50/50">
              <td class="px-6 py-4 font-medium text-slate-900">{{ row.patient_name }}</td>
              <td class="px-6 py-4">
                <select :value="row.assigned_doctor_id || ''" @change="assignDoctor(row, $event.target.value)" aria-label="Assign doctor" class="px-2 py-1 border border-slate-300 rounded-md text-xs bg-white">
                  <option value="">Unassigned</option>
                  <option v-for="d in doctors" :key="d.user_id" :value="d.user_id">{{ d.name }}</option>
                </select>
              </td>
              <td class="px-6 py-4">
                <select :value="row.priority_score" @change="setPriority(row, $event.target.value)" aria-label="Set priority" class="px-2 py-1 border border-slate-300 rounded-md text-xs bg-white">
                  <option value="Routine">Routine</option>
                  <option value="Urgent">Urgent</option>
                  <option value="Emergency">Emergency</option>
                </select>
              </td>
              <td class="px-6 py-4 text-xs font-semibold">{{ row.status }}</td>
              <td class="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                <button v-if="row.status === 'Waiting'" @click="setStatus(row, 'Called')" class="text-indigo-700 bg-indigo-50 hover:bg-indigo-100 text-xs font-bold px-2 py-1 rounded">Call</button>
                <button v-if="row.status === 'Called'" @click="setStatus(row, 'InConsultation')" class="text-emerald-700 bg-emerald-50 hover:bg-emerald-100 text-xs font-bold px-2 py-1 rounded">Start</button>
                <button @click="setStatus(row, 'Discharged')" class="text-red-600 hover:text-red-800 text-xs font-medium">Discharge</button>
              </td>
            </tr>
            <tr v-if="!queue.length">
              <td colspan="5" class="px-6 py-10 text-center text-slate-400">Queue is empty.</td>
            </tr>
          </tbody>
        </table>
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
