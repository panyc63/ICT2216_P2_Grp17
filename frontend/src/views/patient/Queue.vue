<template>
  <div>
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-slate-900 tracking-tight">Consultation Queue</h1>
      <p class="text-sm text-slate-500">Please keep this page open — you'll be connected automatically when it's your turn.</p>
    </div>

    <div class="bg-white border border-slate-200 rounded-2xl shadow-sm p-8 max-w-2xl">
      <!-- Doctor accepted: brief hand-off message before routing to the call -->
      <div v-if="accepted" class="text-center py-10">
        <div class="flex justify-center mb-5">
          <span class="h-12 w-12 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin"></span>
        </div>
        <p class="text-lg font-semibold text-slate-900">Doctor is ready, joining consultation...</p>
      </div>

      <!-- Still waiting in the queue -->
      <div v-else-if="position !== null" class="text-center py-6">
        <div class="flex items-center justify-center gap-2 mb-6">
          <span class="h-3 w-3 rounded-full bg-indigo-600 animate-ping"></span>
          <span class="text-sm font-medium text-slate-500">Waiting...</span>
        </div>

        <p class="text-4xl font-bold text-slate-900 tracking-tight">You are #{{ position }} in the queue</p>
        <p class="text-sm text-slate-500 mt-2">{{ total }} {{ total === 1 ? 'patient' : 'patients' }} in queue</p>

        <div class="mt-6 inline-block bg-indigo-50 border border-indigo-100 rounded-xl px-5 py-3">
          <p class="text-sm font-semibold text-indigo-700">Estimated wait: ~{{ estimatedWait }} minutes</p>
        </div>
      </div>

      <!-- Initial load, before the first status comes back -->
      <div v-else class="text-center py-10">
        <div class="flex items-center justify-center gap-2">
          <span class="h-3 w-3 rounded-full bg-indigo-600 animate-ping"></span>
          <span class="text-sm font-medium text-slate-500">Joining the queue...</span>
        </div>
      </div>

      <p v-if="error" class="mt-4 text-sm font-medium text-red-500 text-center">{{ error }}</p>

      <div v-if="!accepted" class="mt-8 flex justify-center">
        <button
          @click="leaveQueue"
          class="px-5 py-2.5 border border-slate-300 text-slate-700 text-sm font-semibold rounded-lg shadow-sm bg-white hover:bg-slate-50"
        >
          Leave Queue
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { patientStore } from '../../store/patientStore'

const router = useRouter()

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000'
const api = axios.create({ baseURL: API_BASE })

// Identity comes from the logged-in session (store, falling back to
// localStorage for a hard refresh). No session means no queue.
const patientId = patientStore.patientId || localStorage.getItem('userId') || ''

const position = ref(null)
const total = ref(0)
const error = ref('')
const accepted = ref(false)

// Rough estimate: 3 minutes per person ahead of you.
const estimatedWait = computed(() => (position.value ? position.value * 3 : 0))

let pollTimer = null
let hasLeft = false   // guard so we don't double-hit the leave endpoint

const fetchStatus = async () => {
  try {
    const { data } = await api.get(`/api/queue/status/${patientId}`)
    error.value = ''

    // A doctor has accepted us — the status now carries a room id.
    if (data.status === 'accepted' && data.room_id) {
      acceptConsultation(data.room_id)
      return
    }

    position.value = data.position
    total.value = data.total
  } catch (err) {
    error.value = err.response?.data?.error || 'Unable to fetch queue status.'
  }
}

const acceptConsultation = (roomId) => {
  if (accepted.value) return
  accepted.value = true
  stopPolling()
  // We're leaving the queue for the call; don't let unmount cleanup remove the
  // accepted entry (the backend clears it when the consultation completes).
  hasLeft = true
  // Brief hand-off pause, then move into the consultation room.
  setTimeout(() => {
    router.push({ path: '/patient/video-consultation', query: { room: roomId } })
  }, 2000)
}

const stopPolling = () => {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

const leaveQueueRequest = async () => {
  if (hasLeft || !patientId) return
  hasLeft = true
  try {
    await api.delete(`/api/queue/leave/${patientId}`)
  } catch (err) {
    // Best-effort cleanup — a 404 just means we were already removed.
  }
}

const leaveQueue = async () => {
  stopPolling()
  await leaveQueueRequest()
  router.push('/patient/profile')
}

onMounted(async () => {
  // Without a logged-in identity there's nothing to queue — send to login.
  if (!patientId) {
    router.push('/login')
    return
  }

  try {
    await api.post('/api/queue/join', { patient_id: patientId, priority_score: 'normal' })
  } catch (err) {
    // 409 means we're already queued — that's fine, just start polling.
    if (err.response?.status !== 409) {
      error.value = err.response?.data?.error || 'Unable to join the queue.'
    }
  }

  await fetchStatus()
  pollTimer = setInterval(fetchStatus, 3000)
})

onUnmounted(() => {
  // Clean up if the patient navigated away without using "Leave Queue".
  stopPolling()
  leaveQueueRequest()
})
</script>
