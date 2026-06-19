<template>
  <div>
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-slate-900 tracking-tight">Video Consultation</h1>
        <p class="text-sm text-slate-500">{{ statusLabel }}</p>
      </div>
      <span
        :class="status === 'connected' ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' : 'bg-amber-50 text-amber-700 ring-amber-600/20'"
        class="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset"
      >
        <span :class="status === 'connected' ? 'bg-emerald-500' : 'bg-amber-400 animate-pulse'" class="h-2 w-2 rounded-full"></span>
        {{ status === 'connected' ? 'Connected' : 'Connecting…' }}
      </span>
    </div>

    <div class="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 max-w-4xl">
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
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import { useWebRTC } from '../../composables/useWebRTC'

const route = useRoute()
const router = useRouter()

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000'
const api = axios.create({ baseURL: API_BASE })

const roomId = route.query.room || ''
const error = ref('')

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

const endCall = async () => {
  hangUp()
  await completeConsultation()
  router.push('/patient/payment')
}

onMounted(async () => {
  if (!roomId) {
    error.value = 'No consultation room was provided.'
    return
  }
  try {
    await start(roomId, 'callee')
  } catch (err) {
    error.value = 'Could not access camera/microphone. Check browser permissions.'
  }
})

onUnmounted(() => {
  // Navigating away mid-call still tears down media (but does not auto-complete
  // the consultation — that only happens via an explicit Hang Up).
  hangUp()
})
</script>
