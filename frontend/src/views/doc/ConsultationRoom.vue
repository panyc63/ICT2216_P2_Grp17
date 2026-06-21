<template>
  <div class="min-h-screen bg-slate-950 flex flex-col font-sans">
    <header class="flex items-center justify-between px-8 py-4 border-b border-slate-800">
      <div>
        <h1 class="text-lg font-bold text-white tracking-tight">Consultation Room</h1>
        <p class="text-xs text-slate-400">{{ roomId ? `Room ${roomId}` : 'No room' }}</p>
      </div>
      <span
        :class="status === 'connected' ? 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30' : 'bg-amber-500/15 text-amber-300 ring-amber-500/30'"
        class="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset"
      >
        <span :class="status === 'connected' ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'" class="h-2 w-2 rounded-full"></span>
        {{ status === 'connected' ? 'Connected' : 'Waiting for patient…' }}
      </span>
    </header>

    <main class="flex-1 p-8">
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 max-w-6xl mx-auto">
        <!-- Remote (patient) -->
        <div class="relative aspect-video bg-black rounded-xl overflow-hidden border border-slate-800">
          <video ref="remoteVideo" autoplay playsinline class="w-full h-full object-cover"></video>
          <span class="absolute bottom-2 left-2 text-xs font-medium text-white/80 bg-black/40 px-2 py-0.5 rounded">Patient</span>
          <div v-if="status !== 'connected'" class="absolute inset-0 flex items-center justify-center text-slate-500 text-sm">
            Waiting for the patient to join…
          </div>
        </div>

        <!-- Local (doctor) -->
        <div class="relative aspect-video bg-black rounded-xl overflow-hidden border border-slate-800">
          <video ref="localVideo" autoplay playsinline muted class="w-full h-full object-cover transform -scale-x-100"></video>
          <span class="absolute bottom-2 left-2 text-xs font-medium text-white/80 bg-black/40 px-2 py-0.5 rounded">You</span>
        </div>
      </div>

      <p v-if="error" class="mt-4 text-center text-sm font-medium text-red-400">{{ error }}</p>

      <div v-if="videoDevices.length > 1" class="mt-6 flex items-center justify-center gap-2">
        <label class="text-xs font-semibold text-slate-400">Camera</label>
        <select
          :value="selectedDeviceId"
          @change="switchCamera($event.target.value)"
          class="px-3 py-1.5 border border-slate-700 bg-slate-900 text-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        >
          <option v-for="(device, i) in videoDevices" :key="device.deviceId" :value="device.deviceId">
            {{ device.label || `Camera ${i + 1}` }}
          </option>
        </select>
      </div>

      <div class="mt-8 flex justify-center">
        <button
          @click="endCall"
          class="px-6 py-2.5 bg-red-600 text-white text-sm font-semibold rounded-lg shadow-sm hover:bg-red-700"
        >
          End Consultation
        </button>
      </div>
    </main>
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

watch(localStream, (s) => { if (localVideo.value) localVideo.value.srcObject = s })
watch(remoteStream, (s) => { if (remoteVideo.value) remoteVideo.value.srcObject = s })

let ended = false

const endCall = async () => {
  hangUp()
  // Release the patient immediately (tear down room + queue); the consultation
  // is NOT marked Completed here. The order sits in AwaitingFinalization until
  // the doctor finalizes it later from the Admin Orders screen — no forced
  // finalize step, so they're free to take the next patient.
  if (!ended && roomId) {
    ended = true
    try {
      await api.post(`/api/consultations/${roomId}/end`)
    } catch (err) {
      // Best-effort — the patient may have already hung up.
    }
  }
  router.push({ name: 'DocConsult' })
}

onMounted(async () => {
  if (!roomId) {
    error.value = 'No consultation room was provided.'
    return
  }
  try {
    await start(roomId, 'caller')
  } catch (err) {
    error.value = 'Could not access camera/microphone. Check browser permissions.'
  }
})

onUnmounted(() => {
  hangUp()
})
</script>
