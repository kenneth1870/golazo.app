import { defineConfig } from 'vite'
import RubyPlugin from 'vite-plugin-ruby'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    RubyPlugin(),
    react(),
  ],
  resolve: {
    dedupe: ['react', 'react-dom', 'react-dom/client'],
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-dom/client'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) return 'react-vendor'
          if (id.includes('node_modules/react-router')) return 'router'
          if (id.includes('node_modules/i18next') || id.includes('node_modules/react-i18next')) return 'i18n'
          if (id.includes('node_modules/recharts') || id.includes('node_modules/d3')) return 'charts'
          if (id.includes('pages/admin/')) return 'admin'
          if (id.includes('pages/scores/MatchShowPage') || id.includes('pages/MatchShowPage')) return 'match-detail'
          if (id.includes('pages/news/') || id.includes('pages/NewsPage')) return 'news'
        },
      },
    },
  },
  server: {
    headers: {
      'Cache-Control': 'no-store',
    },
  },
})
