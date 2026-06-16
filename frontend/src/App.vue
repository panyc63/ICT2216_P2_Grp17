<template>
  <div id="app-layout">
    <header class="main-header" v-if="showNavbar">
      <div class="container-fluid navbar">
        <div class="logo">
          <router-link to="/" class="logo_a"> MediHealth </router-link>            
        </div>
        <ul class="nav-links">
          <li><router-link to="/">Home</router-link></li>
          <li><a href="#">About Us</a></li>
          <li><a href="#">Services</a></li>
          <li><a href="#">Contact Us</a></li>
        </ul>
        <router-link to="/login" class="nav-cta">Get Started</router-link>
      </div>
    </header>

    <main :class="{ 'has-navbar': showNavbar }">
      <router-view></router-view>
    </main>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

// Computed conditional flag: Automatically hides the main navigation layout 
// ONLY when the user is viewing the full screen Admin Dashboard layout console frame.
const showNavbar = computed(() => {
  return route.path !== '/admin-dashboard'
})
</script>

<style>
/* Adds layout spacing to push down content so it doesn't hide behind fixed headers */
.has-navbar {
  padding-top: 80px; 
}
</style>