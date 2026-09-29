import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';
import bal_pkg from './package.json';

const bal_pages_base =
  (globalThis as { process?: { env?: { BAL_PAGES_BASE?: string } } }).process?.env?.BAL_PAGES_BASE ?? '/';

export default defineConfig({
  base: bal_pages_base,
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'logo.svg'],
      manifest: {
        id: '/',
        name: 'Svelp - Survey Help, simplified.',
        short_name: 'Svelp',
        description: 'Offline-first research questionnaire platform.',
        start_url: bal_pages_base,
        scope: bal_pages_base,
        display: 'standalone',
        orientation: 'any',
        background_color: '#ffffff',
        theme_color: '#ffffff',
        icons: [
          { src: 'icons/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff,woff2}'],
        navigateFallback: `${bal_pages_base}index.html`
      }
    })
  ],
  define: {
    __SVELP_VERSION__: JSON.stringify(bal_pkg.version)
  },
  preview: {
    allowedHosts: ['.e2b.app']
  }
});
