<template>
  <div>
    <div class="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-slate-900 tracking-tight">My Profile</h1>
        <p class="text-sm text-slate-500">Review your account details and keep your home delivery address up to date.</p>
      </div>
      <button
        @click="startConsultation"
        class="shrink-0 px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg shadow-sm hover:bg-indigo-700"
      >
        Start Consultation
      </button>
    </div>

    <div class="bg-white border border-slate-200 rounded-2xl shadow-sm p-8 max-w-2xl">
      <dl class="divide-y divide-slate-100">
        <div class="py-4 flex justify-between gap-4">
          <dt class="text-sm font-semibold text-slate-500">Full Name</dt>
          <dd class="text-sm font-medium text-slate-900 text-right">{{ profile.name }}</dd>
        </div>
        <div class="py-4 flex justify-between gap-4">
          <dt class="text-sm font-semibold text-slate-500">Email Address</dt>
          <dd class="text-sm font-medium text-slate-900 text-right">{{ profile.email }}</dd>
        </div>

        <div class="py-4">
          <div class="flex justify-between items-center gap-4">
            <dt class="text-sm font-semibold text-slate-500">Home Address</dt>
            <button
              v-if="!isEditing"
              @click="startEditing"
              class="text-sm font-semibold text-indigo-600 hover:text-indigo-700"
            >
              Edit
            </button>
          </div>

          <dd v-if="!isEditing" class="mt-2 text-sm font-medium text-slate-900">
            {{ profile.homeAddress }}
          </dd>

          <div v-else class="mt-3">
            <textarea
              v-model="draftAddress"
              rows="3"
              class="block w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Enter your home address"
            ></textarea>
            <div class="flex justify-end gap-2 mt-3">
              <button
                @click="cancelEditing"
                :disabled="saving"
                class="px-3 py-1.5 border border-slate-300 text-slate-700 text-sm font-medium rounded-md bg-white hover:bg-slate-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                @click="saveAddress"
                :disabled="saving"
                class="px-3 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 disabled:opacity-60"
              >
                {{ saving ? 'Saving…' : 'Save Address' }}
              </button>
            </div>
            <p v-if="saveError" class="mt-2 text-sm font-medium text-red-500">{{ saveError }}</p>
          </div>
        </div>
      </dl>

      <p v-if="savedNotice" class="mt-4 text-sm font-medium text-emerald-600">
        Home address updated.
      </p>
    </div>

    <!-- Documents & delivery — accessible here rather than as flow steps. -->
    <div class="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
      <router-link
        to="/patient/download-mc"
        class="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 hover:border-indigo-400 hover:shadow-md transition-all"
      >
        <div class="text-xl mb-2">📄</div>
        <p class="text-sm font-bold text-slate-900">Medical Certificates</p>
        <p class="text-xs text-slate-500 mt-1">View and download your medical certificate.</p>
      </router-link>

      <router-link
        v-if="needsMedication"
        to="/patient/track-delivery"
        class="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 hover:border-indigo-400 hover:shadow-md transition-all"
      >
        <div class="text-xl mb-2">🚚</div>
        <p class="text-sm font-bold text-slate-900">Track Delivery</p>
        <p class="text-xs text-slate-500 mt-1">Follow your medication delivery status.</p>
      </router-link>

      <div
        v-else
        class="bg-slate-50 border border-slate-200 rounded-2xl p-5 opacity-70"
      >
        <div class="text-xl mb-2">🚚</div>
        <p class="text-sm font-bold text-slate-500">Track Delivery</p>
        <p class="text-xs text-slate-400 mt-1">Not applicable — no medication was requested.</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { patientStore } from '../../store/patientStore'

const router = useRouter()
const profile = patientStore.profile

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000'
const api = axios.create({ baseURL: API_BASE })
const patientId = patientStore.patientId || localStorage.getItem('userId') || ''

// Track Delivery only applies to Path B (medication requested).
const needsMedication = computed(() => patientStore.needsMedication === true)

// Entry point into the sequential flow (the stepper itself isn't clickable).
const startConsultation = () => {
  router.push('/patient/questionnaire')
}

const isEditing = ref(false)
const draftAddress = ref('')
const savedNotice = ref(false)
const saving = ref(false)
const saveError = ref('')

const startEditing = () => {
  draftAddress.value = profile.homeAddress
  savedNotice.value = false
  saveError.value = ''
  isEditing.value = true
}

const cancelEditing = () => {
  isEditing.value = false
}

const saveAddress = async () => {
  saving.value = true
  saveError.value = ''
  try {
    const { data } = await api.patch(`/api/users/${patientId}`, {
      home_address: draftAddress.value.trim()
    })
    // Reflect the persisted value in the shared store.
    profile.homeAddress = data.home_address || ''
    isEditing.value = false
    savedNotice.value = true
  } catch (err) {
    saveError.value = err.response?.data?.error || 'Could not save your address. Please try again.'
  } finally {
    saving.value = false
  }
}
</script>
