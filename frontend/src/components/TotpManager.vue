<template>
  <div class="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
    <div class="flex items-start gap-4">
      <div class="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl shrink-0" aria-hidden="true">🔐</div>
      <div class="min-w-0 flex-1">
        <h3 class="font-bold text-slate-900">Authenticator app (two-factor)</h3>
        <p class="text-sm text-slate-500 mt-0.5">
          Add a time-based one-time code from an app like Google Authenticator, Authy or 1Password
          for a stronger, phishing-resistant sign-in step. Codes work offline — no email needed.
        </p>

        <!-- Loading -->
        <p v-if="loading" class="mt-4 text-sm text-slate-400">Checking status…</p>

        <!-- Enabled state -->
        <div v-else-if="enabled && phase === 'idle'" class="mt-4">
          <span class="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1">
            <span aria-hidden="true">✓</span> Authenticator enabled
          </span>
          <p v-if="enrolledAt" class="text-xs text-slate-400 mt-2">Enrolled {{ formatDate(enrolledAt) }}</p>
          <button
            type="button"
            class="mt-4 text-sm font-semibold text-rose-600 hover:text-rose-700 hover:underline"
            @click="phase = 'removing'; resetInputs()"
          >
            Remove authenticator
          </button>
        </div>

        <!-- Remove flow (requires a current code) -->
        <form v-else-if="phase === 'removing'" class="mt-4 space-y-3" @submit.prevent="removeAuthenticator">
          <p class="text-sm text-slate-600">Enter a current 6-digit code to remove your authenticator.</p>
          <input
            v-model="code"
            inputmode="numeric"
            maxlength="6"
            placeholder="123456"
            class="w-40 px-4 py-2.5 border border-slate-200 bg-slate-50 rounded-xl text-sm tracking-widest text-center focus:outline-none focus:border-indigo-600 focus:bg-white transition"
            aria-label="Current authenticator code"
          >
          <div class="flex gap-2">
            <button type="submit" :disabled="busy" class="bg-rose-600 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-rose-700 disabled:opacity-60 transition">
              {{ busy ? 'Removing…' : 'Confirm removal' }}
            </button>
            <button type="button" class="text-sm font-semibold text-slate-500 px-4 py-2.5 hover:text-slate-700" @click="cancel">Cancel</button>
          </div>
        </form>

        <!-- Not enabled: start button -->
        <div v-else-if="!enabled && phase === 'idle'" class="mt-4">
          <button
            type="button"
            :disabled="busy"
            class="bg-indigo-600 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-indigo-700 shadow-sm disabled:opacity-60 transition"
            @click="startEnroll"
          >
            {{ busy ? 'Preparing…' : 'Set up authenticator app' }}
          </button>
        </div>

        <!-- Enrolling: show secret + confirm code -->
        <form v-else-if="phase === 'enrolling'" class="mt-4 space-y-4" @submit.prevent="confirmEnroll">
          <ol class="text-sm text-slate-600 space-y-3 list-decimal list-inside">
            <li>
              Add this key to your authenticator app (scan is unavailable here — use manual entry):
              <div class="mt-2 flex flex-wrap items-center gap-2">
                <code class="font-mono text-sm bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 break-all select-all">{{ prettySecret }}</code>
                <button type="button" class="text-xs font-semibold text-indigo-600 hover:underline" @click="copySecret">
                  {{ copied ? 'Copied!' : 'Copy' }}
                </button>
              </div>
              <a :href="otpauthUrl" class="inline-block mt-2 text-xs font-semibold text-indigo-600 hover:underline">
                Open in an installed authenticator app ↗
              </a>
            </li>
            <li>
              Enter the 6-digit code your app shows to finish:
              <div class="mt-2">
                <input
                  v-model="code"
                  inputmode="numeric"
                  maxlength="6"
                  placeholder="123456"
                  class="w-40 px-4 py-2.5 border border-slate-200 bg-slate-50 rounded-xl text-sm tracking-widest text-center focus:outline-none focus:border-indigo-600 focus:bg-white transition"
                  aria-label="6-digit code from your authenticator"
                >
              </div>
            </li>
          </ol>
          <div class="flex gap-2">
            <button type="submit" :disabled="busy" class="bg-indigo-600 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-indigo-700 shadow-sm disabled:opacity-60 transition">
              {{ busy ? 'Verifying…' : 'Verify & enable' }}
            </button>
            <button type="button" class="text-sm font-semibold text-slate-500 px-4 py-2.5 hover:text-slate-700" @click="cancel">Cancel</button>
          </div>
        </form>

        <!-- Feedback -->
        <p v-if="error" class="mt-3 text-sm text-rose-600" role="alert">{{ error }}</p>
        <p v-if="success" class="mt-3 text-sm text-emerald-600" role="status">{{ success }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { apiFetch } from '../services/api'

const loading = ref(true)
const enabled = ref(false)
const enrolledAt = ref(null)
const phase = ref('idle')     // idle | enrolling | removing
const secret = ref('')
const otpauthUrl = ref('')
const code = ref('')
const busy = ref(false)
const error = ref('')
const success = ref('')
const copied = ref(false)

// Group the base32 secret into 4-char chunks so it is easy to type by hand.
const prettySecret = computed(() => (secret.value.match(/.{1,4}/g) || []).join(' '))

function resetInputs() {
  code.value = ''
  error.value = ''
  success.value = ''
  copied.value = false
}

function cancel() {
  phase.value = 'idle'
  secret.value = ''
  otpauthUrl.value = ''
  resetInputs()
}

function formatDate(value) {
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString()
}

async function loadStatus() {
  try {
    const data = await apiFetch('/totp/status')
    enabled.value = Boolean(data.enabled)
    enrolledAt.value = data.enrolledAt || null
  } catch {
    /* not privileged / not signed in — component simply shows nothing actionable */
  } finally {
    loading.value = false
  }
}

async function startEnroll() {
  busy.value = true
  resetInputs()
  try {
    const data = await apiFetch('/totp/enroll/options', { method: 'POST', body: JSON.stringify({}) })
    secret.value = data.secret
    otpauthUrl.value = data.otpauthUrl
    phase.value = 'enrolling'
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = false
  }
}

async function confirmEnroll() {
  busy.value = true
  error.value = ''
  try {
    await apiFetch('/totp/enroll/verify', { method: 'POST', body: JSON.stringify({ token: code.value.trim() }) })
    enabled.value = true
    enrolledAt.value = new Date().toISOString()
    phase.value = 'idle'
    secret.value = ''
    otpauthUrl.value = ''
    success.value = 'Authenticator enabled.'
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = false
  }
}

async function removeAuthenticator() {
  busy.value = true
  error.value = ''
  try {
    await apiFetch('/totp/disable', { method: 'POST', body: JSON.stringify({ token: code.value.trim() }) })
    enabled.value = false
    enrolledAt.value = null
    phase.value = 'idle'
    success.value = 'Authenticator removed.'
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = false
  }
}

async function copySecret() {
  try {
    await navigator.clipboard.writeText(secret.value)
    copied.value = true
    setTimeout(() => { copied.value = false }, 1500)
  } catch {
    /* clipboard blocked — the secret is visible for manual copy */
  }
}

onMounted(loadStatus)
</script>
