<template>
  <div class="min-h-screen bg-slate-50 flex flex-col font-sans">

    <div class="flex-1 flex items-center justify-center px-4 py-12">
      <div class="bg-white border border-slate-200 w-full max-w-md rounded-2xl p-8 shadow-sm">
        <div class="mb-8">
          <h2 class="text-2xl font-extrabold text-slate-950 tracking-tight mb-2">Get started free</h2>
          <p class="text-sm text-slate-500">
            Already have an account? 
            <router-link to="/login" class="text-indigo-600 font-semibold hover:underline">Sign in</router-link>
          </p>
        </div>

        <form @submit.prevent="handleRegister" class="space-y-6">
          <div class="flex flex-col gap-2">
            <label class="text-sm font-semibold text-slate-900" for="name">Full Name</label>
            <input 
              v-model="name"
              class="w-full px-4 py-3 border border-slate-200 bg-slate-50 rounded-xl text-sm focus:outline-none focus:border-indigo-600 focus:bg-white focus:ring-4 focus:ring-indigo-50 transition-all" 
              type="text" 
              id="name" 
              placeholder="Alex Rivera" 
              required
            >
          </div>

          <div class="flex flex-col gap-2">
            <label class="text-sm font-semibold text-slate-900" for="email">Work Email</label>
            <input 
              v-model="email"
              class="w-full px-4 py-3 border border-slate-200 bg-slate-50 rounded-xl text-sm focus:outline-none focus:border-indigo-600 focus:bg-white focus:ring-4 focus:ring-indigo-50 transition-all" 
              type="email" 
              id="email" 
              placeholder="name@company.com" 
              required
            >
          </div>

          <div class="flex flex-col gap-2">
            <label class="text-sm font-semibold text-slate-900" for="password">Password</label>
            <input 
              v-model="password"
              class="w-full px-4 py-3 border border-slate-200 bg-slate-50 rounded-xl text-sm focus:outline-none focus:border-indigo-600 focus:bg-white focus:ring-4 focus:ring-indigo-50 transition-all" 
              type="password" 
              id="password" 
              placeholder="At least 8 characters" 
              required
            >
          </div>

          <div class="flex items-center gap-3">
            <input type="checkbox" id="terms" required class="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-50">
            <label for="terms" class="text-sm text-slate-500 cursor-pointer select-none">
              I agree to the terms & privacy policy
            </label>
          </div>

          <button type="submit" class="w-full bg-indigo-600 text-white font-bold py-3.5 rounded-xl hover:bg-indigo-700 shadow-md hover:-translate-y-0.5 transition-all duration-200">
            Create Account
          </button>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const name = ref('')
const email = ref('')
const password = ref('')

const handleRegister = async () => {
  try {
    const response = await fetch('http://localhost:5000/api/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: name.value,
        email: email.value,
        password: password.value
      })
    })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error || 'Register sequence failed.')
  }
  localStorage.setItem('userRole', data.user.role)
  localStorage.setItem('userId', data.user.user_id) 

  alert(`Registration successful for ${name.value}! Redirecting to login...`)
  router.push('/login')
  } catch (error) {
    console.error('Registration error:', error)
    alert('An error occurred during registration. Please try again.')
  }
} 
</script>