<template>
  <div class="min-h-screen bg-slate-50 flex font-sans">
    <aside class="w-64 bg-slate-900 text-white p-6 flex flex-col">
      <div class="text-xl font-extrabold tracking-tight text-indigo-400 mb-2">MediFlow Nurse</div>
      <div class="mb-8 border-b border-slate-800 pb-4">
        <p class="text-sm font-bold text-white">Nurse Clara Oswald</p>
      </div>
      <nav class="space-y-1 flex-1">
        <button @click="router.push({ name: 'NurseDashboard' })" class="w-full text-left px-4 py-2.5 rounded-lg font-medium text-sm transition-colors text-slate-300 hover:bg-slate-800 flex items-center gap-2">🏠 Dashboard Home</button>
        <button @click="router.push({ name: 'NurseQueueView' })" class="w-full text-left px-4 py-2.5 rounded-lg font-medium text-sm transition-colors text-slate-300 hover:bg-slate-800 flex items-center gap-2">📋 Live Queue Monitor</button>
        <button @click="router.push({ name: 'NurseQueueEdit' })" class="w-full text-left px-4 py-2.5 rounded-lg font-medium text-sm transition-colors bg-indigo-600 text-white flex items-center gap-2">⚙️ Manage & Sort Queue</button>
      </nav>
    </aside>

    <main class="flex-1 p-10 space-y-8">
      <div class="flex justify-between items-center">
        <div>
          <h1 class="text-2xl font-bold text-slate-900">Queue Administrative Controls</h1>
          <p class="text-sm text-slate-500">Perform onboarding processing and alter active triage line positioning hierarchies.</p>
        </div>
      </div>

      <div class="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
        <h3 class="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4">Patient Check-In Entry Intake</h3>
        <form @submit.prevent="addPatientToQueue" class="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase">Patient Name</label>
            <input v-model="newPatient.name" type="text" required class="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md text-sm" placeholder="Bruce Wayne" />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase">Assign Medical Officer</label>
            <select v-model="newPatient.doctor" class="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white">
              <option value="Unassigned">Leave Unassigned</option>
              <option value="Dr. John Doe">Dr. John Doe</option>
              <option value="Dr. Sarah Lin">Dr. Sarah Lin</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase">Triage Code Level</label>
            <select v-model="newPatient.priority" class="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white">
              <option value="Routine">Routine (Low)</option>
              <option value="Urgent">Urgent (Medium)</option>
              <option value="Emergency">Emergency (High)</option>
            </select>
          </div>
          <button type="submit" class="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-md shadow-sm transition-colors">
            Inject into Queue
          </button>
        </form>
      </div>

      <div class="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div class="p-4 bg-slate-50 border-b border-slate-200">
          <h3 class="text-xs font-bold text-slate-700 uppercase tracking-wider">Active Sorting Workspace</h3>
        </div>
        <table class="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead class="bg-slate-100 font-semibold text-slate-600">
            <tr>
              <th class="px-6 py-2">Patient</th>
              <th class="px-6 py-2">Assigned Officer</th>
              <th class="px-6 py-2">Priority State</th>
              <th class="px-6 py-2 text-right">Administrative Execution</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-200 text-slate-600">
            <tr v-for="patient in patientQueue" :key="patient.id" class="hover:bg-slate-50/50">
              <td class="px-6 py-4 font-medium text-slate-900">{{ patient.patientName }}</td>
              <td class="px-6 py-4 text-xs">{{ patient.assignedDoctor }}</td>
              <td class="px-6 py-4 text-xs font-semibold">{{ patient.priority }}</td>
              <td class="px-6 py-4 text-right space-x-3">
                <button v-if="patient.status === 'Waiting in Lobby'" @click="callToConsultation(patient.id)" class="text-indigo-600 hover:text-indigo-900 text-xs font-bold bg-indigo-50 px-2 py-1 rounded">Call Room</button>
                <button @click="dischargePatient(patient.id)" class="text-red-600 hover:text-red-900 text-xs font-medium">Discharge</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

// Baseline dataset
const patientQueue = ref([
  { id: 1, patientName: 'Michael Chang', assignedDoctor: 'Dr. John Doe', priority: 'Urgent', status: 'In consultation' },
  { id: 2, patientName: 'Emma Watson', assignedDoctor: 'Dr. Sarah Lin', priority: 'Routine', status: 'In consultation' },
  { id: 3, patientName: 'Eleanor Vance', assignedDoctor: 'Dr. John Doe', priority: 'Emergency', status: 'Waiting in Lobby' },
  { id: 4, patientName: 'Marcus Aurelius', assignedDoctor: 'Unassigned', priority: 'Routine', status: 'Waiting in Lobby' }
])

const newPatient = ref({ name: '', doctor: 'Unassigned', priority: 'Routine' })

// Action logic methods
const addPatientToQueue = () => {
  patientQueue.value.push({
    id: Date.now(),
    patientName: newPatient.value.name,
    assignedDoctor: newPatient.value.doctor,
    priority: newPatient.value.priority,
    status: 'Waiting in Lobby'
  })
  newPatient.value = { name: '', doctor: 'Unassigned', priority: 'Routine' }
}

const callToConsultation = (id) => {
  const target = patientQueue.value.find(p => p.id === id)
  if (target) target.status = 'In consultation'
}

const dischargePatient = (id) => {
  patientQueue.value = patientQueue.value.filter(p => p.id !== id)
}
</script>