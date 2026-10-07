import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'electron-vite'
import type { Plugin } from 'vite'

// Three builds (docs/desktop-app.md, "Layout"):
//   main      Node ESM, self-contained apart from electron and node:*: workspace packages are TypeScript
//             sources, and the packaged app ships no node_modules (scripts/build-desktop.ts), so zod is in too.
//   preload   CommonJS, one self-contained file: a sandboxed preload can only require('electron').
//   renderer  the React SPA, served from app:// in production and from the Vite dev server (HMR) in dev.
const workspace = ['@kacola/protocol', '@kacola/ui-core']

/**
 * Every non-ASCII UTF-16 unit in the output as a \\uXXXX escape (valid in strings, templates, regex
 * literals and comments alike). V8 keeps each script's source in memory for as long as it runs, and one
 * non-ASCII character makes the whole source two bytes a character: the renderer bundle was a 6 MB string
 * (docs/desktop-app.md, Footprint). esbuild's `charset: 'ascii'` leaves regex literals alone, hence this.
 */
export function asciiOnly(): Plugin {
  return {
    name: 'kacola:ascii-only',
    // after every other plugin's renderChunk (the minifier turns escapes back into characters)
    generateBundle: {
      order: 'post',
      handler(_options, bundle) {
        for (const chunk of Object.values(bundle))
          if (chunk.type === 'chunk')
            chunk.code = chunk.code.replace(
              /[\u0080-\uffff]/g,
              (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`,
            )
      },
    },
  }
}

export default defineConfig({
  main: {
    plugins: [asciiOnly()],
    build: {
      externalizeDeps: { exclude: [...workspace, 'zod'] },
      rollupOptions: { input: { index: resolve(import.meta.dirname, 'src/main/index.ts') } },
    },
  },
  preload: {
    plugins: [asciiOnly()],
    build: {
      externalizeDeps: false,
      rollupOptions: {
        input: {
          index: resolve(import.meta.dirname, 'src/preload/index.ts'),
          // the hidden capture window's preload (in-app capture): frames out, start/stop in
          capture: resolve(import.meta.dirname, 'src/preload/capture.ts'),
        },
        output: { format: 'cjs', entryFileNames: '[name].cjs' },
      },
    },
  },
  renderer: {
    root: resolve(import.meta.dirname, 'src/renderer'),
    plugins: [react(), tailwindcss(), asciiOnly()],
    resolve: {
      alias: {
        'node:crypto': resolve(import.meta.dirname, 'src/renderer/shims/node-crypto.ts'),
        // the kacola brand assets (logos) — `@brand/logo/icon.svg?url`
        '@brand': resolve(import.meta.dirname, '..', '..', 'brand'),
      },
    },
    build: {
      // Minified, and ASCII-only (esbuild escapes the rest): V8 keeps a script's whole source in memory, and
      // one non-ASCII character makes it two bytes a character — unminified that was a 6 MB string (Footprint).
      minify: 'esbuild',
      rollupOptions: {
        input: {
          index: resolve(import.meta.dirname, 'src/renderer/index.html'),
          capture: resolve(import.meta.dirname, 'src/renderer/capture.html'),
        },
      },
    },
  },
})
