<template>
  <div class="min-h-screen bg-slate-50 flex items-start justify-center px-4 py-16 font-sans">
    <div class="bg-white border border-slate-200 w-full max-w-5xl rounded-2xl p-8 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-8">
      
      <div>
        <div class="mb-6">
          <h2 class="text-2xl font-extrabold text-slate-950 tracking-tight mb-2">Get in touch</h2>
          <p class="text-sm text-slate-500">Facing any problems? Submit a support message below.</p>
        </div>

        <form @submit.prevent="submitContactForm" class="space-y-4">
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-bold uppercase text-slate-700" for="contact-name">Your Name</label>
            <input v-model="form.name" type="text" id="contact-name" placeholder="Alex Mercer" required class="w-full px-4 py-2.5 border border-slate-200 bg-slate-50 rounded-xl text-sm focus:outline-none focus:border-indigo-600 focus:bg-white transition-all">
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-bold uppercase text-slate-700" for="contact-email">Email Address</label>
            <input v-model="form.email" type="email" id="contact-email" placeholder="alex@example.com" required class="w-full px-4 py-2.5 border border-slate-200 bg-slate-50 rounded-xl text-sm focus:outline-none focus:border-indigo-600 focus:bg-white transition-all">
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-bold uppercase text-slate-700" for="contact-msg">Message Body</label>
            <textarea v-model="form.message" id="contact-msg" rows="4" placeholder="Describe your request..." required class="w-full px-4 py-2.5 border border-slate-200 bg-slate-50 rounded-xl text-sm focus:outline-none focus:border-indigo-600 focus:bg-white transition-all resize-none"></textarea>
          </div>

          <button type="submit" class="w-full bg-slate-950 text-white font-bold py-3 rounded-xl hover:bg-slate-800 transition-all shadow-sm">
            Contact Us!
          </button>
        </form>
      </div>

      <div class="flex flex-col h-full min-h-[350px]">
        <div class="mb-4 space-y-1">
          <h3 class="text-lg font-bold text-slate-950 tracking-tight">Our Headquarters</h3>
          <p class="text-sm text-slate-600 font-medium"><b>Address:</b> 11 New Punggol Rd, Singapore 828616</p>
          <p class="text-sm text-slate-600 font-medium"><b>General Inquiries:</b> 
            <a href="mailto:enquiries@MediFlow.com" class="text-indigo-600 hover:underline"> enquiries@MediFlow.com</a>
          </p>
        </div>
        
        <div class="w-full flex-1 border border-slate-200 rounded-xl overflow-hidden shadow-inner bg-slate-100">
          <iframe 
            class="w-full h-full min-h-[300px]"
            src="https://maps.google.com/maps?q=11%20New%20Punggol%20Rd,%20Singapore%20828616&t=&z=15&ie=UTF8&iwloc=&output=embed" 
            frameborder="0" 
            scrolling="no" 
            marginheight="0" 
            marginwidth="0"
            allowfullscreen="" 
            loading="lazy"
            referrerpolicy="no-referrer-when-downgrade"
          ></iframe>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const form = ref({ name: '', email: '', message: '' })

const submitContactForm = () => {
  alert(`Thank you, ${form.value.name}! Your informational request has been processed locally.`)
  form.value = { name: '', email: '', message: '' }
}
</script>