// G-6 — the one architectural rule, enforced rather than hoped for.
//
// Client packages (the window, the CLI and the web client) may depend on @gnomeola/protocol and nothing else from this
// workspace. They must never reach the store, capture, STT, LLM or daemon internals: that discipline
// is what lets the backend move to a remote host without the clients noticing.
//
// Checked two ways, because either alone is easy to route around:
//   1. declared dependencies in each client's package.json
//   2. actual import specifiers in each client's source files
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

export const CLIENT_PACKAGES = ['cli', 'web', 'ui-core', 'desktop'] as const
export const ALLOWED_INTERNAL = new Set(['@gnomeola/protocol'])
/**
 * The window's shared data layer (@gnomeola/ui-core) is itself a client: it may import only protocol,
 * and the window (`desktop`, Electron) may import it on top. Nothing else changes.
 */
export const CLIENT_ALLOWED: Record<(typeof CLIENT_PACKAGES)[number], ReadonlySet<string>> = {
  desktop: new Set(['@gnomeola/protocol', '@gnomeola/ui-core']),
  cli: ALLOWED_INTERNAL,
  web: ALLOWED_INTERNAL,
  'ui-core': ALLOWED_INTERNAL,
}

export type Violation = { pkg: string; where: string; specifier: string }

const IMPORT_RE =
  /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|require\(\s*['"]([^'"]+)['"]\s*\)/g

export function importsIn(source: string): string[] {
  const out: string[] = []
  for (const m of source.matchAll(IMPORT_RE)) out.push((m[1] ?? m[2] ?? m[3])!)
  return out
}

export function isForbidden(specifier: string, allowed: ReadonlySet<string> = ALLOWED_INTERNAL): boolean {
  if (specifier.startsWith('@gnomeola/')) {
    const name = specifier.split('/').slice(0, 2).join('/')
    return !allowed.has(name)
  }
  // relative escapes into sibling packages, e.g. '../../store/src/index.ts'
  return /(^|\/)\.\.\/(\.\.\/)*(store|capture|stt|llm|daemon|testkit)\//.test(specifier)
}

function walk(dir: string, acc: string[] = []): string[] {
  if (!existsSync(dir)) return acc
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === 'dist' || e.startsWith('.')) continue
    const p = join(dir, e)
    if (statSync(p).isDirectory()) walk(p, acc)
    else if (/\.(c|m)?tsx?$/.test(e)) acc.push(p)
  }
  return acc
}

export function checkBoundaries(root: string): Violation[] {
  const violations: Violation[] = []
  for (const pkg of CLIENT_PACKAGES) {
    const allowed = CLIENT_ALLOWED[pkg]
    const dir = join(root, 'packages', pkg)
    const manifest = join(dir, 'package.json')
    if (!existsSync(manifest)) continue
    const json = JSON.parse(readFileSync(manifest, 'utf8')) as Record<
      string,
      Record<string, string> | undefined
    >
    for (const field of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
      for (const dep of Object.keys(json[field] ?? {})) {
        if (isForbidden(dep, allowed))
          violations.push({ pkg, where: `package.json#${field}`, specifier: dep })
      }
    }
    for (const file of walk(dir)) {
      for (const spec of importsIn(readFileSync(file, 'utf8'))) {
        if (isForbidden(spec, allowed)) violations.push({ pkg, where: relative(root, file), specifier: spec })
      }
    }
  }
  return violations
}

// M8 — layer rules for the relocatable halves. Their production code (src/ and declared dependencies;
// tests may use anything) may reach only the workspace entry points listed here:
//   capture-agent  the local half: protocol + capture. Never the store or the daemon — it talks to any
//                  backend over the protocol, which is what makes the backend relocatable.
//   server         the hosted half: protocol, the store (its driver-free core, pg, blob; the SQLite
//                  entry only for self-hosting) and the native-free cloud STT. Never capture, local STT
//                  (sherpa), the daemon, the LLM package, or a client.
//   vercel         the deployment: the server, the store's pg/blob/core entries, cloud STT, protocol (and
//                  the SQLite entry, reached only for a `sqlite:` DATABASE_URL in the local harness).
export const LAYER_RULES: Record<string, readonly string[]> = {
  'capture-agent': ['@gnomeola/protocol', '@gnomeola/capture'],
  server: [
    '@gnomeola/protocol',
    '@gnomeola/store',
    '@gnomeola/store/core',
    '@gnomeola/store/pg',
    '@gnomeola/store/blob',
    '@gnomeola/stt/cloud',
  ],
  vercel: [
    '@gnomeola/protocol',
    '@gnomeola/server',
    '@gnomeola/store',
    '@gnomeola/store/core',
    '@gnomeola/store/pg',
    '@gnomeola/store/blob',
    '@gnomeola/stt/cloud',
  ],
}

/** A manifest may name a package whose sub-entry is allowed (`@gnomeola/stt` for `@gnomeola/stt/cloud`). */
const packageOf = (spec: string) => spec.split('/').slice(0, 2).join('/')

export function checkLayers(root: string, rules = LAYER_RULES): Violation[] {
  const out: Violation[] = []
  for (const [pkg, allowed] of Object.entries(rules)) {
    const dir = join(root, 'packages', pkg)
    const manifest = join(dir, 'package.json')
    if (!existsSync(manifest)) continue
    const json = JSON.parse(readFileSync(manifest, 'utf8')) as { dependencies?: Record<string, string> }
    const allowedPkgs = new Set(allowed.map(packageOf))
    for (const dep of Object.keys(json.dependencies ?? {}))
      if (dep.startsWith('@gnomeola/') && !allowedPkgs.has(dep))
        out.push({ pkg, where: 'package.json#dependencies', specifier: dep })
    for (const file of walk(join(dir, 'src'))) {
      for (const spec of importsIn(readFileSync(file, 'utf8'))) {
        const internal = spec.startsWith('@gnomeola/')
        const escapes = /(^|\/)\.\.\/(\.\.\/)+[a-z-]+\/src\//.test(spec)
        if ((internal && !allowed.includes(spec)) || escapes)
          out.push({ pkg, where: relative(root, file), specifier: spec })
      }
    }
  }
  return out
}

// Runtime rules for the Electron split (docs/desktop-app.md): code that runs in a web context must
// not reach Node, and the shared data layer must run in a web context.
//   ui-core/src            no Node builtins, no electron — it runs in the renderer
//   desktop/src/renderer   no Node builtins, no electron: everything privileged crosses the preload bridge
//   desktop/src/preload    electron only (sandboxed preload: no Node builtins)
// desktop/src/main may use Node and electron, but never workspace sources beyond the client allowance
// above: the daemon and CLI are spawned from built bundles by path, never imported.
export const RUNTIME_RULES: { dir: string; forbid: RegExp; why: string }[] = [
  { dir: 'packages/ui-core/src', forbid: /^(node:|electron$)/, why: 'Node or electron' },
  { dir: 'packages/desktop/src/renderer', forbid: /^(node:|electron$)/, why: 'Node or electron' },
  { dir: 'packages/desktop/src/preload', forbid: /^node:/, why: 'Node in a sandboxed preload' },
]

export function checkRuntime(root: string, rules = RUNTIME_RULES): Violation[] {
  const out: Violation[] = []
  for (const r of rules) {
    for (const file of walk(join(root, r.dir))) {
      if (/\.test\.tsx?$/.test(file)) continue
      for (const spec of importsIn(readFileSync(file, 'utf8')))
        if (r.forbid.test(spec)) out.push({ pkg: r.dir, where: relative(root, file), specifier: spec })
    }
  }
  return out
}

if (import.meta.main) {
  const root = join(import.meta.dirname, '..')
  const v = checkBoundaries(root)
  const l = checkLayers(root)
  const rt = checkRuntime(root)
  if (rt.length) {
    console.error('✗ runtime violations (see RUNTIME_RULES in scripts/check-boundaries.ts):')
    for (const x of rt) console.error(`  ${x.where} imports ${x.specifier}`)
  }
  if (v.length) {
    console.error(
      '✗ boundary violations — clients may only import @gnomeola/protocol (+ ui-core for the windows):',
    )
    for (const x of v) console.error(`  ${x.pkg}: ${x.where} imports ${x.specifier}`)
  }
  if (l.length) {
    console.error('✗ layer violations (see LAYER_RULES in scripts/check-boundaries.ts):')
    for (const x of l) console.error(`  ${x.pkg}: ${x.where} imports ${x.specifier}`)
  }
  if (v.length || l.length || rt.length) process.exit(1)
  console.log(
    `✓ boundaries clean (${CLIENT_PACKAGES.join(', ')} depend only on @gnomeola/protocol; desktop also on ui-core)`,
  )
  console.log(`✓ runtime clean (${RUNTIME_RULES.map((r) => r.dir).join(', ')})`)
  console.log(`✓ layers clean (${Object.keys(LAYER_RULES).join(', ')})`)
}
