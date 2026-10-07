#!/usr/bin/env node
// H-5 — build the deployment as Vercel Build Output API v3 (https://vercel.com/docs/build-output-api):
//
//   .vercel/output/
//     config.json                  routes: two long-running functions, static viewer, everything else → api
//     static/                      the web viewer (index.html, app.js, app.css)
//     functions/_fn/<name>.func/   index.mjs (one esbuild bundle per function) + .vc-config.json
//                                  (runtime, handler, maxDuration, response streaming)
//
// Deploy with `vercel deploy --prebuilt` (docs/hosting.md). Building ourselves instead of letting Vercel
// compile the TypeScript means what the local harness tests (test/harness.ts loads these exact bundles)
// is byte-for-byte what runs in production.
//
//   node packages/vercel/scripts/build.ts [--out DIR] [--max-duration events=3,api=10]
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { type RouteDef, routes } from '@kacola/protocol'
import { build } from 'esbuild'
import { buildViewer } from '../../web/scripts/build.ts'
import { type FunctionName, MAX_DURATION } from '../src/app.ts'

const pkgRoot = resolve(import.meta.dirname, '..')

/**
 * Top-level paths of the protocol's routes, derived from the route table itself, so a route added to the
 * protocol is routed to a function without anyone remembering to list it here. The viewer owns `/` and
 * its static files.
 */
export const API_PREFIXES: string[] = [
  ...new Set(Object.values(routes as Record<string, RouteDef>).map((r) => r.path.split('/')[1]!)),
].sort()

export const RUNTIME = 'nodejs22.x'

export type BuildOptions = { out?: string; maxDuration?: Partial<Record<FunctionName, number>> }

export async function buildOutput(
  o: BuildOptions = {},
): Promise<{ out: string; functions: Record<FunctionName, number> }> {
  const out = resolve(o.out ?? join(pkgRoot, '.vercel', 'output'))
  rmSync(out, { recursive: true, force: true })
  mkdirSync(out, { recursive: true })
  const durations = { ...MAX_DURATION, ...o.maxDuration }

  await buildViewer(join(out, 'static'))

  for (const fn of Object.keys(durations) as FunctionName[]) {
    const dir = join(out, 'functions', '_fn', `${fn}.func`)
    mkdirSync(dir, { recursive: true })
    await build({
      entryPoints: [join(pkgRoot, 'src', 'functions', `${fn}.ts`)],
      outfile: join(dir, 'index.mjs'),
      bundle: true,
      platform: 'node',
      target: 'node22',
      format: 'esm',
      minify: false,
      sourcemap: false,
      legalComments: 'none',
      logLevel: 'warning',
      define: { __MAX_DURATION__: String(durations[fn]) },
      // pg's optional native binding is never used.
      external: ['pg-native'],
      plugins: [
        {
          // The SQLite entry of the store (native better-sqlite3) is reached only for a `sqlite:`
          // DATABASE_URL in the local harness. Bundled, its static driver import would be hoisted to the
          // top of the ESM output and break every cold start; kept external it stays a lazy import().
          name: 'sqlite-entry-external',
          setup(b) {
            b.onResolve({ filter: /^@kacola\/store$/ }, (a) => ({ path: a.path, external: true }))
          },
        },
      ],
      // CommonJS dependencies (pg) call require(); give the ESM bundle one.
      banner: {
        js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);",
      },
    })
    writeFileSync(
      join(dir, '.vc-config.json'),
      `${JSON.stringify(
        {
          runtime: RUNTIME,
          handler: 'index.mjs',
          launcherType: 'Nodejs',
          shouldAddHelpers: false,
          supportsResponseStreaming: true,
          maxDuration: durations[fn],
        },
        null,
        2,
      )}\n`,
    )
  }

  const config = {
    version: 3,
    routes: [
      // headers for everything: no caching of API answers, no framing, no referrer leaks
      {
        src: '/(.*)',
        headers: {
          'x-content-type-options': 'nosniff',
          'x-frame-options': 'DENY',
          'referrer-policy': 'no-referrer',
        },
        continue: true,
      },
      { src: '^/events$', dest: '/_fn/events' },
      { src: '^/sessions/[^/]+/audio/finalize$', dest: '/_fn/finalize' },
      // L-19: a shared agenda's page (the token stays in the URL; the page reads it)
      { src: '^/a/[A-Za-z0-9_-]{16,128}/?$', dest: '/agenda.html' },
      { handle: 'filesystem' },
      { src: `^/(${API_PREFIXES.join('|')})(/.*)?$`, dest: '/_fn/api' },
    ],
  }
  writeFileSync(join(out, 'config.json'), `${JSON.stringify(config, null, 2)}\n`)
  return { out, functions: durations }
}

if (import.meta.main) {
  const { values } = parseArgs({ options: { out: { type: 'string' }, 'max-duration': { type: 'string' } } })
  const maxDuration = Object.fromEntries(
    (values['max-duration'] ?? '')
      .split(',')
      .filter(Boolean)
      .map((kv) => {
        const [k, v] = kv.split('=')
        return [k, Number(v)]
      }),
  ) as Partial<Record<FunctionName, number>>
  const r = await buildOutput({ out: values.out, maxDuration })
  console.log(`vercel output → ${r.out} (functions: ${JSON.stringify(r.functions)})`)
}
