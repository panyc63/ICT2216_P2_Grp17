<template>
  <div class="min-h-screen bg-slate-50 font-sans">
    <!-- Patient sub-navigation -->
    <div class="bg-white border-b border-slate-200 sticky top-0 z-40">
      <div class="max-w-5xl mx-auto px-4 sm:px-6">
        <div class="flex items-center justify-between py-3">
          <router-link to="/" class="text-lg font-extrabold tracking-tight text-indigo-600">MediFlow</router-link>
          <div class="flex items-center gap-4">
            <router-link to="/patient/profile" class="text-sm font-medium text-slate-500 hover:text-indigo-600" active-class="text-indigo-600">Profile</router-link>
            <router-link to="/" class="text-sm font-medium text-slate-500 hover:text-indigo-600">Home</router-link>
            <span class="text-sm text-slate-300">|</span>
            <button
              @click="handleLogout"
              class="text-sm font-semibold text-red-500 hover:text-red-600"
            >
              Logout
            </button>
          </div>
        </div>

        <!-- Progress stepper. Read-only: steps are NOT clickable — the patient
             advances only by completing each step in the actual flow. Hidden on
             standalone pages reached from Profile (not part of the flow). -->
        <nav v-if="showStepper" aria-label="Consultation progress" class="overflow-x-auto pb-3">
          <ol class="flex items-center min-w-max">
            <li
              v-for="(step, i) in steps"
              :key="step.label"
              class="flex items-center"
              :class="{ 'flex-1': i < steps.length - 1 }"
            >
              <div class="flex items-center gap-2 shrink-0">
                <span
                  :class="circleClass(i)"
                  class="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold border-2 transition-colors"
                >
                  <span v-if="i < currentIndex">✓</span>
                  <span v-else>{{ i + 1 }}</span>
                </span>
                <span :class="labelClass(i)" class="text-sm whitespace-nowrap">{{ step.label }}</span>
              </div>
              <div
                v-if="i < steps.length - 1"
                class="flex-1 h-0.5 mx-3 rounded min-w-[1.5rem]"
                :class="i < currentIndex ? 'bg-indigo-600' : 'bg-slate-200'"
              ></div>
            </li>
          </ol>
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
import { useAuth } from '../../composables/useAuth'
import { stepsForOrder, currentStepIndex } from '../../utils/orderFlow'

const route = useRoute()
const router = useRouter()
const { clearSession } = useAuth()

const handleLogout = () => {
  // Drop the patient from the queue if still waiting, then clear the session.
  releaseQueueOnExit()
  patientStore.queue.active = false
  stopPolling()
  clearSession()
  router.push('/')
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000'
const api = axios.create({ baseURL: API_BASE })

// Read-only stepper, fully status-driven (Phase 3d): the highlighted step is
// derived from order.status, not the current route. The step definitions and the
// status→index logic live in utils/orderFlow.js (shared with the order-history
// Resume feature). Medical Cert / Track Delivery are NOT steps — they live on
// Profile.
const steps = computed(() => stepsForOrder(patientStore.order))
const currentIndex = computed(() => currentStepIndex(patientStore.order))

// Pages reached from Profile (not part of the sequential flow) hide the stepper.
const HIDE_STEPPER_ON = ['/patient/profile', '/patient/download-mc', '/patient/track-delivery', '/patient/order-history', '/patient/pending-charges']
const showStepper = computed(() => !HIDE_STEPPER_ON.includes(route.path))

const circleClass = (i) => {
  if (i < currentIndex.value) return 'bg-indigo-600 border-indigo-600 text-white'
  if (i === currentIndex.value) return 'bg-white border-indigo-600 text-indigo-600 ring-4 ring-indigo-100'
  return 'bg-white border-slate-300 text-slate-400'
}

const labelClass = (i) => {
  if (i < currentIndex.value) return 'text-slate-900 font-medium'
  if (i === currentIndex.value) return 'text-indigo-700 font-semibold'
  return 'text-slate-400 font-medium'
}

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

// Load the logged-in user's real profile into the shared store, so Profile.vue
// and the delivery address in Prescription.vue reflect actual data.
const loadProfile = async () => {
  const id = patientId()
  if (!id) return
  try {
    const { data } = await api.get(`/api/users/${id}`)
    patientStore.profile.name = data.name || ''
    patientStore.profile.email = data.email || ''
    patientStore.profile.homeAddress = data.home_address || ''
  } catch (err) {
    // Non-fatal — Profile.vue will surface its own error if needed.
  }
}

// Load the patient's order into the store (source of truth for the journey).
// Tries the active (open) order first, then falls back to the most recent one
// so post-flow pages still resolve after the order goes terminal.
const loadOrder = async () => {
  const id = patientId()
  if (!id) return
  try {
    const { data } = await api.get(`/api/orders/active/${id}`)
    patientStore.setOrder(data)
    return
  } catch (err) {
    if (err.response?.status !== 404) return
  }
  try {
    const { data } = await api.get(`/api/orders/latest/${id}`)
    patientStore.setOrder(data)
  } catch (err) {
    // 404 — no order yet; nothing to load.
  }
}

// Keep order.status live so the status-driven stepper tracks server-side
// transitions that happen without a setOrder call (join → InQueue, accept →
// InCall, end → AwaitingFinalization, finalize → AwaitingPayment/Completed).
// Polls only while the stepper is visible and the patient's active flow is
// ongoing — it stops once the order reaches a status the patient won't move past
// on their own (delivery handoff or a terminal state), so it doesn't poll forever.
const ORDER_POLL_DONE = ['AwaitingDelivery', 'Completed', 'Cancelled', 'Refunded']
let orderPollTimer = null

const startOrderPolling = () => {
  if (orderPollTimer) return
  orderPollTimer = setInterval(loadOrder, 4000)
}

const stopOrderPolling = () => {
  if (orderPollTimer) {
    clearInterval(orderPollTimer)
    orderPollTimer = null
  }
}

// Refresh immediately on navigation between flow pages (snappy), and start/stop
// the poller based on whether the stepper is shown and the flow is still moving.
watch(() => route.path, loadOrder)
watch(
  [showStepper, () => patientStore.order.status],
  ([visible, status]) => {
    if (visible && !ORDER_POLL_DONE.includes(status)) startOrderPolling()
    else stopOrderPolling()
  },
  { immediate: true }
)

onMounted(() => {
  window.addEventListener('pagehide', releaseQueueOnExit)
  loadProfile()
  loadOrder()
})

onUnmounted(() => {
  stopPolling()
  stopOrderPolling()
  window.removeEventListener('pagehide', releaseQueueOnExit)
})
</script>
