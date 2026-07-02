<template>
  <div class="min-h-screen bg-slate-50 font-sans text-slate-800">
    <!-- Patient top bar + sub-navigation -->
    <header class="bg-white/90 backdrop-blur border-b border-slate-200 sticky top-0 z-40">
      <div class="max-w-5xl mx-auto px-4 sm:px-6">
        <div class="flex items-center justify-between py-3.5">
          <router-link to="/" class="flex items-center gap-2.5 group">
            <span class="w-8 h-8 rounded-xl bg-brand-gradient flex items-center justify-center text-white text-sm font-extrabold shadow-sm" aria-hidden="true">M</span>
            <span class="text-lg font-extrabold tracking-tight text-slate-900 group-hover:text-indigo-600 transition-colors">MediFlow</span>
          </router-link>
          <div class="flex items-center gap-3 sm:gap-4">
            <span class="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-full">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden="true"></span>
              Patient portal
            </span>
            <button
              @click="handleLogout"
              class="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-rose-600 rounded-lg px-2.5 py-1.5 hover:bg-rose-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
            >
              <span aria-hidden="true">↪</span> Sign out
            </button>
          </div>
        </div>
        <nav aria-label="Patient sections" class="flex gap-1.5 overflow-x-auto pb-2.5 -mb-px">
          <router-link
            v-for="link in navLinks"
            :key="link.to"
            :to="link.to"
            class="whitespace-nowrap inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            active-class="bg-indigo-600 text-white shadow-sm hover:bg-indigo-600 hover:text-white"
          >
            <span aria-hidden="true">{{ link.icon }}</span>
            {{ link.label }}
          </router-link>
        </nav>
      </div>
    </header>

    <!-- Active patient view -->
    <main class="max-w-5xl mx-auto px-4 sm:px-6 py-8 animate-fade-up">
      <router-view></router-view>
    </main>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { logout } from '../../services/api'

const router = useRouter()
const handleLogout = () => logout(router)

const navLinks = [
  { to: '/patient/profile', label: 'Profile', icon: '👤' },
  { to: '/patient/book-consultation', label: 'Book Consultation', icon: '🩺' },
  { to: '/patient/medication-collection', label: 'Medication', icon: '💊' },
  { to: '/patient/payment', label: 'Payment', icon: '💳' },
  { to: '/patient/prescription', label: 'Prescription', icon: '📋' },
  { to: '/patient/download-mc', label: 'Medical Cert', icon: '📄' },
  { to: '/patient/track-delivery', label: 'Track Delivery', icon: '🚚' }
]
</script>
