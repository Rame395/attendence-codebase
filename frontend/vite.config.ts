import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo.svg', 'favicon.svg', 'apple-touch-icon.png', 'icons/*.png'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,svg,png,woff2,woff}'],
        cleanupOutdatedCaches: true,
        // SPA fallback — navigate to index.html when offline and route not precached
        navigateFallback: null,
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            // API calls — never stale-serve attendance data
            urlPattern: /^https?:\/\/.*\/api\/.*/i,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: ({ url }: { url: URL }) => url.pathname.startsWith('/api') || !!url.searchParams.get('token'),
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts-cache', expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
        ],
      },
      devOptions: {
        // enabled in dev so `beforeinstallprompt` & SW can be tested on localhost without a prod build
        enabled: true,
        navigateFallback: 'index.html',
        type: 'module',
        suppressWarnings: true,
      },
      manifest: {
        name: 'Attendance System',
        short_name: 'Attendance',
        description: 'GPS-based employee attendance with office geofencing — check in/out within 20m radius',
        theme_color: '#28469E',
        background_color: '#CAE8E8',
        display: 'standalone',
        // allow minimal-ui fallback if standalone unsupported
        display_override: ['standalone', 'minimal-ui'],
        orientation: 'portrait',
        scope: '/',
        start_url: '/employee',
        id: '/employee',
        lang: 'en',
        categories: ['business', 'productivity'],
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-maskable-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/logo.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
        shortcuts: [
          {
            name: 'Check In / Out',
            short_name: 'Check In',
            description: 'Open dashboard to check in or out',
            url: '/employee',
            icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
          },
          {
            name: 'My Calendar',
            short_name: 'Calendar',
            description: 'View attendance calendar',
            url: '/employee/calendar',
            icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
          },
          {
            name: 'My Leaves',
            short_name: 'Leaves',
            description: 'Request and view leaves',
            url: '/employee/leaves',
            icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
          },
          {
            name: 'Company Events',
            short_name: 'Events',
            description: 'View company events and holidays',
            url: '/employee/events',
            icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
          },
        ],
      },
    }),
  ],
})
