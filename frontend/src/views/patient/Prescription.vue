<template>
  <div>
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-slate-900 tracking-tight">Active Prescription</h1>
      <p class="text-sm text-slate-500">Medication prescribed for you in your most recent consultation.</p>
    </div>

    <div class="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden max-w-3xl">
      <div class="bg-slate-900 text-white px-6 py-4 flex justify-between items-center">
        <div>
          <p class="text-sm font-semibold">Prescribed by {{ prescription.doctor }}</p>
          <p class="text-xs text-slate-400">Issued {{ prescription.issuedDate }}</p>
        </div>
        <span class="inline-flex items-center rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-medium text-emerald-300 ring-1 ring-inset ring-emerald-500/30">
          Active
        </span>
      </div>

      <table class="min-w-full divide-y divide-slate-200 text-left text-sm">
        <thead class="bg-slate-50 font-semibold text-slate-700">
          <tr>
            <th class="px-6 py-3">Medication</th>
            <th class="px-6 py-3">Dosage</th>
            <th class="px-6 py-3">Frequency</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 text-slate-600">
          <tr v-for="item in prescription.items" :key="item.name">
            <td class="px-6 py-4 font-medium text-slate-900">{{ item.name }}</td>
            <td class="px-6 py-4">{{ item.dosage }}</td>
            <td class="px-6 py-4">{{ item.frequency }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Collection method (merged from the former MedicationCollection step) -->
    <div class="mt-6 bg-white border border-slate-200 rounded-2xl shadow-sm p-8 max-w-3xl space-y-4">
      <div>
        <h3 class="text-sm font-bold text-slate-900">How would you like to receive your medication?</h3>
        <p class="text-sm text-slate-500">Choose collection or delivery for the prescription above.</p>
      </div>

      <label
        v-for="option in options"
        :key="option.value"
        :class="method === option.value ? 'border-indigo-600 ring-2 ring-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-slate-300'"
        class="flex items-start gap-4 border rounded-xl p-4 cursor-pointer transition-all"
      >
        <input type="radio" :value="option.value" v-model="method" class="mt-1 h-4 w-4 text-indigo-600 focus:ring-indigo-500" />
        <div>
          <p class="text-sm font-bold text-slate-900">{{ option.title }}</p>
          <p class="text-sm text-slate-500">{{ option.description }}</p>
        </div>
      </label>

      <div v-if="method === 'delivery'" class="bg-slate-50 border border-slate-200 rounded-xl p-4">
        <p class="text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">Delivering to</p>
        <p class="text-sm font-medium text-slate-900">{{ profile.name }}</p>
        <p class="text-sm text-slate-600">{{ profile.homeAddress }}</p>
        <router-link to="/patient/profile" class="inline-block mt-2 text-xs font-semibold text-indigo-600 hover:text-indigo-700">
          Update address in Profile
        </router-link>
      </div>

      <div class="pt-2">
        <button
          @click="confirmAndFinish"
          class="px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg shadow-sm hover:bg-indigo-700"
        >
          Confirm &amp; Finish
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { patientStore } from '../../store/patientStore'

const router = useRouter()
const profile = patientStore.profile

const options = [
  { value: 'self-collect', title: 'Self-Collect', description: 'Pick up at the MediFlow pharmacy counter during opening hours.' },
  { value: 'delivery', title: 'Home Delivery', description: 'Have your medication delivered to your registered home address.' }
]

const method = ref(patientStore.medication.method)

const confirmAndFinish = () => {
  patientStore.medication.method = method.value
  router.push('/patient/closing')
}

const prescription = ref({
  doctor: 'Dr. John Doe',
  issuedDate: '18 Jun 2026',
  items: [
    { name: 'Amoxicillin', dosage: '500 mg', frequency: '3 times daily, after meals' },
    { name: 'Paracetamol', dosage: '500 mg', frequency: 'Every 6 hours as needed' },
    { name: 'Loratadine', dosage: '10 mg', frequency: 'Once daily' }
  ]
})
</script>
