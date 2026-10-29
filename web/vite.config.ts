import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Relative asset paths, so the same build works on any static host and as a preview page.
export default defineConfig({
  base: './',
  plugins: [react()],
})
