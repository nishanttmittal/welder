import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// Base is parameterized so the SAME source builds for two homes:
//   • GitHub Pages (default):  /welder/   (npm run build / deploy)
//   • Firebase Hosting root:   /          (APP_BASE=/ npm run build) — same-origin Google
//     sign-in that works inside the installed iPhone PWA (github.io could not).
const BASE = process.env.APP_BASE || '/welder/'

// Build stamp — shown in the app so we can tell AT A GLANCE whether a phone is
// running the current build or a stale cached one. A worker "still can't do X"
// after a deploy is almost always a stale service-worker cache; without this we
// were guessing. Bumped automatically on every build.
const BUILD_ID = new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 16).replace('T', ' ') + ' IST'

export default defineConfig({
  base: BASE,
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      scope: BASE,
      includeAssets: ['apple-touch-icon.png'],
      workbox: {
        navigateFallback: `${BASE}index.html`,
        navigateFallbackAllowlist: [new RegExp('^' + BASE)],
        // Never let the SW serve the app for Firebase's reserved /__/auth/* paths —
        // doing so boots the app inside the auth iframe → recursion → white screen.
        navigateFallbackDenylist: [/^\/__/],
      },
      manifest: {
        name: 'Welder Contractor',
        short_name: 'Welder',
        description: 'Welder contractor — material sent for chrome / powder / gold finishing',
        theme_color: '#b45309',
        background_color: '#f1f5f9',
        display: 'standalone',
        orientation: 'portrait',
        start_url: BASE,
        scope: BASE,
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
    }),
  ],
})
