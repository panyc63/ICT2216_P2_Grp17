<template>
  <div class="min-h-screen bg-slate-50 flex font-sans">
    <aside class="w-64 bg-slate-900 text-white p-6 flex flex-col">
      <div class="text-xl font-extrabold tracking-tight text-indigo-400 mb-8">MediHealth Admin</div>
      <nav class="space-y-1 flex-1">
        <button @click="activeTab = 'staff'" :class="[activeTab === 'staff' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800']" class="w-full text-left px-4 py-2.5 rounded-lg font-medium text-sm transition-colors">Staff CRUD Management</button>
        <button @click="activeTab = 'consultations'" :class="[activeTab === 'consultations' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800']" class="w-full text-left px-4 py-2.5 rounded-lg font-medium text-sm transition-colors">Live Consultations</button>
        <button @click="activeTab = 'recordings'" :class="[activeTab === 'recordings' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800']" class="w-full text-left px-4 py-2.5 rounded-lg font-medium text-sm transition-colors">Video Recordings Archive</button>
      </nav>
      <button @click="handleLogout" class="text-left text-red-400 hover:bg-slate-800 px-4 py-2 rounded-lg font-medium text-sm">Logout</button>
    </aside>

    <main class="flex-1 p-10">
      <div v-if="activeTab === 'staff'">
        <div class="flex justify-between items-center mb-6">
          <div>
            <h1 class="text-2xl font-bold text-slate-900">Staff Account Management</h1>
            <p class="text-sm text-slate-500">Provision, view, and adjust identity records for internal operational accounts.</p>
          </div>
          <button @click="showModal = true" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-lg shadow-sm transition-colors">
            Add Staff Account
          </button>
        </div>

        <div class="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <table class="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead class="bg-slate-50 font-semibold text-slate-700">
              <tr>
                <th class="px-6 py-3">Staff ID</th>
                <th class="px-6 py-3">Email</th>
                <th class="px-6 py-3">Role</th>
                <th class="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200 text-slate-600">
              <tr v-for="member in staffList" :key="member.user_id">
                <td class="px-6 py-4 font-medium text-slate-900">{{ member.user_id }}</td>
                <td class="px-6 py-4">{{ member.email }}</td>
                <td class="px-6 py-4">
                  <span :class="member.role === 'Doctor' ? 'bg-blue-50 text-blue-700 ring-blue-700/10' : 'bg-purple-50 text-purple-700 ring-purple-700/10'" class="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset">
                    {{ member.role }}
                  </span>
                </td>
                <td class="px-6 py-4 text-right">
                  <button @click="deleteStaffAccount(member.user_id)" class="text-red-600 hover:text-red-900 font-medium">Delete</button>
                </td>
              </tr>
              <tr v-if="staffList.length === 0">
                <td colspan="4" class="px-6 py-10 text-center text-slate-400 italic">No operational staff records detected in the active database.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div v-if="activeTab === 'consultations'">
        <h1 class="text-2xl font-bold text-slate-900 mb-2">Live Ongoing Consultations</h1>
        <p class="text-sm text-slate-500 mb-6">Real-time telemetry tracking active patient consultation rooms.</p>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div v-for="room in consultations" :key="room.id" class="bg-white border border-slate-200 p-6 rounded-xl shadow-sm">
            <div class="flex justify-between items-start mb-4">
              <div>
                <h4 class="font-bold text-slate-900">Room Token: {{ room.id }}</h4>
                <p class="text-xs text-slate-400">Signal Stream Latency: {{ room.latency }}ms</p>
              </div>
              <span class="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20 animate-pulse">Live</span>
            </div>
            <p class="text-sm text-slate-600"><span class="font-semibold text-slate-700">Practitioner:</span> {{ room.doctor }}</p>
            <p class="text-sm text-slate-600"><span class="font-semibold text-slate-700">Patient identity:</span> {{ room.patient }}</p>
          </div>
        </div>
      </div>

      <div v-if="activeTab === 'recordings'">
        <h1 class="text-2xl font-bold text-slate-900 mb-2">Video Consultation Recording Logs</h1>
        <p class="text-sm text-slate-500 mb-6">Encrypted archival stores for institutional data auditing and liability retention rules.</p>
        <div class="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden divide-y divide-slate-100">
          <div v-for="video in recordings" :key="video.id" class="p-4 flex justify-between items-center hover:bg-slate-50">
            <div class="flex items-center gap-3">
              <div class="text-xl">📹</div>
              <div>
                <p class="text-sm font-semibold text-slate-900">{{ video.fileName }}</p>
                <p class="text-xs text-slate-400">Timestamp: {{ video.date }} | Storage Size: {{ video.size }}</p>
              </div>
            </div>
            <button class="text-xs font-semibold bg-slate-100 text-slate-700 px-3 py-1.5 rounded border border-slate-300 hover:bg-slate-200">Review File</button>
          </div>
        </div>
      </div>
    </main>

    <div v-if="showModal" class="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50">
      <div class="bg-white p-6 rounded-xl border border-slate-200 w-full max-w-sm shadow-xl">
        <h3 class="text-lg font-bold text-slate-900 mb-4">Provision Staff Profile</h3>
        <form @submit.prevent="createStaffAccount" class="space-y-4">
          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase">Email</label>
            <input v-model="newStaff.email" type="email" required class="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md text-sm" placeholder="harper@medihealth.com" />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase">Temporary Password</label>
            <input v-model="newStaff.password" type="text" required class="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md text-sm" />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase">Role</label>
            <select v-model="newStaff.role" class="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white">
              <option value="Doctor">Doctor</option>
              <option value="Nurse">Nurse</option>
              <option value="Pharmacist">Pharmacist</option>
            </select>
          </div>
          <div class="flex justify-end gap-2 pt-2">
            <button type="button" @click="showModal = false" class="px-3 py-1.5 border border-slate-300 text-slate-700 text-sm font-medium rounded-md bg-white">Cancel</button>
            <button type="submit" class="px-3 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-md">Create Account</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const activeTab = ref('staff')
const showModal = ref(false)

const staffList = ref([])
const consultations = ref([])
const recordings = ref([])

const newStaff = ref({ email: '', role: 'Doctor', password: '1234' })

const API_URL = 'http://localhost:5000/api'

const fetchStaffMembers = async () => {
  try {
    const response = await fetch(`${API_URL}/staff`)
    if (!response.ok) throw new Error('Failed to retrieve institutional staff array.')
    const data = await response.json()
    staffList.value = data
  } catch (error) {
    console.error('Database Sync Error:', error.message)
  }
}

onMounted(() => {
  fetchStaffMembers()
  
  consultations.value = [
    { id: 'ROOM-77X', doctor: 'Dr. Smith', patient: 'John Doe', latency: 12 },
    { id: 'ROOM-42B', doctor: 'Dr. Smith', patient: 'Jane Smith', latency: 18 }
  ]
  recordings.value = [
    { id: 101, fileName: 'REC_CONSULT_ROOM-11A_20260614.mp4', date: '2026-06-14 09:22', size: '142.4 MB' },
    { id: 102, fileName: 'REC_CONSULT_ROOM-04F_20260615.mp4', date: '2026-06-15 14:45', size: '98.1 MB' }
  ]
})

// Trigger endpoint registration logic
const createStaffAccount = async () => {
  try {
    const response = await fetch(`${API_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: newStaff.value.email,
        password: newStaff.value.password,
        role: newStaff.value.role
      })
    })

    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'Identity generation fault.')

    alert('Staff account successfully provisioned inside database!')
    showModal.value = false
    newStaff.value = { email: '', role: 'Doctor', password: '1234' }
    
    // Instantly refresh staff list array
    await fetchStaffMembers()

  } catch (error) {
    alert(`Registration Sequence Aborted: ${error.message}`)
  }
}

// Issue targeted HTTP Drop instructions
const deleteStaffAccount = async (userId) => {
  if (!confirm(`Are you confident you want to delete profile record ${userId}?`)) return

  try {
    const response = await fetch(`${API_URL}/staff/${userId}`, {
      method: 'DELETE'
    })

    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'Server rejected removal sequence.')

    // Update state reactively
    staffList.value = staffList.value.filter(item => item.user_id !== userId)
  } catch (error) {
    alert(`Deletion Fault: ${error.message}`)
  }
}

const handleLogout = () => {
  localStorage.clear()
  router.push('/login')
}
</script>