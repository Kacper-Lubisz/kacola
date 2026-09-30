import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { Catalogue, UiState } from '../shared/bridge.ts'

// The Node-only pieces of the GTK app's data layer, re-homed in main and served over the bridge:
// ui-state.json (onboarding memory), THIRD_PARTY_NOTICES.md and the translation catalogue.

export const initialUiState: UiState = { version: 1, onboardingDone: false, skippedMissing: [] }

export function readUiState(path: string): UiState {
  let raw: string
  try {
    raw = readFileSync(path, 'utf8')
  } catch {
    return initialUiState
  }
  try {
    return sanitizeUiState(JSON.parse(raw))
  } catch {
    // a corrupt file must not wedge the app on the onboarding screen forever
    return initialUiState
  }
}

/** The renderer is untrusted: whatever it sends is reduced to exactly the UiState shape. */
export function sanitizeUiState(v: unknown): UiState {
  const o = (typeof v === 'object' && v !== null ? v : {}) as Partial<UiState>
  return {
    version: 1,
    onboardingDone: o.onboardingDone === true,
    skippedMissing: Array.isArray(o.skippedMissing)
      ? o.skippedMissing.filter((x): x is string => typeof x === 'string').slice(0, 100)
      : [],
  }
}

/** Atomic write (temp file + rename), so a crash never leaves half a file. */
export function writeUiState(path: string, state: UiState): void {
  mkdirSync(dirname(path), { recursive: true })
  const tmp = `${path}.${process.pid}.tmp`
  writeFileSync(tmp, `${JSON.stringify(sanitizeUiState(state), null, 2)}\n`)
  renameSync(tmp, path)
}

/** THIRD_PARTY_NOTICES.md: shipped in resources/ when packaged, the repo root's in dev. */
export function readNotices(candidates: string[]): string {
  for (const p of candidates) if (existsSync(p)) return readFileSync(p, 'utf8')
  return ''
}

/**
 * The catalogue for the first preferred language that has one: <dir>/<lang>.json (compiled from
 * translations/<lang>.po at build time, E-10). English — and any language without a catalogue — gets
 * an empty one, and `_()` returns the source strings, exactly as gettext does for a missing .mo.
 */
export function loadCatalogue(dir: string, languages: readonly string[]): Catalogue {
  for (const lang of languages) {
    for (const cand of [lang, lang.split(/[-_]/)[0]!]) {
      if (!/^[A-Za-z]{2,3}([-_][A-Za-z0-9]+)?$/.test(cand)) continue
      const file = join(dir, `${cand}.json`)
      if (!existsSync(file)) continue
      try {
        const messages = JSON.parse(readFileSync(file, 'utf8')) as Catalogue['messages']
        return { locale: cand, messages }
      } catch {
        // a broken catalogue falls through to English rather than breaking the window
      }
    }
  }
  return { locale: 'en', messages: {} }
}

/** LANGUAGE (colon list), then LC_ALL / LC_MESSAGES / LANG, then the system's preferred languages. */
export function preferredLanguages(
  env: Record<string, string | undefined>,
  system: readonly string[],
): string[] {
  const out: string[] = []
  for (const l of (env.LANGUAGE ?? '').split(':')) if (l) out.push(l)
  const posix = env.LC_ALL || env.LC_MESSAGES || env.LANG
  if (posix && posix !== 'C' && !posix.startsWith('C.') && posix !== 'POSIX') out.push(posix.split('.')[0]!)
  out.push(...system)
  return out
}
