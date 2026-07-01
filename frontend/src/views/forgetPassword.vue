<template>
  <div class="min-h-screen bg-slate-50 flex flex-col font-sans">
    <header class="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div class="max-w-7xl mx-auto px-6 h-20 flex justify-between items-center">
        <div class="text-2xl font-extrabold text-indigo-600 tracking-tight">
          <router-link to="/">MediFlow</router-link>
        </div>
        <ul class="hidden md:flex gap-8 list-none font-medium text-sm text-slate-600">
          <li><router-link to="/" class="hover:text-indigo-600 transition-colors">Home</router-link></li>
          <li><router-link to="/about" class="hover:text-indigo-600 transition-colors">About Us</router-link></li>
          <li><router-link to="/services" class="hover:text-indigo-600 transition-colors">Services</router-link></li>
          <li><router-link to="/contact" class="hover:text-indigo-600 transition-colors">Contact Us</router-link></li>
        </ul>
        <router-link to="/login" class="bg-slate-900 text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-indigo-600 transition-all shadow-sm">
          Get Started
        </router-link>
      </div>
    </header>

    <div class="flex-1 flex items-center justify-center px-4 py-12">
      <div class="bg-white border border-slate-200 w-full max-w-md rounded-2xl p-8 shadow-sm">
        <div class="mb-8">
          <h2 class="text-2xl font-extrabold text-slate-950 tracking-tight mb-2">Reset password</h2>
          <p class="text-sm text-slate-500">
            Enter your email address and we'll send you a link to reset your password.
          </p>
        </div>

        <form @submit.prevent="handleReset" class="space-y-6">
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

          <button type="submit" :disabled="submitting" class="w-full bg-indigo-600 text-white font-bold py-3.5 rounded-xl hover:bg-indigo-700 shadow-md hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-60">
            {{ submitting ? 'Sending…' : 'Send Reset Link' }}
          </button>

          <p v-if="notice" role="status" aria-live="polite" class="text-sm font-medium text-emerald-600 text-center">{{ notice }}</p>

          <div class="text-center pt-2">
            <router-link to="/login" class="text-sm text-indigo-600 font-bold hover:underline transition-all">
              ← Back to sign in
            </router-link>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { apiFetch } from '../services/api'

const email = ref('')
const submitting = ref(false)
const notice = ref('')

const handleReset = async () => {
  submitting.value = true
  notice.value = ''
  try {
    const res = await apiFetch('/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: email.value }),
    })
    // Backend returns a neutral message (no account enumeration).
    notice.value = res.message || 'If an account exists for that email, a reset link has been sent.'
    email.value = ''
  } catch (err) {
    notice.value = err.message || 'Something went wrong. Please try again.'
  } finally {
    submitting.value = false
  }
}
</script>