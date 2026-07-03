<template>
  <div class="min-h-screen bg-slate-50 flex items-start justify-center px-4 pt-20 font-sans">
    <div class="bg-white border border-slate-200 w-full max-w-md rounded-2xl p-8 shadow-sm">
      <div class="mb-8">
        <h2 class="text-2xl font-extrabold text-slate-950 tracking-tight mb-2">Sign in to platform</h2>
      </div>

      <form @submit.prevent="handleLogin" class="space-y-6">
        <div class="flex flex-col gap-2">
          <label class="text-sm font-semibold text-slate-900" for="email">Email</label>
          <input 
            v-model="email"
            class="w-full px-4 py-3 border border-slate-200 bg-slate-50 rounded-xl text-sm focus:outline-none focus:border-indigo-600 focus:bg-white transition-all" 
            type="email" 
            id="email" 
            placeholder="admin@mediflow.com" 
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

        <div v-if="mfaChallengeId" class="flex flex-col gap-2">
          <label class="text-sm font-semibold text-slate-900" for="otp">Email verification code</label>
          <input
            v-model="otp"
            class="w-full px-4 py-3 border border-slate-200 bg-slate-50 rounded-xl text-sm focus:outline-none focus:border-indigo-600 focus:bg-white transition-all"
            type="text"
            id="otp"
            inputmode="numeric"
            maxlength="6"
            placeholder="6-digit code"
            required
          >
        </div>

        <TurnstileWidget v-if="!mfaChallengeId" v-model="turnstileToken" />

        <button type="submit" class="w-full bg-indigo-600 text-white font-bold py-3.5 rounded-xl hover:bg-indigo-700 shadow-md transition-all">
          {{ mfaChallengeId ? 'Verify Code' : 'Sign In' }}
        </button>
      </form>

      <div class="mt-6 text-center text-sm text-slate-600">
        Don't have an account? 
        <router-link to="/register" class="font-semibold text-indigo-600 hover:text-indigo-700 hover:underline transition-all">
          Register here
        </router-link>
      </div>
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
          {{ toast.isError ? 'Action required to proceed.' : 'Redirecting to your dashboard...' }}
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { apiFetch, cacheSession, dashboardForRole } from '../services/api'
import TurnstileWidget from '../components/TurnstileWidget.vue'

const router = useRouter()
const email = ref('')
const password = ref('')
const otp = ref('')
const turnstileToken = ref('')
const mfaChallengeId = ref('')

const toast = reactive({
  show: false,
  title: '',
  message: '',
  isError: false
})

const handleLogin = async () => {
  try {
    const data = mfaChallengeId.value
      ? await apiFetch('/login/mfa', {
          method: 'POST',
          body: JSON.stringify({
            email: email.value,
            challengeId: mfaChallengeId.value,
            otp: otp.value
          })
        })
      : await apiFetch('/login', {
          method: 'POST',
          body: JSON.stringify({
            email: email.value,
            password: password.value,
            'cf-turnstile-response': turnstileToken.value
          })
        })

    if (data.requiresMfa) {
      mfaChallengeId.value = data.challengeId
      toast.title = 'Verification Required'
      toast.message = data.message || 'Enter the verification code sent to your email.'
      toast.isError = false
      toast.show = true
      setTimeout(() => {
        toast.show = false
      }, 3000)
      return
    }

    cacheSession(data)

    toast.title = 'Welcome Back'
    toast.message = 'Login authenticated successfully.'
    toast.isError = false
    toast.show = true

    setTimeout(() => {
      toast.show = false
      router.push(router.currentRoute.value.query.redirect || dashboardForRole(data.user.role))
    }, 1500)

  } catch (error) {
    console.error('Login error:', error)
    
    toast.title = 'Access Denied'
    toast.message = error.message
    toast.isError = true
    toast.show = true
    
    setTimeout(() => {
      toast.show = false
    }, 4000)
  }
}
</script>
