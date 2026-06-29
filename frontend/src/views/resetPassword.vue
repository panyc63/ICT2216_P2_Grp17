<template>
  <div class="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-12 font-sans">
    <div class="bg-white border border-slate-200 w-full max-w-md rounded-2xl p-8 shadow-sm">
      <h2 class="text-2xl font-extrabold text-slate-950 tracking-tight mb-2">Set a new password</h2>
      <p class="text-sm text-slate-500 mb-8">Choose a new password for your MediFlow account.</p>

      <form v-if="!done" class="space-y-6" @submit.prevent="handleSubmit">
        <div class="flex flex-col gap-2">
          <label class="text-sm font-semibold text-slate-900" for="password">New password</label>
          <input
            id="password"
            v-model="password"
            class="w-full px-4 py-3 border border-slate-200 bg-slate-50 rounded-xl text-sm focus:outline-none focus:border-indigo-600 focus:bg-white"
            type="password"
            minlength="8"
            placeholder="At least 8 characters"
            required
          >
        </div>
        <button type="submit" :disabled="submitting || !token" class="w-full bg-indigo-600 text-white font-bold py-3.5 rounded-xl hover:bg-indigo-700 disabled:opacity-60">
          {{ submitting ? 'Saving…' : 'Reset password' }}
        </button>
        <p v-if="error" class="text-sm font-medium text-red-600 text-center">{{ error }}</p>
        <p v-if="!token" class="text-sm font-medium text-amber-600 text-center">Missing reset token in the link.</p>
      </form>

      <div v-else class="text-center">
        <p class="text-sm font-medium text-emerald-600 mb-4">Password reset successful.</p>
        <router-link to="/login" class="text-sm text-indigo-600 font-bold hover:underline">Go to sign in →</router-link>
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
