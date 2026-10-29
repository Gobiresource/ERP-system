import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Relative asset paths, so the same build works on any static host and as a preview page.
export default defineConfig({
  base: './',
  plugins: [react()],
  // All screens are in one file on purpose (src/App.tsx), so a page change never waits for the network
  build: { chunkSizeWarningLimit: 700 },
})
