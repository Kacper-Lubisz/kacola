import { DEFAULT_BASE_URL } from '@gnomeola/protocol'

// Runtime configuration, from the environment only (the app has no config file of its own —
// settings that matter live in the daemon).

export type UiConfig =
  | { mode: 'demo'; intervalMs: number; maxSessions: number }
  | { mode: 'daemon'; baseUrl: string; timeoutMs: number }

const TRUE = new Set(['1', 'true', 'yes', 'on'])

function positiveInt(raw: string | undefined, fallback: number, name: string): number {
  if (raw === undefined || raw === '') return fallback
  const n = Number(raw)
  if (!Number.isInteger(n) || n <= 0)
    throw new Error(`${name} must be a positive integer, got ${JSON.stringify(raw)}`)
  return n
}

export function readConfig(env: Record<string, string | undefined>): UiConfig {
  if (TRUE.has((env.GNOMEOLA_UI_DEMO ?? '').toLowerCase())) {
    return {
      mode: 'demo',
      intervalMs: positiveInt(env.GNOMEOLA_UI_DEMO_INTERVAL_MS, 4000, 'GNOMEOLA_UI_DEMO_INTERVAL_MS'),
      maxSessions: positiveInt(env.GNOMEOLA_UI_DEMO_MAX_SESSIONS, 40, 'GNOMEOLA_UI_DEMO_MAX_SESSIONS'),
    }
  }
  const baseUrl = (env.GNOMEOLA_URL ?? '').trim() || DEFAULT_BASE_URL
  try {
    new URL(baseUrl)
  } catch {
    throw new Error(`GNOMEOLA_URL is not a URL: ${JSON.stringify(baseUrl)}`)
  }
  return {
    mode: 'daemon',
    baseUrl,
    timeoutMs: positiveInt(env.GNOMEOLA_UI_TIMEOUT_MS, 5000, 'GNOMEOLA_UI_TIMEOUT_MS'),
  }
}
