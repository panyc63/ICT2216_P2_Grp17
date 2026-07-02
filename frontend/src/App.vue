<template>
  <div id="app-layout">
    <header class="main-header" v-if="showNavbar">
      <div class="container-fluid navbar">
        <div class="logo">
          <!-- Logo returns a signed-in user to their dashboard, a guest to the marketing home. -->
          <router-link :to="homeLink" class="logo_a inline-block h-auto w-max">
            <img src="/src/assets/img/mediflow_logo.png" alt="MediFlow Logo" class="block max-h-full h-12 w-auto object-contain" />
          </router-link>
        </div>
        <ul class="nav-links">
          <li><router-link to="/">Home</router-link></li>
          <li><router-link to="/about">About Us</router-link></li>
          <li><router-link to="/services">Services</router-link></li>
          <li><router-link to="/contact">Contact Us</router-link></li>
        </ul>
        <div class="nav-actions">
          <!-- Signed in: offer a way back to the dashboard + a logout, not a "Get Started"
               button that dumps the user on the login page. Guests get "Get Started". -->
          <template v-if="isLoggedIn">
            <router-link :to="dashboardLink" class="nav-cta">My Dashboard</router-link>
            <button type="button" class="nav-logout" @click="onLogout">Log out</button>
          </template>
          <router-link v-else to="/login" class="nav-cta">Get Started</router-link>
        </div>
      </div>
    </header>

    <main :class="{ 'has-navbar': showNavbar }">
      <router-view></router-view>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { dashboardForRole, logout } from './services/api'

const route = useRoute()
const router = useRouter()

// Every role's authenticated area has its own sidebar/navigation, so the marketing header
// must not render on top of it. Hide it across all dashboard routes.
const DASHBOARD_PREFIXES = ['/admin-dashboard', '/doc-', '/nurse-', '/pharmacist-', '/patient']
const showNavbar = computed(() => !DASHBOARD_PREFIXES.some((p) => route.path.startsWith(p)))

// Auth state derived from the cached session, refreshed on every navigation (login and
// logout both trigger a route change), so the header reflects the real login state.
function readRole() {
  const expiresRaw = localStorage.getItem('sessionExpiresAt')
  const expiresAt = expiresRaw ? new Date(expiresRaw).getTime() : 0
  if (!expiresAt || expiresAt <= Date.now()) return ''
  return localStorage.getItem('userRole') || ''
}
const authRole = ref(readRole())
watch(() => route.path, () => { authRole.value = readRole() })

const isLoggedIn = computed(() => Boolean(authRole.value))
const dashboardLink = computed(() => dashboardForRole(authRole.value))
const homeLink = computed(() => (isLoggedIn.value ? dashboardLink.value : '/'))

const onLogout = () => logout(router)
</script>

<style>
.has-navbar {
  padding-top: 80px;
}
.nav-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.nav-logout {
  background: transparent;
  border: 1px solid #cbd5e1;
  color: #334155;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  font-weight: 600;
  cursor: pointer;
}
.nav-logout:hover {
  background: #f1f5f9;
}
</style>
