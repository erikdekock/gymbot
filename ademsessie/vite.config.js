import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// Static, 100% client-side breathing PWA. vite-plugin-pwa (Workbox) generates
// the manifest + service worker and precaches the full app shell — HTML, CSS,
// JS, fonts (woff2) and icons — so the app works fully offline after first load.
//
// `base` is configurable via BASE_PATH so the same source deploys both at a
// domain root ('/') and under a subpath (e.g. GitHub Pages: '/gymbot/'). The
// manifest start_url/scope follow base so the PWA installs correctly there too.
const base = process.env.BASE_PATH || '/'

export default defineConfig({
  base,
  // Pin an inline (empty) PostCSS config so Vite doesn't walk up the tree and
  // pick up the parent Next.js project's postcss/tailwind config.
  css: { postcss: {} },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      workbox: {
        // Precache everything in the build, including the self-hosted fonts.
        globPatterns: ['**/*.{html,js,css,woff2,png,svg,jpg,webp,ico}'],
      },
      manifest: {
        name: 'Ademsessie',
        short_name: 'Ademsessie',
        description: 'Rustige Wim Hof-stijl ademhalingsoefening. Werkt volledig offline.',
        lang: 'nl',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#3f80ca',
        theme_color: '#0d2544',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
})
