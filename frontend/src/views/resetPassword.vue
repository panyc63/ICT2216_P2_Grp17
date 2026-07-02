<template>
  <div class="relative overflow-hidden min-h-[calc(100vh-5rem)] flex items-center justify-center px-4 py-12 font-sans bg-gradient-to-b from-indigo-50 via-indigo-50/40 to-white">
    <div class="absolute inset-0 opacity-[0.06] bg-dot-grid [background-size:22px_22px]" aria-hidden="true"></div>

    <div class="relative w-full max-w-md animate-fade-up">
      <!-- Brand mark -->
      <div class="flex flex-col items-center text-center mb-6">
        <div class="w-12 h-12 rounded-2xl bg-brand-gradient text-white flex items-center justify-center shadow-glow mb-4" aria-hidden="true">
          <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="4" y="10" width="16" height="10" rx="2" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
          </svg>
        </div>
        <span class="inline-flex items-center gap-2 text-xs font-semibold text-indigo-700 bg-white border border-indigo-100 shadow-sm px-3.5 py-1.5 rounded-full">
          New password
        </span>
      </div>

      <div class="bg-white border border-slate-200 rounded-2xl p-8 shadow-card">
        <div class="mb-8 text-center">
          <h1 class="text-2xl font-extrabold text-slate-900 tracking-tight mb-1.5">Set a new password</h1>
          <p class="text-sm text-slate-500">Choose a new password for your MediFlow account.</p>
        </div>

        <form v-if="!done" class="space-y-5" @submit.prevent="handleSubmit">
          <div class="flex flex-col gap-2">
            <label class="text-sm font-semibold text-slate-900" for="password">New password</label>
            <input
              id="password"
              v-model="password"
              class="w-full px-4 py-3 border border-slate-200 bg-slate-50 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-600 focus:bg-white focus:ring-4 focus:ring-indigo-100 transition-all"
              type="password"
              autocomplete="new-password"
              minlength="8"
              placeholder="At least 8 characters"
              required
            >
            <p class="text-xs text-slate-400">Use at least 8 characters. A longer passphrase is stronger.</p>
          </div>

          <button type="submit" :disabled="submitting || !token" class="w-full bg-indigo-600 text-white font-semibold py-3.5 rounded-xl shadow-sm hover:bg-indigo-700 hover:shadow-md hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-200 transition-all disabled:opacity-60 disabled:hover:translate-y-0">
            {{ submitting ? 'Saving…' : 'Reset password' }}
          </button>

          <p v-if="error" role="alert" class="text-sm font-medium text-rose-800 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3">
            {{ error }}
          </p>
          <p v-if="!token" role="alert" class="text-sm font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            This reset link is missing its token. Please open the link from your email again, or request a new one.
          </p>
        </form>

        <div v-else class="text-center py-2">
          <div class="w-12 h-12 mx-auto rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl font-bold mb-4" aria-hidden="true">✓</div>
          <p role="status" class="text-base font-semibold text-slate-900 mb-1">Password reset successful</p>
          <p class="text-sm text-slate-500 mb-6">You can now sign in with your new password.</p>
          <router-link to="/login" class="inline-block bg-indigo-600 text-white font-semibold px-6 py-3 rounded-xl shadow-sm hover:bg-indigo-700 hover:shadow-md transition-all">
            Go to sign in
          </router-link>
        </div>
      </div>

      <div v-if="!done" class="mt-6 text-center">
        <router-link to="/login" class="text-sm text-indigo-600 font-semibold hover:text-indigo-700 hover:underline transition-all">
          ← Back to sign in
        </router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import { apiFetch } from '../services/api'

const route = useRoute()
const token = ref(route.query.token || '')
const password = ref('')
const submitting = ref(false)
const error = ref('')
const done = ref(false)

const handleSubmit = async () => {
  submitting.value = true
  error.value = ''
  try {
    await apiFetch('/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token: token.value, password: password.value }),
    })
    done.value = true
  } catch (err) {
    error.value = err.message || 'Invalid or expired reset link.'
  } finally {
    submitting.value = false
  }
}
</script>
