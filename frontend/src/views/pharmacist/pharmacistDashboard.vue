<template>
  <div class="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans">
    <aside class="w-full md:w-64 bg-slate-900 text-white p-5 flex md:flex-col md:min-h-screen">
      <div class="flex items-center gap-2.5 mb-8">
        <div class="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black shrink-0">M</div>
        <div class="leading-tight">
          <p class="text-sm font-extrabold tracking-tight text-white">MediFlow</p>
          <p class="text-[11px] font-medium text-indigo-300">Pharmacy Console</p>
        </div>
      </div>

      <div class="mb-6 hidden md:block rounded-xl bg-slate-800/60 border border-slate-800 px-3 py-3">
        <p class="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Signed in as</p>
        <p class="text-sm font-bold text-white mt-0.5 truncate">{{ me.name }}</p>
        <span class="inline-flex items-center rounded-md bg-indigo-500/10 text-indigo-300 px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ring-indigo-500/20 mt-1.5">{{ me.role }}</span>
      </div>

      <nav class="space-y-1 flex-1">
        <button
          @click="tab = 'queue'"
          :class="[tab === 'queue' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-800 hover:text-white']"
          class="w-full text-left px-3 py-2.5 rounded-lg font-medium text-sm transition-colors flex items-center gap-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
        >
          <span aria-hidden="true">💊</span> Dispensing queue
        </button>
        <button
          @click="tab = 'inventory'"
          :class="[tab === 'inventory' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-800 hover:text-white']"
          class="w-full text-left px-3 py-2.5 rounded-lg font-medium text-sm transition-colors flex items-center gap-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
        >
          <span aria-hidden="true">📦</span> Inventory
        </button>
      </nav>

      <button @click="onLogout" class="hidden md:flex items-center gap-2 text-left text-rose-300 hover:text-white hover:bg-rose-500/10 px-3 py-2.5 rounded-lg font-medium text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400">
        <span aria-hidden="true">↩</span> Sign out
      </button>
      <button @click="onLogout" class="md:hidden ml-auto text-rose-300 hover:text-white px-3 py-2 rounded-lg font-medium text-sm">Sign out</button>
    </aside>

    <main class="flex-1 p-6 sm:p-10 overflow-y-auto">
      <div v-if="tab === 'queue'" class="max-w-5xl mf-animate-in">
        <h1 class="text-2xl font-bold text-slate-900 tracking-tight mb-1">Dispensing queue</h1>
        <p class="text-sm text-slate-500 mb-6">Prescriptions issued by doctors, waiting to be dispensed. Dispensing updates medication stock automatically.</p>
        <p v-if="error" role="alert" class="text-sm font-medium text-rose-600 mb-4">{{ error }}</p>
        <div class="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <table class="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead class="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th class="px-6 py-3">Prescription</th><th class="px-6 py-3">Patient</th>
                <th class="px-6 py-3">Medication</th><th class="px-6 py-3">Stock</th><th class="px-6 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 text-slate-600">
              <tr v-for="rx in queue" :key="rx.prescription_id" class="hover:bg-slate-50/60 transition-colors">
                <td class="px-6 py-4 font-mono text-xs text-slate-500">{{ rx.prescription_id }}</td>
                <td class="px-6 py-4 font-semibold text-slate-900">{{ rx.patient_name }}</td>
                <td class="px-6 py-4">
                  <div class="font-medium text-slate-800">{{ rx.medication_name }}</div>
                  <div class="text-xs text-slate-400">{{ rx.dosage }} · {{ rx.frequency }}</div>
                </td>
                <td class="px-6 py-4">
                  <span :class="[
                    (rx.stock_quantity ?? 0) === 0 ? 'bg-rose-50 text-rose-700 ring-rose-600/10' :
                    (rx.stock_quantity ?? 0) <= 10 ? 'bg-amber-50 text-amber-700 ring-amber-600/10' :
                    'bg-emerald-50 text-emerald-700 ring-emerald-600/10'
                  ]" class="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset">
                    {{ rx.stock_quantity == null ? '—' : (rx.stock_quantity === 0 ? 'Out of stock' : `${rx.stock_quantity} in stock`) }}
                  </span>
                </td>
                <td class="px-6 py-4 text-right">
                  <button @click="fulfil(rx)" :disabled="(rx.stock_quantity ?? 0) === 0" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">Dispense</button>
                </td>
              </tr>
              <tr v-if="queue.length === 0">
                <td colspan="5" class="px-6 py-14 text-center">
                  <div class="text-3xl mb-2">✅</div>
                  <p class="text-sm font-semibold text-slate-700">Nothing to dispense</p>
                  <p class="text-xs text-slate-400 mt-0.5">New prescriptions from doctors will appear here.</p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div v-if="tab === 'inventory'" class="max-w-5xl mf-animate-in">
        <h1 class="text-2xl font-bold text-slate-900 tracking-tight mb-1">Medication inventory</h1>
        <p class="text-sm text-slate-500 mb-6">Current stock on hand. Levels drop automatically as prescriptions are dispensed.</p>
        <div class="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <table class="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead class="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500"><tr><th class="px-6 py-3">Name</th><th class="px-6 py-3">Form</th><th class="px-6 py-3">Stock</th></tr></thead>
            <tbody class="divide-y divide-slate-100 text-slate-600">
              <tr v-for="m in inventory" :key="m.medication_id" class="hover:bg-slate-50/60 transition-colors">
                <td class="px-6 py-4 font-semibold text-slate-900">{{ m.name }}</td>
                <td class="px-6 py-4">{{ m.form }}</td>
                <td class="px-6 py-4">
                  <span :class="[
                    m.stock_quantity === 0 ? 'bg-rose-50 text-rose-700 ring-rose-600/10' :
                    m.stock_quantity <= 10 ? 'bg-amber-50 text-amber-700 ring-amber-600/10' :
                    'bg-emerald-50 text-emerald-700 ring-emerald-600/10'
                  ]" class="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset">
                    {{ m.stock_quantity === 0 ? 'Out of stock' : `${m.stock_quantity} units` }}
                  </span>
                </td>
              </tr>
              <tr v-if="inventory.length === 0">
                <td colspan="3" class="px-6 py-14 text-center text-slate-400 text-sm">No medications in the inventory yet.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { apiFetch, logout } from '../../services/api'

const router = useRouter()
const tab = ref('queue')
const me = ref({ name: '', role: 'Pharmacist' })
const queue = ref([])
const inventory = ref([])
const error = ref('')

const load = async () => {
  error.value = ''
  try {
    queue.value = await apiFetch('/pharmacy/queue')
    inventory.value = await apiFetch('/inventory')
  } catch (err) {
    error.value = err.message || 'Failed to load pharmacy data.'
  }
}

onMounted(async () => {
  try { me.value = (await apiFetch('/me')).user } catch { /* not signed in */ }
  await load()
})

const fulfil = async (rx) => {
  error.value = ''
  try {
    await apiFetch(`/prescriptions/${rx.prescription_id}/fulfil`, { method: 'POST' })
    await load()
  } catch (err) {
    error.value = err.message || 'Could not fulfil prescription (re-authentication may be required).'
  }
}

const onLogout = () => logout(router)
</script>
