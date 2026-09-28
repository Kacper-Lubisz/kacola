import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import * as GLib from '@gtkx/gi/glib'
import { t } from '@gtkx/runtime'
import { setTranslator } from './index.ts'

// The GNU gettext side of ./index.ts, the same mechanism @gtkx/i18n uses (bindtextdomain through
// libc, lookups through GLib's dgettext/dngettext), without pulling in i18next: we only need `_()`.
//
// Catalogs: <localeDir>/<lang>/LC_MESSAGES/gnomeola.mo, where localeDir is GNOMEOLA_LOCALE_DIR, else
// `locale/` next to the bundle when it exists (a dev or test build), else the system /usr/share/locale.
// Only English exists today, so every lookup falls through to the source string — which is exactly
// what gettext does for a missing catalog.

export const TEXT_DOMAIN = 'gnomeola'

const LIBC = 'libc.so.6'

export function localeDir(env: Record<string, string | undefined>, bundleDir: string): string {
  if (env.GNOMEOLA_LOCALE_DIR) return env.GNOMEOLA_LOCALE_DIR
  const local = join(bundleDir, 'locale')
  return existsSync(local) ? local : '/usr/share/locale'
}

export function installGettext(env: Record<string, string | undefined>, entry: string): string {
  const dir = localeDir(env, dirname(entry))
  // GTK has already called setlocale(LC_ALL, "") during init; only the domain needs binding.
  const bindTextDomain = t.bind(LIBC, 'bindtextdomain', [t.string(), t.string()], t.string())
  const bindCodeset = t.bind(LIBC, 'bind_textdomain_codeset', [t.string(), t.string()], t.string())
  bindTextDomain(TEXT_DOMAIN, dir)
  bindCodeset(TEXT_DOMAIN, 'UTF-8')
  setTranslator({
    gettext: (msgid) => GLib.dgettext(TEXT_DOMAIN, msgid),
    ngettext: (one, other, n) => GLib.dngettext(TEXT_DOMAIN, one, other, BigInt(Math.max(0, Math.trunc(n)))),
  })
  return dir
}
