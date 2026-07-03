<template>
  <div class="min-h-screen bg-slate-50 font-sans selection:bg-indigo-500 selection:text-white">
    <!-- Corporate Hero Header Section -->
    <div class="relative bg-slate-900 py-24 px-4 sm:px-6 lg:px-8 text-center border-b border-slate-800">
      <div class="absolute inset-0 opacity-5 bg-[radial-gradient(#4f46e5_1px,transparent_1px)] [background-size:24px_24px]"></div>
      <div class="relative max-w-3xl mx-auto">
        <span class="text-xs font-bold uppercase tracking-widest text-indigo-400 bg-indigo-500/10 px-3 py-1.5 rounded-full border border-indigo-500/20">Our Mission</span>
        <h1 class="text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl mt-4 mb-6">
          Your Health, Digitally Connected
        </h1>
        <p class="text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
          MediFlow is a healthcare technology platform dedicated to bridging the gap between medical practitioners and patients through secure, instant, and reliable digital solutions.
        </p>
      </div>
    </div>

    <!-- Company Performance/Impact Stats -->
    <div class="max-w-5xl mx-auto px-4 -mt-10 relative z-10">
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div v-for="stat in companyStats" :key="stat.label" class="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm text-center">
          <p class="text-3xl font-black text-slate-950 tracking-tight mb-1">{{ stat.value }}</p>
          <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider">{{ stat.label }}</p>
        </div>
      </div>
    </div>

    <!-- Core Corporate Values -->
    <div class="max-w-5xl mx-auto px-4 py-20">
      <div class="text-center mb-16">
        <h2 class="text-2xl font-extrabold text-slate-950 tracking-tight sm:text-3xl mb-3">Our Core Commitments</h2>
        <p class="text-sm text-slate-500 max-w-md mx-auto">We build products with absolute care, ensuring our platform serves medical teams and patients safely every single day.</p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
        <!-- Value 1 -->
        <div class="bg-white border border-slate-200 p-8 rounded-2xl shadow-sm hover:border-indigo-500/30 transition-all duration-300 group">
          <div class="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl font-bold mb-6 group-hover:bg-indigo-600 group-hover:text-white transition-all">
            ❤️
          </div>
          <h3 class="text-lg font-bold text-slate-950 mb-2">Patient-Centric Care</h3>
          <p class="text-sm text-slate-600 leading-relaxed">
            Everything we build is created to make medical consultations comfortable, direct, and painless for patients looking for modern healthcare options.
          </p>
        </div>

        <!-- Value 2 -->
        <div class="bg-white border border-slate-200 p-8 rounded-2xl shadow-sm hover:border-indigo-500/30 transition-all duration-300 group">
          <div class="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl font-bold mb-6 group-hover:bg-indigo-600 group-hover:text-white transition-all">
            🔒
          </div>
          <h3 class="text-lg font-bold text-slate-950 mb-2">Absolute Confidentiality</h3>
          <p class="text-sm text-slate-600 leading-relaxed">
            Medical information requires medical-grade trust. Your private sessions, identity profiles, and documentation histories are securely encrypted.
          </p>
        </div>

        <!-- Value 3 -->
        <div class="bg-white border border-slate-200 p-8 rounded-2xl shadow-sm hover:border-indigo-500/30 transition-all duration-300 group">
          <div class="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl font-bold mb-6 group-hover:bg-indigo-600 group-hover:text-white transition-all">
            🏢
          </div>
          <h3 class="text-lg font-bold text-slate-950 mb-2">Clinical Efficiency</h3>
          <p class="text-sm text-slate-600 leading-relaxed">
            We empower doctors, nurses, and pharmacists by reducing manual administrative bottlenecks, letting them focus on what matters most: saving lives.
          </p>
        </div>
      </div>
    </div>

    <!-- Replacement Strategic Focus / Vision Grid -->
    <div class="bg-slate-100/60 border-t border-b border-slate-200/60 py-20 px-4">
      <div class="max-w-5xl mx-auto">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div>
            <span class="text-xs font-bold uppercase tracking-widest text-indigo-600">The Future of Care</span>
            <h2 class="text-3xl font-extrabold text-slate-950 tracking-tight mt-2 mb-4">Shaping Tomorrow's Medical Ecosystem</h2>
            <p class="text-sm text-slate-600 leading-relaxed mb-4">
              At MediFlow, we believe healthcare systems should expand effortlessly alongside the shifting demands of patients and modern medical teams. By integrating communication modules into clinical workspaces, we minimize fragmentation.
            </p>
            <p class="text-sm text-slate-600 leading-relaxed">
              Our ongoing objective centers on optimizing accessibility standards so that qualified care specialists remain immediately reachable wherever reliable network interfaces exist.
            </p>
          </div>
          
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="bg-white p-6 border border-slate-200 rounded-xl shadow-xs">
              <h4 class="font-bold text-slate-950 text-sm mb-1">Seamless Integrations</h4>
              <p class="text-xs text-slate-500 leading-relaxed">Unifying clinical operations under a centralized workspace.</p>
            </div>
            <div class="bg-white p-6 border border-slate-200 rounded-xl shadow-xs">
              <h4 class="font-bold text-slate-950 text-sm mb-1">Empowered Doctors</h4>
              <p class="text-xs text-slate-500 leading-relaxed">Reducing data overhead to clear paths for meaningful care.</p>
            </div>
            <div class="bg-white p-6 border border-slate-200 rounded-xl shadow-xs">
              <h4 class="font-bold text-slate-950 text-sm mb-1">Global Accessibility</h4>
              <p class="text-xs text-slate-500 leading-relaxed">Connecting patients with regional healthcare services smoothly.</p>
            </div>
            <div class="bg-white p-6 border border-slate-200 rounded-xl shadow-xs">
              <h4 class="font-bold text-slate-950 text-sm mb-1">Secure Architectures</h4>
              <p class="text-xs text-slate-500 leading-relaxed">Protecting historical clinical records through end-to-end parameters.</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Call To Action Footer Block -->
    <div class="max-w-4xl mx-auto px-4 py-20 text-center">
      <h3 class="text-2xl font-extrabold text-slate-950 tracking-tight mb-4">Want to learn more about our solutions?</h3>
      <p class="text-sm text-slate-500 max-w-md mx-auto mb-8">Whether you are an individual patient looking for clinical care or an enterprise provider looking to partner with us, we’re happy to talk.</p>
      <div class="flex flex-col sm:flex-row gap-3 justify-center items-center">
        <router-link to="/services" class="w-full sm:w-auto px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md text-sm transition-all text-center">
          Browse Our Services
        </router-link>
        <router-link to="/contact" class="w-full sm:w-auto px-6 py-3.5 bg-white border border-slate-300 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 text-sm transition-all text-center">
          Get in Touch with Us
        </router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const companyStats = ref([
  { value: '50k+', label: 'Successful Consultations' },
  { value: '99.9%', label: 'Platform Uptime Availability' },
  { value: '250+', label: 'Registered Medical Experts' }
])
</script>