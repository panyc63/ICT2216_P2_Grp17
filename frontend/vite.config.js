import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

// Local-only convenience: when the SPA is served by `vite dev` or `vite preview` and built
// with VITE_API_URL=/api, route same-origin `/api` calls to the backend so cookies/CSRF/
// SameSite behave exactly like the production nginx proxy. This never affects `vite build`
// output — production serves the SPA behind nginx, which owns the real /api proxy.
const apiProxyTarget = process.env.VITE_API_PROXY_TARGET || 'http://localhost:5000'
const proxy = { '/api': { target: apiProxyTarget, changeOrigin: true } }

export default defineConfig({
  plugins: [
    vue() // Transpiles and parses your custom .vue files cleanly
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)) // Standard shortcut configuration
    }
  },
  server: { proxy },
  preview: { proxy }
})