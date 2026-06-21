<template>
  <div class="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
    <div class="max-w-xl mx-auto bg-white border border-slate-200 rounded-2xl shadow-sm p-8">
      <h2 class="text-2xl font-bold text-slate-900 tracking-tight mb-2">Pre-Flight Hardware Check</h2>
      <p class="text-slate-500 text-sm mb-6">Verify your peripheral audio and video connection settings before starting your consultation stream.</p>

      <div class="aspect-video bg-slate-900 rounded-xl mb-6 overflow-hidden flex items-center justify-center border border-slate-800 relative">
        <video ref="videoElement" autoplay playsinline class="w-full h-full object-cover transform -scale-x-100"></video>
        <div v-if="!streamActive" class="absolute text-slate-400 font-medium text-sm">
          [ Video Input Stream Offline ]
        </div>
      </div>

      <div class="mb-8">
        <label class="block text-sm font-semibold text-slate-700 mb-2">Microphone Activity Level</label>
        <div class="h-3 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200">
          <div :style="{ width: micVolume + '%' }" class="h-full bg-emerald-500 transition-all duration-75"></div>
        </div>
      </div>

      <div class="flex gap-4">
        <button @click="testHardwareDevices" class="flex-1 py-2.5 px-4 border border-slate-300 rounded-lg shadow-sm text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 focus:outline-none">
          Initialize Devices
        </button>
        <button @click="proceedToDashboard" :disabled="!streamActive" class="flex-1 py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:pointer-events-none">
          Proceed to Workspace
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const videoElement = ref(null)
const streamActive = ref(false)
const micVolume = ref(0)
let mediaStream = null

const testHardwareDevices = async () => {
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    
    if (videoElement.value) {
      videoElement.value.srcObject = mediaStream
      streamActive.value = true
      
      simulateAudioInputLevel()
    }
  } catch (error) {
    console.error("Hardware access declined:", error)
    alert("Could not access camera/microphone. Check browser permission blocks.")
  }
}

const simulateAudioInputLevel = () => {
  if (!streamActive.value) return
  setInterval(() => {
    micVolume.value = Math.floor(Math.random() * 40) + 10 
  }, 150)
}

const proceedToDashboard = () => {
  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop())
  }
  router.push('/admin-dashboard')
}
</script>