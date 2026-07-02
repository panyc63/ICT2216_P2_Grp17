<template>
  <div>
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-slate-900 tracking-tight">Your medication</h1>
      <p class="text-sm text-slate-500 mt-1">Review what's been prescribed and choose how you'd like to receive it.</p>
    </div>

    <div class="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 sm:p-8 max-w-2xl space-y-8">
      <!-- Real prescriptions from the pharmacy system -->
      <div>
        <h2 class="text-sm font-bold text-slate-700 mb-3">Prescribed medication</h2>
        <div v-if="loading" class="text-sm text-slate-400">Loading your medication…</div>
        <div v-else-if="!prescriptions.length" class="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
          Nothing prescribed yet. Once your doctor prescribes medication, it will show up here.
        </div>
        <ul v-else class="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
          <li v-for="p in prescriptions" :key="p.prescription_id" class="flex items-center justify-between px-4 py-3">
            <div>
              <p class="text-sm font-semibold text-slate-900">{{ p.medication_name }}</p>
              <p class="text-xs text-slate-500">{{ p.dosage }} · {{ p.frequency }}</p>
            </div>
            <span
              class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset"
              :class="p.status === 'Fulfilled' ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' : p.status === 'Cancelled' ? 'bg-rose-50 text-rose-700 ring-rose-600/20' : 'bg-amber-50 text-amber-700 ring-amber-600/20'"
            >{{ p.status }}</span>
          </li>
        </ul>
      </div>

      <!-- Collection method -->
      <div class="space-y-4">
        <h2 class="text-sm font-bold text-slate-700">How would you like to receive it?</h2>
        <label
          v-for="option in options"
          :key="option.value"
          :class="[
            method === option.value ? 'border-indigo-600 ring-2 ring-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-slate-300',
            (option.value === 'Delivery' && !hasAddress) ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
          ]"
          class="flex items-start gap-4 border rounded-xl p-4 transition-all"
        >
          <input type="radio" :value="option.value" v-model="method" :disabled="option.value === 'Delivery' && !hasAddress" class="mt-1 h-4 w-4 text-indigo-600 focus:ring-indigo-500">
          <div>
            <p class="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span aria-hidden="true">{{ option.icon }}</span>{{ option.title }}
            </p>
            <p class="text-sm text-slate-500 mt-0.5">{{ option.description }}</p>
            <p v-if="option.value === 'Delivery' && !hasAddress" class="text-xs text-amber-600 mt-1.5">
              Add a home address in your Profile to unlock delivery.
            </p>
          </div>
        </label>

        <div v-if="method === 'Delivery'" class="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <p class="text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">Delivering to</p>
          <p class="text-sm font-semibold text-slate-900">{{ profile.name || '—' }}</p>
          <p class="text-sm text-slate-600">{{ profile.address || 'No address on file' }}</p>
          <router-link to="/patient/profile" class="inline-block mt-2 text-xs font-semibold text-indigo-600 hover:text-indigo-700">
            Update address in Profile →
          </router-link>
        </div>

        <div class="flex flex-wrap items-center gap-4 pt-1">
          <button
            @click="saveMethod"
            :disabled="!activeCount || saving"
            class="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
          >
            {{ saving ? 'Saving…' : 'Save my choice' }}
          </button>
          <p v-if="notice" role="status" aria-live="polite" class="text-sm font-medium text-emerald-600">{{ notice }}</p>
          <p v-if="error" role="alert" class="text-sm font-medium text-rose-600">{{ error }}</p>
        </div>

        <p class="text-xs text-slate-400">Follow progress under <router-link to="/patient/track-delivery" class="font-semibold text-indigo-600 hover:underline">Track Delivery</router-link>.</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { apiFetch } from '../../services/api'
import { canChooseDelivery } from '../../utils/medication.js'

const prescriptions = ref([])
const profile = reactive({ name: '', address: '' })
const method = ref('SelfCollect')
const saving = ref(false)
const loading = ref(true)
const notice = ref('')
const error = ref('')

const options = [
  { value: 'SelfCollect', title: 'Self-collect', icon: '🏥', description: 'Pick up at the MediFlow pharmacy counter during opening hours.' },
  { value: 'Delivery', title: 'Home delivery', icon: '🚚', description: 'Have your medication delivered to your registered home address.' },
]

const hasAddress = computed(() => canChooseDelivery(profile.address))
const activePrescriptions = computed(() => prescriptions.value.filter((p) => p.status !== 'Cancelled'))
const activeCount = computed(() => activePrescriptions.value.length)

const load = async () => {
  try { prescriptions.value = await apiFetch('/patient/prescriptions') } catch { prescriptions.value = [] }
  // Reflect the method already stored against the patient's active prescriptions.
  const current = activePrescriptions.value[0]?.collection_method
  if (current) method.value = current
}

onMounted(async () => {
  try {
    const me = await apiFetch('/me/profile')
    profile.name = me.name || ''
    profile.address = me.address || ''
  } catch { /* not signed in */ }
  await load()
  loading.value = false
})

const saveMethod = async () => {
  error.value = ''
  notice.value = ''
  if (method.value === 'Delivery' && !hasAddress.value) {
    error.value = 'Add a home address in your Profile before choosing delivery.'
    return
  }
  saving.value = true
  try {
    // Apply the choice to every non-cancelled prescription so the pharmacy and the
    // tracker agree on how each item is being received.
    for (const p of activePrescriptions.value) {
      await apiFetch(`/patient/prescriptions/${p.prescription_id}/collection`, {
        method: 'PATCH',
        body: JSON.stringify({ method: method.value }),
      })
    }
    notice.value = method.value === 'Delivery' ? 'Home delivery selected — we’ll bring it to you.' : 'Self-collection selected — pick it up at the counter.'
    await load()
  } catch (err) {
    error.value = err.message || 'Could not save your collection method.'
  } finally {
    saving.value = false
  }
}
</script>
