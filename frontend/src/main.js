import { createApp } from 'vue'
import App from './App.vue'
import router from './router'

// IMPORT YOUR DESIGN SYSTEM STYLES HERE
import './assets/variables.css'
import './assets/styles.css'
import './assets/auth.css'
import './assets/dashboard.css'

const app = createApp(App)
app.use(router)
app.mount('#app')