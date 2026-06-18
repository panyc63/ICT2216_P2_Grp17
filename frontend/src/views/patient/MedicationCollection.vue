<template>
  <div>
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-slate-900 tracking-tight">Medication Collection</h1>
      <p class="text-sm text-slate-500">Choose how you would like to receive your prescribed medication.</p>
    </div>

    <div class="bg-white border border-slate-200 rounded-2xl shadow-sm p-8 max-w-2xl space-y-4">
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

      <!-- Delivery address surfaces only when Delivery is chosen -->
      <div v-if="method === 'delivery'" class="mt-2 bg-slate-50 border border-slate-200 rounded-xl p-4">
        <p class="text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">Delivering to</p>
        <p class="text-sm font-medium text-slate-900">{{ profile.name }}</p>
        <p class="text-sm text-slate-600">{{ profile.homeAddress }}</p>
        <router-link to="/patient/profile" class="inline-block mt-2 text-xs font-semibold text-indigo-600 hover:text-indigo-700">
          Update address in Profile
        </router-link>
      </div>

      <div class="pt-2 flex items-center gap-4">
        <button
          @click="saveSelection"
          class="px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg shadow-sm hover:bg-indigo-700"
        >
          Save Selection
        </button>
        <p v-if="saved" class="text-sm font-medium text-emerald-600">
          Saved: {{ method === 'delivery' ? 'Home Delivery' : 'Self-Collect' }}.
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { patientStore } from '../../store/patientStore'

const profile = patientStore.profile

const options = [
  { value: 'self-collect', title: 'Self-Collect', description: 'Pick up at the MediFlow pharmacy counter during opening hours.' },
  { value: 'delivery', title: 'Home Delivery', description: 'Have your medication delivered to your registered home address.' }
]

const method = ref(patientStore.medication.method)
const saved = ref(false)

const saveSelection = () => {
  patientStore.medication.method = method.value
  saved.value = true
}
</script>
