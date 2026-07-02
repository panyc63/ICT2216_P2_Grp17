<template>
  <div class="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
    <div class="flex items-center gap-2 mb-1">
      <span class="text-lg" aria-hidden="true">🔐</span>
      <h4 class="font-bold text-lg text-slate-900">Passkey security</h4>
    </div>
    <p class="text-sm text-slate-500 mb-4">
      Register a device passkey (Face ID, fingerprint, or a security key) for phishing-resistant
      step-up verification on sensitive actions.
    </p>
    <div class="flex flex-wrap items-center gap-3">
      <button
        @click="registerPasskey"
        :disabled="busy || !supported"
        class="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {{ busy ? 'Working…' : 'Register a passkey' }}
      </button>
      <button
        @click="verifyPasskey"
        :disabled="busy || !supported || credentials.length === 0"
        class="px-4 py-2 bg-white border border-slate-300 text-slate-800 text-sm font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Verify with passkey
      </button>
      <span class="text-xs text-slate-500">{{ credentials.length }} registered</span>
    </div>
    <p v-if="!supported" class="text-xs text-amber-600 mt-2">This browser does not support passkeys.</p>
    <p v-if="message" role="status" class="text-xs mt-2" :class="isError ? 'text-red-600' : 'text-emerald-600'">{{ message }}</p>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { startRegistration, startAuthentication, browserSupportsWebAuthn } from '@simplewebauthn/browser'
import { apiFetch } from '../services/api'

const busy = ref(false)
const message = ref('')
const isError = ref(false)
const credentials = ref([])
const supported = ref(browserSupportsWebAuthn())

const say = (msg, err = false) => { message.value = msg; isError.value = err }

const loadCredentials = async () => {
  try { credentials.value = await apiFetch('/webauthn/credentials') } catch { credentials.value = [] }
}

// Enrollment ceremony: get options from the server, run the browser create() ceremony, then
// post the attestation back for cryptographic verification + storage.
const registerPasskey = async () => {
  busy.value = true; say('')
  try {
    const options = await apiFetch('/webauthn/register/options', { method: 'POST', body: '{}' })
    const attestation = await startRegistration({ optionsJSON: options })
    await apiFetch('/webauthn/register/verify', { method: 'POST', body: JSON.stringify(attestation) })
    say('Passkey registered successfully.')
    await loadCredentials()
  } catch (err) {
    say(err.message || 'Could not register a passkey.', true)
  } finally { busy.value = false }
}

// Step-up ceremony: prove possession of a registered passkey; the server treats a valid
// assertion as a fresh re-authentication.
const verifyPasskey = async () => {
  busy.value = true; say('')
  try {
    const options = await apiFetch('/webauthn/authenticate/options', { method: 'POST', body: '{}' })
    const assertion = await startAuthentication({ optionsJSON: options })
    await apiFetch('/webauthn/authenticate/verify', { method: 'POST', body: JSON.stringify(assertion) })
    say('Passkey verified — re-authentication complete.')
  } catch (err) {
    say(err.message || 'Passkey verification failed.', true)
  } finally { busy.value = false }
}

onMounted(loadCredentials)
</script>
