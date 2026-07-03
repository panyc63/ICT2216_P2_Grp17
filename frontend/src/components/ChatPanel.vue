<template>
  <div class="flex flex-col h-96 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
    <div class="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
      <h4 class="text-sm font-bold text-slate-900">Consultation Chat</h4>
      <span class="text-xs text-slate-400 font-mono">{{ consultationId }}</span>
    </div>

    <div ref="scrollArea" class="flex-1 overflow-y-auto p-4 space-y-3">
      <p v-if="error" role="alert" class="text-xs text-red-600">{{ error }}</p>
      <p v-if="!messages.length && !error" class="text-xs text-slate-400 text-center mt-8">
        No messages yet — start the conversation.
      </p>
      <div v-for="m in messages" :key="m.message_id" :class="isMine(m) ? 'items-end' : 'items-start'" class="flex flex-col">
        <div
          :class="isMine(m) ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-900'"
          class="max-w-[75%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words"
        >{{ m.messageBody }}</div>
        <span class="text-[10px] text-slate-400 mt-1">{{ formatTime(m.sent_at) }}</span>
      </div>
    </div>

    <form @submit.prevent="send" class="border-t border-slate-100 p-3 flex gap-2">
      <input
        v-model="draft"
        type="text"
        maxlength="1000"
        aria-label="Message"
        placeholder="Type a message…"
        class="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-600"
      >
      <button type="submit" :disabled="sending || !draft.trim()" class="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg disabled:opacity-50">
        Send
      </button>
    </form>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { apiFetch } from '../services/api'

// Firebase-free chat: polls the encrypted MySQL message endpoints, which are
// guarded server-side by ensureConsultationAccess (object-level authorization).
const props = defineProps({ consultationId: { type: String, required: true } })

const messages = ref([])
const draft = ref('')
const sending = ref(false)
const error = ref('')
const scrollArea = ref(null)
let timer = null
const meId = String(localStorage.getItem('userId') || '')

const isMine = (m) => String(m.sender_id) === meId
const formatTime = (t) => {
  try { return new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) } catch { return '' }
}

const scrollToBottom = async () => {
  await nextTick()
  if (scrollArea.value) scrollArea.value.scrollTop = scrollArea.value.scrollHeight
}

const load = async () => {
  try {
    const data = await apiFetch(`/consultations/${props.consultationId}/messages`)
    const grew = data.length !== messages.value.length
    messages.value = data
    error.value = ''
    if (grew) await scrollToBottom()
  } catch (err) {
    error.value = err.message || 'Could not load messages.'
  }
}

const send = async () => {
  const body = draft.value.trim()
  if (!body) return
  sending.value = true
  try {
    await apiFetch(`/consultations/${props.consultationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ messageBody: body }),
    })
    draft.value = ''
    await load()
  } catch (err) {
    error.value = err.message || 'Could not send message.'
  } finally {
    sending.value = false
  }
}

onMounted(async () => {
  await load()
  timer = setInterval(load, 4000) // lightweight polling; no Firebase dependency
})
onBeforeUnmount(() => { if (timer) clearInterval(timer) })
</script>
