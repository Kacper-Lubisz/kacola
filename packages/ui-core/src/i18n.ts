// Translatable strings (S-5). Every user-visible string is wrapped in `_()` (or `ngettext()`), which
// is what packages/desktop/scripts/i18n-pot.ts scans for to produce translations/kacola.pot. At startup
// the renderer installs a translator over the JSON catalogue main hands it; until then — and in unit
// tests — the source string is returned unchanged.
//
// No DOM or Node imports: the folds in this package use it too, and they run anywhere.

export type Translator = {
  gettext: (msgid: string) => string
  ngettext: (one: string, other: string, n: number) => string
}

const identity: Translator = {
  gettext: (s) => s,
  ngettext: (one, other, n) => (n === 1 ? one : other),
}

let active: Translator = identity

export function setTranslator(t: Translator | null): void {
  active = t ?? identity
}

/** Translate a message. The argument must be a string literal, or extraction will miss it. */
export function _(msgid: string): string {
  return active.gettext(msgid)
}

/** Translate a message with a plural form chosen by `n`. Both forms must be literals. */
export function ngettext(one: string, other: string, n: number): string {
  return active.ngettext(one, other, n)
}

/**
 * Fill `{name}` placeholders after translation, so translators can move them: fmt(_('Ask about
 * {title}'), { title }). Unknown placeholders are left as they are.
 */
export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m))
}
