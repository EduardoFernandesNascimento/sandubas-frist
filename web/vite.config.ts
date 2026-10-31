import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Permite importar os tipos de ../shared (REQ-053).
export default defineConfig({
  plugins: [react()],
  server: {
    fs: { allow: ['..'] },
  },
})
