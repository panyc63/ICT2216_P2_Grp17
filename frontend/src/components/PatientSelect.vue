<template>
  <div>
    <input
      v-model="filter"
      type="text"
      placeholder="Search patients by name or ID…"
      class="block w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 mb-2"
    />
    <select
      :value="modelValue"
      @change="$emit('update:modelValue', $event.target.value)"
      size="6"
      class="block w-full border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
    >
      <option v-if="filtered.length === 0" disabled value="">No patients found</option>
      <option v-for="p in filtered" :key="p.user_id" :value="p.user_id">
        {{ p.name || p.email }} — {{ p.user_id }}
      </option>
    </select>
    <p v-if="error" class="mt-1 text-xs font-medium text-red-500">{{ error }}</p>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'

defineProps({ modelValue: { type: String, default: '' } })
defineEmits(['update:modelValue'])

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000'
const api = axios.create({ baseURL: API_BASE })

const patients = ref([])
const filter = ref('')
const error = ref('')

const filtered = computed(() => {
  const q = filter.value.trim().toLowerCase()
  if (!q) return patients.value
  return patients.value.filter((p) =>
    (p.name || '').toLowerCase().includes(q) ||
    (p.email || '').toLowerCase().includes(q) ||
    p.user_id.toLowerCase().includes(q)
  )
})

onMounted(async () => {
  try {
    const { data } = await api.get('/api/users/patients')
    patients.value = data
  } catch (err) {
    error.value = 'Unable to load patients.'
  }
})
</script>
