import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const api = process.env.ERP_API ?? 'http://localhost:8787'

// Relative asset paths, so the same build works on any static host and as a preview page.
export default defineConfig({
  base: './',
  plugins: [react()],
  // All screens are in one file on purpose (src/App.tsx), so a page change never waits for the network
  build: { chunkSizeWarningLimit: 700 },
  // The server (server/main.ts) answers /api when it runs; without it the app works on, with the AI reading switched off.
  // ERP_API names another address for it: the tests of the server mode run beside a preview that has no server.
  server: { proxy: { '/api': api } },
  preview: { proxy: { '/api': api } },
})
