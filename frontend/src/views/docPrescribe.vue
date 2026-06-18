<template>
  <div class="min-h-screen bg-slate-50 flex font-sans">
    <aside class="w-64 bg-slate-900 text-white p-6 flex flex-col">
      <div class="text-xl font-extrabold tracking-tight text-indigo-400 mb-2">MediHealth Portal</div>
      <div class="mb-8 border-b border-slate-800 pb-4">
        <p class="text-xs text-slate-400 font-semibold uppercase tracking-wider">Logged In As</p>
        <p class="text-sm font-bold text-white mt-1">{{ currentUser.name }}</p>
        <span class="inline-flex items-center rounded-md bg-indigo-500/10 text-indigo-400 px-2 py-0.5 text-xs font-medium ring-1 ring-inset ring-indigo-500/20 mt-1">
          {{ currentUser.role }}
        </span>
      </div>

      <nav class="space-y-1 flex-1">
        <button @click="activeTab = 'my-consultations'" :class="[activeTab === 'my-consultations' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800']" class="w-full text-left px-4 py-2.5 rounded-lg font-medium text-sm transition-colors">
          My Active Sessions
        </button>
        <button @click="activeTab = 'history'" :class="[activeTab === 'history' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800']" class="w-full text-left px-4 py-2.5 rounded-lg font-medium text-sm transition-colors">
          Past History & Logs
        </button>
      </nav>
      
      <button @click="handleLogout" class="text-left text-red-400 hover:bg-slate-800 px-4 py-2 rounded-lg font-medium text-sm transition-colors">
        Logout
      </button>
    </aside>

    <main class="flex-1 p-10">
      
      <div v-if="activeTab === 'my-consultations'">
        <div class="mb-6">
          <h1 class="text-2xl font-bold text-slate-900">Your Consultations</h1>
          <p class="text-sm text-slate-500">Manage, join, and track live telehealth instances tied to your credential baseline.</p>
        </div>

        <div v-if="filteredConsultations.length === 0" class="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-sm">
          <div class="text-3xl mb-3">📅</div>
          <h3 class="text-md font-semibold text-slate-900 mb-1">No Active Consultations Found</h3>
          <p class="text-sm text-slate-500">You have no live streaming rooms scheduled or running at this present moment.</p>
        </div>

        <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div v-for="room in filteredConsultations" :key="room.id" class="bg-white border border-slate-200 p-6 rounded-xl shadow-sm flex flex-col justify-between">
            <div>
              <div class="flex justify-between items-start mb-4">
                <div>
                  <h4 class="font-bold text-slate-900">Room Token: {{ room.id }}</h4>
                  <p class="text-xs text-slate-400 mt-0.5">Network Stream Health: {{ room.latency }}ms</p>
                </div>
                <span class="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20 animate-pulse">Live</span>
              </div>
              
              <div class="space-y-2 border-t border-slate-100 pt-3 mb-6">
                <p class="text-sm text-slate-600">
                  <span class="font-semibold text-slate-700">Practitioner:</span> {{ room.doctor }}
                </p>
                <p class="text-sm text-slate-600">
                  <span class="font-semibold text-slate-700">Patient Target:</span> {{ room.patient }}
                </p>
              </div>
            </div>

            <button @click="joinRoom(room.id)" class="w-full text-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-lg shadow-sm transition-colors">
              Launch Telehealth Stream
            </button>
          </div>
        </div>
      </div>

      <div v-if="activeTab === 'history'">
        <div class="mb-6">
          <h1 class="text-2xl font-bold text-slate-900">Personal Recording Archive</h1>
          <p class="text-sm text-slate-500">Authorized local playbacks for video streams matching your user context.</p>
        </div>

        <div v-if="filteredRecordings.length === 0" class="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-500">
          No prior recorded historical elements found for your account profile.
        </div>

        <div v-else class="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden divide-y divide-slate-100">
          <div v-for="video in filteredRecordings" :key="video.id" class="p-4 flex justify-between items-center hover:bg-slate-50">
            <div class="flex items-center gap-3">
              <div class="text-xl">📹</div>
              <div>
                <p class="text-sm font-semibold text-slate-900">{{ video.fileName }}</p>
                <p class="text-xs text-slate-400">Timestamp: {{ video.date }} | Storage Footprint: {{ video.size }}</p>
              </div>
            </div>
            <button class="text-xs font-semibold bg-slate-100 text-slate-700 px-3 py-1.5 rounded border border-slate-300 hover:bg-slate-200 transition-colors">
              Request Playback
            </button>
          </div>
        </div>
      </div>

    </main>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const activeTab = ref('my-consultations')

// Simulated application current user state (This can be derived from your Pinia store or localStorage)
const currentUser = ref({
  name: 'Dr. John Doe',
  role: 'Doctor' // Swap with 'Patient' or alternative names to see pipeline filters adapt dynamically
})

// Global Mock Master Pipelines (simulating data coming from your backend entity models)
const consultations = ref([
  { id: 'ROOM-77X', doctor: 'Dr. John Doe', patient: 'Michael Chang', latency: 12 },
  { id: 'ROOM-42B', doctor: 'Dr. Sarah Lin', patient: 'Emma Watson', latency: 18 },
  { id: 'ROOM-99A', doctor: 'Dr. John Doe', patient: 'Eleanor Vance', latency: 15 }
])

const recordings = ref([
  { id: 101, fileName: 'REC_DR_JOHN_DOE_MICHAEL_20260614.mp4', doctor: 'Dr. John Doe', date: '2026-06-14 09:22', size: '142.4 MB' },
  { id: 102, fileName: 'REC_DR_SARAH_LIN_EMMA_20260615.mp4', doctor: 'Dr. Sarah Lin', date: '2026-06-15 14:45', size: '98.1 MB' },
  { id: 103, fileName: 'REC_DR_JOHN_DOE_ELEANOR_20260616.mp4', doctor: 'Dr. John Doe', date: '2026-06-16 11:10', size: '114.7 MB' }
])

// Computed property: Filters out consultations where the current user is either the doctor or the patient
const filteredConsultations = computed(() => {
  return consultations.value.filter(room => {
    return room.doctor === currentUser.value.name || room.patient === currentUser.value.name
  })
})

// Computed property: Filters recordings tied explicitly to this specific user context
const filteredRecordings = computed(() => {
  return recordings.value.filter(video => {
    return video.doctor === currentUser.value.name || video.patient === currentUser.value.name
  })
})

// Telehealth Interactive Action Mock
const joinRoom = (roomId) => {
  alert(`Connecting down to streaming pipeline room: ${roomId}`)
  // Implementation pattern: router.push(`/telehealth/room/${roomId}`)
}

const handleLogout = () => {
  localStorage.clear()
  router.push('/')
}
</script>