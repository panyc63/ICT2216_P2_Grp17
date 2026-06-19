<template>
  <div>
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-slate-900 tracking-tight">Consultation Queue</h1>
      <p class="text-sm text-slate-500">You can browse other tabs while you wait — you'll be connected automatically when it's your turn.</p>
    </div>

    <div class="bg-white border border-slate-200 rounded-2xl shadow-sm p-8 max-w-2xl">
      <!-- Waiting in the queue -->
      <div v-if="position !== null" class="text-center py-6">
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

      <div class="mt-8 flex justify-center">
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
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { patientStore } from '../../store/patientStore'

const router = useRouter()

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000'
const api = axios.create({ baseURL: API_BASE })

// Identity comes from the logged-in session (store, falling back to
// localStorage for a hard refresh). No session means no queue.
const patientId = patientStore.patientId || localStorage.getItem('userId') || ''

// Position/total are kept current by the poller in PatientLayout, which keeps
// running even when this page is unmounted (patient on another tab).
const position = computed(() => patientStore.queue.position)
const total = computed(() => patientStore.queue.total)

// Rough estimate: 3 minutes per person ahead of you.
const estimatedWait = computed(() => (position.value ? position.value * 3 : 0))

const error = ref('')

const leaveQueue = async () => {
  // Flip the shared flag first so PatientLayout stops polling immediately.
  patientStore.queue.active = false
  patientStore.queue.position = null
  patientStore.queue.total = 0
  if (patientId) {
    try {
      await api.delete(`/api/queue/leave/${patientId}`)
    } catch (err) {
      // Best-effort cleanup — a 404 just means we were already removed.
    }
  }
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
    // 409 means we're already queued — that's fine; anything else is a real error.
    if (err.response?.status !== 409) {
      error.value = err.response?.data?.error || 'Unable to join the queue.'
      return
    }
  }

  // Hand polling/acceptance off to the persistent poller in PatientLayout.
  // Navigating to another tab no longer removes us from the queue.
  patientStore.queue.active = true
})
</script>
