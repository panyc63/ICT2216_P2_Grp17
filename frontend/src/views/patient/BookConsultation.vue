<template>
  <div>
    <div class="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold text-slate-900 tracking-tight">Your consultations</h1>
        <p class="text-sm text-slate-500 mt-1 max-w-xl">
          Tell us how you're feeling and a doctor will pick up your case. Once it's open, you can chat or start a
          video call whenever you're ready.
        </p>
      </div>
      <button
        v-if="!showForm"
        @click="showForm = true"
        class="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl shadow-sm hover:bg-indigo-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
      >
        <span aria-hidden="true">＋</span> Start a consultation
      </button>
    </div>

    <p v-if="error" role="alert" class="mb-4 rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm font-medium text-rose-700">{{ error }}</p>
    <p v-if="notice" role="status" class="mb-4 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm font-medium text-emerald-700">{{ notice }}</p>

    <!-- New consultation = pre-consultation questionnaire (triage). Submitting opens the
         linked, prioritized consultation, so this is the single booking entry point. -->
    <div v-if="showForm" class="mb-6 bg-white border border-slate-200 rounded-2xl shadow-sm p-6 sm:p-8 max-w-3xl">
      <div class="mb-6">
        <h2 class="text-lg font-bold text-slate-900">A few questions before we begin</h2>
        <p class="text-sm text-slate-500 mt-1">
          Your answers help the doctor prepare and set how urgently you're seen. It only takes a minute.
        </p>
      </div>
      <TriageForm cancellable @submitted="onTriageSubmitted" @cancel="showForm = false" />
      <p class="mt-6 flex items-start gap-2 text-xs text-slate-500 border-t border-slate-100 pt-4">
        <span aria-hidden="true">⚠️</span>
        <span>MediFlow is for non-emergencies. If this is a medical emergency, call <span class="font-semibold text-slate-700">995</span> right away.</span>
      </p>
    </div>

    <!-- Empty state -->
    <div v-if="!consultations.length && !showForm" class="bg-white border border-slate-200 rounded-2xl shadow-sm p-10 text-center max-w-3xl">
      <div class="w-14 h-14 mx-auto rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-2xl" aria-hidden="true">🩺</div>
      <h2 class="mt-4 font-bold text-slate-900">You haven't booked a consultation yet</h2>
      <p class="mt-1.5 text-sm text-slate-500 max-w-md mx-auto">
        When you're ready, answer a few quick questions about your symptoms and a doctor will be with you.
      </p>
      <button
        @click="showForm = true"
        class="inline-flex items-center gap-2 mt-6 px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl shadow-sm hover:bg-indigo-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
      >
        <span aria-hidden="true">＋</span> Start a consultation
      </button>
    </div>

    <div v-else-if="consultations.length" class="grid gap-4 max-w-3xl">
      <div
        v-for="c in consultations"
        :key="c.consultation_id"
        class="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-card-hover transition-shadow"
      >
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Consultation</p>
            <p class="text-sm font-bold text-slate-900 truncate">{{ c.consultation_id }}</p>
            <p class="text-xs text-slate-500 mt-0.5">
              <span aria-hidden="true">👩‍⚕️</span>
              {{ c.doctor_name ? `Dr ${c.doctor_name}` : 'Waiting for a doctor to pick up your case' }}
            </p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <span v-if="c.priority" :class="priorityClass(c.priority)" class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset">
              {{ c.priority }}
            </span>
            <span :class="statusClass(c.session_status)" class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset">
              {{ c.session_status }}
            </span>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-slate-100">
          <button
            @click="toggleChat(c.consultation_id)"
            class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            :class="openChatId === c.consultation_id ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'"
          >
            <span aria-hidden="true">💬</span>{{ openChatId === c.consultation_id ? 'Hide chat' : 'Open chat' }}
          </button>
          <button
            @click="toggleVideo(c.consultation_id)"
            class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            :class="openVideoId === c.consultation_id ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'"
          >
            <span aria-hidden="true">🎥</span>{{ openVideoId === c.consultation_id ? 'Hide video' : 'Video call' }}
          </button>
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
  notice.value = `Thanks — your consultation ${result.consultationId} is open and in the queue (priority: ${result.priority}).`
  showForm.value = false
  await load()
}

const toggleChat = (id) => { openChatId.value = openChatId.value === id ? '' : id }
const toggleVideo = (id) => { openVideoId.value = openVideoId.value === id ? '' : id }

const statusClass = (s) => ({
  Active: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  Pending: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  Completed: 'bg-slate-100 text-slate-600 ring-slate-500/20',
  Cancelled: 'bg-rose-50 text-rose-700 ring-rose-600/20',
}[s] || 'bg-slate-100 text-slate-600 ring-slate-500/20')

const priorityClass = (p) => ({
  Emergency: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  Urgent: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  Routine: 'bg-slate-100 text-slate-600 ring-slate-500/20',
}[p] || 'bg-slate-100 text-slate-600 ring-slate-500/20')

onMounted(load)
</script>
