import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// /api is proxied to Django so the session cookie stays same-origin (no CORS, no tokens in JS).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    strictPort: true,
    proxy: { '/api': { target: 'http://127.0.0.1:8000', changeOrigin: false } },
  },
})
