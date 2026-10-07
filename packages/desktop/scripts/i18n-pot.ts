// Regenerate translations/kacola.pot from every `_()` / `ngettext()` call in src/renderer (and ../ui-core/src) with GNU
// xgettext (0.23+ understands TypeScript and TSX). `pnpm --filter @kacola/desktop i18n:pot`.
//
// Output is deterministic (sorted inputs, no creation date) so the template only changes when a
// message does; test/i18n.test.ts fails when src has a message the template lacks.
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const PKG = join(import.meta.dirname, '..')
/** The window's strings: only the renderer shows text (main and preload have none to translate). */
const SRC = join(PKG, 'src', 'renderer')
/** The shared data layer (packages/ui-core): its strings belong to this catalogue too. */
const CORE_SRC = join(PKG, '..', 'ui-core', 'src')
export const POT = join(PKG, 'translations', 'kacola.pot')

function sources(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir).sort()) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) sources(p, acc)
    else if (/\.tsx?$/.test(e) && !e.endsWith('.d.ts')) acc.push(p)
  }
  return acc
}

export function buildPot(): string {
  const files = [...sources(SRC), ...sources(CORE_SRC)].map((f) => relative(PKG, f))
  const common = ['--keyword=_', '--keyword=ngettext:1,2', '--from-code=UTF-8', '--add-comments=TRANSLATORS:']
  const version = (JSON.parse(readFileSync(join(PKG, 'package.json'), 'utf8')) as { version: string }).version
  const header = ['--package-name=kacola', `--package-version=${version}`]
  const tmp = join(PKG, 'translations', '.kacola.pot.tmp')
  // xgettext picks the language from the extension only for .ts; TSX must be named explicitly
  const tsx = files.filter((f) => f.endsWith('.tsx'))
  const ts = files.filter((f) => f.endsWith('.ts'))
  execFileSync('xgettext', [...common, ...header, '--language=TSX', '-o', tmp, ...tsx], { cwd: PKG })
  execFileSync('xgettext', [...common, ...header, '--language=TypeScript', '-j', '-o', tmp, ...ts], {
    cwd: PKG,
  })
  const pot = readFileSync(tmp, 'utf8')
  rmSync(tmp, { force: true })
  return pot.replace(/^"POT-Creation-Date: .*\\n"\n/m, '')
}

if (import.meta.main) {
  writeFileSync(POT, buildPot())
  console.log(`wrote ${relative(process.cwd(), POT)}`)
}
