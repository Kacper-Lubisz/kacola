// Compile the translations listed in translations/LINGUAS into dist/locale/<lang>/LC_MESSAGES/
// gnomeola.mo, next to the bundle — where src/i18n/gettext.ts looks first. Runs after `gtkx build`.
//
// Why not `po/`: GTKX's build treats a `po/` directory as @gtkx/i18n's (i18next `t()` messages,
// application-id text domain) and would regenerate it from `t()` calls, discarding our `_()`
// messages. gnomeola's strings go through plain GNU gettext, so they live in translations/.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const PKG = join(import.meta.dirname, '..')
const DIR = join(PKG, 'translations')
export const DOMAIN = 'gnomeola'

export function linguas(): string[] {
  return readFileSync(join(DIR, 'LINGUAS'), 'utf8')
    .split('\n')
    .map((l) => l.replace(/#.*/, '').trim())
    .filter(Boolean)
}

export function compile(outLocaleDir: string): string[] {
  const out: string[] = []
  for (const lang of linguas()) {
    const po = join(DIR, `${lang}.po`)
    if (!existsSync(po)) throw new Error(`LINGUAS lists ${lang} but ${po} does not exist`)
    const mo = join(outLocaleDir, lang, 'LC_MESSAGES', `${DOMAIN}.mo`)
    mkdirSync(join(outLocaleDir, lang, 'LC_MESSAGES'), { recursive: true })
    execFileSync('msgfmt', ['--check', '-o', mo, po])
    out.push(mo)
  }
  return out
}

if (import.meta.main) {
  const written = compile(join(PKG, 'dist', 'locale'))
  console.log(written.length ? `compiled ${written.length} catalog(s)` : 'no translations listed in LINGUAS')
}
