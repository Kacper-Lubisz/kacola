import type { Translator } from '@gnomeola/ui-core/i18n'
import type { Catalogue } from '../../shared/bridge.ts'

/**
 * ui-core's `_()` / `ngettext()` over a JSON catalogue from main. Plural selection is the Germanic
 * one-vs-other rule for now; E-10 compiles each language's Plural-Forms expression into the catalogue.
 */
export function catalogueTranslator(c: Catalogue): Translator {
  const m = c.messages
  return {
    gettext: (id) => {
      const v = m[id]
      return typeof v === 'string' && v ? v : Array.isArray(v) && v[0] ? v[0] : id
    },
    ngettext: (one, other, n) => {
      const v = m[one]
      const i = n === 1 ? 0 : 1
      if (Array.isArray(v) && v[i]) return v[i]!
      return n === 1 ? one : other
    },
  }
}
