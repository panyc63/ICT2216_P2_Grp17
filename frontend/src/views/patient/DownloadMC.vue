<template>
  <div>
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-slate-900 tracking-tight">Medical Certificate</h1>
      <p class="text-sm text-slate-500">View and download your medical certificate as a PDF.</p>
    </div>

    <div class="bg-white border border-slate-200 rounded-2xl shadow-sm p-8 max-w-2xl">
      <div class="text-center border-b border-slate-200 pb-4 mb-6">
        <p class="text-lg font-extrabold tracking-tight text-indigo-600">MediFlow Clinic</p>
        <p class="text-xs text-slate-400">Medical Certificate</p>
      </div>

      <dl class="divide-y divide-slate-100">
        <div class="py-3 flex justify-between gap-4">
          <dt class="text-sm font-semibold text-slate-500">Patient Name</dt>
          <dd class="text-sm font-medium text-slate-900 text-right">{{ mc.patientName }}</dd>
        </div>
        <div class="py-3 flex justify-between gap-4">
          <dt class="text-sm font-semibold text-slate-500">Diagnosis</dt>
          <dd class="text-sm font-medium text-slate-900 text-right">{{ mc.diagnosis }}</dd>
        </div>
        <div class="py-3 flex justify-between gap-4">
          <dt class="text-sm font-semibold text-slate-500">Date of Issue</dt>
          <dd class="text-sm font-medium text-slate-900 text-right">{{ mc.issueDate }}</dd>
        </div>
        <div class="py-3 flex justify-between gap-4">
          <dt class="text-sm font-semibold text-slate-500">Valid From</dt>
          <dd class="text-sm font-medium text-slate-900 text-right">{{ mc.validFrom }}</dd>
        </div>
        <div class="py-3 flex justify-between gap-4">
          <dt class="text-sm font-semibold text-slate-500">Valid To</dt>
          <dd class="text-sm font-medium text-slate-900 text-right">{{ mc.validTo }}</dd>
        </div>
        <div class="py-3 flex justify-between gap-4">
          <dt class="text-sm font-semibold text-slate-500">Attending Doctor</dt>
          <dd class="text-sm font-medium text-slate-900 text-right">{{ mc.doctor }}</dd>
        </div>
      </dl>

      <button
        @click="downloadPdf"
        class="mt-8 w-full py-3 bg-indigo-600 text-white text-sm font-semibold rounded-lg shadow-sm hover:bg-indigo-700"
      >
        Download PDF
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { jsPDF } from 'jspdf'

const mc = ref({
  patientName: 'Tan Wei Ming',
  diagnosis: 'Acute Upper Respiratory Tract Infection',
  issueDate: '18 Jun 2026',
  validFrom: '18 Jun 2026',
  validTo: '20 Jun 2026',
  doctor: 'Dr. John Doe'
})

const downloadPdf = () => {
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
    ['Attending Doctor', data.doctor]
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
  doc.text(
    'This is to certify that the above-named patient is unfit for work/school',
    20,
    y
  )
  doc.text('for the validity period stated above.', 20, y + 6)

  doc.text('_____________________', 20, y + 30)
  doc.text(data.doctor, 20, y + 36)

  doc.save(`Medical_Certificate_${data.patientName.replace(/\s+/g, '_')}.pdf`)
}
</script>
