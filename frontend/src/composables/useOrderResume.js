import axios from 'axios'
import { ref as dbRef, get } from 'firebase/database'
import { db } from '../firebase'
import { patientStore } from '../store/patientStore'
import { resumeRouteForOrder } from '../utils/orderFlow'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000'
const api = axios.create({ baseURL: API_BASE })

// Resume a patient's order at the page matching its status, with self-healing for
// orphaned InCall orders (call ended abnormally — the WebRTC room is gone but the
// order never advanced past InCall). Side-effects (HTTP + Firebase) live here so
// utils/orderFlow.js stays a pure mapper.
export async function resumeOrder(order, router) {
  if (!order) return

  if (order.status === 'InCall' && order.consultation_id) {
    // Is the live signaling room still there? If so, reconnect to the call.
    let roomExists = false
    try {
      const snap = await get(dbRef(db, `rooms/${order.consultation_id}`))
      roomExists = snap.exists()
    } catch (err) {
      // Treat a failed lookup as "no room" — better to self-heal than to drop
      // the patient on a dead video page.
      roomExists = false
    }

    if (roomExists) {
      patientStore.setOrder(order)
      router.push({ path: '/patient/video-consultation', query: { room: order.consultation_id } })
      return
    }

    // No room: the call ended abnormally. Advance the order to
    // AwaitingFinalization (idempotent /end), then resume from there.
    try {
      await api.post(`/api/consultations/${order.consultation_id}/end`)
    } catch (err) {
      // Best-effort — if /end already ran, the order is fine; we still continue.
    }
    order = { ...order, status: 'AwaitingFinalization' }
  }

  const route = resumeRouteForOrder(order)
  if (!route) return
  patientStore.setOrder(order)
  router.push(route)
}
