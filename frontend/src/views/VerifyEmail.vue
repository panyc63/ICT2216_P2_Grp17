<template>
  <div class="min-h-screen bg-slate-50 flex items-start justify-center px-4 pt-20 font-sans">
    <div class="bg-white border border-slate-200 w-full max-w-md rounded-2xl p-8 shadow-card">
      <div class="mb-6">
        <div class="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl mb-4" aria-hidden="true">✉️</div>
        <h2 class="text-2xl font-extrabold text-slate-950 tracking-tight mb-1">Verify your email</h2>
        <p class="text-sm text-slate-500">
          Enter the 6-digit code we sent to
          <span class="font-semibold text-slate-700">{{ email || 'your email' }}</span>.
        </p>
      </div>

      <p v-if="demoNote" class="mb-4 text-xs bg-amber-50 border border-amber-200 text-amber-700 rounded-xl px-3 py-2">
        Demo mode: email delivery isn't configured, so your code is pre-filled below.
      </p>

      <form @submit.prevent="submitCode" class="space-y-5">
        <div class="flex flex-col gap-2">
          <label class="text-sm font-semibold text-slate-900" for="code">Verification code</label>
          <input
            v-model="code"
            id="code"
            inputmode="numeric"
            maxlength="6"
            autocomplete="one-time-code"
            placeholder="123456"
            class="w-full px-4 py-3 border border-slate-200 bg-slate-50 rounded-xl text-lg tracking-[0.5em] text-center font-semibold focus:outline-none focus:border-indigo-600 focus:bg-white transition"
            required
          >
        </div>

        <button
          type="submit"
          :disabled="busy || code.length !== 6"
          class="w-full bg-indigo-600 text-white font-bold py-3.5 rounded-xl hover:bg-indigo-700 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed transition"
        >
          {{ busy ? 'Verifying…' : 'Verify account' }}
        </button>
      </form>

      <p v-if="error" role="alert" class="mt-4 text-sm text-rose-600">{{ error }}</p>
      <p v-if="success" role="status" class="mt-4 text-sm text-emerald-600">{{ success }}</p>

      <div class="mt-6 pt-5 border-t border-slate-100 text-center text-sm text-slate-500">
        Didn't get it?
        <button
          type="button"
          :disabled="cooldown > 0 || resending"
          class="font-semibold text-indigo-600 hover:text-indigo-700 hover:underline disabled:text-slate-400 disabled:no-underline disabled:cursor-not-allowed"
          @click="resend"
        >
          {{ cooldown > 0 ? `Resend in ${cooldown}s` : (resending ? 'Sending…' : 'Resend code') }}
        </button>
      </div>

      <div class="mt-4 text-center text-sm text-slate-500">
        <router-link to="/login" class="font-semibold text-slate-600 hover:text-slate-800">Back to sign in</router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { apiFetch } from '../services/api'

const route = useRoute()
const router = useRouter()

const email = ref(String(route.query.email || ''))
const code = ref(String(route.query.code || ''))   // demo mode pre-fills the code
const demoNote = ref(Boolean(route.query.code))
const busy = ref(false)
const resending = ref(false)
const error = ref('')
const success = ref('')
const cooldown = ref(0)
let timer = null

function startCooldown(seconds = 30) {
  cooldown.value = seconds
  timer = setInterval(() => {
    cooldown.value -= 1
    if (cooldown.value <= 0) { clearInterval(timer); timer = null }
  }, 1000)
}

const submitCode = async () => {
  busy.value = true
  error.value = ''
  success.value = ''
  try {
    await apiFetch('/verify-email', { method: 'POST', body: JSON.stringify({ email: email.value, code: code.value.trim() }) })
    success.value = 'Email verified! Redirecting to sign in…'
    setTimeout(() => router.push('/login'), 1200)
  } catch (err) {
    error.value = err.message || 'Verification failed.'
  } finally {
    busy.value = false
  }
}

const resend = async () => {
  resending.value = true
  error.value = ''
  success.value = ''
  try {
    const data = await apiFetch('/verify-email/resend', { method: 'POST', body: JSON.stringify({ email: email.value }) })
    if (data?.devOtp) { code.value = data.devOtp; demoNote.value = true }
    success.value = 'A new code has been sent.'
    startCooldown(30)
  } catch (err) {
    error.value = err.message || 'Could not resend the code.'
  } finally {
    resending.value = false
  }
}

onMounted(() => {
  if (!email.value) error.value = 'Missing email address. Please register again.'
})
onBeforeUnmount(() => { if (timer) clearInterval(timer) })
</script>
