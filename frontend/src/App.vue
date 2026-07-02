<template>
  <div id="app-layout" class="min-h-screen flex flex-col bg-slate-50 font-sans text-slate-800">
    <header
      v-if="showNavbar"
      class="fixed top-0 inset-x-0 z-50 bg-white/85 backdrop-blur-md border-b border-slate-200"
    >
      <nav class="max-w-7xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between gap-4" aria-label="Primary">
        <!-- Logo returns a signed-in user to their dashboard, a guest to the marketing home. -->
        <router-link :to="homeLink" class="logo_a inline-flex items-center shrink-0 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2">
          <img src="/src/assets/img/mediflow_logo.png" alt="MediFlow home" class="block h-11 w-auto object-contain" />
        </router-link>

        <!-- Desktop nav -->
        <ul class="hidden md:flex items-center gap-1 list-none">
          <li v-for="link in navLinks" :key="link.to">
            <router-link
              :to="link.to"
              class="px-3.5 py-2 rounded-lg text-sm font-medium text-slate-600 hover:text-indigo-700 hover:bg-indigo-50 transition-colors"
              active-class="text-indigo-700 bg-indigo-50"
            >
              {{ link.label }}
            </router-link>
          </li>
        </ul>

        <div class="hidden md:flex items-center gap-2.5">
          <template v-if="isLoggedIn">
            <router-link
              :to="dashboardLink"
              class="px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm hover:shadow-md transition-all"
            >
              My Dashboard
            </router-link>
            <button
              type="button"
              class="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 border border-slate-300 bg-white hover:bg-slate-50 transition-colors"
              @click="onLogout"
            >
              Log out
            </button>
          </template>
          <router-link
            v-else
            to="/login"
            class="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm hover:shadow-md transition-all"
          >
            Get Started
          </router-link>
        </div>

        <!-- Mobile toggle -->
        <button
          type="button"
          class="md:hidden inline-flex items-center justify-center w-11 h-11 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          :aria-expanded="mobileOpen"
          aria-controls="mobile-menu"
          :aria-label="mobileOpen ? 'Close menu' : 'Open menu'"
          @click="mobileOpen = !mobileOpen"
        >
          <svg v-if="!mobileOpen" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          <svg v-else class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </nav>

      <!-- Mobile menu -->
      <Transition
        enter-active-class="transition ease-out duration-200"
        enter-from-class="opacity-0 -translate-y-2"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition ease-in duration-150"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 -translate-y-2"
      >
        <div v-if="mobileOpen" id="mobile-menu" class="md:hidden border-t border-slate-200 bg-white">
          <div class="px-4 py-4 space-y-1">
            <router-link
              v-for="link in navLinks"
              :key="link.to"
              :to="link.to"
              class="block px-4 py-3 rounded-xl text-base font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
              active-class="text-indigo-700 bg-indigo-50"
              @click="mobileOpen = false"
            >
              {{ link.label }}
            </router-link>

            <div class="pt-3 mt-2 border-t border-slate-100 space-y-2">
              <template v-if="isLoggedIn">
                <router-link
                  :to="dashboardLink"
                  class="block text-center px-4 py-3 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
                  @click="mobileOpen = false"
                >
                  My Dashboard
                </router-link>
                <button
                  type="button"
                  class="w-full px-4 py-3 rounded-xl text-sm font-semibold text-slate-700 border border-slate-300 bg-white hover:bg-slate-50 transition-colors"
                  @click="onLogout(); mobileOpen = false"
                >
                  Log out
                </button>
              </template>
              <router-link
                v-else
                to="/login"
                class="block text-center px-4 py-3 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
                @click="mobileOpen = false"
              >
                Get Started
              </router-link>
            </div>
          </div>
        </div>
      </Transition>
    </header>

    <main class="flex-1 flex flex-col" :class="{ 'pt-20': showNavbar }">
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

const navLinks = [
  { to: '/', label: 'Home' },
  { to: '/about', label: 'About Us' },
  { to: '/services', label: 'Services' },
  { to: '/contact', label: 'Contact Us' },
]

const mobileOpen = ref(false)

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
watch(() => route.path, () => {
  authRole.value = readRole()
  mobileOpen.value = false
})

const isLoggedIn = computed(() => Boolean(authRole.value))
const dashboardLink = computed(() => dashboardForRole(authRole.value))
const homeLink = computed(() => (isLoggedIn.value ? dashboardLink.value : '/'))

const onLogout = () => logout(router)
</script>
