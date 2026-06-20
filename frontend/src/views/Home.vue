<template>
  <div class="min-h-screen bg-slate-50 flex flex-col font-sans">
    <!-- HERO SECTION -->
    <section class="py-20 text-center bg-gradient-to-b from-white to-slate-50 px-4">
      <div class="max-w-3xl mx-auto">
        <span class="inline-block bg-indigo-50 text-indigo-700 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider mb-6">
          Next Generation TeleHealth Provider
        </span>
        <h1 class="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-none mb-6">
          We bring secure, adaptive, and scalable <span class="text-indigo-600">health solutions</span> to your home.
        </h1>
        <p class="text-lg text-slate-500 max-w-xl mx-auto mb-10">
          Our modern digital clinic framework provides end-to-end automation, real-time doctor consultation queuing, and secure video feeds.
        </p>
        <div class="flex justify-center gap-4">
          <router-link v-if="isLoggedIn" :to="portalPath" class="bg-indigo-600 text-white px-8 py-3.5 rounded-lg font-semibold shadow-md hover:bg-indigo-700 hover:-translate-y-0.5 transition-all duration-200">
            Go to My Portal
          </router-link>
          <router-link v-else to="/login" class="bg-indigo-600 text-white px-8 py-3.5 rounded-lg font-semibold shadow-md hover:bg-indigo-700 hover:-translate-y-0.5 transition-all duration-200">
            Book Consultation
          </router-link>
        </div>
      </div>
    </section>

    <!-- SERVICES BENTO GRID -->
    <section class="py-16 max-w-5xl mx-auto px-6">
      <div class="text-center mb-12">
        <h2 class="text-3xl font-extrabold text-slate-900 tracking-tight">Our Platform Capabilities</h2>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <!-- Card 1 (Span 2 Columns) -->
        <div class="md:col-span-2 bg-white border border-slate-200 rounded-xl p-8 hover:-translate-y-1 hover:shadow-md transition-all duration-200">
          <div class="w-12 h-12 bg-indigo-50 text-indigo-600 text-xl font-bold flex items-center justify-center rounded-lg mb-6">⚡</div>
          <h3 class="text-xl font-bold text-slate-950 mb-3">Real-Time Triage Queue Management</h3>
          <p class="text-slate-500 text-sm">Automated patient intake processing paired with administrative overriding tools engineered for maximum emergency tracking capability.</p>
        </div>

        <!-- Card 2 -->
        <div class="bg-white border border-slate-200 rounded-xl p-8 hover:-translate-y-1 hover:shadow-md transition-all duration-200">
          <div class="w-12 h-12 bg-indigo-50 text-indigo-600 text-xl font-bold flex items-center justify-center rounded-lg mb-6">🔒</div>
          <h3 class="text-xl font-bold text-slate-950 mb-3">Secure Consultations</h3>
          <p class="text-slate-500 text-sm">End-to-end encrypted video channels featuring hardware sanity assessments before launching feeds.</p>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { useAuth } from '../composables/useAuth'

const { isLoggedIn, portalPath } = useAuth()
</script>