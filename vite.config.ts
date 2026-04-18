import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;

          if (id.includes('firebase/firestore') || id.includes('@firebase/firestore')) {
            return 'firebase-firestore';
          }
          if (id.includes('firebase/auth') || id.includes('@firebase/auth')) {
            return 'firebase-auth';
          }
          if (id.includes('firebase/messaging') || id.includes('@firebase/messaging')) {
            return 'firebase-messaging';
          }
          if (id.includes('@sentry')) {
            return 'sentry-vendor';
          }
          if (id.includes('recharts') || id.includes('d3-')) {
            return 'charts-vendor';
          }
          if (id.includes('driver.js') || id.includes('canvas-confetti') || id.includes('lucide-react')) {
            return 'ui-vendor';
          }

          return 'vendor';
        },
      },
    },
  },
})
