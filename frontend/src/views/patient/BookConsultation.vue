<template>
  <div>
    <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold text-slate-900 tracking-tight">My Consultations</h1>
        <p class="text-sm text-slate-500">Start a tele-consultation by sharing your symptoms; a doctor picks it up, then you can chat or video in real time.</p>
      </div>
      <button
        v-if="!showForm"
        @click="showForm = true"
        class="px-4 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg shadow-sm hover:bg-indigo-700"
      >
        + Start New Consultation
      </button>
    </div>

    <p v-if="error" role="alert" class="mb-4 text-sm font-medium text-red-600">{{ error }}</p>
    <p v-if="notice" role="status" class="mb-4 text-sm font-medium text-emerald-600">{{ notice }}</p>

    <!-- New consultation = pre-consultation questionnaire (triage). Submitting opens the
         linked, prioritized consultation, so this is the single booking entry point. -->
    <div v-if="showForm" class="mb-6 bg-white border border-slate-200 rounded-2xl shadow-sm p-6 max-w-3xl">
      <div class="mb-4">
        <h2 class="text-lg font-bold text-slate-900">Pre-Consultation Questionnaire</h2>
        <p class="text-sm text-slate-500">Help the doctor prepare by sharing your current symptoms. This opens your consultation and sets its priority.</p>
      </div>
      <TriageForm cancellable @submitted="onTriageSubmitted" @cancel="showForm = false" />
    </div>

    <div v-if="!consultations.length && !showForm" class="bg-white border border-slate-200 rounded-xl p-10 text-center text-slate-500 max-w-3xl">
      No consultations yet. Click <span class="font-semibold">“Start New Consultation”</span> to begin.
    </div>

    <div v-else class="grid gap-4 max-w-3xl">
      <div v-for="c in consultations" :key="c.consultation_id" class="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p class="text-sm font-bold text-slate-900">{{ c.consultation_id }}</p>
            <p class="text-xs text-slate-500 mt-0.5">Doctor: {{ c.doctor_name || 'Awaiting assignment' }}</p>
          </div>
          <div class="flex items-center gap-3">
            <span v-if="c.priority" :class="priorityClass(c.priority)" class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset">
              {{ c.priority }}
            </span>
            <span :class="statusClass(c.session_status)" class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset">
              {{ c.session_status }}
            </span>
            <button @click="toggleChat(c.consultation_id)" class="text-xs font-semibold text-indigo-600 hover:underline">
              {{ openChatId === c.consultation_id ? 'Hide chat' : 'Open chat' }}
            </button>
            <button @click="toggleVideo(c.consultation_id)" class="text-xs font-semibold text-indigo-600 hover:underline">
              {{ openVideoId === c.consultation_id ? 'Hide video' : 'Video call' }}
            </button>
          </div>
        </div>
        <div v-if="openChatId === c.consultation_id" class="mt-4">
          <ChatPanel :consultation-id="c.consultation_id" />
        </div>
        <div v-if="openVideoId === c.consultation_id" class="mt-4">
          <VideoConsult :consultation-id="c.consultation_id" role="Patient" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { apiFetch } from '../../services/api'
import ChatPanel from '../../components/ChatPanel.vue'
import VideoConsult from '../../components/VideoConsult.vue'
import TriageForm from '../../components/TriageForm.vue'

const consultations = ref([])
const showForm = ref(false)
const error = ref('')
const notice = ref('')
const openChatId = ref('')
const openVideoId = ref('')

const load = async () => {
  try {
    consultations.value = await apiFetch('/consultations')
  } catch (err) {
    error.value = err.message || 'Could not load consultations.'
  }
}

// Triage submit opened the consultation server-side; surface the priority and refresh.
const onTriageSubmitted = async (result) => {
  error.value = ''
  notice.value = `Triage priority: ${result.priority} — consultation ${result.consultationId} opened and placed in the queue.`
  showForm.value = false
  await load()
}

const toggleChat = (id) => { openChatId.value = openChatId.value === id ? '' : id }
const toggleVideo = (id) => { openVideoId.value = openVideoId.value === id ? '' : id }

const statusClass = (s) => ({
  Active: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  Pending: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  Completed: 'bg-slate-100 text-slate-600 ring-slate-500/20',
  Cancelled: 'bg-red-50 text-red-700 ring-red-600/20',
}[s] || 'bg-slate-100 text-slate-600 ring-slate-500/20')

const priorityClass = (p) => ({
  Emergency: 'bg-red-50 text-red-700 ring-red-600/20',
  Urgent: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  Routine: 'bg-slate-100 text-slate-600 ring-slate-500/20',
}[p] || 'bg-slate-100 text-slate-600 ring-slate-500/20')

onMounted(load)
</script>
