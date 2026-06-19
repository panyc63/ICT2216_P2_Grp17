import { ref } from 'vue'
import {
  ref as dbRef,
  onValue,
  onChildAdded,
  push,
  set
} from 'firebase/database'
import { db } from '../firebase'

// Public STUN only. Works for same-network / most home NATs; a TURN server
// would be needed for strict/symmetric NAT in production.
const ICE_SERVERS = {
  iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }
  ]
}

// Browser-to-browser WebRTC with Firebase Realtime Database as the signaling
// channel. The doctor is the 'caller' (creates the offer), the patient is the
// 'callee' (answers). SDP and ICE candidates are exchanged under /rooms/{id}.
export function useWebRTC() {
  const localStream = ref(null)
  const remoteStream = ref(null)
  const status = ref('idle') // idle | connecting | connected | disconnected
  const videoDevices = ref([]) // available cameras (populated after permission)
  const selectedDeviceId = ref('')

  let pc = null
  let listeners = []

  // Camera labels are only exposed after getUserMedia permission is granted,
  // so this is called once the local stream is live.
  const refreshDevices = async () => {
    const devices = await navigator.mediaDevices.enumerateDevices()
    videoDevices.value = devices.filter((d) => d.kind === 'videoinput')
  }

  const cleanupListeners = () => {
    listeners.forEach((unsub) => {
      try { unsub() } catch (e) { /* already detached */ }
    })
    listeners = []
  }

  const start = async (roomId, role) => {
    status.value = 'connecting'
    pc = new RTCPeerConnection(ICE_SERVERS)

    // Local media → outbound tracks.
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    localStream.value = stream
    stream.getTracks().forEach((track) => pc.addTrack(track, stream))

    // Remember which camera is active and list the rest for the picker.
    selectedDeviceId.value = stream.getVideoTracks()[0]?.getSettings().deviceId || ''
    await refreshDevices()

    // Inbound tracks → remote stream.
    const remote = new MediaStream()
    remoteStream.value = remote
    pc.ontrack = (event) => {
      event.streams[0].getTracks().forEach((track) => remote.addTrack(track))
    }

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        status.value = 'connected'
      } else if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
        status.value = 'disconnected'
      }
    }

    const offerRef = dbRef(db, `rooms/${roomId}/offer`)
    const answerRef = dbRef(db, `rooms/${roomId}/answer`)
    const isCaller = role === 'caller'
    const localCandidates = dbRef(db, `rooms/${roomId}/${isCaller ? 'callerCandidates' : 'calleeCandidates'}`)
    const remoteCandidates = dbRef(db, `rooms/${roomId}/${isCaller ? 'calleeCandidates' : 'callerCandidates'}`)

    // Publish our ICE candidates as they're discovered.
    pc.onicecandidate = (event) => {
      if (event.candidate) push(localCandidates, event.candidate.toJSON())
    }

    // Remote candidates can (and usually do) arrive before the remote SDP is
    // applied. Adding a candidate before setRemoteDescription throws, so buffer
    // them until the description is set, then drain the queue.
    let remoteDescriptionSet = false
    const pendingCandidates = []

    const drainPendingCandidates = async () => {
      while (pendingCandidates.length) {
        const candidate = pendingCandidates.shift()
        await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {})
      }
    }

    // Apply (or buffer) the other peer's ICE candidates.
    listeners.push(onChildAdded(remoteCandidates, (snap) => {
      const candidate = snap.val()
      if (!candidate) return
      if (remoteDescriptionSet) {
        pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {})
      } else {
        pendingCandidates.push(candidate)
      }
    }))

    if (isCaller) {
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      await set(offerRef, { type: offer.type, sdp: offer.sdp })

      // Wait for the callee's answer.
      listeners.push(onValue(answerRef, async (snap) => {
        const answer = snap.val()
        if (answer && !pc.currentRemoteDescription) {
          await pc.setRemoteDescription(new RTCSessionDescription(answer))
          remoteDescriptionSet = true
          await drainPendingCandidates()
        }
      }))
    } else {
      // Wait for the caller's offer, then answer.
      listeners.push(onValue(offerRef, async (snap) => {
        const offer = snap.val()
        if (offer && !pc.currentRemoteDescription) {
          await pc.setRemoteDescription(new RTCSessionDescription(offer))
          remoteDescriptionSet = true
          await drainPendingCandidates()
          const answer = await pc.createAnswer()
          await pc.setLocalDescription(answer)
          await set(answerRef, { type: answer.type, sdp: answer.sdp })
        }
      }))
    }
  }

  // Swap the active camera mid-call: grab the chosen device, replace the
  // outgoing video track in place, and refresh the local preview.
  const switchCamera = async (deviceId) => {
    if (!deviceId || !pc) return
    const newStream = await navigator.mediaDevices.getUserMedia({
      video: { deviceId: { exact: deviceId } },
      audio: false
    })
    const newTrack = newStream.getVideoTracks()[0]

    const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video')
    if (sender) await sender.replaceTrack(newTrack)

    // Update the local preview stream in place (same object → <video> updates).
    if (localStream.value) {
      const oldTrack = localStream.value.getVideoTracks()[0]
      if (oldTrack) {
        localStream.value.removeTrack(oldTrack)
        oldTrack.stop()
      }
      localStream.value.addTrack(newTrack)
    }

    selectedDeviceId.value = deviceId
  }

  const hangUp = () => {
    cleanupListeners()
    if (pc) {
      pc.getSenders().forEach((s) => { if (s.track) s.track.stop() })
      pc.close()
      pc = null
    }
    if (localStream.value) {
      localStream.value.getTracks().forEach((t) => t.stop())
      localStream.value = null
    }
    remoteStream.value = null
    status.value = 'disconnected'
  }

  return { localStream, remoteStream, status, videoDevices, selectedDeviceId, switchCamera, start, hangUp }
}
