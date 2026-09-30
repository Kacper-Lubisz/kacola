import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'electron-vite'

// Three builds (docs/desktop-app.md, "Layout"):
//   main      Node ESM. Workspace packages are TypeScript sources, so they are bundled, not externalized.
//   preload   CommonJS, one self-contained file: a sandboxed preload can only require('electron').
//   renderer  the React SPA, served from app:// in production and from the Vite dev server (HMR) in dev.
const workspace = ['@gnomeola/protocol', '@gnomeola/ui-core']

export default defineConfig({
  main: {
    build: {
      externalizeDeps: { exclude: workspace },
      rollupOptions: { input: { index: resolve(import.meta.dirname, 'src/main/index.ts') } },
    },
  },
  preload: {
    build: {
      externalizeDeps: false,
      rollupOptions: {
        input: { index: resolve(import.meta.dirname, 'src/preload/index.ts') },
        output: { format: 'cjs', entryFileNames: '[name].cjs' },
      },
    },
  },
  renderer: {
    root: resolve(import.meta.dirname, 'src/renderer'),
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        'node:crypto': resolve(import.meta.dirname, 'src/renderer/shims/node-crypto.ts'),
        // the kacola brand assets (logos) — `@brand/logo/icon.svg?url`
        '@brand': resolve(import.meta.dirname, '..', '..', 'brand'),
      },
    },
    build: {
      rollupOptions: { input: { index: resolve(import.meta.dirname, 'src/renderer/index.html') } },
    },
  },
})
