<template>
  <div>
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-slate-900 tracking-tight">Book a Consultation</h1>
      <p class="text-sm text-slate-500">Choose an available time slot with one of our doctors.</p>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-3xl">
      <button
        v-for="slot in slots"
        :key="slot.id"
        @click="selectSlot(slot)"
        :disabled="!slot.available"
        :aria-pressed="selectedSlotId === slot.id"
        :aria-label="`${slot.date} ${slot.time} with ${slot.doctor}${slot.available ? '' : ' — fully booked'}`"
        :class="[
          selectedSlotId === slot.id
            ? 'border-indigo-600 ring-2 ring-indigo-500 bg-indigo-50'
            : 'border-slate-200 bg-white hover:border-slate-300',
          !slot.available ? 'opacity-50 cursor-not-allowed' : ''
        ]"
        class="text-left border rounded-xl p-4 shadow-sm transition-all"
      >
        <p class="text-sm font-bold text-slate-900">{{ slot.date }}</p>
        <p class="text-sm text-slate-600">{{ slot.time }}</p>
        <p class="text-xs text-slate-400 mt-2">{{ slot.doctor }}</p>
        <p v-if="!slot.available" class="text-xs font-semibold text-red-500 mt-1">Fully booked</p>
      </button>
    </div>

    <div class="mt-8 max-w-3xl flex items-center gap-4">
      <button
        @click="confirmBooking"
        :disabled="selectedSlotId === null"
        class="px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg shadow-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Confirm Booking
      </button>
      <p v-if="confirmed && bookedRef" role="status" class="text-sm font-medium text-emerald-600">
        Booked ({{ bookedRef }}) — status: {{ bookedStatus }}. A doctor will pick up your consultation shortly.
      </p>
      <p v-if="error" role="alert" class="text-sm font-medium text-red-600">{{ error }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { patientStore } from '../../store/patientStore'
import { apiFetch } from '../../services/api'

const slots = ref([
  { id: 1, date: 'Mon, 22 Jun', time: '09:00 AM', doctor: 'Dr. John Doe', available: true },
  { id: 2, date: 'Mon, 22 Jun', time: '11:30 AM', doctor: 'Dr. Sarah Lin', available: true },
  { id: 3, date: 'Tue, 23 Jun', time: '02:00 PM', doctor: 'Dr. John Doe', available: false },
  { id: 4, date: 'Wed, 24 Jun', time: '10:15 AM', doctor: 'Dr. Amir Rahman', available: true },
  { id: 5, date: 'Thu, 25 Jun', time: '04:45 PM', doctor: 'Dr. Sarah Lin', available: true },
  { id: 6, date: 'Fri, 26 Jun', time: '01:00 PM', doctor: 'Dr. Amir Rahman', available: true }
])

const confirmed = ref(false)
const bookedRef = ref('')
const bookedStatus = ref('')
const error = ref('')

// selectedSlotId lives in the shared store so the choice survives navigation.
const selectedSlotId = computed(() => patientStore.booking.selectedSlotId)
const selectedSlot = computed(() => slots.value.find(s => s.id === selectedSlotId.value) || null)

const selectSlot = (slot) => {
  if (!slot.available) return
  patientStore.booking.selectedSlotId = slot.id
  confirmed.value = false
}

const confirmBooking = async () => {
  if (selectedSlotId.value === null) return
  error.value = ''
  try {
    const res = await apiFetch('/consultations', { method: 'POST', body: JSON.stringify({}) })
    bookedRef.value = res.consultationId
    bookedStatus.value = res.status
    confirmed.value = true
  } catch (err) {
    error.value = err.message || 'Could not book the consultation.'
  }
}
</script>
