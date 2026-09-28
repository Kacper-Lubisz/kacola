import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import type { ModelInfo } from '@gnomeola/protocol'

// What the window remembers about itself, as opposed to the daemon's settings: today only whether
// first-run onboarding (S-1) has been completed or skipped. It lives in a small JSON file under
// $XDG_STATE_HOME/gnomeola/ui-state.json (GNOMEOLA_UI_STATE_FILE overrides the path) because it is
// per-user-per-machine window state, not a setting a remote daemon should hold.

export type UiState = {
  version: 1
  /** Set when the user finished or skipped onboarding. */
  onboardingDone: boolean
  /** Model ids that were still missing when onboarding was skipped: those do not re-trigger it. */
  skippedMissing: string[]
}

export const initialUiState: UiState = { version: 1, onboardingDone: false, skippedMissing: [] }

export function uiStatePath(env: Record<string, string | undefined>): string {
  if (env.GNOMEOLA_UI_STATE_FILE) return env.GNOMEOLA_UI_STATE_FILE
  const base = env.XDG_STATE_HOME || join(env.HOME || homedir(), '.local', 'state')
  return join(base, 'gnomeola', 'ui-state.json')
}

export function readUiState(path: string): UiState {
  let raw: string
  try {
    raw = readFileSync(path, 'utf8')
  } catch {
    return initialUiState
  }
  try {
    const v = JSON.parse(raw) as Partial<UiState>
    return {
      version: 1,
      onboardingDone: v.onboardingDone === true,
      skippedMissing: Array.isArray(v.skippedMissing)
        ? v.skippedMissing.filter((x): x is string => typeof x === 'string')
        : [],
    }
  } catch {
    // a corrupt file must not wedge the app on the onboarding screen forever
    return initialUiState
  }
}

/** Atomic write (temp file + rename), so a crash never leaves half a file. */
export function writeUiState(path: string, state: UiState): void {
  mkdirSync(dirname(path), { recursive: true })
  const tmp = `${path}.${process.pid}.tmp`
  writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`)
  renameSync(tmp, path)
}

/**
 * Open onboarding by itself? On first run, and afterwards whenever a required model is missing that
 * was not already missing when the user skipped (a newly required model, or one that went corrupt).
 * `missing` is null when the model list could not be fetched (an older or partial daemon): then the
 * flow has nothing to offer and does not open by itself.
 */
export function shouldOnboard(state: UiState, missing: readonly ModelInfo[] | null): boolean {
  if (!missing) return false
  if (!state.onboardingDone) return true
  return missing.some((m) => !state.skippedMissing.includes(m.id))
}
