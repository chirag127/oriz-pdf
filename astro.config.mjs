// @ts-check
import { defineConfig } from 'astro/config'
import react from '@astrojs/react'
import sitemap from '@astrojs/sitemap'
import AstroPWA from '@vite-pwa/astro'
import tailwindcss from '@tailwindcss/vite'

// https://astro.build
export default defineConfig({
  site: 'https://pdf.oriz.in',
  output: 'static',
  integrations: [
    react(),
    sitemap(),
    AstroPWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['favicon.svg', '.well-known/assetlinks.json'],
      manifest: {
        name: 'oriz PDF',
        short_name: 'PDF',
        id: '/',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        lang: 'en',
        dir: 'ltr',
        categories: ['productivity'],
        description:
          'Merge, split, rotate, reorder, and extract PDF pages, text, or images — 100% in your browser. No upload, no signup.',
        background_color: '#0a0f14',
        theme_color: '#22d3ee',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-256.png', sizes: '256x256', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-384.png', sizes: '384x384', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
        screenshots: [
          { src: '/screenshots/desktop.png', sizes: '1280x800', type: 'image/png', form_factor: 'wide', label: 'oriz PDF drafting table' },
          { src: '/screenshots/mobile.png', sizes: '412x915', type: 'image/png', label: 'oriz PDF on mobile' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest,woff,woff2}'],
        navigateFallback: '/',
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/(?:[^/]*\.)?(?:pollinations\.ai|g4f\.dev|gpt4free\.io)\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'ai-endpoints',
              networkTimeoutSeconds: 10,
              expiration: { maxEntries: 32, maxAgeSeconds: 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /\.(?:woff2?|ttf|otf)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'fonts',
              expiration: { maxEntries: 16, maxAgeSeconds: 365 * 24 * 60 * 60 },
            },
          },
        ],
      },
    }),
  ],
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
