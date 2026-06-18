<template>
  <div class="min-h-screen bg-slate-50 flex font-sans">
    <aside class="w-64 bg-slate-900 text-white p-6 flex flex-col">
      <div class="text-xl font-extrabold tracking-tight text-indigo-400 mb-2">MediHealth Clinical</div>
      
      <div class="mb-8 border-b border-slate-800 pb-4">
        <p class="text-xs text-slate-400 font-semibold uppercase tracking-wider">Practitioner Console</p>
        <p class="text-sm font-bold text-white mt-1">{{ currentDoctor.name }}</p>
        <p class="text-xs text-slate-400 italic mt-0.5">{{ currentDoctor.specialty }}</p>
      </div>

      <nav class="space-y-1 flex-1">
        <button @click="activeTab = 'new-prescription'" :class="[activeTab === 'new-prescription' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800']" class="w-full text-left px-4 py-2.5 rounded-lg font-medium text-sm transition-colors">
          Issue Prescription
        </button>
        <button @click="activeTab = 'prescription-history'" :class="[activeTab === 'prescription-history' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800']" class="w-full text-left px-4 py-2.5 rounded-lg font-medium text-sm transition-colors">
          Recent Orders Log
        </button>
      </nav>
      
      <button @click="handleLogout" class="text-left text-red-400 hover:bg-slate-800 px-4 py-2 rounded-lg font-medium text-sm transition-colors">
        Logout
      </button>
    </aside>

    <main class="flex-1 p-10 max-w-5xl">
      
      <div v-if="activeTab === 'new-prescription'">
        <div class="mb-6">
          <h1 class="text-2xl font-bold text-slate-900">Rx Medication Prescription Intake</h1>
          <p class="text-sm text-slate-500">Authorize drug distributions, control dosages, and map refilling structures directly to the pharmacy subsystem.</p>
        </div>

        <div class="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
          <form @submit.prevent="submitPrescription" class="space-y-6">
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider">Target Patient</label>
                <select v-model="prescriptionForm.patientName" required class="mt-1.5 block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500">
                  <option value="" disabled>Select active patient context</option>
                  <option v-for="patient in mockPatients" :key="patient" :value="patient">{{ patient }}</option>
                </select>
              </div>

              <div>
                <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider">Medication Name</label>
                <input v-model="prescriptionForm.medication" type="text" required placeholder="e.g., Amoxicillin, Lisinopril" class="mt-1.5 block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" />
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider">Dosage / Strength</label>
                <input v-model="prescriptionForm.dosage" type="text" required placeholder="e.g., 500mg, 10ml" class="mt-1.5 block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" />
              </div>

              <div>
                <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider">Frequency</label>
                <select v-model="prescriptionForm.frequency" required class="mt-1.5 block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500">
                  <option value="Once daily">Once daily (QD)</option>
                  <option value="Twice daily">Twice daily (BID)</option>
                  <option value="Three times daily">Three times daily (TID)</option>
                  <option value="Four times daily">Four times daily (QID)</option>
                  <option value="As needed">As needed (PRN)</option>
                </select>
              </div>

              <div>
                <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider">Refills Permitted</label>
                <input v-model.number="prescriptionForm.refills" type="number" min="0" max="12" required class="mt-1.5 block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" />
              </div>
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider">Sig / Patient Special Instructions</label>
              <textarea v-model="prescriptionForm.instructions" rows="3" placeholder="Take with food. Complete the full course of antibiotic medication treatment." class="mt-1.5 block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"></textarea>
            </div>

            <div class="flex justify-end pt-2">
              <button type="submit" class="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-lg shadow-sm transition-colors flex items-center gap-2">
                <span>📝</span> Route to Pharmacy Router
              </button>
            </div>
          </form>
        </div>
      </div>

      <div v-if="activeTab === 'prescription-history'">
        <div class="mb-6">
          <h1 class="text-2xl font-bold text-slate-900">Your Issued Prescription Logs</h1>
          <p class="text-sm text-slate-500">Audit trial history tracking prescriptions routed under your current security credentials.</p>
        </div>

        <div class="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <table class="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead class="bg-slate-50 font-semibold text-slate-700">
              <tr>
                <th class="px-6 py-3">Patient Context</th>
                <th class="px-6 py-3">Prescribed Medication</th>
                <th class="px-6 py-3">Dosage / Frequency</th>
                <th class="px-6 py-3">Refills</th>
                <th class="px-6 py-3">Status</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200 text-slate-600">
              <tr v-for="item in historyLogs" :key="item.id" class="hover:bg-slate-50/50 transition-colors">
                <td class="px-6 py-4 font-medium text-slate-900">{{ item.patientName }}</td>
                <td class="px-6 py-4 font-mono text-xs text-indigo-600 font-semibold">{{ item.medication }}</td>
                <td class="px-6 py-4">
                  <div>{{ item.dosage }}</div>
                  <div class="text-xs text-slate-400">{{ item.frequency }}</div>
                </td>
                <td class="px-6 py-4">
                  <span class="text-slate-700 bg-slate-100 font-medium text-xs px-2 py-1 rounded">
                    {{ item.refills }} remaining
                  </span>
                </td>
                <td class="px-6 py-4">
                  <span class="inline-flex items-center rounded-md bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/10 px-2 py-1 text-xs font-medium">
                    {{ item.status }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </main>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const activeTab = ref('new-prescription')

// User Context State
const currentDoctor = ref({
  name: 'Dr. John Doe',
  specialty: 'General Internal Medicine'
})

// Options list for targeted patient select context
const mockPatients = ref(['Michael Chang', 'Emma Watson', 'Eleanor Vance', 'Marcus Aurelius'])

// Master Data List mapping back orders
const historyLogs = ref([
  { id: 1, patientName: 'Michael Chang', medication: 'Amoxicillin 500mg', dosage: '500mg', frequency: 'Three times daily', refills: 0, status: 'Transmitted' },
  { id: 2, patientName: 'Emma Watson', medication: 'Lisinopril 10mg', dosage: '10mg', frequency: 'Once daily', refills: 3, status: 'Transmitted' }
])

// Clean baseline target model schema for incoming data
const defaultForm = {
  patientName: '',
  medication: '',
  dosage: '',
  frequency: 'Once daily',
  refills: 0,
  instructions: ''
}

const prescriptionForm = ref({ ...defaultForm })

// Actions logic
const submitPrescription = () => {
  // Push local dynamic state upward to the display matrix log array
  historyLogs.value.unshift({
    id: Date.now(),
    patientName: prescriptionForm.value.patientName,
    medication: `${prescriptionForm.value.medication} ${prescriptionForm.value.dosage}`,
    dosage: prescriptionForm.value.dosage,
    frequency: prescriptionForm.value.frequency,
    refills: prescriptionForm.value.refills,
    status: 'Transmitted'
  })

  // Clear tracking data structures back to baseline parameters 
  prescriptionForm.value = { ...defaultForm }
  
  // Transition views seamlessly over into history log summary index
  activeTab.value = 'prescription-history'
}

const handleLogout = () => {
  localStorage.clear()
  router.push('/')
}
</script>