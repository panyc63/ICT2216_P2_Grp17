<template>
  <div class="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
    <div class="bg-white rounded-xl border border-slate-200 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
      <div class="p-6">
        <div class="flex justify-between items-start mb-1">
          <h3 class="text-lg font-bold text-slate-900">Finalize Consultation</h3>
          <button @click="$emit('close')" class="text-slate-400 hover:text-slate-600 text-sm font-semibold">Close</button>
        </div>
        <p class="text-sm text-slate-500 mb-5">
          {{ order.order_id }} · {{ order.patient_name || order.patient_id }}
          <span
            :class="needsMedication ? 'bg-indigo-50 text-indigo-700 ring-indigo-600/10' : 'bg-slate-100 text-slate-600 ring-slate-600/10'"
            class="ml-1 inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset"
          >
            {{ needsMedication ? 'Requested medication' : 'Certificate only' }}
          </span>
        </p>

        <form @submit.prevent="submit" class="space-y-5">
          <!-- Medical certificate (optional) -->
          <div class="space-y-3">
            <label class="flex items-center gap-2 cursor-pointer">
              <input v-model="issueMc" type="checkbox" class="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
              <span class="text-sm font-bold text-slate-900">Issue Medical Certificate for this visit?</span>
            </label>

            <template v-if="issueMc">
              <div>
                <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Diagnosis</label>
                <input
                  v-model="diagnosis"
                  type="text"
                  placeholder="e.g. Acute Upper Respiratory Tract Infection"
                  class="block w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Valid Until</label>
                <input
                  v-model="validUntil"
                  type="date"
                  class="block w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <p class="text-xs text-slate-400 mt-1">Issue date is set to today automatically.</p>
              </div>
            </template>
            <p v-else class="text-xs text-slate-400">No certificate will be issued for this consultation.</p>
          </div>

          <!-- Prescription (only when the patient requested medication) -->
          <div v-if="needsMedication" class="space-y-3 border-t border-slate-100 pt-4">
            <div class="flex items-center justify-between">
              <h4 class="text-sm font-bold text-slate-900">Prescription</h4>
              <button type="button" @click="addItem" class="text-sm font-semibold text-indigo-600 hover:text-indigo-700">+ Add medication</button>
            </div>

            <div v-for="(item, i) in items" :key="i" class="grid grid-cols-12 gap-2 items-start">
              <input
                v-model="item.medication_name"
                type="text"
                placeholder="Medication"
                class="col-span-4 block w-full px-2.5 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <input
                v-model="item.dosage"
                type="text"
                placeholder="Dosage"
                class="col-span-3 block w-full px-2.5 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <input
                v-model="item.instructions"
                type="text"
                placeholder="Instructions"
                class="col-span-4 block w-full px-2.5 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <button type="button" @click="removeItem(i)" class="col-span-1 text-sm font-medium text-red-500 hover:text-red-600 py-2">✕</button>
            </div>
            <p class="text-xs text-slate-400">Leave blank to issue the certificate without medication.</p>
          </div>

          <p v-if="error" class="text-sm font-medium text-red-500">{{ error }}</p>

          <div class="flex justify-end gap-2 pt-1">
            <button type="button" @click="$emit('close')" :disabled="submitting" class="px-3 py-1.5 border border-slate-300 text-slate-700 text-sm font-medium rounded-md bg-white disabled:opacity-60">Cancel</button>
            <button type="submit" :disabled="submitting" class="px-4 py-1.5 bg-indigo-600 text-white text-sm font-semibold rounded-md hover:bg-indigo-700 disabled:opacity-60">
              {{ submitting ? 'Saving…' : 'Finalize & Issue' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import axios from 'axios'

const props = defineProps({
  order: { type: Object, required: true }
})
const emit = defineEmits(['close', 'finalized'])

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000'
const api = axios.create({ baseURL: API_BASE })

const needsMedication = computed(() => props.order.needs_medication === true)

// Default Valid Until to two days from today.
const defaultValidUntil = () => {
  const d = new Date()
  d.setDate(d.getDate() + 2)
  return d.toISOString().slice(0, 10)
}

const issueMc = ref(true)
const diagnosis = ref('')
const validUntil = ref(defaultValidUntil())
const items = ref(needsMedication.value ? [{ medication_name: '', dosage: '', instructions: '' }] : [])

const submitting = ref(false)
const error = ref('')

const addItem = () => items.value.push({ medication_name: '', dosage: '', instructions: '' })
const removeItem = (i) => items.value.splice(i, 1)

const submit = async () => {
  if (!props.order.consultation_id) {
    error.value = 'This order has no linked consultation to finalize.'
    return
  }
  if (issueMc.value && (!diagnosis.value.trim() || !validUntil.value)) {
    error.value = 'Diagnosis and valid-until are required to issue a certificate.'
    return
  }
  submitting.value = true
  error.value = ''
  try {
    await api.post(`/api/consultations/${props.order.consultation_id}/finalize`, {
      issue_mc: issueMc.value,
      diagnosis: issueMc.value ? diagnosis.value.trim() : undefined,
      valid_until: issueMc.value ? validUntil.value : undefined,
      prescription_items: needsMedication.value ? items.value : []
    })
    emit('finalized')
  } catch (err) {
    error.value = err.response?.data?.error || 'Could not finalize the consultation.'
  } finally {
    submitting.value = false
  }
}
</script>
