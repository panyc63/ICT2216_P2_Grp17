<template>
  <div>
    <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold text-slate-900 tracking-tight">My Consultations</h1>
        <p class="text-sm text-slate-500">Request a tele-consultation; a doctor will pick it up, then you can chat in real time.</p>
      </div>
      <button
        @click="requestConsultation"
        :disabled="requesting"
        class="px-4 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg shadow-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {{ requesting ? 'Requesting…' : '+ Request Consultation' }}
      </button>
    </div>

    <p v-if="error" role="alert" class="mb-4 text-sm font-medium text-red-600">{{ error }}</p>
    <p v-if="notice" role="status" class="mb-4 text-sm font-medium text-emerald-600">{{ notice }}</p>

    <div v-if="!consultations.length" class="bg-white border border-slate-200 rounded-xl p-10 text-center text-slate-500 max-w-3xl">
      No consultations yet. Click <span class="font-semibold">“Request Consultation”</span> to start one.
    </div>

    <div v-else class="grid gap-4 max-w-3xl">
      <div v-for="c in consultations" :key="c.consultation_id" class="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p class="text-sm font-bold text-slate-900">{{ c.consultation_id }}</p>
            <p class="text-xs text-slate-500 mt-0.5">Doctor: {{ c.doctor_name || 'Awaiting assignment' }}</p>
          </div>
          <div class="flex items-center gap-3">
            <span :class="statusClass(c.session_status)" class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset">
              {{ c.session_status }}
            </span>
            <button @click="toggleChat(c.consultation_id)" class="text-xs font-semibold text-indigo-600 hover:underline">
              {{ openChatId === c.consultation_id ? 'Hide chat' : 'Open chat' }}
            </button>
          </div>
        </div>
        <div v-if="openChatId === c.consultation_id" class="mt-4">
          <ChatPanel :consultation-id="c.consultation_id" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { apiFetch } from '../../services/api'
import ChatPanel from '../../components/ChatPanel.vue'

const consultations = ref([])
const requesting = ref(false)
const error = ref('')
const notice = ref('')
const openChatId = ref('')

const load = async () => {
  try {
    consultations.value = await apiFetch('/consultations')
  } catch (err) {
    error.value = err.message || 'Could not load consultations.'
  }
}

const requestConsultation = async () => {
  requesting.value = true
  error.value = ''
  notice.value = ''
  try {
    const res = await apiFetch('/consultations', { method: 'POST', body: JSON.stringify({}) })
    notice.value = `Consultation ${res.consultationId} requested — status: ${res.status}.`
    await load()
  } catch (err) {
    error.value = err.message || 'Could not request a consultation.'
  } finally {
    requesting.value = false
  }
}

const toggleChat = (id) => { openChatId.value = openChatId.value === id ? '' : id }

const statusClass = (s) => ({
  Active: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  Pending: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  Completed: 'bg-slate-100 text-slate-600 ring-slate-500/20',
  Cancelled: 'bg-red-50 text-red-700 ring-red-600/20',
}[s] || 'bg-slate-100 text-slate-600 ring-slate-500/20')

onMounted(load)
</script>
