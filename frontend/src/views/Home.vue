<template>
  <div class="flex-1 flex flex-col bg-white font-sans text-slate-800">
    <!-- Hero -->
    <section class="relative overflow-hidden bg-gradient-to-b from-indigo-50 via-indigo-50/40 to-white">
      <div class="absolute inset-0 opacity-[0.06] bg-dot-grid [background-size:22px_22px]" aria-hidden="true"></div>
      <div class="relative max-w-3xl mx-auto text-center px-4 pt-16 pb-16 sm:pt-24 sm:pb-20 animate-fade-up">
        <span class="inline-flex items-center gap-2 text-xs font-semibold text-indigo-700 bg-white border border-indigo-100 shadow-sm px-3.5 py-1.5 rounded-full mb-6">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          Secure online clinic
        </span>
        <h1 class="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight leading-[1.1] mb-5">
          See a doctor by secure video —
          <span class="text-indigo-600">without leaving home.</span>
        </h1>
        <p class="text-lg text-slate-600 max-w-2xl mx-auto mb-8 leading-relaxed">
          MediFlow is an online clinic. Answer a few questions about your symptoms, talk to a doctor by
          chat or video, and receive your prescription or medical certificate — with medication delivered
          to your door or ready to collect.
        </p>
        <div class="flex flex-col sm:flex-row justify-center items-center gap-3">
          <router-link
            to="/register"
            class="w-full sm:w-auto bg-indigo-600 text-white px-7 py-3.5 rounded-xl font-semibold shadow-sm hover:bg-indigo-700 hover:shadow-md hover:-translate-y-0.5 transition-all"
          >
            Create an account
          </router-link>
          <router-link
            to="/login"
            class="w-full sm:w-auto bg-white border border-slate-300 text-slate-800 px-7 py-3.5 rounded-xl font-semibold hover:bg-slate-50 hover:-translate-y-0.5 transition-all"
          >
            Sign in
          </router-link>
        </div>
        <a href="#how-it-works" class="inline-block text-indigo-700 mt-6 text-sm font-semibold hover:underline">
          See how it works ↓
        </a>
        <p class="text-xs text-slate-500 mt-6">
          Chat or video from your browser · No app download needed
        </p>
      </div>
    </section>

    <!-- Trust strip -->
    <section aria-label="What makes MediFlow safe" class="border-y border-slate-200 bg-slate-50">
      <div class="max-w-5xl mx-auto px-6 py-8 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
        <div v-for="item in trust" :key="item.title">
          <p class="text-sm font-bold text-slate-900">{{ item.icon }} {{ item.title }}</p>
          <p class="text-xs text-slate-500 mt-1">{{ item.body }}</p>
        </div>
      </div>
    </section>

    <!-- How it works -->
    <section id="how-it-works" class="max-w-5xl mx-auto px-6 py-16 sm:py-20 scroll-mt-24 w-full">
      <div class="text-center mb-12">
        <h2 class="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">How it works</h2>
        <p class="text-slate-500 mt-3">Four steps from symptom to treatment.</p>
      </div>
      <ol class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
        <li
          v-for="step in steps"
          :key="step.n"
          class="relative bg-white border border-slate-200 rounded-2xl p-6 shadow-soft hover:shadow-card-hover hover:-translate-y-0.5 transition-all"
        >
          <div class="w-10 h-10 rounded-xl bg-indigo-600 text-white font-bold flex items-center justify-center mb-4">{{ step.n }}</div>
          <h3 class="font-bold text-slate-900 mb-1.5">{{ step.title }}</h3>
          <p class="text-sm text-slate-500 leading-relaxed">{{ step.body }}</p>
        </li>
      </ol>
      <div class="text-center mt-12">
        <router-link
          to="/register"
          class="inline-block bg-indigo-600 text-white px-7 py-3.5 rounded-xl font-semibold shadow-sm hover:bg-indigo-700 hover:shadow-md hover:-translate-y-0.5 transition-all"
        >
          Start a consultation
        </router-link>
      </div>
    </section>

    <!-- What you can do -->
    <section class="bg-slate-50 border-t border-slate-200">
      <div class="max-w-5xl mx-auto px-6 py-16 sm:py-20">
        <div class="text-center mb-12">
          <h2 class="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">Everything in one place</h2>
          <p class="text-slate-500 mt-3">From first symptom to the medicine in your hand.</p>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          <div
            v-for="f in features"
            :key="f.title"
            class="bg-white border border-slate-200 rounded-2xl p-6 shadow-soft hover:shadow-card-hover hover:-translate-y-0.5 transition-all"
          >
            <div class="w-11 h-11 rounded-xl bg-indigo-50 flex items-center justify-center text-2xl mb-4" aria-hidden="true">{{ f.icon }}</div>
            <h3 class="font-bold text-slate-900 mb-1.5">{{ f.title }}</h3>
            <p class="text-sm text-slate-500 leading-relaxed">{{ f.body }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Staff -->
    <section class="max-w-5xl mx-auto px-6 py-16 w-full">
      <div class="relative overflow-hidden bg-brand-gradient rounded-3xl px-8 py-10 sm:px-10 text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-glow">
        <div class="absolute inset-0 opacity-10 bg-dot-grid [background-size:20px_20px]" aria-hidden="true"></div>
        <div class="relative">
          <h2 class="text-2xl font-bold mb-2">Clinic staff?</h2>
          <p class="text-indigo-100 text-sm max-w-xl leading-relaxed">
            Doctors, nurses, pharmacists and administrators sign in to the same portal to manage the triage
            queue, run consultations, issue prescriptions and certificates, and dispense medication.
          </p>
        </div>
        <router-link
          to="/login"
          class="relative bg-white text-indigo-700 px-6 py-3 rounded-xl font-semibold hover:bg-indigo-50 transition-colors whitespace-nowrap shadow-sm"
        >
          Staff sign in
        </router-link>
      </div>
    </section>

    <!-- Footer -->
    <footer class="mt-auto border-t border-slate-200 bg-white">
      <div class="max-w-5xl mx-auto px-6 py-12 grid grid-cols-1 sm:grid-cols-3 gap-8 text-sm">
        <div>
          <p class="text-lg font-extrabold text-indigo-600 mb-2">MediFlow</p>
          <p class="text-slate-500 leading-relaxed">
            Secure telehealth for everyday care — consultations, prescriptions, medical certificates and
            medication delivery.
          </p>
        </div>
        <div>
          <p class="font-semibold text-slate-900 mb-3">Explore</p>
          <ul class="space-y-2 text-slate-500">
            <li><router-link to="/about" class="hover:text-indigo-600 transition-colors">About us</router-link></li>
            <li><router-link to="/services" class="hover:text-indigo-600 transition-colors">Services</router-link></li>
            <li><router-link to="/contact" class="hover:text-indigo-600 transition-colors">Contact us</router-link></li>
          </ul>
        </div>
        <div>
          <p class="font-semibold text-slate-900 mb-3">Get in touch</p>
          <ul class="space-y-2 text-slate-500">
            <li>11 New Punggol Rd, Singapore 828616</li>
            <li><a href="mailto:enquiries@mediflow.com" class="hover:text-indigo-600 transition-colors">enquiries@mediflow.com</a></li>
          </ul>
        </div>
      </div>
      <div class="border-t border-slate-100 py-5 px-6 text-center text-xs text-slate-400 space-y-1">
        <p>© {{ year }} MediFlow. For non-emergencies only — in an emergency, call 995.</p>
        <p>A student project built for ICT2216 Secure Software Development. Not a real clinical service.</p>
      </div>
    </footer>
  </div>
</template>

<script setup>
const year = new Date().getFullYear()

const trust = [
  { icon: '🔒', title: 'Encrypted video', body: 'Browser-to-browser calls, encrypted in transit' },
  { icon: '🩺', title: 'Talk to a doctor', body: 'Consult by secure chat or video' },
  { icon: '📄', title: 'Verifiable MCs', body: 'Digitally signed, QR-checkable' },
  { icon: '🛡️', title: 'Data protected', body: 'Clinical records encrypted at rest' },
]

const steps = [
  { n: 1, title: 'Register & describe symptoms', body: 'Create an account and complete a short pre-consultation questionnaire. It sets your priority automatically.' },
  { n: 2, title: 'Consult a doctor', body: 'A doctor picks up your case from the queue. Talk it through by secure chat or video call.' },
  { n: 3, title: 'Get your paperwork', body: 'Receive a prescription and, if needed, a digitally signed medical certificate you can verify by QR.' },
  { n: 4, title: 'Get your medication', body: 'Collect at the pharmacy counter or have it delivered to your registered address — track it either way.' },
]

const features = [
  { icon: '🎥', title: 'Video & chat consultations', body: 'Encrypted, one-to-one calls with your doctor — no downloads, straight from your browser.' },
  { icon: '💊', title: 'Digital prescriptions', body: 'Prescriptions are routed straight to the pharmacy and dispensed against live stock.' },
  { icon: '📄', title: 'Medical certificates', body: 'Signed with the doctor’s key so anyone (e.g. your employer) can verify it is genuine.' },
  { icon: '🚚', title: 'Delivery or self-collect', body: 'Choose home delivery to your saved address or pick up in person, and track the status.' },
  { icon: '⏱️', title: 'Smart triage', body: 'Your answers flag urgent cases so the most serious patients are seen first.' },
  { icon: '🔐', title: 'Privacy by design', body: 'Personal and clinical data are encrypted, with strict role-based access for staff.' },
]
</script>
