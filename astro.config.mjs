// @ts-check
import { defineConfig } from 'astro/config'
import react from '@astrojs/react'
import sitemap from '@astrojs/sitemap'
import tailwindcss from '@tailwindcss/vite'

// https://astro.build
export default defineConfig({
  site: 'https://pdf.oriz.in',
  output: 'static',
  integrations: [react(), sitemap()],
  vite: {
    plugins: [tailwindcss()],
    // pdfjs-dist / pdf-lib ship large modules; keep them out of the initial
    // bundle — they're always dynamically imported at feature-trigger time.
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('pdfjs-dist')) return 'pdfjs'
            if (id.includes('pdf-lib')) return 'pdflib'
          },
        },
      },
    },
  },
})
