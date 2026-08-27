import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages deployment (spec §4) — project page serves under /<repo>/.
  // Deploying via GitHub Pages "Deploy from a branch" reading /docs on main.
  base: '/architecture-canvas/',
  build: {
    // Output the static site into /docs so it can be committed and served
    // directly from the main branch (Settings → Pages → branch: main, folder: /docs).
    outDir: 'docs',
    emptyOutDir: true,
  },
  plugins: [vue(), vueDevTools(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
