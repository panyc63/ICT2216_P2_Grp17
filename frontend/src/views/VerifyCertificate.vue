<template>
  <div class="min-h-screen bg-slate-50 flex items-start justify-center px-4 pt-16 pb-16 font-sans">
    <div class="w-full max-w-md">
      <div class="text-center mb-6">
        <div class="text-xl font-extrabold tracking-tight text-indigo-600">MediFlow</div>
        <p class="text-sm text-slate-500 mt-1">Medical certificate verification</p>
      </div>

      <div class="bg-white border border-slate-200 rounded-2xl shadow-card p-8">
        <!-- Loading -->
        <div v-if="state === 'loading'" class="text-center py-8 text-sm text-slate-400">
          Checking the certificate…
        </div>

        <!-- No reference supplied -->
        <div v-else-if="state === 'missing'" class="text-center py-4">
          <div class="w-14 h-14 mx-auto rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center text-2xl" aria-hidden="true">🔎</div>
          <h1 class="mt-4 font-bold text-slate-900">Nothing to verify</h1>
          <p class="mt-1 text-sm text-slate-500">Open this page from the QR code or link on a certificate.</p>
        </div>

        <!-- Valid -->
        <div v-else-if="state === 'valid'" class="text-center py-2">
          <div class="w-16 h-16 mx-auto rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-3xl" aria-hidden="true">✓</div>
          <h1 class="mt-4 text-xl font-extrabold text-slate-900">Genuine certificate</h1>
          <p class="mt-1 text-sm text-slate-500">This certificate was cryptographically signed by the issuing doctor and has not been revoked.</p>
          <dl class="mt-6 text-left divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
            <div class="flex justify-between gap-4 px-4 py-3"><dt class="text-sm text-slate-500">Certificate ID</dt><dd class="text-sm font-semibold text-slate-900">{{ result.mcId }}</dd></div>
            <div class="flex justify-between gap-4 px-4 py-3"><dt class="text-sm text-slate-500">Issued</dt><dd class="text-sm font-semibold text-slate-900">{{ fmt(result.issueDate) }}</dd></div>
            <div class="flex justify-between gap-4 px-4 py-3"><dt class="text-sm text-slate-500">Valid until</dt><dd class="text-sm font-semibold text-slate-900">{{ fmt(result.validUntil) }}</dd></div>
          </dl>
          <p class="mt-4 text-xs text-slate-400">No personal or medical details are shown — verification confirms authenticity only.</p>
        </div>

        <!-- Revoked -->
        <div v-else-if="state === 'revoked'" class="text-center py-2">
          <div class="w-16 h-16 mx-auto rounded-full bg-amber-50 text-amber-600 flex items-center justify-center text-3xl" aria-hidden="true">⚠</div>
          <h1 class="mt-4 text-xl font-extrabold text-slate-900">Certificate revoked</h1>
          <p class="mt-1 text-sm text-slate-500">This certificate was validly signed but has since been <strong>revoked</strong> by the clinic and should not be accepted.</p>
          <dl class="mt-6 text-left divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
            <div class="flex justify-between gap-4 px-4 py-3"><dt class="text-sm text-slate-500">Certificate ID</dt><dd class="text-sm font-semibold text-slate-900">{{ result.mcId }}</dd></div>
            <div class="flex justify-between gap-4 px-4 py-3"><dt class="text-sm text-slate-500">Issued</dt><dd class="text-sm font-semibold text-slate-900">{{ fmt(result.issueDate) }}</dd></div>
          </dl>
        </div>

        <!-- Invalid / not found -->
        <div v-else class="text-center py-2">
          <div class="w-16 h-16 mx-auto rounded-full bg-rose-50 text-rose-600 flex items-center justify-center text-3xl" aria-hidden="true">✕</div>
          <h1 class="mt-4 text-xl font-extrabold text-slate-900">Not verifiable</h1>
          <p class="mt-1 text-sm text-slate-500">We could not confirm this certificate. The code may be mistyped, tampered with, or not issued by MediFlow.</p>
        </div>

        <router-link to="/" class="mt-8 block text-center text-sm font-semibold text-indigo-600 hover:text-indigo-700">Back to MediFlow</router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const state = ref('loading') // loading | missing | valid | revoked | invalid
const result = ref({})

const fmt = (d) => {
  const dt = new Date(d)
  return Number.isNaN(dt.getTime()) ? String(d || '') : dt.toLocaleDateString()
}

onMounted(async () => {
  const mc = route.query.mc ? String(route.query.mc) : ''
  const token = route.query.token ? String(route.query.token) : ''
  if (!mc && !token) { state.value = 'missing'; return }

  const url = mc
    ? `/api/verify/mc-id/${encodeURIComponent(mc)}`
    : `/api/verify/mc/${encodeURIComponent(token)}`
  try {
    // Public endpoint — read the JSON regardless of status (400/404 => invalid).
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || data.valid === false) {
      state.value = data.revoked ? 'revoked' : 'invalid'
      result.value = data || {}
      return
    }
    result.value = data
    state.value = data.revoked ? 'revoked' : 'valid'
  } catch {
    state.value = 'invalid'
  }
})
</script>
