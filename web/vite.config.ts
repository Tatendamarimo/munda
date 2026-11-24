import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// The service worker precaches the app shell so Munda opens with no signal after the first
// visit. Data offline is handled by Firestore's IndexedDB cache, not the service worker.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'favicon-32.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Munda: maize scouting assistant',
        short_name: 'Munda',
        description: 'Offline-first crop scouting with on-device AI.',
        theme_color: '#075536',
        background_color: '#F8F6EE',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2,png,jpg}'],
        navigateFallback: '/index.html',
        // Never cache Firebase/Google API calls; those must hit the network (or fail fast offline).
        navigateFallbackDenylist: [/^\/__/],
      },
    }),
  ],
  // The shared crop guides live outside web/ (single source of truth for all clients).
  server: { fs: { allow: ['..'] } },
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
  },
  build: {
    // Firebase SDK dominates the bundle; it's precached by the service worker, so one chunk is fine.
    chunkSizeWarningLimit: 1200,
  },
});
