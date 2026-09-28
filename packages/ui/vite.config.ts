import { join } from 'node:path'
import { defineConfig } from 'vite'

// Read by `gtkx build` (it hands Vite an inline config without `configFile: false`, so Vite also loads
// this file and merges it).
//
// Why it exists: GTKX codegen writes the generated bindings (`@gtkx/gi`, `@gtkx/jsx`) into THIS
// package's node_modules/.gtkx, next to where `@gtkx/react` is installed. Under pnpm's isolated
// layout the real files of `@gtkx/react` / `@gtkx/runtime` live in the workspace root's
// node_modules/.pnpm, and walking up from there never reaches packages/ui/node_modules — so their
// own `import "@gtkx/gi/gtk"` fails to resolve. A single-package app does not hit this; a pnpm
// workspace does. Pointing both specifiers at the generated store fixes resolution for every
// importer. See docs/gtkx.md, "pnpm workspaces".
const store = join(import.meta.dirname, 'node_modules', '.gtkx')

export default defineConfig({
  resolve: {
    alias: [{ find: /^@gtkx\/(gi|jsx)(?=\/|$)/, replacement: `${store}/$1` }],
  },
})
