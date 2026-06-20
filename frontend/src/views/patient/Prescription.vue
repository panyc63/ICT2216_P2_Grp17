<template>
  <div>
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-slate-900 tracking-tight">Active Prescription</h1>
      <p class="text-sm text-slate-500">Medication prescribed for you in your most recent consultation.</p>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="bg-white border border-slate-200 rounded-2xl shadow-sm p-8 max-w-3xl text-center text-sm text-slate-500">
      Loading…
    </div>

    <!-- Still being finalized by the doctor -->
    <div v-else-if="!ready" class="bg-white border border-slate-200 rounded-2xl shadow-sm p-10 max-w-3xl text-center">
      <div class="flex items-center justify-center gap-2 mb-4">
        <span class="h-3 w-3 rounded-full bg-amber-400 animate-ping"></span>
        <span class="text-sm font-medium text-slate-500">Finalizing…</span>
      </div>
      <p class="text-sm font-semibold text-slate-900">Your visit is still being finalized by the doctor.</p>
      <p class="text-xs text-slate-500 mt-1">This page will update automatically. You can also check again.</p>
      <button
        @click="fetchPrescription"
        class="mt-5 px-4 py-2 border border-slate-300 text-slate-700 text-sm font-semibold rounded-lg bg-white hover:bg-slate-50"
      >
        Check again
      </button>
      <p v-if="error" class="mt-4 text-sm font-medium text-red-500">{{ error }}</p>
    </div>

    <!-- Ready -->
    <template v-else>
      <!-- Prescription card -->
      <div class="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden max-w-3xl">
        <div class="bg-slate-900 text-white px-6 py-4 flex justify-between items-center">
          <div>
            <p class="text-sm font-semibold">Prescribed by {{ doctorName || '—' }}</p>
            <p class="text-xs text-slate-400">Issued {{ issuedDate || '—' }}</p>
          </div>
          <span class="inline-flex items-center rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-medium text-emerald-300 ring-1 ring-inset ring-emerald-500/30">
            Active
          </span>
        </div>

        <table v-if="items.length" class="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead class="bg-slate-50 font-semibold text-slate-700">
            <tr>
              <th class="px-6 py-3">Medication</th>
              <th class="px-6 py-3">Dosage</th>
              <th class="px-6 py-3">Instructions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 text-slate-600">
            <tr v-for="(item, i) in items" :key="i">
              <td class="px-6 py-4 font-medium text-slate-900">{{ item.medication_name }}</td>
              <td class="px-6 py-4">{{ item.dosage || '—' }}</td>
              <td class="px-6 py-4">{{ item.instructions || '—' }}</td>
            </tr>
          </tbody>
        </table>

        <p v-else class="px-6 py-8 text-center text-sm text-slate-500">
          No medication was prescribed for this visit.
        </p>
      </div>

      <!-- Collection method -->
      <div class="mt-6 bg-white border border-slate-200 rounded-2xl shadow-sm p-8 max-w-3xl space-y-4">
        <div>
          <h3 class="text-sm font-bold text-slate-900">How would you like to receive your medication?</h3>
          <p class="text-sm text-slate-500">Choose collection or delivery for the prescription above.</p>
        </div>

        <label
          v-for="option in options"
          :key="option.value"
          :class="method === option.value ? 'border-indigo-600 ring-2 ring-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-slate-300'"
          class="flex items-start gap-4 border rounded-xl p-4 cursor-pointer transition-all"
        >
          <input type="radio" :value="option.value" v-model="method" class="mt-1 h-4 w-4 text-indigo-600 focus:ring-indigo-500" />
          <div>
            <p class="text-sm font-bold text-slate-900">{{ option.title }}</p>
            <p class="text-sm text-slate-500">{{ option.description }}</p>
          </div>
        </label>

        <div v-if="method === 'delivery'" class="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <p class="text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">Delivering to</p>
          <p class="text-sm font-medium text-slate-900">{{ profile.name }}</p>
          <p class="text-sm text-slate-600">{{ profile.homeAddress }}</p>
          <router-link to="/patient/profile" class="inline-block mt-2 text-xs font-semibold text-indigo-600 hover:text-indigo-700">
            Update address in Profile
          </router-link>
        </div>

        <p v-if="error" class="text-sm font-medium text-red-500">{{ error }}</p>

        <div class="pt-2">
          <button
            @click="confirmAndFinish"
            :disabled="saving"
            class="px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg shadow-sm hover:bg-indigo-700 disabled:opacity-60"
          >
            {{ saving ? 'Saving…' : 'Confirm & Finish' }}
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { patientStore } from '../../store/patientStore'

const router = useRouter()
const profile = patientStore.profile

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000'
const api = axios.create({ baseURL: API_BASE })
const patientId = patientStore.patientId || localStorage.getItem('userId') || ''

const options = [
  { value: 'self-collect', title: 'Self-Collect', description: 'Pick up at the MediFlow pharmacy counter during opening hours.' },
  { value: 'delivery', title: 'Home Delivery', description: 'Have your medication delivered to your registered home address.' }
]

const loading = ref(true)
const ready = ref(false)        // consultation finalized (session Completed)
const error = ref('')
const saving = ref(false)

const consultationId = ref(null)
const doctorName = ref('')
const issuedDate = ref('')
const items = ref([])
const method = ref(patientStore.medication.method)

let pollTimer = null

const stopPolling = () => {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
}

const fetchPrescription = async () => {
  error.value = ''
  try {
    const { data } = await api.get(`/api/prescriptions/${patientId}`)
    consultationId.value = data.consultation_id
    if (data.session_status === 'Completed') {
      ready.value = true
      doctorName.value = data.doctor_name || ''
      issuedDate.value = data.issued_date || ''
      items.value = data.items || []
      if (data.collection_method) method.value = data.collection_method
      stopPolling()
    }
  } catch (err) {
    error.value = err.response?.data?.error || 'Unable to load your prescription.'
  } finally {
    loading.value = false
  }
}

const confirmAndFinish = async () => {
  saving.value = true
  error.value = ''
  try {
    if (consultationId.value) {
      await api.patch(`/api/consultations/${consultationId.value}/collection-method`, {
        collection_method: method.value
      })
    }
    patientStore.medication.method = method.value
    router.push('/patient/closing')
  } catch (err) {
    error.value = err.response?.data?.error || 'Could not save your collection choice.'
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  if (!patientId) {
    error.value = 'No patient session found.'
    loading.value = false
    return
  }
  await fetchPrescription()
  // While the doctor is still finalizing, poll until the record is ready.
  if (!ready.value) {
    pollTimer = setInterval(fetchPrescription, 4000)
  }
})

onUnmounted(stopPolling)
</script>
