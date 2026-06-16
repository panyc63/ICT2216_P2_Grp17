<template>
  <div class="min-h-screen bg-slate-50 flex items-start justify-center px-4 pt-20 font-sans">
    <div class="bg-white border border-slate-200 w-full max-w-md rounded-2xl p-8 shadow-sm">
      <div class="mb-8">
        <h2 class="text-2xl font-extrabold text-slate-950 tracking-tight mb-2">Sign in to platform</h2>
      </div>

      <form @submit.prevent="handleLogin" class="space-y-6">
        <div class="flex flex-col gap-2">
          <label class="text-sm font-semibold text-slate-900" for="email">Work Email</label>
          <input 
            v-model="email"
            class="w-full px-4 py-3 border border-slate-200 bg-slate-50 rounded-xl text-sm focus:outline-none focus:border-indigo-600 focus:bg-white transition-all" 
            type="email" 
            id="email" 
            placeholder="admin@medihealth.com" 
            required
          >
        </div>

        <div class="flex flex-col gap-2">
          <label class="text-sm font-semibold text-slate-900" for="password">Password</label>
          <input 
            v-model="password"
            class="w-full px-4 py-3 border border-slate-200 bg-slate-50 rounded-xl text-sm focus:outline-none focus:border-indigo-600 focus:bg-white transition-all" 
            type="password" 
            id="password" 
            placeholder="••••••••" 
            required
          >
        </div>

        <button type="submit" class="w-full bg-indigo-600 text-white font-bold py-3.5 rounded-xl hover:bg-indigo-700 shadow-md transition-all">
          Sign In
        </button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const email = ref('')       // Must be defined as email
const password = ref('')

const handleLogin = () => {
  // Exact match string verification
  if (email.value === 'admin@medihealth.com' && password.value === 'pass123') {
    router.push('/admin-dashboard')
  } else {
    alert(`Invalid credentials! You typed: ${email.value}`)
  }
}
</script>