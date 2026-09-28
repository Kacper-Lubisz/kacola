// Translatable strings (S-5). Every user-visible string is wrapped in `_()` (or `ngettext()`), which
// is what `scripts/i18n-extract.ts` scans for to produce po/gnomeola.pot. At startup index.tsx installs
// the GNU gettext translator from ./gettext.ts (GLib's dgettext against a bound text domain); until
// then — and in unit tests, which run without GTK — the source string is returned unchanged.
//
// This module has no GTK imports on purpose: data/ uses it too, and data/ must stay GTK-free.

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
