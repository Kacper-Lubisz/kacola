#!/usr/bin/env node
// Build the web viewer into a static directory: index.html, app.css and one bundled app.js (esbuild),
// and the shared agenda page (L-19): agenda.html, agenda.css, agenda.js; both use the kacola brand tokens,
// favicon and the typefaces they use (served at /a/<token> by a rewrite to agenda.html).
//   node packages/web/scripts/build.ts [OUT_DIR]      (default packages/web/dist)
// packages/vercel/scripts/build.ts calls buildViewer() to place it in the deployment's static output.
import { copyFileSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { build } from 'esbuild'

const root = resolve(import.meta.dirname, '..')
const brand = resolve(root, '..', '..', 'brand')

export async function buildViewer(outDir: string): Promise<{ bytes: number }> {
  mkdirSync(outDir, { recursive: true })
  const r = await build({
    entryPoints: { app: join(root, 'src', 'main.ts'), agenda: join(root, 'src', 'agenda-main.ts') },
    outdir: outDir,
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    minify: true,
    sourcemap: false,
    legalComments: 'none',
    metafile: true,
    logLevel: 'warning',
    plugins: [
      {
        // The protocol's id generator imports node:crypto; the viewer never creates ids, but the module
        // graph reaches it. Web Crypto stands in.
        name: 'node-crypto-shim',
        setup(b) {
          b.onResolve({ filter: /^node:crypto$/ }, () => ({ path: 'node-crypto', namespace: 'shim' }))
          b.onLoad({ filter: /.*/, namespace: 'shim' }, () => ({
            contents: `export const randomBytes = (n) => { const b = crypto.getRandomValues(new Uint8Array(n));
              return { toString: () => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('') } }`,
            loader: 'js',
          }))
        },
      },
    ],
  })
  copyFileSync(join(root, 'index.html'), join(outDir, 'index.html'))
  copyFileSync(join(root, 'app.css'), join(outDir, 'app.css'))
  copyFileSync(join(root, 'agenda.html'), join(outDir, 'agenda.html'))
  copyFileSync(join(root, 'agenda.css'), join(outDir, 'agenda.css'))
  mkdirSync(join(outDir, 'brand'), { recursive: true })
  mkdirSync(join(outDir, 'fonts'), { recursive: true })
  copyFileSync(join(brand, 'tokens', 'tokens.css'), join(outDir, 'brand', 'tokens.css'))
  copyFileSync(join(brand, 'icons', 'favicon.svg'), join(outDir, 'brand', 'favicon.svg'))
  for (const f of ['BricolageGrotesque-Variable.woff2', 'InstrumentSans-Variable.woff2', 'JetBrainsMono-Variable.woff2'])
    copyFileSync(join(brand, 'fonts', f), join(outDir, 'fonts', f))
  const bytes = Object.values(r.metafile.outputs).reduce((n, o) => n + o.bytes, 0)
  return { bytes }
}

if (import.meta.main) {
  const out = resolve(process.argv[2] ?? join(root, 'dist'))
  const { bytes } = await buildViewer(out)
  console.log(`viewer → ${out} (js ${(bytes / 1024).toFixed(0)} KiB)`)
}
