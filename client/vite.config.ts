import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, './src') } },
  // API_URL lets the e2e suite point the UI at an isolated test API.
  server: { port: 5173, proxy: { '/api': process.env.API_URL || 'http://localhost:4000' } },
})
