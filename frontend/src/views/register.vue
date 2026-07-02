<template>
  <div class="min-h-screen bg-slate-50 flex items-start justify-center px-4 pt-20 font-sans">
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
            class="w-full px-4 py-3 border border-slate-200 bg-slate-50 rounded-xl text-sm focus:outline-none focus:border-indigo-600 focus:bg-white transition-all" 
            type="text" 
            id="name" 
            placeholder="Alex Rivera" 
            required
          >
        </div>

        <div class="flex flex-col gap-2">
          <label class="text-sm font-semibold text-slate-900" for="email">Email</label>
          <input 
            v-model="email"
            class="w-full px-4 py-3 border border-slate-200 bg-slate-50 rounded-xl text-sm focus:outline-none focus:border-indigo-600 focus:bg-white transition-all" 
            type="email" 
            id="email" 
            placeholder="alex@example.com"
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

        <TurnstileWidget v-model="turnstileToken" />

        <button type="submit" class="w-full bg-indigo-600 text-white font-bold py-3.5 rounded-xl hover:bg-indigo-700 shadow-md transition-all">
          Create Account
        </button>
      </form>
    </div>
  </div>

  <Transition
    enter-active-class="transform ease-out duration-300 transition"
    enter-from-class="opacity-0 scale-95"
    enter-to-class="opacity-100 scale-100"
    leave-active-class="transition ease-in duration-200"
    leave-from-class="opacity-100 scale-100"
    leave-to-class="opacity-0 scale-95"
  >
    <div v-if="toast.show" class="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div :role="toast.isError ? 'alert' : 'status'" class="bg-white border border-slate-200 w-full max-w-sm rounded-2xl p-6 shadow-xl text-center flex flex-col items-center gap-4">
        
        <div :class="toast.isError ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'" class="w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold">
          {{ toast.isError ? '✕' : '✓' }}
        </div>

        <div>
          <h3 class="font-extrabold text-lg text-slate-900 mb-1">{{ toast.title }}</h3>
          <p class="text-sm text-slate-500 leading-relaxed px-2">{{ toast.message }}</p>
        </div>

        <div class="w-full text-xs text-slate-400 bg-slate-50 py-2.5 rounded-xl font-medium">
          {{ toast.isError ? 'Please resolve the error to try again.' : 'Redirecting to login portal shortly...' }}
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { apiFetch } from '../services/api'
import TurnstileWidget from '../components/TurnstileWidget.vue'

const router = useRouter()
const turnstileToken = ref('')
const name = ref('')
const email = ref('')
const password = ref('')

const toast = reactive({
  show: false,
  title: '',
  message: '',
  isError: false
})

const handleRegister = async () => {
  try {
    await apiFetch('/register', {
      method: 'POST',
      body: JSON.stringify({
        name: name.value,
        email: email.value,
        password: password.value,
        role: 'Patient',
        'cf-turnstile-response': turnstileToken.value
      })
    })

    toast.title = 'Verify Your Email'
    toast.message = `We have sent a verification link to ${email.value}. Please confirm it to activate your account.`
    toast.isError = false
    toast.show = true

    setTimeout(() => {
      toast.show = false
      router.push('/login')
    }, 5000)

  } catch (error) {
    console.error('Registration error:', error)
    
    toast.title = 'Registration Failed'
    toast.message = error.message
    toast.isError = true
    toast.show = true
    
    setTimeout(() => {
      toast.show = false
    }, 4000)
  }
}
</script>
