<template>
  <div>
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-slate-900 tracking-tight">My Profile</h1>
      <p class="text-sm text-slate-500">Review your account details and keep your home delivery address up to date.</p>
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
        <div class="py-4 flex justify-between gap-4">
          <dt class="text-sm font-semibold text-slate-500">NRIC</dt>
          <dd class="text-sm font-medium text-slate-900 text-right">{{ profile.nric }}</dd>
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
                class="px-3 py-1.5 border border-slate-300 text-slate-700 text-sm font-medium rounded-md bg-white hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                @click="saveAddress"
                class="px-3 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700"
              >
                Save Address
              </button>
            </div>
          </div>
        </div>
      </dl>

      <p v-if="savedNotice" class="mt-4 text-sm font-medium text-emerald-600">
        Home address updated.
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { patientStore } from '../../store/patientStore'

const profile = patientStore.profile

const isEditing = ref(false)
const draftAddress = ref('')
const savedNotice = ref(false)

const startEditing = () => {
  draftAddress.value = profile.homeAddress
  savedNotice.value = false
  isEditing.value = true
}

const cancelEditing = () => {
  isEditing.value = false
}

const saveAddress = () => {
  profile.homeAddress = draftAddress.value.trim()
  isEditing.value = false
  savedNotice.value = true
}
</script>
