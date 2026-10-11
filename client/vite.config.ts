import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    // Installable app: manifest, icons and an offline cache for the app shell.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Haunted Village',
        short_name: 'Haunted',
        description: 'A party game of villagers, the possessed and NFC charms.',
        theme_color: '#0b0a10',
        background_color: '#0b0a10',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // The live game, the API and the health check must always hit the server.
        navigateFallbackDenylist: [/^\/api\//, /^\/socket\.io\//, /^\/health/],
        globPatterns: ['**/*.{js,css,html,svg,png}'],
      },
    }),
  ],
  server: {
    host: true, // reachable from phones on the same Wi-Fi
    proxy: {
      // In dev the client (5173) forwards the live connection to the server (3001).
      '/socket.io': { target: 'http://localhost:3001', ws: true },
      '/api': 'http://localhost:3001',
    },
  },
});
