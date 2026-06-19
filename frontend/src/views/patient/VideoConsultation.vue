<template>
  <div>
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-slate-900 tracking-tight">Video Consultation</h1>
        <p class="text-sm text-slate-500">{{ statusLabel }}</p>
      </div>
      <span
        v-if="joined"
        :class="status === 'connected' ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' : 'bg-amber-50 text-amber-700 ring-amber-600/20'"
        class="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset"
      >
        <span :class="status === 'connected' ? 'bg-emerald-500' : 'bg-amber-400 animate-pulse'" class="h-2 w-2 rounded-full"></span>
        {{ status === 'connected' ? 'Connected' : 'Connecting…' }}
      </span>
    </div>

    <!-- Pre-join: the patient's camera does NOT start until the doctor has
         entered the room; then the patient joins automatically. -->
    <div v-if="!joined" class="bg-white border border-slate-200 rounded-2xl shadow-sm p-10 max-w-2xl text-center">
      <div class="flex justify-center mb-5">
        <span class="h-12 w-12 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin"></span>
      </div>
      <p class="text-lg font-semibold text-slate-900">
        {{ doctorReady ? 'Doctor is ready, joining consultation…' : 'Waiting for the doctor to start the consultation…' }}
      </p>
      <p class="text-sm text-slate-500 mt-1">Please keep this page open.</p>

      <p v-if="error" class="mt-4 text-sm font-medium text-red-500">{{ error }}</p>
    </div>

    <!-- In call -->
    <div v-else class="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 max-w-4xl">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <!-- Remote (doctor) -->
        <div class="relative aspect-video bg-slate-900 rounded-xl overflow-hidden border border-slate-800">
          <video ref="remoteVideo" autoplay playsinline class="w-full h-full object-cover"></video>
          <span class="absolute bottom-2 left-2 text-xs font-medium text-white/80 bg-black/40 px-2 py-0.5 rounded">Doctor</span>
          <div v-if="status !== 'connected'" class="absolute inset-0 flex items-center justify-center text-slate-400 text-sm">
            Waiting for the doctor to connect…
          </div>
        </div>

        <!-- Local (patient) -->
        <div class="relative aspect-video bg-slate-900 rounded-xl overflow-hidden border border-slate-800">
          <video ref="localVideo" autoplay playsinline muted class="w-full h-full object-cover transform -scale-x-100"></video>
          <span class="absolute bottom-2 left-2 text-xs font-medium text-white/80 bg-black/40 px-2 py-0.5 rounded">You</span>
        </div>
      </div>

      <p v-if="error" class="mt-4 text-sm font-medium text-red-500">{{ error }}</p>

      <div v-if="videoDevices.length > 1" class="mt-5 flex items-center justify-center gap-2">
        <label class="text-xs font-semibold text-slate-500">Camera</label>
        <select
          :value="selectedDeviceId"
          @change="switchCamera($event.target.value)"
          class="px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        >
          <option v-for="(device, i) in videoDevices" :key="device.deviceId" :value="device.deviceId">
            {{ device.label || `Camera ${i + 1}` }}
          </option>
        </select>
      </div>

      <div class="mt-6 flex justify-center">
        <button
          @click="endCall"
          class="px-6 py-2.5 bg-red-600 text-white text-sm font-semibold rounded-lg shadow-sm hover:bg-red-700"
        >
          Hang Up
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import { ref as dbRef, onValue } from 'firebase/database'
import { db } from '../../firebase'
import { useWebRTC } from '../../composables/useWebRTC'

const route = useRoute()
const router = useRouter()

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000'
const api = axios.create({ baseURL: API_BASE })

const roomId = route.query.room || ''
const error = ref('')

// doctorReady — the doctor has entered the room (their offer exists).
// joined     — the patient has clicked Join and their camera is now live.
const doctorReady = ref(false)
const joined = ref(false)

const localVideo = ref(null)
const remoteVideo = ref(null)

const { localStream, remoteStream, status, videoDevices, selectedDeviceId, switchCamera, start, hangUp } = useWebRTC()

const statusLabel = roomId ? `Consultation room ${roomId}` : 'No active consultation'

// Bind media streams to the <video> elements as they arrive.
watch(localStream, (s) => { if (localVideo.value) localVideo.value.srcObject = s })
watch(remoteStream, (s) => { if (remoteVideo.value) remoteVideo.value.srcObject = s })

let completed = false

const completeConsultation = async () => {
  if (completed || !roomId) return
  completed = true
  try {
    await api.post(`/api/consultations/${roomId}/complete`)
  } catch (err) {
    // Best-effort; the doctor side may have completed it already.
  }
}

// The patient joins only once the doctor is in the room (see the doctorReady
// watcher). Render the in-call view first so the <video> elements exist, then
// start media and bind the streams to them.
const joinConsultation = async () => {
  if (joined.value) return
  joined.value = true
  await nextTick() // ensure the <video> elements are mounted before binding
  try {
    await start(roomId, 'callee')
    // Bind directly as well, in case the streams were set before the watchers
    // could see the (newly rendered) video elements.
    if (localVideo.value) localVideo.value.srcObject = localStream.value
    if (remoteVideo.value) remoteVideo.value.srcObject = remoteStream.value
  } catch (err) {
    error.value = 'Could not access camera/microphone. Check browser permissions.'
  }
}

// Auto-join as soon as the doctor has entered the room (their offer appears).
watch(doctorReady, (ready) => {
  if (ready) joinConsultation()
})

const endCall = async () => {
  hangUp()
  await completeConsultation()
  router.push('/patient/payment')
}

// When the doctor ends the consultation, the backend removes the rooms/{id}
// signaling node. Watch for that removal and end the patient's side too.
let offerListener = null
let roomListener = null
let roomSeen = false

const onDoctorEnded = () => {
  // The doctor already marked the consultation complete; just tear down and
  // route the patient out (skip the redundant /complete call via the guard).
  if (completed) return
  completed = true
  hangUp()
  router.push('/patient/payment')
}

onMounted(() => {
  if (!roomId) {
    error.value = 'No consultation room was provided.'
    return
  }

  // The doctor writes their offer to rooms/{id}/offer the moment they enter the
  // room. Its presence is our signal that the doctor is on, gating the patient's
  // ability to join (and therefore start their camera).
  const offerRef = dbRef(db, `rooms/${roomId}/offer`)
  offerListener = onValue(offerRef, (snap) => {
    if (snap.exists()) doctorReady.value = true
  })

  // Once the room node has been seen, its disappearance means the doctor hung up.
  const roomRef = dbRef(db, `rooms/${roomId}`)
  roomListener = onValue(roomRef, (snap) => {
    if (snap.exists()) {
      roomSeen = true
    } else if (roomSeen) {
      onDoctorEnded()
    }
  })
})

onUnmounted(() => {
  // Navigating away mid-call still tears down media (but does not auto-complete
  // the consultation — that only happens via an explicit Hang Up).
  if (offerListener) offerListener()
  if (roomListener) roomListener()
  hangUp()
})
</script>
