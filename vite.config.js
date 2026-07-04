import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'react-dom/client': 'react-dom/profiling',
      'react-dom': 'react-dom/profiling'
    }
  }
})
