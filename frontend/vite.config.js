import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // En desarrollo, las llamadas a /api se redirigen al backend (mismo origen que en produccion)
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
