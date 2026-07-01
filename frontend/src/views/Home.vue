<template>
  <div class="min-h-screen bg-white flex flex-col font-sans text-slate-800">
    <!-- Hero -->
    <section class="px-4 pt-16 pb-14 sm:pt-20 sm:pb-16 bg-gradient-to-b from-indigo-50/60 to-white">
      <div class="max-w-3xl mx-auto text-center">
        <h1 class="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight mb-5">
          See a doctor by secure video — <span class="text-indigo-600">without leaving home.</span>
        </h1>
        <p class="text-lg text-slate-600 max-w-2xl mx-auto mb-8">
          MediFlow is an online clinic. Answer a few questions about your symptoms, talk to a doctor by
          chat or video, and get your prescription or medical certificate the same day — with medication
          delivered to your door or ready to collect.
        </p>
        <div class="flex flex-col sm:flex-row justify-center gap-3">
          <router-link to="/register" class="bg-indigo-600 text-white px-7 py-3 rounded-lg font-semibold shadow-sm hover:bg-indigo-700 transition-colors">
            Create an account
          </router-link>
          <router-link to="/login" class="bg-white border border-slate-300 text-slate-800 px-7 py-3 rounded-lg font-semibold hover:bg-slate-50 transition-colors">
            Sign in
          </router-link>
          <a href="#how-it-works" class="text-indigo-700 px-4 py-3 rounded-lg font-semibold hover:underline self-center">
            How it works ↓
          </a>
        </div>
        <p class="text-xs text-slate-500 mt-6">
          Typical wait under 15 minutes · Open every day · No app download needed
        </p>
      </div>
    </section>

    <!-- Trust strip -->
    <section aria-label="What makes MediFlow safe" class="border-y border-slate-100 bg-slate-50">
      <div class="max-w-5xl mx-auto px-6 py-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
        <div><p class="text-sm font-bold text-slate-900">🔒 Encrypted video</p><p class="text-xs text-slate-500 mt-1">Calls are peer-to-peer &amp; encrypted</p></div>
        <div><p class="text-sm font-bold text-slate-900">🩺 Real doctors</p><p class="text-xs text-slate-500 mt-1">Consult a licensed practitioner</p></div>
        <div><p class="text-sm font-bold text-slate-900">📄 Verifiable MCs</p><p class="text-xs text-slate-500 mt-1">Digitally signed, QR-checkable</p></div>
        <div><p class="text-sm font-bold text-slate-900">🛡️ Your data, protected</p><p class="text-xs text-slate-500 mt-1">Records encrypted at rest</p></div>
      </div>
    </section>

    <!-- How it works -->
    <section id="how-it-works" class="max-w-5xl mx-auto px-6 py-16 scroll-mt-24">
      <div class="text-center mb-10">
        <h2 class="text-3xl font-extrabold text-slate-900 tracking-tight">How it works</h2>
        <p class="text-slate-500 mt-2">Four steps from symptom to treatment.</p>
      </div>
      <ol class="grid grid-cols-1 md:grid-cols-4 gap-6">
        <li v-for="step in steps" :key="step.n" class="bg-white border border-slate-200 rounded-xl p-6">
          <div class="w-9 h-9 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center mb-4">{{ step.n }}</div>
          <h3 class="font-bold text-slate-900 mb-1">{{ step.title }}</h3>
          <p class="text-sm text-slate-500">{{ step.body }}</p>
        </li>
      </ol>
      <div class="text-center mt-10">
        <router-link to="/register" class="inline-block bg-indigo-600 text-white px-7 py-3 rounded-lg font-semibold shadow-sm hover:bg-indigo-700 transition-colors">
          Start a consultation
        </router-link>
      </div>
    </section>

    <!-- What you can do -->
    <section class="bg-slate-50 border-t border-slate-100">
      <div class="max-w-5xl mx-auto px-6 py-16">
        <h2 class="text-3xl font-extrabold text-slate-900 tracking-tight text-center mb-10">Everything in one place</h2>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div v-for="f in features" :key="f.title" class="bg-white border border-slate-200 rounded-xl p-6">
            <div class="text-2xl mb-3" aria-hidden="true">{{ f.icon }}</div>
            <h3 class="font-bold text-slate-900 mb-1.5">{{ f.title }}</h3>
            <p class="text-sm text-slate-500">{{ f.body }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Staff -->
    <section class="max-w-5xl mx-auto px-6 py-14">
      <div class="bg-indigo-600 rounded-2xl px-8 py-10 text-white flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <h2 class="text-2xl font-bold mb-1">Clinic staff?</h2>
          <p class="text-indigo-100 text-sm max-w-xl">Doctors, nurses, pharmacists and administrators sign in to the same portal to manage the triage queue, run consultations, issue prescriptions and certificates, and dispense medication.</p>
        </div>
        <router-link to="/login" class="bg-white text-indigo-700 px-6 py-3 rounded-lg font-semibold hover:bg-indigo-50 transition-colors whitespace-nowrap">
          Staff sign in
        </router-link>
      </div>
    </section>

    <!-- Footer -->
    <footer class="mt-auto border-t border-slate-200 bg-white">
      <div class="max-w-5xl mx-auto px-6 py-10 grid grid-cols-1 sm:grid-cols-3 gap-8 text-sm">
        <div>
          <p class="text-lg font-extrabold text-indigo-600 mb-2">MediFlow</p>
          <p class="text-slate-500">Secure telehealth for everyday care — consultations, prescriptions, medical certificates and medication delivery.</p>
        </div>
        <div>
          <p class="font-semibold text-slate-900 mb-3">Explore</p>
          <ul class="space-y-2 text-slate-500">
            <li><router-link to="/about" class="hover:text-indigo-600">About us</router-link></li>
            <li><router-link to="/services" class="hover:text-indigo-600">Services</router-link></li>
            <li><router-link to="/contact" class="hover:text-indigo-600">Contact us</router-link></li>
          </ul>
        </div>
        <div>
          <p class="font-semibold text-slate-900 mb-3">Get in touch</p>
          <ul class="space-y-2 text-slate-500">
            <li>11 New Punggol Rd, Singapore 828616</li>
            <li><a href="mailto:enquiries@mediflow.com" class="hover:text-indigo-600">enquiries@mediflow.com</a></li>
          </ul>
        </div>
      </div>
      <div class="border-t border-slate-100 py-4 text-center text-xs text-slate-400">
        © {{ year }} MediFlow. For non-emergencies only — in an emergency, call 995.
      </div>
    </footer>
  </div>
</template>

<script setup>
const year = new Date().getFullYear()

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
