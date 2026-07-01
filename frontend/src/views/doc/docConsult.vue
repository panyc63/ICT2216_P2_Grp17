<template>
  <div class="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans">
    <aside class="w-full md:w-64 bg-slate-900 text-white p-6 flex flex-col">
      <div class="text-xl font-extrabold tracking-tight text-indigo-400 mb-2">MediFlow Portal</div>
      <div class="mb-8 border-b border-slate-800 pb-4">
        <p class="text-xs text-slate-400 font-semibold uppercase tracking-wider">Logged In As</p>
        <p class="text-sm font-bold text-white mt-1">{{ currentUser.name }}</p>
        <span class="inline-flex items-center rounded-md bg-indigo-500/10 text-indigo-400 px-2 py-0.5 text-xs font-medium ring-1 ring-inset ring-indigo-500/20 mt-1">
          {{ currentUser.role }}
        </span>
      </div>

      <nav class="space-y-1 flex-1">
        <button @click="router.push({ name: 'DocDashboard' })" :class="[route.name === 'DocDashboard' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800']" class="w-full text-left px-4 py-2.5 rounded-lg font-medium text-sm transition-colors flex items-center gap-2"><span>🏠</span> Dashboard Home</button>
        <button @click="router.push({ name: 'DocConsult' })" :class="[route.name === 'DocConsult' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800']" class="w-full text-left px-4 py-2.5 rounded-lg font-medium text-sm transition-colors flex items-center gap-2"><span>🎥</span> Live Stream Rooms</button>
        <button @click="router.push({ name: 'DocPrescribe' })" :class="[route.name === 'DocPrescribe' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800']" class="w-full text-left px-4 py-2.5 rounded-lg font-medium text-sm transition-colors flex items-center gap-2"><span>📝</span> Rx Prescriptions</button>
      </nav>
      
      <button @click="handleLogout" class="text-left text-red-400 hover:bg-slate-800 px-4 py-2 rounded-lg font-medium text-sm transition-colors">
        Logout
      </button>
    </aside>

    <main class="flex-1 p-10">
      <div class="mb-6 flex gap-2 border-b border-slate-200">
        <button @click="activeTab = 'my-consultations'" :class="[activeTab === 'my-consultations' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700']" class="px-4 py-2 -mb-px border-b-2 text-sm font-semibold">My Active Sessions</button>
        <button @click="activeTab = 'history'" :class="[activeTab === 'history' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700']" class="px-4 py-2 -mb-px border-b-2 text-sm font-semibold">Past History &amp; Logs</button>
      </div>

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
          <div v-for="room in filteredConsultations" :key="room.consultation_id" class="bg-white border border-slate-200 p-6 rounded-xl shadow-sm flex flex-col justify-between">
            <div>
              <div class="flex justify-between items-start mb-4">
                <div>
                  <h4 class="font-bold text-slate-900">{{ room.consultation_id }}</h4>
                  <p class="text-xs text-slate-400 mt-0.5">Patient: {{ room.patient_name }}</p>
                </div>
                <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset"
                  :class="room.session_status === 'Active' ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' : 'bg-amber-50 text-amber-700 ring-amber-600/20'">
                  {{ room.session_status }}
                </span>
              </div>
              <div class="space-y-2 border-t border-slate-100 pt-3 mb-6">
                <p class="text-sm text-slate-600">
                  <span class="font-semibold text-slate-700">Assigned:</span> {{ room.doctor_id ? 'You' : 'Unassigned' }}
                </p>
              </div>
            </div>

            <div class="flex flex-wrap gap-2">
              <button v-if="!room.doctor_id && room.session_status === 'Pending'" @click="act(room, 'claim')" class="flex-1 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white font-medium text-sm rounded-lg">Claim</button>
              <button v-if="room.doctor_id && room.session_status === 'Pending'" @click="act(room, 'start')" class="flex-1 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-lg">Start</button>
              <button v-if="room.session_status === 'Active'" @click="act(room, 'complete')" class="flex-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm rounded-lg">Complete</button>
              <button v-if="room.doctor_id" @click="toggleChat(room.consultation_id)" class="flex-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-sm rounded-lg">
                {{ openChatId === room.consultation_id ? 'Hide Chat' : 'Chat' }}
              </button>
              <button v-if="room.doctor_id" @click="toggleVideo(room.consultation_id)" class="flex-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-sm rounded-lg">
                {{ openVideoId === room.consultation_id ? 'Hide Video' : 'Video' }}
              </button>
              <button v-if="room.doctor_id && room.session_status !== 'Cancelled'" @click="prescribeFor(room)" class="flex-1 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold text-sm rounded-lg">Prescribe</button>
            </div>
            <div v-if="openChatId === room.consultation_id" class="mt-4">
              <ChatPanel :consultation-id="room.consultation_id" />
            </div>
            <div v-if="openVideoId === room.consultation_id" class="mt-4">
              <VideoConsult :consultation-id="room.consultation_id" role="Doctor" />
            </div>
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
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { apiFetch, logout } from '../../services/api'
import ChatPanel from '../../components/ChatPanel.vue'
import VideoConsult from '../../components/VideoConsult.vue'

const router = useRouter()
const route = useRoute()
const activeTab = ref('my-consultations')

// Jump straight to prescribing for the patient you're treating, with the
// consultation pre-selected on the prescribe screen.
const prescribeFor = (room) => {
  router.push({ name: 'DocPrescribe', query: { consultationId: room.consultation_id } })
}
const openChatId = ref('')
const openVideoId = ref('')
const toggleChat = (id) => { openChatId.value = openChatId.value === id ? '' : id }
const toggleVideo = (id) => { openVideoId.value = openVideoId.value === id ? '' : id }

const currentUser = ref({ name: '', role: 'Doctor' })
const consultations = ref([])
// Recording archive is delivered in the WebRTC phase; show none until then.
const recordings = ref([])

const loadMe = async () => {
  try {
    const me = await apiFetch('/me')
    currentUser.value = { name: me.user?.name || '', role: me.user?.role || 'Doctor' }
  } catch { /* not signed in */ }
}

const loadConsultations = async () => {
  try {
    consultations.value = await apiFetch('/consultations')
  } catch {
    consultations.value = []
  }
}

onMounted(async () => {
  await loadMe()
  await loadConsultations()
})

// Backend already scopes the list to this doctor (assigned + pending pool).
const filteredConsultations = computed(() => consultations.value)
const filteredRecordings = computed(() => recordings.value)

const act = async (room, action) => {
  try {
    await apiFetch(`/consultations/${room.consultation_id}`, {
      method: 'PATCH',
      body: JSON.stringify({ action }),
    })
    await loadConsultations()
  } catch (err) {
    alert(err.message || `Could not ${action} the consultation.`)
  }
}

const handleLogout = () => {
  logout(router)
}
</script>
