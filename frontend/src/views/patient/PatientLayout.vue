<template>
  <div class="min-h-screen bg-slate-50 font-sans">
    <!-- Patient sub-navigation -->
    <div class="bg-white border-b border-slate-200 sticky top-0 z-40">
      <div class="max-w-5xl mx-auto px-4 sm:px-6">
        <div class="flex items-center justify-between py-3">
          <div class="text-lg font-extrabold tracking-tight text-indigo-600">MediFlow</div>
          <div class="text-sm text-slate-500">Patient Portal</div>
        </div>
        <nav class="flex gap-1 overflow-x-auto pb-2 -mb-px">
          <router-link
            v-for="link in navLinks"
            :key="link.to"
            :to="link.to"
            class="whitespace-nowrap px-3 py-1.5 rounded-lg text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            active-class="bg-indigo-600 text-white hover:bg-indigo-600 hover:text-white"
          >
            {{ link.label }}
          </router-link>
        </nav>
      </div>
    </div>

    <!-- Persistent queue banner: shown on any tab while the patient is waiting,
         so they can hop around and still jump back into the queue. -->
    <div v-if="showQueueBanner" class="bg-indigo-600 text-white">
      <div class="max-w-5xl mx-auto px-4 sm:px-6 py-2 flex items-center justify-between gap-4">
        <span class="text-sm font-medium">
          <span class="inline-block h-2 w-2 rounded-full bg-white animate-pulse mr-2 align-middle"></span>
          You're in the consultation queue<template v-if="patientStore.queue.position"> — position #{{ patientStore.queue.position }}</template>. You'll be connected automatically.
        </span>
        <button
          @click="router.push('/patient/queue')"
          class="shrink-0 text-sm font-semibold bg-white/15 hover:bg-white/25 px-3 py-1 rounded-lg transition-colors"
        >
          Return to queue
        </button>
      </div>
    </div>

    <!-- Active patient view -->
    <main class="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <router-view></router-view>
    </main>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import { patientStore } from '../../store/patientStore'

const route = useRoute()
const router = useRouter()

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000'
const api = axios.create({ baseURL: API_BASE })

const navLinks = [
  { to: '/patient/profile', label: 'Profile' },
  { to: '/patient/questionnaire', label: 'Start Consultation' },
  { to: '/patient/medication-collection', label: 'Medication' },
  { to: '/patient/payment', label: 'Payment' },
  { to: '/patient/prescription', label: 'Prescription' },
  { to: '/patient/download-mc', label: 'Medical Cert' },
  { to: '/patient/track-delivery', label: 'Track Delivery' }
]

// The banner is redundant on the queue page itself and the live call.
const showQueueBanner = computed(() =>
  patientStore.queue.active &&
  route.path !== '/patient/queue' &&
  route.path !== '/patient/video-consultation'
)

// Queue polling lives here (in the always-mounted layout) rather than in the
// Queue page, so it keeps running while the patient is on any other tab. When
// a doctor accepts, we route into the call from wherever the patient is.
let pollTimer = null

const patientId = () => patientStore.patientId || localStorage.getItem('userId') || ''

const poll = async () => {
  const id = patientId()
  if (!id) return
  try {
    const { data } = await api.get(`/api/queue/status/${id}`)
    if (data.status === 'accepted' && data.room_id) {
      patientStore.queue.active = false
      stopPolling()
      router.push({ path: '/patient/video-consultation', query: { room: data.room_id } })
      return
    }
    patientStore.queue.position = data.position
    patientStore.queue.total = data.total
  } catch (err) {
    // 404 — no longer in the queue (left, or the consultation already ended).
    if (err.response?.status === 404) {
      patientStore.queue.active = false
      stopPolling()
    }
  }
}

const startPolling = () => {
  if (pollTimer) return
  poll()
  pollTimer = setInterval(poll, 3000)
}

const stopPolling = () => {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

// Start/stop polling as queue membership changes (Queue.vue flips `active`).
watch(() => patientStore.queue.active, (active) => {
  if (active) startPolling()
  else stopPolling()
})

// Remove the patient from the queue if they close or refresh the tab while
// still waiting. keepalive lets the DELETE finish after the page begins
// unloading (sendBeacon can't be used — it only issues POSTs, and the leave
// endpoint is a DELETE). Switching between in-app tabs does NOT trigger this;
// only a real page unload (close/refresh/navigate-away) does.
const releaseQueueOnExit = () => {
  if (!patientStore.queue.active) return
  const id = patientId()
  if (!id) return
  fetch(`${API_BASE}/api/queue/leave/${id}`, { method: 'DELETE', keepalive: true })
}

onMounted(() => {
  window.addEventListener('pagehide', releaseQueueOnExit)
})

onUnmounted(() => {
  stopPolling()
  window.removeEventListener('pagehide', releaseQueueOnExit)
})
</script>
