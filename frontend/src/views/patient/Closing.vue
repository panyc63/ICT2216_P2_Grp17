<template>
  <div>
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-slate-900 tracking-tight">All Done</h1>
      <p class="text-sm text-slate-500">Your consultation is complete.</p>
    </div>

    <div class="bg-white border border-slate-200 rounded-2xl shadow-sm p-8 max-w-2xl text-center">
      <div class="text-4xl mb-3">✅</div>
      <h2 class="text-lg font-semibold text-slate-900">Thank you for using MediFlow</h2>
      <p class="mt-3 text-sm text-slate-600 leading-relaxed">
        Your consultation is complete. Your doctor will finalize your visit when ready.
        Check <span class="font-semibold text-slate-900">Profile → My Consultations</span>
        for updates on your Medical Certificate, prescription, and any payment needed.
      </p>

      <div class="mt-8 flex justify-center gap-3">
        <router-link
          to="/patient/profile"
          class="px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg shadow-sm hover:bg-indigo-700"
        >
          Go to Profile
        </router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
// The active journey ends here once the call is over. The closing message is
// universal — everything downstream (finalization, prescription, payment,
// delivery) is on-demand via Profile → My Consultations, on the patient's
// schedule, not forced from here.
</script>
