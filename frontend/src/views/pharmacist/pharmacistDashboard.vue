<template>
  <div class="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans">
    <aside class="w-full md:w-64 bg-slate-900 text-white p-6 flex flex-col">
      <div class="text-xl font-extrabold tracking-tight text-indigo-400 mb-2">MediFlow Pharmacy</div>
      <div class="mb-8 border-b border-slate-800 pb-4">
        <p class="text-xs text-slate-400 font-semibold uppercase tracking-wider">Pharmacy Console</p>
        <p class="text-sm font-bold text-white mt-1">{{ me.name }}</p>
        <span class="inline-flex items-center rounded-md bg-indigo-500/10 text-indigo-400 px-2 py-0.5 text-xs font-medium ring-1 ring-inset ring-indigo-500/20 mt-1">{{ me.role }}</span>
      </div>
      <nav class="space-y-1 flex-1">
        <button @click="tab = 'queue'" :class="[tab === 'queue' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800']" class="w-full text-left px-4 py-2.5 rounded-lg font-medium text-sm">Fulfilment Queue</button>
        <button @click="tab = 'inventory'" :class="[tab === 'inventory' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800']" class="w-full text-left px-4 py-2.5 rounded-lg font-medium text-sm">Inventory</button>
      </nav>
      <button @click="onLogout" class="text-left text-red-400 hover:bg-slate-800 px-4 py-2 rounded-lg font-medium text-sm">Logout</button>
    </aside>

    <main class="flex-1 p-10">
      <div v-if="tab === 'queue'">
        <h1 class="text-2xl font-bold text-slate-900 mb-1">Prescription Fulfilment Queue</h1>
        <p class="text-sm text-slate-500 mb-6">Issued prescriptions awaiting dispensing. Fulfilment decrements stock atomically.</p>
        <p v-if="error" class="text-sm font-medium text-red-600 mb-4">{{ error }}</p>
        <div class="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <table class="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead class="bg-slate-50 font-semibold text-slate-700">
              <tr>
                <th class="px-6 py-3">Prescription</th><th class="px-6 py-3">Patient</th>
                <th class="px-6 py-3">Medication</th><th class="px-6 py-3">Stock</th><th class="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200 text-slate-600">
              <tr v-for="rx in queue" :key="rx.prescription_id" class="hover:bg-slate-50/50">
                <td class="px-6 py-4 font-mono text-xs">{{ rx.prescription_id }}</td>
                <td class="px-6 py-4">{{ rx.patient_name }}</td>
                <td class="px-6 py-4">{{ rx.medication_name }} <span class="text-xs text-slate-400">{{ rx.dosage }} / {{ rx.frequency }}</span></td>
                <td class="px-6 py-4">{{ rx.stock_quantity ?? '—' }}</td>
                <td class="px-6 py-4 text-right">
                  <button @click="fulfil(rx)" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg">Fulfil</button>
                </td>
              </tr>
              <tr v-if="queue.length === 0"><td colspan="5" class="px-6 py-10 text-center text-slate-400">No prescriptions awaiting fulfilment.</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div v-if="tab === 'inventory'">
        <h1 class="text-2xl font-bold text-slate-900 mb-6">Medication Inventory</h1>
        <div class="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <table class="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead class="bg-slate-50 font-semibold text-slate-700"><tr><th class="px-6 py-3">Name</th><th class="px-6 py-3">Form</th><th class="px-6 py-3">Stock</th></tr></thead>
            <tbody class="divide-y divide-slate-200 text-slate-600">
              <tr v-for="m in inventory" :key="m.medication_id"><td class="px-6 py-4 font-medium text-slate-900">{{ m.name }}</td><td class="px-6 py-4">{{ m.form }}</td><td class="px-6 py-4">{{ m.stock_quantity }}</td></tr>
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
