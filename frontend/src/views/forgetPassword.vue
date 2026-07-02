<template>
  <div class="relative overflow-hidden min-h-[calc(100vh-5rem)] flex items-center justify-center px-4 py-12 font-sans bg-gradient-to-b from-indigo-50 via-indigo-50/40 to-white">
    <div class="absolute inset-0 opacity-[0.06] bg-dot-grid [background-size:22px_22px]" aria-hidden="true"></div>

    <div class="relative w-full max-w-md animate-fade-up">
      <!-- Brand mark -->
      <div class="flex flex-col items-center text-center mb-6">
        <div class="w-12 h-12 rounded-2xl bg-brand-gradient text-white flex items-center justify-center shadow-glow mb-4" aria-hidden="true">
          <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 4h16v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
            <path d="M4 8l8 5 8-5" />
          </svg>
        </div>
        <span class="inline-flex items-center gap-2 text-xs font-semibold text-indigo-700 bg-white border border-indigo-100 shadow-sm px-3.5 py-1.5 rounded-full">
          Account recovery
        </span>
      </div>

      <div class="bg-white border border-slate-200 rounded-2xl p-8 shadow-card">
        <div class="mb-8 text-center">
          <h1 class="text-2xl font-extrabold text-slate-900 tracking-tight mb-1.5">Reset your password</h1>
          <p class="text-sm text-slate-500">
            Enter your email and we'll send you a link to set a new password.
          </p>
        </div>

        <form @submit.prevent="handleReset" class="space-y-5">
          <div class="flex flex-col gap-2">
            <label class="text-sm font-semibold text-slate-900" for="email">Email</label>
            <input
              v-model="email"
              class="w-full px-4 py-3 border border-slate-200 bg-slate-50 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-600 focus:bg-white focus:ring-4 focus:ring-indigo-100 transition-all"
              type="email"
              id="email"
              autocomplete="email"
              placeholder="you@example.com"
              required
            >
          </div>

          <button type="submit" :disabled="submitting" class="w-full bg-indigo-600 text-white font-semibold py-3.5 rounded-xl shadow-sm hover:bg-indigo-700 hover:shadow-md hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-200 transition-all disabled:opacity-60 disabled:hover:translate-y-0">
            {{ submitting ? 'Sending…' : 'Send reset link' }}
          </button>

          <p
            v-if="notice"
            role="status"
            aria-live="polite"
            class="text-sm font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3"
          >
            {{ notice }}
          </p>

          <div class="text-center pt-1">
            <router-link to="/login" class="text-sm text-indigo-600 font-semibold hover:text-indigo-700 hover:underline transition-all">
              ← Back to sign in
            </router-link>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { apiFetch } from '../services/api'

const email = ref('')
const submitting = ref(false)
const notice = ref('')

const handleReset = async () => {
  submitting.value = true
  notice.value = ''
  try {
    const res = await apiFetch('/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: email.value }),
    })
    // Backend returns a neutral message (no account enumeration).
    notice.value = res.message || 'If an account exists for that email, a reset link has been sent.'
    email.value = ''
  } catch (err) {
    notice.value = err.message || 'Something went wrong. Please try again.'
  } finally {
    submitting.value = false
  }
}
</script>
