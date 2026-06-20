<template>
  <div class="min-h-screen bg-slate-50 font-sans">
    <header class="bg-white border-b border-slate-200">
      <div class="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
        <div>
          <h1 class="text-lg font-bold text-slate-900 tracking-tight">Finalize Consultation</h1>
          <p class="text-xs text-slate-500">{{ consultationId || 'No consultation' }}</p>
        </div>
        <button @click="router.push({ name: 'DocConsult' })" class="text-sm font-medium text-slate-500 hover:text-indigo-600">
          Back to queue
        </button>
      </div>
    </header>

    <main class="max-w-3xl mx-auto px-6 py-8">
      <div v-if="loading" class="bg-white border border-slate-200 rounded-2xl shadow-sm p-8 text-center text-sm text-slate-500">
        Loading…
      </div>

      <div v-else-if="loadError" class="bg-white border border-slate-200 rounded-2xl shadow-sm p-8 text-center text-sm text-red-500">
        {{ loadError }}
      </div>

      <div v-else-if="alreadyFinalized" class="bg-white border border-slate-200 rounded-2xl shadow-sm p-8 text-center">
        <div class="text-3xl mb-2">✅</div>
        <p class="text-sm font-semibold text-slate-900">This consultation has already been finalized.</p>
        <button @click="router.push({ name: 'DocConsult' })" class="mt-4 px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700">
          Back to queue
        </button>
      </div>

      <form v-else @submit.prevent="submit" class="space-y-6">
        <!-- Patient context -->
        <div class="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
          <div class="flex justify-between items-center">
            <div>
              <p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Patient</p>
              <p class="text-base font-bold text-slate-900">{{ patientName }}</p>
            </div>
            <span
              :class="needsMedication ? 'bg-indigo-50 text-indigo-700 ring-indigo-600/10' : 'bg-slate-100 text-slate-600 ring-slate-600/10'"
              class="inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium ring-1 ring-inset"
            >
              {{ needsMedication ? 'Requested medication' : 'Certificate only' }}
            </span>
          </div>
        </div>

        <!-- Medical certificate (always issued) -->
        <div class="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4">
          <h2 class="text-sm font-bold text-slate-900">Medical Certificate</h2>
          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Diagnosis</label>
            <input
              v-model="diagnosis"
              type="text"
              required
              placeholder="e.g. Acute Upper Respiratory Tract Infection"
              class="block w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Valid Until</label>
            <input
              v-model="validUntil"
              type="date"
              required
              class="block w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            <p class="text-xs text-slate-400 mt-1">Issue date is set to today automatically.</p>
          </div>
        </div>

        <!-- Prescription (only when the patient requested medication) -->
        <div v-if="needsMedication" class="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="text-sm font-bold text-slate-900">Prescription</h2>
            <button type="button" @click="addItem" class="text-sm font-semibold text-indigo-600 hover:text-indigo-700">+ Add medication</button>
          </div>

          <div v-for="(item, i) in items" :key="i" class="grid grid-cols-1 md:grid-cols-12 gap-3 items-start border-t border-slate-100 pt-4 first:border-t-0 first:pt-0">
            <input
              v-model="item.medication_name"
              type="text"
              placeholder="Medication"
              class="md:col-span-4 block w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            <input
              v-model="item.dosage"
              type="text"
              placeholder="Dosage (e.g. 500 mg)"
              class="md:col-span-3 block w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            <input
              v-model="item.instructions"
              type="text"
              placeholder="Instructions (e.g. 3x daily after meals)"
              class="md:col-span-4 block w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            <button
              type="button"
              @click="removeItem(i)"
              class="md:col-span-1 text-sm font-medium text-red-500 hover:text-red-600 py-2"
            >
              Remove
            </button>
          </div>
          <p class="text-xs text-slate-400">Leave blank to issue the certificate without medication.</p>
        </div>

        <p v-if="submitError" class="text-sm font-medium text-red-500">{{ submitError }}</p>

        <div class="flex justify-end">
          <button
            type="submit"
            :disabled="submitting"
            class="px-6 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg shadow-sm hover:bg-indigo-700 disabled:opacity-60"
          >
            {{ submitting ? 'Saving…' : 'Finalize & Issue' }}
          </button>
        </div>
      </form>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'

const route = useRoute()
const router = useRouter()

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000'
const api = axios.create({ baseURL: API_BASE })

const consultationId = route.query.id || ''

const loading = ref(true)
const loadError = ref('')
const alreadyFinalized = ref(false)

const patientName = ref('')
const needsMedication = ref(false)

const diagnosis = ref('')
const validUntil = ref('')
const items = ref([])

const submitting = ref(false)
const submitError = ref('')

const addItem = () => items.value.push({ medication_name: '', dosage: '', instructions: '' })
const removeItem = (i) => items.value.splice(i, 1)

// Default Valid Until to two days from today.
const defaultValidUntil = () => {
  const d = new Date()
  d.setDate(d.getDate() + 2)
  return d.toISOString().slice(0, 10)
}

onMounted(async () => {
  if (!consultationId) {
    loadError.value = 'No consultation was provided.'
    loading.value = false
    return
  }
  try {
    const { data } = await api.get(`/api/consultations/${consultationId}`)
    patientName.value = data.patient_name || data.patient_id
    needsMedication.value = data.needs_medication === true
    if (data.session_status === 'Completed') {
      alreadyFinalized.value = true
    } else {
      validUntil.value = defaultValidUntil()
      if (needsMedication.value) addItem()
    }
  } catch (err) {
    loadError.value = err.response?.data?.error || 'Unable to load the consultation.'
  } finally {
    loading.value = false
  }
})

const submit = async () => {
  submitting.value = true
  submitError.value = ''
  try {
    await api.post(`/api/consultations/${consultationId}/finalize`, {
      diagnosis: diagnosis.value.trim(),
      valid_until: validUntil.value,
      prescription_items: needsMedication.value ? items.value : []
    })
    router.push({ name: 'DocConsult' })
  } catch (err) {
    submitError.value = err.response?.data?.error || 'Could not finalize the consultation.'
  } finally {
    submitting.value = false
  }
}
</script>
