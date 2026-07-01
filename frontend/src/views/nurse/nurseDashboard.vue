<template>
  <div class="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans">
    <aside class="w-full md:w-64 bg-slate-900 text-white p-6 flex flex-col">
      <div class="text-xl font-extrabold tracking-tight text-indigo-400 mb-2">MediFlow Nurse</div>
      <div class="mb-8 border-b border-slate-800 pb-4">
        <p class="text-xs text-slate-400 font-semibold uppercase tracking-wider">Active Station</p>
        <p class="text-sm font-bold text-white mt-1">{{ nurseName }}</p>
        <span class="inline-flex items-center rounded-md bg-emerald-500/10 text-emerald-400 px-2 py-0.5 text-xs font-medium ring-1 ring-inset ring-emerald-500/20 mt-1">Triage Floor 1</span>
      </div>
      <nav class="space-y-1 flex-1">
        <button @click="router.push({ name: 'NurseDashboard' })" class="w-full text-left px-4 py-2.5 rounded-lg font-medium text-sm transition-colors bg-indigo-600 text-white flex items-center gap-2">🏠 Dashboard Home</button>
        <button @click="router.push({ name: 'NurseQueueView' })" class="w-full text-left px-4 py-2.5 rounded-lg font-medium text-sm transition-colors text-slate-300 hover:bg-slate-800 flex items-center gap-2">📋 Live Queue Monitor</button>
        <button @click="router.push({ name: 'NurseQueueEdit' })" class="w-full text-left px-4 py-2.5 rounded-lg font-medium text-sm transition-colors text-slate-300 hover:bg-slate-800 flex items-center gap-2">⚙️ Manage & Sort Queue</button>
      </nav>
      <button @click="handleLogout" class="text-left text-red-400 hover:bg-slate-800 px-4 py-2 rounded-lg font-medium text-sm transition-colors">Logout</button>
    </aside>

    <main class="flex-1 p-10 max-w-5xl space-y-8">
      <div>
        <h1 class="text-3xl font-extrabold text-slate-900 tracking-tight">Triage Management Dashboard</h1>
        <p class="text-sm text-slate-500 mt-1">Coordinate patient pathways, monitor clinic load parameters, and assign clinical staff units.</p>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div class="bg-white border border-slate-200 p-5 rounded-xl shadow-sm">
          <span class="text-xs text-slate-400 font-bold uppercase tracking-wider block">Patients In Queue</span>
          <span class="text-2xl font-black text-indigo-600 block mt-1">{{ totalActive }}</span>
        </div>
        <div class="bg-white border border-slate-200 p-5 rounded-xl shadow-sm">
          <span class="text-xs text-slate-400 font-bold uppercase tracking-wider block">Emergency / Urgent</span>
          <span class="text-2xl font-black text-amber-500 block mt-1">{{ highPriority }}</span>
        </div>
        <div class="bg-white border border-slate-200 p-5 rounded-xl shadow-sm">
          <span class="text-xs text-slate-400 font-bold uppercase tracking-wider block">Assigned To A Doctor</span>
          <span class="text-2xl font-black text-emerald-600 block mt-1">{{ assignedCount }}</span>
        </div>
      </div>

      <div>
        <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Core Clinical Modules</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div @click="router.push({ name: 'NurseQueueView' })" class="group cursor-pointer bg-white border border-slate-200 hover:border-indigo-500 rounded-xl p-6 shadow-sm hover:shadow-md transition-all">
            <div class="w-12 h-12 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl font-bold group-hover:bg-indigo-600 group-hover:text-white transition-colors mb-4">📋</div>
            <h4 class="font-bold text-lg text-slate-900 group-hover:text-indigo-600 transition-colors">Patient Queue Viewer</h4>
            <p class="text-sm text-slate-500 mt-1 mb-4">Read-only live tracker optimized for clinical wall monitors or reception displays tracking flow status indicators.</p>
            <span class="text-xs font-semibold text-indigo-600 group-hover:underline flex items-center gap-1">Launch Viewer View &rarr;</span>
          </div>

          <div @click="router.push({ name: 'NurseQueueEdit' })" class="group cursor-pointer bg-white border border-slate-200 hover:border-amber-500 rounded-xl p-6 shadow-sm hover:shadow-md transition-all">
            <div class="w-12 h-12 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center text-xl font-bold group-hover:bg-amber-600 group-hover:text-white transition-colors mb-4">⚙️</div>
            <h4 class="font-bold text-lg text-slate-900 group-hover:text-amber-600 transition-colors">Queue Intake & Editor</h4>
            <p class="text-sm text-slate-500 mt-1 mb-4">Check in new patients, assign target practitioners, prioritize triage urgency flags, and clear rooms.</p>
            <span class="text-xs font-semibold text-amber-600 group-hover:underline flex items-center gap-1">Launch Administrative Editor &rarr;</span>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { apiFetch, logout } from '../../services/api'
const router = useRouter()

const nurseName = ref('Nurse')
const queue = ref([])

onMounted(async () => {
  try {
    const me = await apiFetch('/me')
    nurseName.value = me.user?.name || 'Nurse'
  } catch { /* not signed in */ }
  try {
    queue.value = await apiFetch('/nurse/queue')
  } catch {
    queue.value = []
  }
})

// Real counts from the triage queue (same endpoint as the Live Queue Monitor).
const totalActive = computed(() => queue.value.length)
const highPriority = computed(() => queue.value.filter((q) => ['Emergency', 'Urgent'].includes(q.priority_score)).length)
const assignedCount = computed(() => queue.value.filter((q) => q.assigned_doctor_id).length)

const handleLogout = () => { logout(router) }
</script>
