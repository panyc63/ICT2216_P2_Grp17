<template>
  <div class="bg-white font-sans text-slate-800">
    <!-- Hero -->
    <section class="relative overflow-hidden bg-gradient-to-b from-indigo-50 via-indigo-50/40 to-white border-b border-slate-200">
      <div class="absolute inset-0 opacity-[0.06] bg-dot-grid [background-size:22px_22px]" aria-hidden="true"></div>
      <div class="relative max-w-3xl mx-auto text-center px-4 pt-16 pb-16 sm:pt-24 sm:pb-20 animate-fade-up">
        <span class="inline-flex items-center gap-2 text-xs font-semibold text-indigo-700 bg-white border border-indigo-100 shadow-sm px-3.5 py-1.5 rounded-full mb-6">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          About MediFlow
        </span>
        <h1 class="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight leading-[1.1] mb-5">
          Secure telehealth, from first symptom
          <span class="text-indigo-600">to treatment.</span>
        </h1>
        <p class="text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
          MediFlow is an online clinic that connects patients with doctors by secure video or chat — then
          handles the prescription, medical certificate and medication that follow, all in one place.
        </p>
      </div>
    </section>

    <!-- Why we built it -->
    <section class="max-w-3xl mx-auto px-6 py-16 sm:py-20 text-center">
      <h2 class="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mb-4">Why we built MediFlow</h2>
      <p class="text-slate-600 leading-relaxed">
        MediFlow was built for ICT2216 Secure Software Development as a working telehealth platform with
        security designed in from the start. The aim is simple: make a full course of care — consultation,
        prescription, certificate and medication — possible from your browser, without ever compromising the
        privacy of your medical information.
      </p>
    </section>

    <!-- Core commitments -->
    <section class="bg-slate-50 border-y border-slate-200">
      <div class="max-w-5xl mx-auto px-6 py-16 sm:py-20">
        <div class="text-center mb-12">
          <h2 class="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mb-3">What we stand for</h2>
          <p class="text-slate-500 max-w-xl mx-auto">The principles behind every part of the platform.</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div
            v-for="value in commitments"
            :key="value.title"
            class="bg-white border border-slate-200 rounded-2xl p-6 shadow-soft hover:shadow-card-hover hover:-translate-y-0.5 transition-all"
          >
            <div class="w-11 h-11 rounded-xl bg-indigo-50 flex items-center justify-center text-2xl mb-4" aria-hidden="true">{{ value.icon }}</div>
            <h3 class="font-bold text-slate-900 mb-1.5">{{ value.title }}</h3>
            <p class="text-sm text-slate-500 leading-relaxed">{{ value.body }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- How we protect your data -->
    <section class="max-w-5xl mx-auto px-6 py-16 sm:py-20">
      <div class="text-center mb-12">
        <h2 class="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mb-3">How we keep your data safe</h2>
        <p class="text-slate-500 max-w-xl mx-auto">Security isn't a feature bolted on afterwards — it runs through the whole system.</p>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
        <div
          v-for="item in safeguards"
          :key="item.title"
          class="bg-white border border-slate-200 rounded-2xl p-6 shadow-soft hover:shadow-card-hover hover:-translate-y-0.5 transition-all"
        >
          <div class="text-2xl mb-3" aria-hidden="true">{{ item.icon }}</div>
          <h3 class="font-bold text-slate-900 text-sm mb-1.5">{{ item.title }}</h3>
          <p class="text-xs text-slate-500 leading-relaxed">{{ item.body }}</p>
        </div>
      </div>
    </section>

    <!-- One platform, everyone involved -->
    <section class="bg-slate-50 border-y border-slate-200">
      <div class="max-w-5xl mx-auto px-6 py-16 sm:py-20">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-12 items-center">
          <div>
            <span class="text-xs font-bold uppercase tracking-widest text-indigo-600">One platform</span>
            <h2 class="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-2 mb-4">Everything in one workflow</h2>
            <p class="text-slate-600 leading-relaxed mb-4">
              Instead of stitching together separate tools, MediFlow runs the whole journey on a single
              platform: triage and booking, the consultation itself, prescribing against live pharmacy stock,
              issuing certificates, and getting medication to the patient.
            </p>
            <p class="text-slate-600 leading-relaxed">
              Patients, doctors, nurses, pharmacists and administrators each see only what their role needs —
              and every step is recorded.
            </p>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div
              v-for="who in audiences"
              :key="who.title"
              class="bg-white p-5 border border-slate-200 rounded-xl shadow-soft"
            >
              <h4 class="font-bold text-slate-900 text-sm mb-1">{{ who.title }}</h4>
              <p class="text-xs text-slate-500 leading-relaxed">{{ who.body }}</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- CTA -->
    <section class="max-w-5xl mx-auto px-6 py-16 sm:py-20 w-full">
      <div class="relative overflow-hidden bg-brand-gradient rounded-3xl px-8 py-10 sm:px-10 text-white text-center shadow-glow">
        <div class="absolute inset-0 opacity-10 bg-dot-grid [background-size:20px_20px]" aria-hidden="true"></div>
        <div class="relative max-w-xl mx-auto">
          <h2 class="text-2xl sm:text-3xl font-extrabold tracking-tight mb-3">See what MediFlow can do</h2>
          <p class="text-indigo-100 leading-relaxed mb-8">
            Explore the services on offer, or get in touch if you have a question about the platform.
          </p>
          <div class="flex flex-col sm:flex-row gap-3 justify-center items-center">
            <router-link to="/services" class="w-full sm:w-auto px-7 py-3.5 bg-white text-indigo-700 font-semibold rounded-xl shadow-sm hover:bg-indigo-50 hover:-translate-y-0.5 transition-all text-center">
              Browse our services
            </router-link>
            <router-link to="/contact" class="w-full sm:w-auto px-7 py-3.5 bg-indigo-500/30 border border-white/40 text-white font-semibold rounded-xl hover:bg-indigo-500/50 hover:-translate-y-0.5 transition-all text-center">
              Get in touch
            </router-link>
          </div>
        </div>
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

const commitments = [
  {
    icon: '❤️',
    title: 'Patient-centred care',
    body: 'Answer a few questions, speak to a doctor by chat or video, and get the prescription or certificate you need — no app to download and no queue at a counter.',
  },
  {
    icon: '🔒',
    title: 'Privacy by design',
    body: 'Personal and clinical details — your address, identity number, triage answers and diagnoses — are encrypted at rest, and staff reach only the records their role allows.',
  },
  {
    icon: '🩺',
    title: 'Accountable and verifiable',
    body: 'Medical certificates are digitally signed so anyone can confirm they are genuine, and every access to a record is written to a tamper-evident audit log.',
  },
]

const safeguards = [
  { icon: '🔐', title: 'Encrypted at rest', body: 'Sensitive fields are encrypted in the database rather than stored as plain text.' },
  { icon: '🪪', title: 'Multi-factor sign-in', body: 'Clinic staff confirm a one-time code, with authenticator-app protection on privileged accounts.' },
  { icon: '📄', title: 'Signed certificates', body: 'Each medical certificate carries an Ed25519 signature and a QR code that anyone can verify.' },
  { icon: '🧾', title: 'Full audit trail', body: 'Actions on a record are recorded in a hash-chained log that cannot be quietly edited.' },
]

const audiences = [
  { title: 'For patients', body: 'Book a consultation, meet your doctor online, and track medication to your door or the pharmacy counter.' },
  { title: 'For doctors', body: 'Pick up cases from a prioritised queue, consult by video or chat, and issue prescriptions and signed certificates.' },
  { title: 'For pharmacists', body: 'Dispense prescriptions against real inventory and manage collection or delivery.' },
  { title: 'For administrators', body: 'Manage staff accounts and roles, with access controlled and logged throughout.' },
]
</script>
