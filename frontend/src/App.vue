<template>
  <div id="app-layout">
    <header class="main-header" v-if="showNavbar">
      <div class="container-fluid navbar">
        <div class="logo">
          <router-link to="/" class="logo_a"> MediFlow </router-link>
        </div>
        <ul class="nav-links">
          <li><router-link to="/">Home</router-link></li>
          <li><a href="#">About Us</a></li>
          <li><a href="#">Services</a></li>
          <li><a href="#">Contact Us</a></li>
        </ul>
        <router-link v-if="isLoggedIn" :to="portalPath" class="nav-cta">Portal</router-link>
        <router-link v-else to="/login" class="nav-cta">Get Started</router-link>
      </div>
    </header>

    <main :class="{ 'has-navbar': showNavbar }">
      <router-view></router-view>
    </main>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAuth } from './composables/useAuth'
import { useIdleTimeout } from './composables/useIdleTimeout'

const route = useRoute()
const { isLoggedIn, portalPath } = useAuth()

// App-wide 15-minute idle auto-logout (SNFR3).
const idle = useIdleTimeout()
onMounted(idle.start)
onUnmounted(idle.stop)

// Computed conditional flag: Hides the main navigation layout on full-screen
// console frames that carry their own navigation (Admin Dashboard, Patient Portal).
const showNavbar = computed(() => {
  return route.path !== '/admin-dashboard' && !route.path.startsWith('/patient')
})
</script>

<style>
/* Adds layout spacing to push down content so it doesn't hide behind fixed headers */
.has-navbar {
  padding-top: 80px; 
}
</style>