<template>
  <div class="min-h-screen bg-slate-50 font-sans">
    <!-- Patient sub-navigation -->
    <div class="bg-white border-b border-slate-200 sticky top-0 z-40">
      <div class="max-w-5xl mx-auto px-4 sm:px-6">
        <div class="flex items-center justify-between py-3">
          <router-link to="/" class="text-lg font-extrabold tracking-tight text-indigo-600">MediFlow</router-link>
          <div class="flex items-center gap-4">
            <span class="text-sm text-slate-500 hidden sm:inline">Patient Portal</span>
            <button @click="handleLogout" class="text-sm font-semibold text-red-600 hover:text-red-700">Logout</button>
          </div>
        </div>
        <nav class="flex gap-1 overflow-x-auto pb-2 -mb-px">
          <router-link
            v-for="link in navLinks"
            :key="link.to"
            :to="link.to"
            class="whitespace-nowrap px-3 py-1.5 rounded-lg text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            active-class="bg-indigo-600 text-white hover:bg-indigo-600 hover:text-white"
          >
            {{ link.label }}
          </router-link>
        </nav>
      </div>
    </div>

    <!-- Active patient view -->
    <main class="max-w-5xl mx-auto px-4 sm:px-6 py-8">
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
  { to: '/patient/profile', label: 'Profile' },
  { to: '/patient/book-consultation', label: 'Book Consultation' },
  { to: '/patient/questionnaire', label: 'Questionnaire' },
  { to: '/patient/medication-collection', label: 'Medication' },
  { to: '/patient/payment', label: 'Payment' },
  { to: '/patient/prescription', label: 'Prescription' },
  { to: '/patient/download-mc', label: 'Medical Cert' },
  { to: '/patient/track-delivery', label: 'Track Delivery' }
]
</script>
