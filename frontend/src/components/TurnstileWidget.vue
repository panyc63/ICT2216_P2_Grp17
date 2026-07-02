<template>
  <!-- Only rendered when a Turnstile site key is configured at build time. Without it the
       widget is a no-op and the backend also bypasses verification (local/dev/CI). -->
  <div v-if="siteKey" ref="host" class="cf-turnstile-host my-3"></div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'

// The parent binds the resulting token via v-model and submits it as `cf-turnstile-response`.
defineProps({ modelValue: { type: String, default: '' } })
const emit = defineEmits(['update:modelValue'])

const siteKey = import.meta.env.VITE_TURNSTILE_SITEKEY || ''
const host = ref(null)
let widgetId = null

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js'

function loadScript() {
  return new Promise((resolve, reject) => {
    if (window.turnstile) return resolve()
    const existing = document.querySelector(`script[src="${SCRIPT_SRC}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('turnstile script failed to load')))
      return
    }
    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('turnstile script failed to load'))
    document.head.appendChild(script)
  })
}

onMounted(async () => {
  if (!siteKey) return
  try {
    await loadScript()
    widgetId = window.turnstile.render(host.value, {
      sitekey: siteKey,
      callback: (token) => emit('update:modelValue', token),
      'expired-callback': () => emit('update:modelValue', ''),
      'error-callback': () => emit('update:modelValue', ''),
    })
  } catch {
    // Fail open in the UI (no widget) — the backend still enforces verification in
    // production, so a broken widget surfaces as a clear "verification failed" response
    // rather than a silently bypassed challenge.
  }
})

onBeforeUnmount(() => {
  if (widgetId && window.turnstile) {
    try { window.turnstile.remove(widgetId) } catch { /* already gone */ }
  }
})
</script>
