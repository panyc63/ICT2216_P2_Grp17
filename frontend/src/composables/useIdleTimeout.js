import { useRouter } from 'vue-router'
import { useAuth } from './useAuth'

// SNFR3: 15-minute idle timeout. We track the last interaction in localStorage
// (so it also survives refreshes/restarts — a stale session is logged out on
// next load) and poll periodically to auto-logout once the limit is exceeded.
// Dev override: set VITE_IDLE_LIMIT_MS in frontend/.env to shorten it for
// testing (e.g. 15000 for 15s). Falls back to 15 minutes when unset/invalid.
const DEFAULT_IDLE_LIMIT_MS = 15 * 60 * 1000
const envLimit = parseInt(import.meta.env.VITE_IDLE_LIMIT_MS, 10)
const IDLE_LIMIT_MS = Number.isFinite(envLimit) && envLimit > 0 ? envLimit : DEFAULT_IDLE_LIMIT_MS
// Check at most every 30s, but never less often than the limit itself (so a
// short test override still fires promptly).
const CHECK_INTERVAL_MS = Math.min(30 * 1000, IDLE_LIMIT_MS)
const ACTIVITY_THROTTLE_MS = 5 * 1000
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'click', 'scroll', 'touchstart']
const STORAGE_KEY = 'lastActivity'

export function useIdleTimeout() {
  const router = useRouter()
  const { isLoggedIn, clearSession } = useAuth()

  let checkTimer = null
  let lastWrite = 0

  const recordActivity = () => {
    // Throttle writes so high-frequency events (mousemove/scroll) don't hammer
    // localStorage; correctness only needs roughly-current timestamps.
    const now = Date.now()
    if (now - lastWrite < ACTIVITY_THROTTLE_MS) return
    lastWrite = now
    localStorage.setItem(STORAGE_KEY, String(now))
  }

  const logoutForIdle = () => {
    clearSession() // also removes lastActivity
    router.push('/login')
  }

  const checkIdle = () => {
    if (!isLoggedIn.value) return
    const last = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10)
    if (last && Date.now() - last >= IDLE_LIMIT_MS) {
      logoutForIdle()
    }
  }

  const start = () => {
    // On load: a logged-in user whose last activity is already stale (e.g. they
    // closed the browser for an hour) gets logged out immediately.
    if (isLoggedIn.value) {
      const last = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10)
      if (last && Date.now() - last >= IDLE_LIMIT_MS) {
        logoutForIdle()
        return
      }
      localStorage.setItem(STORAGE_KEY, String(Date.now()))
    }

    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, recordActivity, { passive: true }))
    checkTimer = setInterval(checkIdle, CHECK_INTERVAL_MS)
  }

  const stop = () => {
    ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, recordActivity))
    if (checkTimer) {
      clearInterval(checkTimer)
      checkTimer = null
    }
  }

  return { start, stop }
}
