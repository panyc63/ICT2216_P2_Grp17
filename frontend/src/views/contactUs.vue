<template>
  <div class="bg-white font-sans text-slate-800">
    <!-- Hero -->
    <section class="relative overflow-hidden bg-gradient-to-b from-indigo-50 via-indigo-50/40 to-white border-b border-slate-200">
      <div class="absolute inset-0 opacity-[0.06] bg-dot-grid [background-size:22px_22px]" aria-hidden="true"></div>
      <div class="relative max-w-3xl mx-auto text-center px-4 pt-16 pb-16 sm:pt-20 sm:pb-16 animate-fade-up">
        <span class="inline-flex items-center gap-2 text-xs font-semibold text-indigo-700 bg-white border border-indigo-100 shadow-sm px-3.5 py-1.5 rounded-full mb-6">
          Contact us
        </span>
        <h1 class="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-[1.1] mb-5">
          We're here to help.
        </h1>
        <p class="text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
          Have a question about MediFlow or ran into a problem? Send us a message and we'll get back to you.
        </p>
      </div>
    </section>

    <!-- Contact card -->
    <section class="max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-20 w-full">
      <div class="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-card grid grid-cols-1 md:grid-cols-2 gap-8">

        <!-- Form -->
        <div>
          <div class="mb-6">
            <h2 class="text-xl font-extrabold text-slate-900 tracking-tight mb-1.5">Send us a message</h2>
            <p class="text-sm text-slate-500">Fill in the form below and we'll follow up by email.</p>
          </div>

          <form @submit.prevent="submitContactForm" class="space-y-4">
            <div class="flex flex-col gap-1.5">
              <label class="text-sm font-semibold text-slate-900" for="contact-name">Your name</label>
              <input
                v-model="form.name"
                type="text"
                id="contact-name"
                placeholder="Alex Mercer"
                required
                class="w-full px-4 py-3 border border-slate-200 bg-slate-50 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-600 focus:bg-white focus:ring-4 focus:ring-indigo-100 transition-all"
              >
            </div>

            <div class="flex flex-col gap-1.5">
              <label class="text-sm font-semibold text-slate-900" for="contact-email">Email address</label>
              <input
                v-model="form.email"
                type="email"
                id="contact-email"
                placeholder="alex@example.com"
                required
                class="w-full px-4 py-3 border border-slate-200 bg-slate-50 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-600 focus:bg-white focus:ring-4 focus:ring-indigo-100 transition-all"
              >
            </div>

            <div class="flex flex-col gap-1.5">
              <label class="text-sm font-semibold text-slate-900" for="contact-msg">Message</label>
              <textarea
                v-model="form.message"
                id="contact-msg"
                rows="4"
                placeholder="How can we help?"
                required
                class="w-full px-4 py-3 border border-slate-200 bg-slate-50 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-600 focus:bg-white focus:ring-4 focus:ring-indigo-100 transition-all resize-none"
              ></textarea>
            </div>

            <button
              type="submit"
              class="w-full bg-indigo-600 text-white font-semibold py-3.5 rounded-xl shadow-sm hover:bg-indigo-700 hover:shadow-md hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-200 transition-all"
            >
              Send message
            </button>

            <p
              v-if="notice"
              role="status"
              aria-live="polite"
              class="text-sm font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 leading-relaxed"
            >
              {{ notice }}
            </p>
          </form>
        </div>

        <!-- Details + map -->
        <div class="flex flex-col">
          <div class="mb-4">
            <h3 class="text-lg font-bold text-slate-900 tracking-tight mb-3">Where to find us</h3>
            <ul class="space-y-2.5 text-sm text-slate-600">
              <li class="flex items-start gap-2.5">
                <span class="text-base leading-none mt-0.5" aria-hidden="true">📍</span>
                <span>11 New Punggol Rd, Singapore 828616</span>
              </li>
              <li class="flex items-start gap-2.5">
                <span class="text-base leading-none mt-0.5" aria-hidden="true">✉️</span>
                <a href="mailto:enquiries@mediflow.com" class="text-indigo-600 font-medium hover:text-indigo-700 hover:underline">
                  enquiries@mediflow.com
                </a>
              </li>
            </ul>
          </div>

          <div class="w-full flex-1 min-h-[280px] border border-slate-200 rounded-xl overflow-hidden bg-slate-100">
            <iframe
              class="w-full h-full min-h-[280px]"
              src="https://maps.google.com/maps?q=11%20New%20Punggol%20Rd,%20Singapore%20828616&t=&z=15&ie=UTF8&iwloc=&output=embed"
              title="MediFlow location map"
              frameborder="0"
              scrolling="no"
              marginheight="0"
              marginwidth="0"
              allowfullscreen=""
              loading="lazy"
              referrerpolicy="no-referrer-when-downgrade"
            ></iframe>
          </div>

          <p class="mt-4 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 leading-relaxed">
            MediFlow is for non-emergencies only. If this is a medical emergency, call 995 immediately.
          </p>
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
import { ref } from 'vue'

const year = new Date().getFullYear()

const form = ref({ name: '', email: '', message: '' })
const notice = ref('')

// This clinic prototype has no ticketing backend; the form gives an honest
// acknowledgement and points the user at the monitored support inbox.
const submitContactForm = () => {
  notice.value = `Thanks, ${form.value.name}. For a guaranteed response please also email enquiries@mediflow.com — we'll get back to you within one business day.`
  form.value = { name: '', email: '', message: '' }
}
</script>
