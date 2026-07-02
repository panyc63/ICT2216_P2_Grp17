<template>
  <div class="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans">
    <aside class="w-full md:w-64 bg-slate-900 text-white p-5 flex md:flex-col md:min-h-screen">
      <div class="flex items-center gap-2.5 mb-8">
        <div class="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black shrink-0">M</div>
        <div class="leading-tight">
          <p class="text-sm font-extrabold tracking-tight text-white">MediFlow</p>
          <p class="text-[11px] font-medium text-indigo-300">Nurse Console</p>
        </div>
      </div>

      <div class="mb-6 hidden md:block rounded-xl bg-slate-800/60 border border-slate-800 px-3 py-3">
        <p class="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Signed in as</p>
        <p class="text-sm font-bold text-white mt-0.5 truncate">{{ nurseName }}</p>
      </div>

      <nav class="space-y-1 flex-1">
        <button
          @click="router.push({ name: 'NurseDashboard' })"
          class="w-full text-left px-3 py-2.5 rounded-lg font-medium text-sm transition-colors flex items-center gap-2.5 bg-indigo-600 text-white shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
        >
          <span aria-hidden="true">🏠</span> Dashboard
        </button>
        <button
          @click="router.push({ name: 'NurseQueueView' })"
          class="w-full text-left px-3 py-2.5 rounded-lg font-medium text-sm transition-colors flex items-center gap-2.5 text-slate-400 hover:bg-slate-800 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
        >
          <span aria-hidden="true">📋</span> Live queue
        </button>
        <button
          @click="router.push({ name: 'NurseQueueEdit' })"
          class="w-full text-left px-3 py-2.5 rounded-lg font-medium text-sm transition-colors flex items-center gap-2.5 text-slate-400 hover:bg-slate-800 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
        >
          <span aria-hidden="true">⚙️</span> Manage queue
        </button>
      </nav>

      <button @click="handleLogout" class="hidden md:flex items-center gap-2 text-left text-rose-300 hover:text-white hover:bg-rose-500/10 px-3 py-2.5 rounded-lg font-medium text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400">
        <span aria-hidden="true">↩</span> Sign out
      </button>
      <button @click="handleLogout" class="md:hidden ml-auto text-rose-300 hover:text-white px-3 py-2 rounded-lg font-medium text-sm">Sign out</button>
    </aside>

    <main class="flex-1 p-6 sm:p-10 overflow-y-auto">
      <div class="max-w-5xl space-y-8 mf-animate-in">
        <div>
          <h1 class="text-3xl font-extrabold text-slate-900 tracking-tight">Welcome back, {{ nurseName }}</h1>
          <p class="text-sm text-slate-500 mt-1">Manage the triage queue — set priority, assign a doctor, and move patients through their visit.</p>
        </div>

        <div>
          <h2 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Queue at a glance</h2>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div class="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm">
              <span class="text-xs text-slate-500 font-semibold block">Patients in queue</span>
              <span class="text-3xl font-extrabold tracking-tight text-indigo-600 block mt-1">{{ totalActive }}</span>
              <span class="text-xs text-slate-400">waiting to be seen</span>
            </div>
            <div class="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm">
              <span class="text-xs text-slate-500 font-semibold block">Urgent or emergency</span>
              <span class="text-3xl font-extrabold tracking-tight text-amber-600 block mt-1">{{ highPriority }}</span>
              <span class="text-xs text-slate-400">need priority attention</span>
            </div>
            <div class="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm">
              <span class="text-xs text-slate-500 font-semibold block">Assigned to a doctor</span>
              <span class="text-3xl font-extrabold tracking-tight text-emerald-600 block mt-1">{{ assignedCount }}</span>
              <span class="text-xs text-slate-400">already routed to a doctor</span>
            </div>
          </div>
        </div>

        <div>
          <h2 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Quick actions</h2>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
            <button type="button" @click="router.push({ name: 'NurseQueueView' })" class="group text-left cursor-pointer bg-white border border-slate-200 hover:border-indigo-400 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
              <div class="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl group-hover:bg-indigo-600 group-hover:text-white transition-colors mb-4">📋</div>
              <h3 class="font-bold text-lg text-slate-900 group-hover:text-indigo-600 transition-colors">Live queue</h3>
              <p class="text-sm text-slate-500 mt-1 mb-4">A clean, read-only view of who's waiting and their priority — good for a shared reception or waiting-room display.</p>
              <span class="text-xs font-semibold text-indigo-600 group-hover:underline inline-flex items-center gap-1">Open live queue &rarr;</span>
            </button>

            <button type="button" @click="router.push({ name: 'NurseQueueEdit' })" class="group text-left cursor-pointer bg-white border border-slate-200 hover:border-amber-400 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500">
              <div class="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-xl group-hover:bg-amber-600 group-hover:text-white transition-colors mb-4">⚙️</div>
              <h3 class="font-bold text-lg text-slate-900 group-hover:text-amber-600 transition-colors">Manage queue</h3>
              <p class="text-sm text-slate-500 mt-1 mb-4">Assign a doctor, set triage priority, call patients in, and discharge them once their visit is done.</p>
              <span class="text-xs font-semibold text-amber-600 group-hover:underline inline-flex items-center gap-1">Open queue manager &rarr;</span>
            </button>
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
