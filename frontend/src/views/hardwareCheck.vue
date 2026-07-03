<template>
  <div class="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
    <div class="max-w-xl mx-auto bg-white border border-slate-200 rounded-2xl shadow-sm p-6 sm:p-8 animate-fade-up">
      <div class="flex items-center gap-3 mb-2">
        <span class="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl" aria-hidden="true">🎥</span>
        <h1 class="text-2xl font-bold text-slate-900 tracking-tight">Check your camera and mic</h1>
      </div>
      <p class="text-slate-500 text-sm mb-6">
        Let's make sure everything's working before your video consultation. It only takes a moment.
      </p>

      <div class="aspect-video bg-slate-900 rounded-xl mb-6 overflow-hidden flex items-center justify-center border border-slate-800 relative">
        <video ref="videoElement" autoplay playsinline class="w-full h-full object-cover transform -scale-x-100"></video>
        <div v-if="!streamActive" class="absolute flex flex-col items-center text-slate-400 text-sm">
          <span class="text-2xl mb-1" aria-hidden="true">📷</span>
          Your camera preview will appear here
        </div>
        <span v-if="streamActive" class="absolute top-2 left-2 inline-flex items-center gap-1.5 text-[11px] font-semibold text-white bg-emerald-600/90 rounded-full px-2.5 py-1">
          <span class="w-1.5 h-1.5 rounded-full bg-white" aria-hidden="true"></span> Camera on
        </span>
      </div>

      <div class="mb-8">
        <label class="block text-sm font-semibold text-slate-700 mb-2">Microphone level</label>
        <div class="h-3 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200" role="meter" aria-label="Microphone level" :aria-valuenow="micVolume" aria-valuemin="0" aria-valuemax="100">
          <div :style="{ width: micVolume + '%' }" class="h-full bg-emerald-500 transition-all duration-75"></div>
        </div>
        <p class="text-xs text-slate-400 mt-2">Say something — you should see the bar move.</p>
      </div>

      <div class="flex flex-col sm:flex-row gap-3">
        <button @click="testHardwareDevices" class="flex-1 py-2.5 px-4 border border-slate-300 rounded-xl shadow-sm text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
          Test camera &amp; mic
        </button>
        <button @click="proceedToDashboard" :disabled="!streamActive" class="flex-1 py-2.5 px-4 rounded-xl shadow-sm text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:pointer-events-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2">
          Continue
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { getCurrentSession, dashboardForRole } from '../services/api'

const router = useRouter()
const videoElement = ref(null)
const streamActive = ref(false)
const micVolume = ref(0)
let mediaStream = null
let audioContext = null
let rafId = null

const testHardwareDevices = async () => {
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    if (videoElement.value) videoElement.value.srcObject = mediaStream
    streamActive.value = true
    startMicMeter()
  } catch (error) {
    console.error('Hardware access declined:', error)
    alert('We couldn’t access your camera or microphone. Please allow access in your browser settings and try again.')
  }
}

// Real microphone level via the Web Audio API (replaces the previous random simulation).
const startMicMeter = () => {
  audioContext = new (window.AudioContext || window.webkitAudioContext)()
  const source = audioContext.createMediaStreamSource(mediaStream)
  const analyser = audioContext.createAnalyser()
  analyser.fftSize = 512
  source.connect(analyser)
  const data = new Uint8Array(analyser.frequencyBinCount)
  const tick = () => {
    analyser.getByteFrequencyData(data)
    const avg = data.reduce((sum, v) => sum + v, 0) / data.length
    micVolume.value = Math.min(100, Math.round((avg / 255) * 200))
    rafId = requestAnimationFrame(tick)
  }
  tick()
}

const cleanup = () => {
  if (rafId) cancelAnimationFrame(rafId)
  rafId = null
  if (audioContext) { audioContext.close(); audioContext = null }
  if (mediaStream) { mediaStream.getTracks().forEach((track) => track.stop()); mediaStream = null }
}

const proceedToDashboard = async () => {
  cleanup()
  const session = await getCurrentSession()
  router.push(session?.user ? dashboardForRole(session.user.role) : '/login')
}

onBeforeUnmount(cleanup)
</script>
