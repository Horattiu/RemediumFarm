import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/features': path.resolve(__dirname, './src/features'),
      '@/shared': path.resolve(__dirname, './src/shared'),
      '@/config': path.resolve(__dirname, './src/config'),
      '@/app': path.resolve(__dirname, './src/app'),
    },
  },
  optimizeDeps: {
    exclude: ['pdfjs-dist'],
  },
  worker: {
    format: 'es',
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // ✅ Vendor chunks - separate large dependencies for better caching
          
          // React core (react, react-dom, react-router-dom)
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router')) {
            return 'react-vendor';
          }
          
          // date-fns (used in calendar components)
          if (id.includes('node_modules/date-fns')) {
            return 'date-vendor';
          }
          
          // PDF libraries (used only in PDF feature)
          if (id.includes('node_modules/pdfjs-dist') || id.includes('node_modules/pdf-lib')) {
            return 'pdf-vendor';
          }
          
          // Other node_modules
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        },
      },
    },
    // ✅ Increase chunk size warning limit (we're splitting intentionally)
    chunkSizeWarningLimit: 600,
  },
})

