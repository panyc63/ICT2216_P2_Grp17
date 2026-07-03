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

        <!-- Verify authenticity: QR + short link a third party (e.g. employer) can check. -->
        <div v-if="qr" class="mt-8 flex items-start gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <svg
            :viewBox="`0 0 ${qr.size + 8} ${qr.size + 8}`" width="108" height="108"
            shape-rendering="crispEdges" role="img" aria-label="Certificate verification QR code"
            class="shrink-0 rounded-lg border border-slate-200 bg-white"
          >
            <rect :width="qr.size + 8" :height="qr.size + 8" fill="#ffffff" />
            <g fill="#0f172a">
              <rect v-for="(cell, i) in qrCells" :key="i" :x="cell.c + 4" :y="cell.r + 4" width="1" height="1" />
            </g>
          </svg>
          <div class="min-w-0">
            <p class="text-sm font-semibold text-slate-900">Verify authenticity</p>
            <p class="text-xs text-slate-500 mt-0.5">Scan the QR, or open the link, to confirm this certificate is genuine and not revoked.</p>
            <a :href="verifyUrl" target="_blank" rel="noopener noreferrer" class="mt-1.5 inline-block text-xs font-semibold text-indigo-600 hover:underline break-all">{{ verifyUrl }}</a>
          </div>
        </div>

        <button
          @click="downloadPdf"
          class="mt-6 w-full inline-flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white text-sm font-semibold rounded-xl shadow-sm hover:bg-indigo-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
        >
          <span aria-hidden="true">⬇</span> Download PDF
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref, computed } from 'vue'
import { jsPDF } from 'jspdf'
import { apiFetch } from '../../services/api'
import { qrMatrix } from '../../utils/qrcode'

// Null until the backend confirms an issued certificate — no sample/seed data.
const mc = ref(null)
const loading = ref(true)
const verifyUrl = ref('')

// QR matrix for the short verify URL (rendered as inline SVG — no v-html).
const qr = computed(() => (verifyUrl.value ? qrMatrix(verifyUrl.value) : null))
const qrCells = computed(() => {
  if (!qr.value) return []
  const cells = []
  qr.value.modules.forEach((row, r) => row.forEach((on, c) => { if (on) cells.push({ r, c }) }))
  return cells
})

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
    verifyUrl.value = data.verifyUrl || ''
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

  // Verification QR (drawn as filled squares — no image dependency) + the short verify link.
  if (qr.value && verifyUrl.value) {
    const matrix = qr.value
    const mod = 1.5
    const qx = 140
    const qy = y - 4
    doc.setFillColor(15, 23, 42)
    for (let r = 0; r < matrix.size; r += 1) {
      for (let c = 0; c < matrix.size; c += 1) {
        if (matrix.modules[r][c]) doc.rect(qx + c * mod, qy + r * mod, mod, mod, 'F')
      }
    }
    doc.setFontSize(8)
    doc.setTextColor(90)
    doc.text('Scan to verify authenticity', qx, qy + matrix.size * mod + 5)
    doc.text('Verify this certificate at:', 20, 280)
    doc.setTextColor(60)
    doc.text(verifyUrl.value, 20, 285, { maxWidth: 175 })
    doc.setTextColor(0)
  }

  doc.save(`Medical_Certificate_${String(data.patientName).replace(/\s+/g, '_')}.pdf`)
}
</script>
