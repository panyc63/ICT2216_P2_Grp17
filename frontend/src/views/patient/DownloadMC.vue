<template>
  <div>
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-slate-900 tracking-tight">Medical Certificates</h1>
      <p class="text-sm text-slate-500">All medical certificates issued to you.</p>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="bg-white border border-slate-200 rounded-2xl shadow-sm p-8 max-w-3xl text-center text-sm text-slate-500">
      Loading…
    </div>

    <!-- Error -->
    <div v-else-if="error" class="bg-white border border-slate-200 rounded-2xl shadow-sm p-8 max-w-3xl text-center text-sm text-red-500">
      {{ error }}
    </div>

    <!-- Empty state -->
    <div v-else-if="certificates.length === 0" class="bg-white border border-slate-200 rounded-2xl shadow-sm p-10 max-w-3xl text-center">
      <div class="text-3xl mb-3">📄</div>
      <p class="text-sm font-semibold text-slate-900">No Medical Certificates issued yet</p>
      <p class="text-xs text-slate-500 mt-1">Certificates issued by a doctor after a consultation will appear here.</p>
    </div>

    <!-- List -->
    <div v-else class="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden max-w-3xl">
      <table class="min-w-full divide-y divide-slate-200 text-left text-sm">
        <thead class="bg-slate-50 font-semibold text-slate-700">
          <tr>
            <th class="px-6 py-3">Issue Date</th>
            <th class="px-6 py-3">Valid Until</th>
            <th class="px-6 py-3">Issuing Doctor</th>
            <th class="px-6 py-3">Status</th>
            <th class="px-6 py-3 text-right">Action</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 text-slate-600">
          <tr v-for="cert in certificates" :key="cert.mc_id" class="hover:bg-slate-50/50">
            <td class="px-6 py-4 font-medium text-slate-900">{{ cert.issue_date }}</td>
            <td class="px-6 py-4">{{ cert.valid_until }}</td>
            <td class="px-6 py-4">{{ cert.doctor_name || '—' }}</td>
            <td class="px-6 py-4">
              <span
                :class="cert.is_revoked ? 'bg-red-50 text-red-700 ring-red-600/10' : 'bg-emerald-50 text-emerald-700 ring-emerald-600/10'"
                class="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset"
              >
                {{ cert.is_revoked ? 'Revoked' : 'Active' }}
              </span>
            </td>
            <td class="px-6 py-4 text-right">
              <button
                @click="downloadPdf(cert)"
                class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm"
              >
                Download PDF
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { jsPDF } from 'jspdf'
import { patientStore } from '../../store/patientStore'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000'
const api = axios.create({ baseURL: API_BASE })

const patientId = patientStore.patientId || localStorage.getItem('userId') || ''

const certificates = ref([])
const loading = ref(true)
const error = ref('')

onMounted(async () => {
  if (!patientId) {
    error.value = 'No patient session found.'
    loading.value = false
    return
  }
  try {
    const { data } = await api.get(`/api/medical-certificates/${patientId}`)
    certificates.value = data
  } catch (err) {
    error.value = err.response?.data?.error || 'Unable to load medical certificates.'
  } finally {
    loading.value = false
  }
})

const downloadPdf = (cert) => {
  const doc = new jsPDF()
  const patientName = cert.patient_name || patientStore.profile.name || '—'
  const doctorName = cert.doctor_name || '—'
  const diagnosis = cert.diagnosis || 'N/A'

  doc.setFontSize(18)
  doc.text('MediFlow Clinic', 105, 20, { align: 'center' })
  doc.setFontSize(12)
  doc.text('Medical Certificate', 105, 28, { align: 'center' })
  doc.setLineWidth(0.5)
  doc.line(20, 34, 190, 34)

  doc.setFontSize(11)
  let y = 50
  const rows = [
    ['Certificate ID', cert.mc_id],
    ['Patient Name', patientName],
    ['Diagnosis', diagnosis],
    ['Date of Issue', cert.issue_date],
    ['Valid From', cert.issue_date],
    ['Valid To', cert.valid_until],
    ['Attending Doctor', doctorName],
    ['Status', cert.is_revoked ? 'REVOKED' : 'Active']
  ]
  rows.forEach(([label, value]) => {
    doc.setFont(undefined, 'bold')
    doc.text(`${label}:`, 20, y)
    doc.setFont(undefined, 'normal')
    doc.text(String(value), 70, y)
    y += 12
  })

  y += 10
  doc.setFontSize(10)
  doc.text('This is to certify that the above-named patient is unfit for work/school', 20, y)
  doc.text('for the validity period stated above.', 20, y + 6)

  doc.text('_____________________', 20, y + 30)
  doc.text(doctorName, 20, y + 36)

  doc.save(`Medical_Certificate_${cert.mc_id}.pdf`)
}
</script>
