<template>
  <div class="bg-white font-sans text-slate-800">
    <!-- Hero -->
    <section class="relative overflow-hidden bg-gradient-to-b from-indigo-50 via-indigo-50/40 to-white border-b border-slate-200">
      <div class="absolute inset-0 opacity-[0.06] bg-dot-grid [background-size:22px_22px]" aria-hidden="true"></div>
      <div class="relative max-w-3xl mx-auto text-center px-4 pt-16 pb-16 sm:pt-24 sm:pb-20 animate-fade-up">
        <span class="inline-flex items-center gap-2 text-xs font-semibold text-indigo-700 bg-white border border-indigo-100 shadow-sm px-3.5 py-1.5 rounded-full mb-6">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          Our services
        </span>
        <h1 class="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight leading-[1.1] mb-5">
          Everything you need for
          <span class="text-indigo-600">everyday care.</span>
        </h1>
        <p class="text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
          From the first symptom to the medicine in your hand, MediFlow covers the whole journey — securely,
          and without leaving your browser.
        </p>
      </div>
    </section>

    <!-- Services grid -->
    <section class="max-w-5xl mx-auto px-6 py-16 sm:py-20 w-full">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <div
          v-for="service in services"
          :key="service.title"
          class="bg-white border border-slate-200 rounded-2xl p-6 shadow-soft hover:shadow-card-hover hover:-translate-y-0.5 transition-all"
        >
          <div class="w-11 h-11 rounded-xl bg-indigo-50 flex items-center justify-center text-2xl mb-4" aria-hidden="true">{{ service.icon }}</div>
          <h3 class="font-bold text-slate-900 mb-1.5">{{ service.title }}</h3>
          <p class="text-sm text-slate-500 leading-relaxed">{{ service.body }}</p>
        </div>
      </div>
    </section>

    <!-- Verify certificate callout -->
    <section class="bg-slate-50 border-y border-slate-200">
      <div class="max-w-5xl mx-auto px-6 py-16 sm:py-20">
        <div class="bg-white border border-slate-200 rounded-2xl p-8 sm:p-10 shadow-soft flex flex-col md:flex-row items-start md:items-center gap-6">
          <div class="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center text-3xl shrink-0" aria-hidden="true">✅</div>
          <div>
            <h2 class="text-xl font-extrabold text-slate-900 tracking-tight mb-2">Every certificate is verifiable</h2>
            <p class="text-sm text-slate-600 leading-relaxed">
              MediFlow medical certificates are signed with the issuing doctor's Ed25519 key and carry a QR
              code. Scanning it checks the signature against the doctor's public key and confirms whether the
              certificate is still valid or has been revoked — so an employer, school or anyone else can trust
              it is genuine.
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- CTA -->
    <section class="max-w-5xl mx-auto px-6 py-16 sm:py-20 w-full text-center">
      <h2 class="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mb-3">Ready to see a doctor?</h2>
      <p class="text-slate-500 max-w-xl mx-auto mb-8">Create an account and start a consultation, or sign in if you already have one.</p>
      <div class="flex flex-col sm:flex-row gap-3 justify-center items-center">
        <router-link to="/register" class="w-full sm:w-auto bg-indigo-600 text-white px-7 py-3.5 rounded-xl font-semibold shadow-sm hover:bg-indigo-700 hover:shadow-md hover:-translate-y-0.5 transition-all">
          Create an account
        </router-link>
        <router-link to="/login" class="w-full sm:w-auto bg-white border border-slate-300 text-slate-800 px-7 py-3.5 rounded-xl font-semibold hover:bg-slate-50 hover:-translate-y-0.5 transition-all">
          Sign in
        </router-link>
      </div>
    </section>

    <!-- Safety / disclaimer -->
    <footer class="border-t border-slate-200 bg-white">
      <div class="max-w-5xl mx-auto py-8 px-6 text-center text-xs text-slate-400 space-y-1">
        <p>© {{ year }} MediFlow. For non-emergencies only — in an emergency, call 995.</p>
        <p>A student project built for ICT2216 Secure Software Development. Not a real clinical service.</p>
      </div>
    </footer>
  </div>
</template>

<script setup>
const year = new Date().getFullYear()

const services = [
  {
    icon: '🎥',
    title: 'Video and chat consultations',
    body: 'Meet a doctor by encrypted, one-to-one video or chat, straight from your browser — nothing to download.',
  },
  {
    icon: '⏱️',
    title: 'Triage and booking',
    body: 'A short questionnaire sets your priority automatically, so the most urgent cases are seen first, then places you in the queue.',
  },
  {
    icon: '💊',
    title: 'Digital prescriptions',
    body: 'Prescriptions are routed straight to the pharmacy and dispensed against live medication stock.',
  },
  {
    icon: '📄',
    title: 'Signed medical certificates',
    body: "Certificates are signed with the doctor's Ed25519 key and carry a QR code, so anyone can confirm they are genuine — and revoked ones are flagged.",
  },
  {
    icon: '🚚',
    title: 'Delivery or self-collect',
    body: 'Choose home delivery to your saved address or collect at the pharmacy counter, and follow the status through to receipt.',
  },
  {
    icon: '🔐',
    title: 'Secure staff portal',
    body: 'Doctors, nurses, pharmacists and administrators share one role-based portal, protected by multi-factor sign-in and a full audit trail.',
  },
]
</script>
