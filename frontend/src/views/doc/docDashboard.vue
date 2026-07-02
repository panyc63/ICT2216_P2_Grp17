<template>
  <div class="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans">
    <aside class="w-full md:w-64 bg-slate-900 text-white p-5 flex md:flex-col md:min-h-screen">
      <div class="flex items-center gap-2.5 mb-8">
        <div class="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black shrink-0">M</div>
        <div class="leading-tight">
          <p class="text-sm font-extrabold tracking-tight text-white">MediFlow</p>
          <p class="text-[11px] font-medium text-indigo-300">Doctor Console</p>
        </div>
      </div>

      <div class="mb-6 hidden md:block rounded-xl bg-slate-800/60 border border-slate-800 px-3 py-3">
        <p class="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Signed in as</p>
        <p class="text-sm font-bold text-white mt-0.5 truncate">{{ currentDoctor.name }}</p>
      </div>

      <nav class="space-y-1 flex-1">
        <button
          @click="navigateTo('DocDashboard')"
          :class="[route.name === 'DocDashboard' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-800 hover:text-white']"
          class="w-full text-left px-3 py-2.5 rounded-lg font-medium text-sm transition-colors flex items-center gap-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
        >
          <span aria-hidden="true">🏠</span> Dashboard
        </button>
        <button
          @click="navigateTo('DocConsult')"
          :class="[route.name === 'DocConsult' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-800 hover:text-white']"
          class="w-full text-left px-3 py-2.5 rounded-lg font-medium text-sm transition-colors flex items-center gap-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
        >
          <span aria-hidden="true">🎥</span> Video Consultations
        </button>
        <button
          @click="navigateTo('DocPrescribe')"
          :class="[route.name === 'DocPrescribe' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-800 hover:text-white']"
          class="w-full text-left px-3 py-2.5 rounded-lg font-medium text-sm transition-colors flex items-center gap-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
        >
          <span aria-hidden="true">📝</span> Prescriptions &amp; MCs
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
          <h1 class="text-3xl font-extrabold text-slate-900 tracking-tight">Welcome back, {{ currentDoctor.name }}</h1>
          <p class="text-sm text-slate-500 mt-1">Pick up a patient from the queue to start a consultation, or issue a prescription.</p>
        </div>

        <div>
          <h2 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Today at a glance</h2>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div class="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm">
              <span class="text-xs text-slate-500 font-semibold block">Waiting in queue</span>
              <span class="text-3xl font-extrabold tracking-tight text-amber-600 block mt-1">{{ unclaimedPending }}</span>
              <span class="text-xs text-slate-400">unassigned, pending</span>
            </div>
            <div class="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm">
              <span class="text-xs text-slate-500 font-semibold block">Active now</span>
              <span class="text-3xl font-extrabold tracking-tight text-emerald-600 block mt-1">{{ myActive }}</span>
              <span class="text-xs text-slate-400">your live consultations</span>
            </div>
            <div class="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm">
              <span class="text-xs text-slate-500 font-semibold block">Assigned to you</span>
              <span class="text-3xl font-extrabold tracking-tight text-indigo-600 block mt-1">{{ myAssigned }}</span>
              <span class="text-xs text-slate-400">total on your list</span>
            </div>
          </div>
        </div>

        <div>
          <h2 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Quick actions</h2>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-5">

            <button type="button" @click="navigateTo('DocConsult')" class="group text-left cursor-pointer bg-white border border-slate-200 hover:border-indigo-400 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
              <div class="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl group-hover:bg-indigo-600 group-hover:text-white transition-colors mb-4">
                🎥
              </div>
              <h3 class="font-bold text-lg text-slate-900 group-hover:text-indigo-600 transition-colors">Video Consultations</h3>
              <p class="text-sm text-slate-500 mt-1 mb-4">See patients assigned to you, claim new ones from the queue, and start secure video consultations.</p>
              <span class="text-xs font-semibold text-indigo-600 group-hover:underline inline-flex items-center gap-1">Open consultations &rarr;</span>
            </button>

            <button type="button" @click="navigateTo('DocPrescribe')" class="group text-left cursor-pointer bg-white border border-slate-200 hover:border-emerald-400 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
              <div class="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl group-hover:bg-emerald-600 group-hover:text-white transition-colors mb-4">
                📝
              </div>
              <h3 class="font-bold text-lg text-slate-900 group-hover:text-emerald-600 transition-colors">Prescriptions &amp; Medical Certificates</h3>
              <p class="text-sm text-slate-500 mt-1 mb-4">Issue prescriptions to the pharmacy and sign medical certificates for your patients.</p>
              <span class="text-xs font-semibold text-emerald-600 group-hover:underline inline-flex items-center gap-1">Open prescribing &rarr;</span>
            </button>

          </div>
        </div>

        <div>
          <h2 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Account security</h2>
          <TotpManager />
        </div>
      </div>

    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { apiFetch, logout } from '../../services/api'
import TotpManager from '../../components/TotpManager.vue'

// Grab router instances
const router = useRouter()
const route = useRoute()

const currentDoctor = ref({ name: 'Doctor' })
const meId = ref('')
const consultations = ref([])

const loadMe = async () => {
  try {
    const me = await apiFetch('/me')
    meId.value = me.user?.user_id || ''
    currentDoctor.value = { name: me.user?.name || 'Doctor' }
  } catch { /* not signed in */ }
}

const loadConsultations = async () => {
  try { consultations.value = await apiFetch('/consultations') } catch { consultations.value = [] }
}

onMounted(async () => { await loadMe(); await loadConsultations() })

// Live summary computed from the real, role-scoped consultation list.
const unclaimedPending = computed(() =>
  consultations.value.filter((c) => !c.doctor_id && c.session_status === 'Pending').length)
const myActive = computed(() =>
  consultations.value.filter((c) => c.session_status === 'Active' && String(c.doctor_id) === String(meId.value)).length)
const myAssigned = computed(() =>
  consultations.value.filter((c) => String(c.doctor_id) === String(meId.value)).length)

// Central route handling function
const navigateTo = (routeName) => {
  router.push({ name: routeName })
}

const handleLogout = () => {
  logout(router)
}
</script>
