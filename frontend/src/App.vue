<template>
  <div id="app-layout">
    <header class="main-header" v-if="showNavbar">
      <div class="container-fluid navbar">
        <div class="logo">
          <router-link to="/" class="logo_a inline-block h-auto w-max"> 
            <img src="/src/assets/img/mediflow_logo.png" alt="MediFlow Logo" class="block max-h-full h-12 w-auto object-contain" /> 
          </router-link> 
        </div>
        <ul class="nav-links">
          <li><router-link to="/">Home</router-link></li>
          <li><router-link to="/about">About Us</router-link></li>
          <li><router-link to="/services">Services</router-link></li>
          <li><router-link to="/contact">Contact Us</router-link></li>
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


const showNavbar = computed(() => {
  return route.path !== '/admin-dashboard' && !route.path.startsWith('/patient')
})
</script>

<style>
.has-navbar {
  padding-top: 80px; 
}
</style>