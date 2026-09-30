import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { DEFAULT_BASE_URL } from '@gnomeola/protocol'
import { uiStatePath } from './ui-state.ts'

// Runtime configuration, from the environment only (the app has no config file of its own —
// settings that matter live in the daemon).

type Common = {
  /** Where the window remembers onboarding ($XDG_STATE_HOME/gnomeola/ui-state.json). */
  uiStatePath: string
  /** Open first-run onboarding by itself when it is due. Default: on for a daemon, off for the demo. */
  autoOnboarding: boolean
}

export type UiConfig =
  | ({ mode: 'demo'; intervalMs: number; maxSessions: number } & Common)
  | ({ mode: 'daemon'; baseUrl: string; timeoutMs: number; token?: string } & Common)

const TRUE = new Set(['1', 'true', 'yes', 'on'])

/**
 * M8: a remote gnomeola needs a device token — GNOMEOLA_TOKEN, else the one `gnomeola pair` saved for
 * this URL in ${XDG_CONFIG_HOME:-~/.config}/gnomeola/hosts.json. A loopback daemon needs none.
 */
function tokenFor(env: Record<string, string | undefined>, baseUrl: string): string | undefined {
  if (env.GNOMEOLA_TOKEN) return env.GNOMEOLA_TOKEN
  const file = join(env.XDG_CONFIG_HOME || join(env.HOME || homedir(), '.config'), 'gnomeola', 'hosts.json')
  if (!existsSync(file)) return undefined
  try {
    const hosts = JSON.parse(readFileSync(file, 'utf8')) as Record<string, { token?: string }>
    return hosts[baseUrl.replace(/\/+$/, '')]?.token
  } catch {
    return undefined
  }
}

function positiveInt(raw: string | undefined, fallback: number, name: string): number {
  if (raw === undefined || raw === '') return fallback
  const n = Number(raw)
  if (!Number.isInteger(n) || n <= 0)
    throw new Error(`${name} must be a positive integer, got ${JSON.stringify(raw)}`)
  return n
}

const FALSE = new Set(['0', 'false', 'no', 'off'])

function flag(raw: string | undefined, fallback: boolean): boolean {
  const v = (raw ?? '').trim().toLowerCase()
  if (TRUE.has(v)) return true
  if (FALSE.has(v)) return false
  return fallback
}

export function readConfig(env: Record<string, string | undefined>): UiConfig {
  const demo = TRUE.has((env.GNOMEOLA_UI_DEMO ?? '').toLowerCase())
  const common: Common = {
    uiStatePath: uiStatePath(env),
    autoOnboarding: flag(env.GNOMEOLA_UI_ONBOARDING, !demo),
  }
  if (demo) {
    return {
      ...common,
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
  const token = tokenFor(env, baseUrl)
  return {
    ...common,
    mode: 'daemon',
    baseUrl,
    timeoutMs: positiveInt(env.GNOMEOLA_UI_TIMEOUT_MS, 5000, 'GNOMEOLA_UI_TIMEOUT_MS'),
    ...(token ? { token } : {}),
  }
}
