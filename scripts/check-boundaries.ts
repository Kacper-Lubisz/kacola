// G-6 — the one architectural rule, enforced rather than hoped for.
//
// Client packages (the UI and the CLI) may depend on @gnomeola/protocol and nothing else from this
// workspace. They must never reach the store, capture, STT, LLM or daemon internals: that discipline
// is what lets the backend move to a remote host without the clients noticing.
//
// Checked two ways, because either alone is easy to route around:
//   1. declared dependencies in each client's package.json
//   2. actual import specifiers in each client's source files
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

export const CLIENT_PACKAGES = ['ui', 'cli'] as const
export const ALLOWED_INTERNAL = new Set(['@gnomeola/protocol'])

export type Violation = { pkg: string; where: string; specifier: string }

const IMPORT_RE =
  /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|require\(\s*['"]([^'"]+)['"]\s*\)/g

export function importsIn(source: string): string[] {
  const out: string[] = []
  for (const m of source.matchAll(IMPORT_RE)) out.push((m[1] ?? m[2] ?? m[3])!)
  return out
}

export function isForbidden(specifier: string): boolean {
  if (specifier.startsWith('@gnomeola/')) {
    const name = specifier.split('/').slice(0, 2).join('/')
    return !ALLOWED_INTERNAL.has(name)
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
    const dir = join(root, 'packages', pkg)
    const manifest = join(dir, 'package.json')
    if (!existsSync(manifest)) continue
    const json = JSON.parse(readFileSync(manifest, 'utf8')) as Record<
      string,
      Record<string, string> | undefined
    >
    for (const field of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
      for (const dep of Object.keys(json[field] ?? {})) {
        if (isForbidden(dep)) violations.push({ pkg, where: `package.json#${field}`, specifier: dep })
      }
    }
    for (const file of walk(dir)) {
      for (const spec of importsIn(readFileSync(file, 'utf8'))) {
        if (isForbidden(spec)) violations.push({ pkg, where: relative(root, file), specifier: spec })
      }
    }
  }
  return violations
}

if (import.meta.main) {
  const root = join(import.meta.dirname, '..')
  const v = checkBoundaries(root)
  if (v.length) {
    console.error('✗ boundary violations — clients may only import @gnomeola/protocol:')
    for (const x of v) console.error(`  ${x.pkg}: ${x.where} imports ${x.specifier}`)
    process.exit(1)
  }
  console.log(`✓ boundaries clean (${CLIENT_PACKAGES.join(', ')} depend only on @gnomeola/protocol)`)
}
