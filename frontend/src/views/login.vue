<template>
  <div class="relative overflow-hidden min-h-[calc(100vh-5rem)] flex items-center justify-center px-4 py-12 font-sans bg-gradient-to-b from-indigo-50 via-indigo-50/40 to-white">
    <div class="absolute inset-0 opacity-[0.06] bg-dot-grid [background-size:22px_22px]" aria-hidden="true"></div>

    <div class="relative w-full max-w-md animate-fade-up">
      <!-- Brand mark -->
      <div class="flex flex-col items-center text-center mb-6">
        <div class="w-12 h-12 rounded-2xl bg-brand-gradient text-white flex items-center justify-center shadow-glow mb-4" aria-hidden="true">
          <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="4" y="10" width="16" height="10" rx="2" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
          </svg>
        </div>
        <span class="inline-flex items-center gap-2 text-xs font-semibold text-indigo-700 bg-white border border-indigo-100 shadow-sm px-3.5 py-1.5 rounded-full">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          Secure sign-in
        </span>
      </div>

      <div class="bg-white border border-slate-200 rounded-2xl p-8 shadow-card">
        <div class="mb-8 text-center">
          <h1 class="text-2xl font-extrabold text-slate-900 tracking-tight mb-1.5">Welcome back</h1>
          <p class="text-sm text-slate-500">
            {{ mfaChallengeId ? 'Enter the verification code to finish signing in.' : 'Sign in to your MediFlow account.' }}
          </p>
        </div>

        <form @submit.prevent="handleLogin" class="space-y-5">
          <template v-if="!mfaChallengeId">
            <div class="flex flex-col gap-2">
              <label class="text-sm font-semibold text-slate-900" for="email">Email</label>
              <input
                v-model="email"
                class="w-full px-4 py-3 border border-slate-200 bg-slate-50 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-600 focus:bg-white focus:ring-4 focus:ring-indigo-100 transition-all"
                type="email"
                id="email"
                autocomplete="email"
                placeholder="you@example.com"
                required
              >
            </div>

            <div class="flex flex-col gap-2">
              <div class="flex items-center justify-between">
                <label class="text-sm font-semibold text-slate-900" for="password">Password</label>
                <router-link to="/forget-password" class="text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:underline">
                  Forgot password?
                </router-link>
              </div>
              <input
                v-model="password"
                class="w-full px-4 py-3 border border-slate-200 bg-slate-50 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-600 focus:bg-white focus:ring-4 focus:ring-indigo-100 transition-all"
                type="password"
                id="password"
                autocomplete="current-password"
                placeholder="••••••••"
                required
              >
            </div>
          </template>

          <div v-else class="space-y-4">
            <div class="flex items-start gap-3 text-sm text-indigo-800 bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3" role="status" aria-live="polite">
              <span aria-hidden="true">📧</span>
              <span>We sent a 6-digit verification code to your email. It expires in 5 minutes.</span>
            </div>
            <div class="flex flex-col gap-2">
              <label class="text-sm font-semibold text-slate-900" for="otp">Verification code</label>
              <input
                v-model="otp"
                class="w-full px-4 py-3 border border-slate-200 bg-slate-50 rounded-xl text-center text-lg font-semibold tracking-[0.4em] text-slate-900 placeholder:tracking-normal placeholder:font-normal placeholder:text-slate-400 focus:outline-none focus:border-indigo-600 focus:bg-white focus:ring-4 focus:ring-indigo-100 transition-all"
                type="text"
                id="otp"
                inputmode="numeric"
                autocomplete="one-time-code"
                maxlength="6"
                placeholder="6-digit code"
                required
              >
            </div>
          </div>

          <TurnstileWidget v-if="!mfaChallengeId" v-model="turnstileToken" />

          <button type="submit" class="w-full bg-indigo-600 text-white font-semibold py-3.5 rounded-xl shadow-sm hover:bg-indigo-700 hover:shadow-md hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-200 transition-all">
            {{ mfaChallengeId ? 'Verify code' : 'Sign in' }}
          </button>
        </form>

        <div class="mt-6 text-center text-sm text-slate-600">
          Don't have an account?
          <router-link to="/register" class="font-semibold text-indigo-600 hover:text-indigo-700 hover:underline transition-all">
            Create one
          </router-link>
        </div>
      </div>

      <p class="mt-6 text-center text-xs text-slate-400 flex items-center justify-center gap-1.5">
        <span aria-hidden="true">🔒</span>
        Staff accounts are protected with multi-factor authentication.
      </p>
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
