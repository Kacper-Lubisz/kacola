import { registerHooks } from 'node:module'
import { pathToFileURL } from 'node:url'

// Preloaded with `--import` for `gtkx dev` (see the "dev" script and docs/gtkx.md, "pnpm workspaces").
//
// GTKX codegen writes the generated bindings (`@gtkx/gi`, `@gtkx/jsx`) into packages/ui/node_modules.
// Under pnpm's isolated layout the real files of @gtkx/cli, @gtkx/react and @gtkx/runtime live in the
// workspace root's node_modules/.pnpm, and Node resolves a bare specifier by walking up from the
// *importing file's real path* — so their `import "@gtkx/gi/gtk"` never reaches packages/ui. `gtkx
// build` is fixed by the Vite alias in vite.config.ts; `gtkx dev` loads those packages through Node
// itself (they are SSR externals), so it needs this resolve hook instead.
//
// The hook re-resolves the two generated specifiers as if they were imported from this package,
// which finds packages/ui/node_modules/@gtkx/{gi,jsx} and applies their package.json exports.

const fromHere = pathToFileURL(new URL('../package.json', import.meta.url).pathname).href
const GENERATED = /^@gtkx\/(gi|jsx)(\/|$)/

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (GENERATED.test(specifier)) return nextResolve(specifier, { ...context, parentURL: fromHere })
    return nextResolve(specifier, context)
  },
})
