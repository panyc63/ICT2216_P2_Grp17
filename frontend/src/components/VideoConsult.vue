<template>
  <div class="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
    <div class="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
      <h4 class="text-sm font-bold text-slate-900">Video Consultation</h4>
      <span class="text-xs" :class="callActive ? 'text-emerald-600' : 'text-slate-400'">{{ status }}</span>
    </div>

    <div class="grid grid-cols-2 gap-2 p-3 bg-slate-900">
      <div class="relative">
        <video ref="remoteVideo" autoplay playsinline class="w-full aspect-video bg-slate-800 rounded-lg object-cover"></video>
        <span class="absolute bottom-1 left-2 text-[10px] text-white/80">Remote</span>
      </div>
      <div class="relative">
        <video ref="localVideo" autoplay playsinline muted class="w-full aspect-video bg-slate-800 rounded-lg object-cover transform -scale-x-100"></video>
        <span class="absolute bottom-1 left-2 text-[10px] text-white/80">You</span>
      </div>
    </div>

    <div class="p-3 flex items-center gap-3 flex-wrap">
      <label v-if="isDoctor && !callActive" class="flex items-center gap-2 text-xs text-slate-600">
        <input type="checkbox" v-model="consent" class="rounded border-slate-300">
        Patient consents to session-recording metadata
      </label>
      <button
        v-if="!callActive"
        @click="start"
        :disabled="busy || (isDoctor && !consent)"
        class="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {{ busy ? 'Connecting…' : (isDoctor ? 'Start Call' : 'Join Call') }}
      </button>
      <button v-else @click="hangUp" class="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700">
        Hang up
      </button>
      <p v-if="error" role="alert" class="text-xs text-red-600">{{ error }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onBeforeUnmount } from 'vue'
import { apiFetch } from '../services/api'

// 1:1 WebRTC: the doctor is the caller (creates the offer), the patient answers.
// Media is P2P DTLS-SRTP; only SDP/ICE signalling crosses our same-origin API.
const props = defineProps({
  consultationId: { type: String, required: true },
  role: { type: String, default: 'Patient' },
})
const isDoctor = props.role === 'Doctor'

const localVideo = ref(null)
const remoteVideo = ref(null)
const status = ref('Not connected')
const callActive = ref(false)
const busy = ref(false)
const consent = ref(false)
const error = ref('')

let pc = null
let localStream = null
let pollTimer = null
let connectTimer = null
let hasTurn = false
let lastSignalId = 0
let remoteSet = false
const pendingCandidates = []

// How long to wait for the peer connection to reach a connected state before we
// tell the user the network almost certainly needs a TURN relay.
const CONNECT_TIMEOUT_MS = 20000

const sendSignal = (kind, payload) =>
  apiFetch(`/consultations/${props.consultationId}/signal`, {
    method: 'POST',
    body: JSON.stringify({ kind, payload: JSON.stringify(payload) }),
  })

const clearConnectTimer = () => { if (connectTimer) { clearTimeout(connectTimer); connectTimer = null } }

// Called on ICE 'failed' or when the connect timeout elapses without a connection.
const onConnectTrouble = () => {
  clearConnectTimer()
  if (!pc || pc.connectionState === 'connected' || pc.connectionState === 'completed') return
  status.value = 'Not connected'
  error.value = hasTurn
    ? 'Couldn’t connect to the other party. Please check both sides’ network/firewall and try again.'
    : 'Couldn’t establish a direct connection — this network needs a TURN relay, which the clinic must configure before video calls work across networks.'
  // Stop polling a call that will not connect so it can't run up the signalling rate limit.
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
}

const flushCandidates = async () => {
  while (pendingCandidates.length) {
    try { await pc.addIceCandidate(new RTCIceCandidate(pendingCandidates.shift())) } catch { /* ignore */ }
  }
}

const poll = async () => {
  if (!pc) return
  let signals
  try {
    signals = await apiFetch(`/consultations/${props.consultationId}/signal?since=${lastSignalId}`)
  } catch { return }
  for (const s of signals) {
    lastSignalId = Math.max(lastSignalId, s.signal_id)
    let data
    try { data = JSON.parse(s.payload) } catch { continue }
    try {
      if (s.kind === 'offer' && !isDoctor) {
        await pc.setRemoteDescription(new RTCSessionDescription(data))
        remoteSet = true
        await flushCandidates()
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        await sendSignal('answer', answer)
      } else if (s.kind === 'answer' && isDoctor) {
        await pc.setRemoteDescription(new RTCSessionDescription(data))
        remoteSet = true
        await flushCandidates()
      } else if (s.kind === 'candidate') {
        if (remoteSet) await pc.addIceCandidate(new RTCIceCandidate(data))
        else pendingCandidates.push(data)
      }
    } catch (err) {
      console.error('signal handling error', err)
    }
  }
}

const start = async () => {
  busy.value = true
  error.value = ''
  try {
    if (isDoctor && consent.value) {
      // Persist consent + session metadata (no media is stored) before the call begins.
      await apiFetch(`/consultations/${props.consultationId}/recording`, {
        method: 'POST',
        body: JSON.stringify({ consent: true }),
      }).catch(() => {}) // best-effort; never block the call on the metadata write
    }
    const { iceServers } = await apiFetch(`/consultations/${props.consultationId}/rtc-credentials`)
    // Whether a relay is available at all — used to give a precise message if we can't connect.
    hasTurn = (iceServers || []).some((s) => /^turns?:/.test(String(s.urls)))
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    if (localVideo.value) localVideo.value.srcObject = localStream

    pc = new RTCPeerConnection({ iceServers })
    localStream.getTracks().forEach((t) => pc.addTrack(t, localStream))
    pc.ontrack = (e) => { if (remoteVideo.value) remoteVideo.value.srcObject = e.streams[0] }
    pc.onicecandidate = (e) => { if (e.candidate) sendSignal('candidate', e.candidate) }
    pc.onconnectionstatechange = () => {
      if (!pc) return
      const s = pc.connectionState
      if (s === 'connected' || s === 'completed') {
        status.value = 'Connected'
        error.value = ''
        clearConnectTimer()
      } else if (s === 'connecting') {
        status.value = 'Connecting…'
      } else if (s === 'disconnected') {
        status.value = 'Reconnecting…'
      } else if (s === 'failed') {
        onConnectTrouble()
      }
    }

    callActive.value = true
    status.value = 'Connecting…'

    if (isDoctor) {
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      await sendSignal('offer', offer)
    }
    await poll()
    pollTimer = setInterval(poll, 1500)
    // If we never reach a connected state, the network almost always needs a TURN relay.
    connectTimer = setTimeout(onConnectTrouble, CONNECT_TIMEOUT_MS)
  } catch (err) {
    error.value = err.message || 'Could not start the call. Check camera/microphone permissions.'
    callActive.value = false
  } finally {
    busy.value = false
  }
}

const hangUp = () => {
  if (pollTimer) clearInterval(pollTimer)
  pollTimer = null
  clearConnectTimer()
  if (pc) { pc.close(); pc = null }
  if (localStream) { localStream.getTracks().forEach((t) => t.stop()); localStream = null }
  if (remoteVideo.value) remoteVideo.value.srcObject = null
  callActive.value = false
  remoteSet = false
  lastSignalId = 0
  pendingCandidates.length = 0
  status.value = 'Call ended'
}

onBeforeUnmount(hangUp)
</script>
