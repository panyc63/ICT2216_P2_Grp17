<template>
  <div>
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-slate-900 tracking-tight">Track Delivery</h1>
      <p class="text-sm text-slate-500">Follow your medication delivery from the pharmacy to your door.</p>
    </div>

    <div class="bg-white border border-slate-200 rounded-2xl shadow-sm p-8 max-w-xl">
      <ol class="relative">
        <li
          v-for="(step, index) in steps"
          :key="step"
          class="flex items-start pb-8 last:pb-0 relative"
        >
          <!-- Connector line between steps -->
          <span
            v-if="index < steps.length - 1"
            :class="index < currentStepIndex ? 'bg-indigo-600' : 'bg-slate-200'"
            class="absolute left-[15px] top-8 h-full w-0.5"
          ></span>

          <!-- Step marker -->
          <span
            :class="markerClass(index)"
            class="relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold shrink-0"
          >
            <span v-if="index < currentStepIndex">✓</span>
            <span v-else>{{ index + 1 }}</span>
          </span>

          <div class="ml-4 pt-1">
            <p :class="index <= currentStepIndex ? 'text-slate-900' : 'text-slate-400'" class="text-sm font-semibold">
              {{ step }}
            </p>
            <p v-if="index === currentStepIndex" class="text-xs font-medium text-indigo-600 mt-0.5">
              Current status
            </p>
          </div>
        </li>
      </ol>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const steps = ['Pending', 'Preparing', 'Dispatched', 'Out for Delivery', 'Delivered']

// Hardcoded current step for the prototype.
const currentStep = ref('Dispatched')
const currentStepIndex = computed(() => steps.indexOf(currentStep.value))

const markerClass = (index) => {
  if (index < currentStepIndex.value) return 'bg-indigo-600 border-indigo-600 text-white'
  if (index === currentStepIndex.value) return 'bg-white border-indigo-600 text-indigo-600 ring-4 ring-indigo-100'
  return 'bg-white border-slate-300 text-slate-400'
}
</script>
