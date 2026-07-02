<template>
  <div>
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-slate-900 tracking-tight">Your profile</h1>
      <p class="text-sm text-slate-500 mt-1">Your account details, and the address we deliver your medication to.</p>
    </div>

    <div class="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden max-w-2xl">
      <!-- Identity header -->
      <div class="flex items-center gap-4 px-6 sm:px-8 py-6 border-b border-slate-100 bg-indigo-50/40">
        <div class="w-12 h-12 rounded-2xl bg-brand-gradient flex items-center justify-center text-white text-lg font-bold shadow-sm" aria-hidden="true">
          {{ initials }}
        </div>
        <div class="min-w-0">
          <p class="text-base font-bold text-slate-900 truncate">{{ profile.name || '—' }}</p>
          <p class="text-sm text-slate-500 truncate">{{ profile.email || '—' }}</p>
        </div>
      </div>

      <div class="p-6 sm:p-8">
        <dl class="divide-y divide-slate-100">
          <div class="py-4 flex justify-between gap-4">
            <dt class="text-sm font-semibold text-slate-500">Full name</dt>
            <dd class="text-sm font-semibold text-slate-900 text-right">{{ profile.name || '—' }}</dd>
          </div>
          <div class="py-4 flex justify-between gap-4">
            <dt class="text-sm font-semibold text-slate-500">Email address</dt>
            <dd class="text-sm font-semibold text-slate-900 text-right">{{ profile.email || '—' }}</dd>
          </div>
          <div class="py-4 flex justify-between gap-4">
            <dt class="text-sm font-semibold text-slate-500">NRIC</dt>
            <dd class="text-sm font-semibold text-slate-900 text-right">{{ profile.nric || '—' }}</dd>
          </div>

          <div class="py-4">
            <div class="flex justify-between items-center gap-4">
              <dt class="text-sm font-semibold text-slate-500">Home address</dt>
              <button
                v-if="!isEditing"
                @click="startEditing"
                class="text-sm font-semibold text-indigo-600 hover:text-indigo-700 rounded-lg px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                Edit
              </button>
            </div>

            <dd v-if="!isEditing" class="mt-2 text-sm font-semibold text-slate-900">
              {{ profile.address || '—' }}
            </dd>

            <div v-else class="mt-3">
              <textarea
                v-model="draftAddress"
                rows="3"
                aria-label="Home address"
                class="block w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Enter your home address"
              ></textarea>
              <div class="flex justify-end gap-2 mt-3">
                <button
                  @click="cancelEditing"
                  class="px-4 py-2 border border-slate-300 text-slate-700 text-sm font-semibold rounded-xl bg-white hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                >
                  Cancel
                </button>
                <button
                  @click="saveAddress"
                  class="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl shadow-sm hover:bg-indigo-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                >
                  Save address
                </button>
              </div>
            </div>
          </div>
        </dl>

        <p v-if="savedNotice" role="status" class="mt-4 text-sm font-medium text-emerald-600">
          Home address updated.
        </p>

        <p class="mt-6 flex items-start gap-2 text-xs text-slate-500 border-t border-slate-100 pt-4">
          <span aria-hidden="true">🔒</span>
          <span>Your personal and clinical details are encrypted and only accessible to your care team.</span>
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { apiFetch } from '../../services/api'

const profile = reactive({ name: '', email: '', nric: '', address: '' })

const isEditing = ref(false)
const draftAddress = ref('')
const savedNotice = ref(false)

const initials = computed(() => {
  const parts = String(profile.name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '🙂'
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
})

const loadProfile = async () => {
  try {
    const data = await apiFetch('/me/profile')
    Object.assign(profile, {
      name: data.name,
      email: data.email,
      nric: data.nric,
      address: data.address,
    })
  } catch {
    // Unauthenticated or error — leave fields blank.
  }
}

onMounted(loadProfile)

const startEditing = () => {
  draftAddress.value = profile.address
  savedNotice.value = false
  isEditing.value = true
}

const cancelEditing = () => {
  isEditing.value = false
}

const saveAddress = async () => {
  try {
    await apiFetch('/me/profile', {
      method: 'PATCH',
      body: JSON.stringify({ address: draftAddress.value.trim() }),
    })
    profile.address = draftAddress.value.trim()
    isEditing.value = false
    savedNotice.value = true
    // Auto-dismiss the confirmation so it doesn't linger on the page.
    setTimeout(() => { savedNotice.value = false }, 4000)
  } catch (err) {
    alert(err.message || 'Could not update profile.')
  }
}
</script>
