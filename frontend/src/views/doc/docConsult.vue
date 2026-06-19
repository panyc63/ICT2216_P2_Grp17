<template>
  <div class="min-h-screen bg-slate-50 flex font-sans">
    <aside class="w-64 bg-slate-900 text-white p-6 flex flex-col">
      <div class="text-xl font-extrabold tracking-tight text-indigo-400 mb-2">MediHealth Hub</div>
      <div class="mb-8 border-b border-slate-800 pb-4">
        <p class="text-xs text-slate-400 font-semibold uppercase tracking-wider">Practitioner Portal</p>
        <p class="text-sm font-bold text-white mt-1">{{ currentDoctor.name }}</p>
        <p class="text-xs text-slate-400 italic mt-0.5">{{ doctorId || 'Not signed in' }}</p>
      </div>

      <nav class="space-y-1 flex-1">
        <button @click="router.push({ name: 'DocDashboard' })" class="w-full text-left px-4 py-2.5 rounded-lg font-medium text-sm transition-colors text-slate-300 hover:bg-slate-800 flex items-center gap-2"><span>🏠</span> Dashboard Home</button>
        <button class="w-full text-left px-4 py-2.5 rounded-lg font-medium text-sm transition-colors bg-indigo-600 text-white flex items-center gap-2"><span>🎥</span> Live Stream Rooms</button>
        <button @click="router.push({ name: 'DocPrescribe' })" class="w-full text-left px-4 py-2.5 rounded-lg font-medium text-sm transition-colors text-slate-300 hover:bg-slate-800 flex items-center gap-2"><span>📝</span> Rx Prescriptions</button>
      </nav>

      <button @click="handleLogout" class="text-left text-red-400 hover:bg-slate-800 px-4 py-2 rounded-lg font-medium text-sm transition-colors">Logout</button>
    </aside>

    <main class="flex-1 p-10">
      <div class="mb-6 flex justify-between items-center">
        <div>
          <h1 class="text-2xl font-bold text-slate-900">Live Patient Queue</h1>
          <p class="text-sm text-slate-500">Accept a waiting patient to open a video consultation room.</p>
        </div>
        <span class="bg-emerald-50 text-emerald-700 text-xs px-3 py-1 rounded-full font-semibold animate-pulse border border-emerald-200">Live Feed</span>
      </div>

      <div v-if="queue.length === 0" class="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-sm">
        <div class="text-3xl mb-3">🩺</div>
        <h3 class="text-md font-semibold text-slate-900 mb-1">No patients in the queue</h3>
        <p class="text-sm text-slate-500">Waiting patients will appear here in real time.</p>
      </div>

      <div v-else class="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <table class="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead class="bg-slate-50 font-semibold text-slate-700">
            <tr>
              <th class="px-6 py-3">#</th>
              <th class="px-6 py-3">Patient ID</th>
              <th class="px-6 py-3">Priority</th>
              <th class="px-6 py-3">Waiting Since</th>
              <th class="px-6 py-3">State</th>
              <th class="px-6 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-200 text-slate-600">
            <tr v-for="(patient, index) in queue" :key="patient.key" class="hover:bg-slate-50/40">
              <td class="px-6 py-4 font-mono font-bold text-slate-400">{{ index + 1 }}</td>
              <td class="px-6 py-4 font-semibold text-slate-900">{{ patient.patient_id }}</td>
              <td class="px-6 py-4">
                <span :class="[
                  patient.priority_score === 'emergency' ? 'bg-red-50 text-red-700 ring-red-600/10' :
                  patient.priority_score === 'urgent' ? 'bg-amber-50 text-amber-700 ring-amber-600/10' :
                  'bg-slate-50 text-slate-600 ring-slate-600/10'
                ]" class="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset capitalize">
                  {{ patient.priority_score }}
                </span>
              </td>
              <td class="px-6 py-4 text-xs text-slate-400">{{ formatTime(patient.timestamp) }}</td>
              <td class="px-6 py-4">
                <span v-if="patient.room_id" class="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600">
                  <span class="h-2 w-2 rounded-full bg-indigo-600 animate-pulse"></span> In consultation
                </span>
                <span v-else class="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600">
                  <span class="h-2 w-2 rounded-full bg-amber-400"></span> Waiting
                </span>
              </td>
              <td class="px-6 py-4 text-right">
                <button
                  v-if="!patient.room_id"
                  @click="acceptPatient(patient.patient_id)"
                  :disabled="accepting"
                  class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm disabled:opacity-50"
                >
                  Accept &amp; Start
                </button>
                <button
                  v-else
                  @click="rejoinRoom(patient.room_id)"
                  class="px-3 py-1.5 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50"
                >
                  Rejoin Room
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p v-if="error" class="mt-4 text-sm font-medium text-red-500">{{ error }}</p>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'

const router = useRouter()

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000'
const api = axios.create({ baseURL: API_BASE })

const doctorId = localStorage.getItem('userId') || ''
const currentDoctor = ref({ name: 'Practitioner' })

const queue = ref([])
const error = ref('')
const accepting = ref(false)

let pollTimer = null

const formatTime = (ts) => {
  if (!ts) return '—'
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const fetchQueue = async () => {
  try {
    const { data } = await api.get('/api/queue/list')
    queue.value = data
    error.value = ''
  } catch (err) {
    error.value = err.response?.data?.error || 'Unable to load the queue.'
  }
}

const acceptPatient = async (patientId) => {
  if (!doctorId) {
    error.value = 'You must be signed in as a doctor to accept patients.'
    return
  }
  accepting.value = true
  try {
    const { data } = await api.post('/api/consultations/accept', {
      doctor_id: doctorId,
      patient_id: patientId
    })
    router.push({ path: '/doc-consult-room', query: { room: data.room_id } })
  } catch (err) {
    error.value = err.response?.data?.error || 'Could not accept this patient.'
  } finally {
    accepting.value = false
  }
}

const rejoinRoom = (roomId) => {
  router.push({ path: '/doc-consult-room', query: { room: roomId } })
}

const handleLogout = () => {
  localStorage.clear()
  router.push('/')
}

onMounted(async () => {
  await fetchQueue()
  pollTimer = setInterval(fetchQueue, 3000)
})

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer)
})
</script>
