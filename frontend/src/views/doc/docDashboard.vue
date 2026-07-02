<template>
  <div class="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans">
    <aside class="w-full md:w-64 bg-slate-900 text-white p-6 flex flex-col">
      <div class="text-xl font-extrabold tracking-tight text-indigo-400 mb-2">MediFlow Hub</div>
      
      <div class="mb-8 border-b border-slate-800 pb-4">
        <p class="text-xs text-slate-400 font-semibold uppercase tracking-wider">Practitioner Portal</p>
        <p class="text-sm font-bold text-white mt-1">{{ currentDoctor.name }}</p>
      </div>

      <nav class="space-y-1 flex-1">
        <button 
          @click="navigateTo('DocDashboard')" 
          :class="[route.name === 'DocDashboard' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800']" 
          class="w-full text-left px-4 py-2.5 rounded-lg font-medium text-sm transition-colors flex items-center gap-2"
        >
          <span>🏠</span> Dashboard Home
        </button>
        <button 
          @click="navigateTo('DocConsult')" 
          :class="[route.name === 'DocConsult' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800']" 
          class="w-full text-left px-4 py-2.5 rounded-lg font-medium text-sm transition-colors flex items-center gap-2"
        >
          <span>🎥</span> Live Stream Rooms
        </button>
        <button 
          @click="navigateTo('DocPrescribe')" 
          :class="[route.name === 'DocPrescribe' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800']" 
          class="w-full text-left px-4 py-2.5 rounded-lg font-medium text-sm transition-colors flex items-center gap-2"
        >
          <span>📝</span> Rx Prescriptions
        </button>
      </nav>
      
      <button @click="handleLogout" class="text-left text-red-400 hover:bg-slate-800 px-4 py-2 rounded-lg font-medium text-sm transition-colors">
        Logout
      </button>
    </aside>

    <main class="flex-1 p-10 overflow-y-auto">
      
      <div class="max-w-5xl space-y-8">
        <div>
          <h1 class="text-3xl font-extrabold text-slate-900 tracking-tight">Welcome Back, {{ currentDoctor.name }}</h1>
          <p class="text-sm text-slate-500 mt-1">Select an operational unit layer to begin handling your synchronized shift tasks.</p>
        </div>

        <div>
          <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Today's Queue</h3>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div class="bg-white border border-slate-200 p-5 rounded-xl shadow-sm">
              <span class="text-xs text-slate-400 font-bold uppercase tracking-wider block">Unclaimed Pending</span>
              <span class="text-2xl font-black text-amber-500 block mt-1">{{ unclaimedPending }}</span>
            </div>
            <div class="bg-white border border-slate-200 p-5 rounded-xl shadow-sm">
              <span class="text-xs text-slate-400 font-bold uppercase tracking-wider block">My Active Sessions</span>
              <span class="text-2xl font-black text-emerald-600 block mt-1">{{ myActive }}</span>
            </div>
            <div class="bg-white border border-slate-200 p-5 rounded-xl shadow-sm">
              <span class="text-xs text-slate-400 font-bold uppercase tracking-wider block">Assigned To Me</span>
              <span class="text-2xl font-black text-indigo-600 block mt-1">{{ myAssigned }}</span>
            </div>
          </div>
        </div>

        <div>
          <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Available Medical Applications</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            <div @click="navigateTo('DocConsult')" class="group cursor-pointer bg-white border border-slate-200 hover:border-indigo-500 rounded-xl p-6 shadow-sm hover:shadow-md transition-all">
              <div class="w-12 h-12 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl font-bold group-hover:bg-indigo-600 group-hover:text-white transition-colors mb-4">
                📹
              </div>
              <h4 class="font-bold text-lg text-slate-900 group-hover:text-indigo-600 transition-colors">Telehealth Stream Rooms</h4>
              <p class="text-sm text-slate-500 mt-1 mb-4">Access active patient digital consultation queues, monitor live signaling feeds, and conduct video calls.</p>
              <span class="text-xs font-semibold text-indigo-600 group-hover:underline flex items-center gap-1">Open Telehealth App &rarr;</span>
            </div>

            <div @click="navigateTo('DocPrescribe')" class="group cursor-pointer bg-white border border-slate-200 hover:border-emerald-500 rounded-xl p-6 shadow-sm hover:shadow-md transition-all">
              <div class="w-12 h-12 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl font-bold group-hover:bg-emerald-600 group-hover:text-white transition-colors mb-4">
                📝
              </div>
              <h4 class="font-bold text-lg text-slate-900 group-hover:text-emerald-600 transition-colors">Rx Prescription Hub</h4>
              <p class="text-sm text-slate-500 mt-1 mb-4">Fill prescriptions, verify dosages, configure refill permission metrics, and route orders to network pharmacies.</p>
              <span class="text-xs font-semibold text-emerald-600 group-hover:underline flex items-center gap-1">Open Prescription App &rarr;</span>
            </div>

          </div>
        </div>

        <div>
          <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Account Security</h3>
          <PasskeyManager />
        </div>
      </div>

    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { apiFetch, logout } from '../../services/api'
import PasskeyManager from '../../components/PasskeyManager.vue'

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
