<template>
  <div class="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans">
    <aside class="w-full md:w-64 bg-slate-900 text-white p-6 flex flex-col">
      <div class="text-xl font-extrabold tracking-tight text-indigo-400 mb-2">MediFlow Clinical</div>

      <div class="mb-8 border-b border-slate-800 pb-4">
        <p class="text-xs text-slate-400 font-semibold uppercase tracking-wider">Practitioner Console</p>
        <p class="text-sm font-bold text-white mt-1">{{ currentDoctor.name }}</p>
      </div>

      <nav class="space-y-1 flex-1">
        <button @click="router.push({ name: 'DocDashboard' })" :class="[route.name === 'DocDashboard' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800']" class="w-full text-left px-4 py-2.5 rounded-lg font-medium text-sm transition-colors flex items-center gap-2"><span>🏠</span> Dashboard Home</button>
        <button @click="router.push({ name: 'DocConsult' })" :class="[route.name === 'DocConsult' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800']" class="w-full text-left px-4 py-2.5 rounded-lg font-medium text-sm transition-colors flex items-center gap-2"><span>🎥</span> Video Consultations</button>
        <button @click="router.push({ name: 'DocPrescribe' })" :class="[route.name === 'DocPrescribe' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800']" class="w-full text-left px-4 py-2.5 rounded-lg font-medium text-sm transition-colors flex items-center gap-2"><span>📝</span> Rx Prescriptions</button>
      </nav>

      <button @click="handleLogout" class="text-left text-red-400 hover:bg-slate-800 px-4 py-2 rounded-lg font-medium text-sm transition-colors">
        Logout
      </button>
    </aside>

    <main class="flex-1 p-10 max-w-5xl">
      <div class="mb-6 flex gap-2 border-b border-slate-200">
        <button @click="activeTab = 'new-prescription'" :class="[activeTab === 'new-prescription' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700']" class="px-4 py-2 -mb-px border-b-2 text-sm font-semibold">Issue Prescription</button>
        <button @click="activeTab = 'medical-cert'" :class="[activeTab === 'medical-cert' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700']" class="px-4 py-2 -mb-px border-b-2 text-sm font-semibold">Issue Medical Cert</button>
        <button @click="activeTab = 'prescription-history'" :class="[activeTab === 'prescription-history' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700']" class="px-4 py-2 -mb-px border-b-2 text-sm font-semibold">Recent Orders Log</button>
      </div>

      <div v-if="activeTab === 'new-prescription'">
        <div class="mb-6">
          <h1 class="text-2xl font-bold text-slate-900">Rx Medication Prescription Intake</h1>
          <p class="text-sm text-slate-500">Authorize drug distributions, control dosages, and route orders to the pharmacy subsystem.</p>
        </div>

        <div class="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
          <form @submit.prevent="submitPrescription" class="space-y-6">

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider">Patient (your active consultation)</label>
                <select v-model="prescriptionForm.consultationId" required class="mt-1.5 block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500">
                  <option value="" disabled>Select a patient consultation</option>
                  <option v-for="c in myConsultations" :key="c.consultation_id" :value="c.consultation_id">
                    {{ c.patient_name }} — {{ c.consultation_id }} ({{ c.session_status }})
                  </option>
                </select>
                <p v-if="!myConsultations.length" class="mt-1 text-xs text-amber-600">
                  No consultations assigned to you yet — claim one under Video Consultations first.
                </p>
              </div>

              <div>
                <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider">Medication (from inventory)</label>
                <select v-model="prescriptionForm.medicationId" required class="mt-1.5 block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500">
                  <option value="" disabled>Select a medication</option>
                  <option v-for="med in inventory" :key="med.medication_id" :value="med.medication_id" :disabled="med.stock_quantity === 0">
                    {{ med.name }} — {{ med.form }} ({{ med.stock_quantity }} in stock)
                  </option>
                </select>
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider">Dosage / Strength</label>
                <input v-model="prescriptionForm.dosage" type="text" required placeholder="e.g., 500mg, 10ml" class="mt-1.5 block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500">
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
                <input v-model.number="prescriptionForm.refills" type="number" min="0" max="12" required class="mt-1.5 block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500">
              </div>
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider">Sig / Patient Special Instructions</label>
              <textarea v-model="prescriptionForm.instructions" rows="3" placeholder="Take with food. Complete the full course of treatment." class="mt-1.5 block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"></textarea>
            </div>

            <div class="flex items-center justify-end gap-4 pt-2">
              <p v-if="error" role="alert" class="text-sm font-medium text-red-600 mr-auto">{{ error }}</p>
              <p v-if="notice" role="status" class="text-sm font-medium text-emerald-600 mr-auto">{{ notice }}</p>
              <button type="submit" :disabled="submitting || !myConsultations.length" class="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-lg shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                <span>📝</span> {{ submitting ? 'Routing…' : 'Route to Pharmacy' }}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div v-if="activeTab === 'medical-cert'">
        <div class="mb-6">
          <h1 class="text-2xl font-bold text-slate-900">Issue Medical Certificate</h1>
          <p class="text-sm text-slate-500">Issue a digitally signed MC for one of your consultations. The patient can download and share it; anyone can verify its signature via the public QR link.</p>
        </div>

        <div class="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
          <form @submit.prevent="submitMc" class="space-y-6">
            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider">Patient (your active consultation)</label>
              <select v-model="mcForm.consultationId" required class="mt-1.5 block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500">
                <option value="" disabled>Select a patient consultation</option>
                <option v-for="c in myConsultations" :key="c.consultation_id" :value="c.consultation_id">
                  {{ c.patient_name }} — {{ c.consultation_id }} ({{ c.session_status }})
                </option>
              </select>
              <p v-if="!myConsultations.length" class="mt-1 text-xs text-amber-600">
                No consultations assigned to you yet — claim one under Video Consultations first.
              </p>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider">Diagnosis</label>
                <input v-model="mcForm.diagnosis" type="text" required minlength="3" maxlength="300" placeholder="e.g., Acute viral pharyngitis" class="mt-1.5 block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500">
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider">Valid Until</label>
                <input v-model="mcForm.validUntil" type="date" required :min="today" class="mt-1.5 block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500">
              </div>
            </div>

            <div class="flex items-center justify-end gap-4 pt-2">
              <p v-if="mcError" role="alert" class="text-sm font-medium text-red-600 mr-auto">{{ mcError }}</p>
              <p v-if="mcNotice" role="status" class="text-sm font-medium text-emerald-600 mr-auto">{{ mcNotice }}</p>
              <button type="submit" :disabled="mcSubmitting || !myConsultations.length" class="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-lg shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                <span>🩺</span> {{ mcSubmitting ? 'Signing…' : 'Issue & Sign MC' }}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div v-if="activeTab === 'prescription-history'">
        <div class="mb-6">
          <h1 class="text-2xl font-bold text-slate-900">Your Issued Prescription Logs</h1>
          <p class="text-sm text-slate-500">Prescriptions routed under your credentials.</p>
        </div>

        <div class="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <table class="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead class="bg-slate-50 font-semibold text-slate-700">
              <tr>
                <th scope="col" class="px-6 py-3">Patient</th>
                <th scope="col" class="px-6 py-3">Medication</th>
                <th scope="col" class="px-6 py-3">Dosage / Frequency</th>
                <th scope="col" class="px-6 py-3">Refills</th>
                <th scope="col" class="px-6 py-3">Status</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200 text-slate-600">
              <tr v-for="item in historyLogs" :key="item.prescription_id" class="hover:bg-slate-50/50 transition-colors">
                <td class="px-6 py-4 font-medium text-slate-900">{{ item.patient_name }}</td>
                <td class="px-6 py-4 font-mono text-xs text-indigo-600 font-semibold">{{ item.medication_name }}</td>
                <td class="px-6 py-4">
                  <div>{{ item.dosage }}</div>
                  <div class="text-xs text-slate-400">{{ item.frequency }}</div>
                </td>
                <td class="px-6 py-4">
                  <span class="text-slate-700 bg-slate-100 font-medium text-xs px-2 py-1 rounded">{{ item.refills }} permitted</span>
                </td>
                <td class="px-6 py-4">
                  <span class="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset"
                    :class="item.status === 'Fulfilled' ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/10' : item.status === 'Cancelled' ? 'bg-red-50 text-red-700 ring-red-600/10' : 'bg-amber-50 text-amber-700 ring-amber-600/10'">
                    {{ item.status }}
                  </span>
                </td>
              </tr>
              <tr v-if="historyLogs.length === 0">
                <td colspan="5" class="px-6 py-10 text-center text-slate-400">No prescriptions issued yet.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { apiFetch, logout } from '../../services/api'

const router = useRouter()
const route = useRoute()
const activeTab = ref('new-prescription')

const currentDoctor = ref({ name: 'Doctor' })
const meId = ref('')
const inventory = ref([])
const consultations = ref([])
const historyLogs = ref([])
const error = ref('')
const notice = ref('')
const submitting = ref(false)

// Only the doctor's own consultations are valid prescribing contexts (backend enforces
// ensureAssignedDoctor too).
const myConsultations = computed(() =>
  consultations.value.filter((c) => String(c.doctor_id) === String(meId.value) && c.session_status !== 'Cancelled'))

const defaultForm = { consultationId: '', medicationId: '', dosage: '', frequency: 'Once daily', refills: 0, instructions: '' }
const prescriptionForm = ref({ ...defaultForm })

// Medical certificate issuance (separate state so messages don't bleed across tabs).
const today = new Date().toISOString().slice(0, 10)
const mcForm = ref({ consultationId: '', diagnosis: '', validUntil: '' })
const mcError = ref('')
const mcNotice = ref('')
const mcSubmitting = ref(false)

const loadAll = async () => {
  try {
    const me = await apiFetch('/me')
    meId.value = me.user?.user_id || ''
    currentDoctor.value = { name: me.user?.name || 'Doctor' }
  } catch { /* not signed in */ }
  try { inventory.value = await apiFetch('/inventory') } catch { inventory.value = [] }
  try { consultations.value = await apiFetch('/consultations') } catch { consultations.value = [] }
  try { historyLogs.value = await apiFetch('/doctor/prescriptions') } catch { historyLogs.value = [] }
  // Arrived via the "Prescribe" / "Issue MC" button on Live Rooms → open the right tab
  // and pre-select that consultation (only if it's really one of this doctor's own).
  const preselect = route.query.consultationId
  if (preselect && myConsultations.value.some((c) => c.consultation_id === preselect)) {
    if (route.query.tab === 'mc') {
      activeTab.value = 'medical-cert'
      mcForm.value.consultationId = preselect
    } else {
      activeTab.value = 'new-prescription'
      prescriptionForm.value.consultationId = preselect
    }
  }
}
onMounted(loadAll)

const submitPrescription = async () => {
  error.value = ''
  notice.value = ''
  const consult = myConsultations.value.find((c) => c.consultation_id === prescriptionForm.value.consultationId)
  if (!consult) { error.value = 'Please select one of your patient consultations.'; return }
  submitting.value = true
  try {
    await apiFetch('/prescriptions', {
      method: 'POST',
      body: JSON.stringify({
        consultationId: consult.consultation_id,
        patientId: consult.patient_id,
        medicationId: prescriptionForm.value.medicationId,
        dosage: prescriptionForm.value.dosage,
        frequency: prescriptionForm.value.frequency,
        refills: prescriptionForm.value.refills,
        instructions: prescriptionForm.value.instructions,
      }),
    })
    notice.value = `Prescription routed to pharmacy for ${consult.patient_name}.`
    prescriptionForm.value = { ...defaultForm }
    await loadAll()
    activeTab.value = 'prescription-history'
  } catch (err) {
    // Backend may require recent re-auth for prescribing — surface that clearly.
    error.value = err.message || 'Could not issue the prescription.'
  } finally {
    submitting.value = false
  }
}

const submitMc = async () => {
  mcError.value = ''
  mcNotice.value = ''
  const consult = myConsultations.value.find((c) => c.consultation_id === mcForm.value.consultationId)
  if (!consult) { mcError.value = 'Please select one of your patient consultations.'; return }
  mcSubmitting.value = true
  try {
    const res = await apiFetch('/medical-certificates', {
      method: 'POST',
      body: JSON.stringify({
        consultationId: consult.consultation_id,
        patientId: consult.patient_id,
        diagnosis: mcForm.value.diagnosis,
        validUntil: mcForm.value.validUntil,
      }),
    })
    mcNotice.value = `Medical certificate ${res.mcId} issued and signed for ${consult.patient_name}. The patient can download it under “Medical Cert”.`
    mcForm.value = { consultationId: '', diagnosis: '', validUntil: '' }
  } catch (err) {
    // The backend requires a completed payment before an MC is released; surface that.
    mcError.value = /payment/i.test(err.message || '')
      ? 'The patient must complete payment before a medical certificate can be issued.'
      : (err.message || 'Could not issue the medical certificate (recent re-authentication may be required).')
  } finally {
    mcSubmitting.value = false
  }
}

const handleLogout = () => { logout(router) }
</script>
