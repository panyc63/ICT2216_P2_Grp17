<template>
  <div>
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-slate-900 tracking-tight">Your medical certificate</h1>
      <p class="text-sm text-slate-500 mt-1">View your certificate and save a copy as a PDF.</p>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="bg-white border border-slate-200 rounded-2xl shadow-sm p-8 max-w-2xl text-sm text-slate-400">
      Loading your certificate…
    </div>

    <!-- Empty -->
    <div v-else-if="!mc" class="bg-white border border-slate-200 rounded-2xl shadow-sm p-10 text-center max-w-2xl">
      <div class="w-14 h-14 mx-auto rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-2xl" aria-hidden="true">📄</div>
      <h2 class="mt-4 font-bold text-slate-900">No certificate yet</h2>
      <p class="mt-1.5 text-sm text-slate-500 max-w-md mx-auto">
        If a doctor issues you a medical certificate during a consultation, you'll be able to view and download it here.
      </p>
    </div>

    <!-- Certificate -->
    <div v-else class="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden max-w-2xl">
      <div class="bg-brand-gradient px-8 py-6 text-white text-center">
        <p class="text-lg font-extrabold tracking-tight">MediFlow Clinic</p>
        <p class="text-xs text-indigo-100 mt-0.5">Medical Certificate</p>
      </div>

      <div class="p-8">
        <p class="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-full px-3 py-1 mb-5">
          <span aria-hidden="true">🔏</span> Digitally signed by your doctor
        </p>

        <dl class="divide-y divide-slate-100">
          <div class="py-3 flex justify-between gap-4">
            <dt class="text-sm font-semibold text-slate-500">Patient name</dt>
            <dd class="text-sm font-semibold text-slate-900 text-right">{{ mc.patientName }}</dd>
          </div>
          <div class="py-3 flex justify-between gap-4">
            <dt class="text-sm font-semibold text-slate-500">Diagnosis</dt>
            <dd class="text-sm font-semibold text-slate-900 text-right">{{ mc.diagnosis }}</dd>
          </div>
          <div class="py-3 flex justify-between gap-4">
            <dt class="text-sm font-semibold text-slate-500">Date of issue</dt>
            <dd class="text-sm font-semibold text-slate-900 text-right">{{ mc.issueDate }}</dd>
          </div>
          <div class="py-3 flex justify-between gap-4">
            <dt class="text-sm font-semibold text-slate-500">Valid from</dt>
            <dd class="text-sm font-semibold text-slate-900 text-right">{{ mc.validFrom }}</dd>
          </div>
          <div class="py-3 flex justify-between gap-4">
            <dt class="text-sm font-semibold text-slate-500">Valid to</dt>
            <dd class="text-sm font-semibold text-slate-900 text-right">{{ mc.validTo }}</dd>
          </div>
          <div class="py-3 flex justify-between gap-4">
            <dt class="text-sm font-semibold text-slate-500">Attending doctor</dt>
            <dd class="text-sm font-semibold text-slate-900 text-right">{{ mc.doctor }}</dd>
          </div>
        </dl>

        <button
          @click="downloadPdf"
          class="mt-8 w-full inline-flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white text-sm font-semibold rounded-xl shadow-sm hover:bg-indigo-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
        >
          <span aria-hidden="true">⬇</span> Download PDF
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { jsPDF } from 'jspdf'
import { apiFetch } from '../../services/api'

// Null until the backend confirms an issued certificate — no sample/seed data.
const mc = ref(null)
const loading = ref(true)

onMounted(async () => {
  try {
    const data = await apiFetch('/patient/medical-certificates/latest')
    mc.value = {
      patientName: data.patient_name || 'You',
      diagnosis: data.diagnosis || 'Recorded in your clinical record',
      issueDate: String(data.issue_date || '').slice(0, 10),
      validFrom: String(data.issue_date || '').slice(0, 10),
      validTo: String(data.valid_until || '').slice(0, 10),
      doctor: data.doctor_name || 'Attending doctor',
    }
  } catch {
    mc.value = null // no certificate yet → empty state
  } finally {
    loading.value = false
  }
})

const downloadPdf = () => {
  if (!mc.value) return
  const doc = new jsPDF()
  const data = mc.value

  doc.setFontSize(18)
  doc.text('MediFlow Clinic', 105, 20, { align: 'center' })
  doc.setFontSize(12)
  doc.text('Medical Certificate', 105, 28, { align: 'center' })
  doc.setLineWidth(0.5)
  doc.line(20, 34, 190, 34)

  doc.setFontSize(11)
  let y = 50
  const rows = [
    ['Patient Name', data.patientName],
    ['Diagnosis', data.diagnosis],
    ['Date of Issue', data.issueDate],
    ['Valid From', data.validFrom],
    ['Valid To', data.validTo],
    ['Attending Doctor', data.doctor],
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
  doc.text(String(data.doctor), 20, y + 36)

  doc.save(`Medical_Certificate_${String(data.patientName).replace(/\s+/g, '_')}.pdf`)
}
</script>
