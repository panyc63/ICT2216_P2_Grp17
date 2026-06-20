import { ref, computed } from 'vue'

// Central, reactive auth state for the prototype. Session truth still lives in
// localStorage (userId/userRole), but these module-scope refs mirror it so the
// UI updates reactively within the same tab. Declared at module scope so every
// component shares one instance (singleton).
const currentUserId = ref(localStorage.getItem('userId') || '')
const currentRole = ref(localStorage.getItem('userRole') || '')

const isLoggedIn = computed(() => !!currentUserId.value)

// Role → landing route. Keep this the single source of truth for "where does
// this role go". Doctor points at /doc-consult for now; switch to /doc-dashboard
// once that exists (Issue 2). Roles without a portal yet fall back to home.
const PORTAL_BY_ROLE = {
  Patient: '/patient/profile',
  Admin: '/admin-dashboard',
  Doctor: '/doc-consult'
}

// Single source of truth for role → landing route, usable outside components
// (e.g. router guards) where the composable's refs aren't convenient.
export function portalFor(role) {
  return PORTAL_BY_ROLE[role] || '/'
}

const portalPath = computed(() => portalFor(currentRole.value))

// Writes the session and updates the reactive refs together. localStorage's
// `storage` event does not fire in the same tab, so we must update refs here.
function setSession(userId, role) {
  localStorage.setItem('userId', userId)
  localStorage.setItem('userRole', role)
  // Start the idle clock fresh on login (see useIdleTimeout / SNFR3).
  localStorage.setItem('lastActivity', String(Date.now()))
  currentUserId.value = userId
  currentRole.value = role
}

function clearSession() {
  localStorage.removeItem('userId')
  localStorage.removeItem('userRole')
  localStorage.removeItem('lastActivity')
  currentUserId.value = ''
  currentRole.value = ''
}

export function useAuth() {
  return {
    isLoggedIn,
    currentRole,
    currentUserId,
    portalPath,
    setSession,
    clearSession
  }
}
