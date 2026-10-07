import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { DEFAULT_BASE_URL } from '@kacola/protocol'

// Main-process configuration, from the environment and argv (the app has no config file of its own:
// settings that matter live in the daemon). (The GTK app read the same variables.)

export type DesktopConfig = {
  baseUrl: string
  /** M8 device token for a remote kacola. Stays in main: the tunnel adds it, the renderer never sees it. */
  token?: string
  /** True when baseUrl is a loopback address — the only case in which we may start a daemon ourselves. */
  loopback: boolean
  /** Start without a window (`--background`): the CLI uses this to bring a daemon up. */
  background: boolean
  /** The daemon entry to spawn (a built daemon.mjs, or packages/daemon/src/main.ts in dev). */
  daemonEntry: string | null
  /** Extra args for a spawned daemon (tests pass --data-dir, fakes…). */
  daemonArgs: string[]
  uiStatePath: string
  /**
   * A separate profile of the window (KACOLA_PROFILE, e.g. `sandbox` from `pnpm sandbox start`): its own
   * Electron user-data dir — so its own single-instance lock, and it never meets the everyday window —
   * no kacola:// registration, and a title and badge that say which window it is. Null: the everyday app.
   */
  profile: string | null
  /** The profile's user-data dir: KACOLA_USER_DATA_DIR, else null (main derives `<userData>-<profile>`). */
  userDataDir: string | null
}

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '::1', '[::1]'])

/**
 * M8: a remote kacola needs a device token — KACOLA_TOKEN, else the one `kacola pair` saved for
 * this URL in ${XDG_CONFIG_HOME:-~/.config}/kacola/hosts.json. A loopback daemon needs none.
 */
export function tokenFor(env: Record<string, string | undefined>, baseUrl: string): string | undefined {
  if (env.KACOLA_TOKEN) return env.KACOLA_TOKEN
  const file = join(env.XDG_CONFIG_HOME || join(env.HOME || homedir(), '.config'), 'kacola', 'hosts.json')
  if (!existsSync(file)) return undefined
  try {
    const hosts = JSON.parse(readFileSync(file, 'utf8')) as Record<string, { token?: string }>
    return hosts[baseUrl.replace(/\/+$/, '')]?.token
  } catch {
    return undefined
  }
}

export function uiStatePath(env: Record<string, string | undefined>): string {
  if (env.KACOLA_UI_STATE_FILE) return env.KACOLA_UI_STATE_FILE
  const base = env.XDG_STATE_HOME || join(env.HOME || homedir(), '.local', 'state')
  return join(base, 'kacola', 'ui-state.json')
}

/**
 * Which daemon to spawn: KACOLA_DAEMON_ENTRY, else a bundled daemon.mjs next to the app (packaged
 * builds put the runtime in resources/runtime/: scripts/build-desktop.ts), else the repo's packages/daemon/src/main.ts (dev), else none.
 */
export function daemonEntry(
  env: Record<string, string | undefined>,
  o: { resourcesPath?: string; appDir: string },
): string | null {
  if (env.KACOLA_DAEMON_ENTRY) return env.KACOLA_DAEMON_ENTRY
  const candidates = [
    ...(o.resourcesPath ? [join(o.resourcesPath, 'runtime', 'daemon.mjs')] : []),
    // out/main → packages/desktop → packages/daemon
    join(o.appDir, '..', '..', '..', 'daemon', 'dist', 'daemon.mjs'),
    join(o.appDir, '..', '..', '..', 'daemon', 'src', 'main.ts'),
  ]
  return candidates.find((p) => existsSync(p)) ?? null
}

/** KACOLA_PROFILE: a short lower-case name, or null. Anything else is refused (it names a directory). */
export function profileFrom(env: Record<string, string | undefined>): string | null {
  const p = (env.KACOLA_PROFILE ?? '').trim()
  if (!p) return null
  if (!/^[a-z0-9][a-z0-9-]{0,31}$/.test(p))
    throw new Error(`KACOLA_PROFILE must be a short lower-case name (got ${JSON.stringify(p)})`)
  return p
}

export function readDesktopConfig(
  env: Record<string, string | undefined>,
  argv: readonly string[],
  o: { resourcesPath?: string; appDir: string },
): DesktopConfig {
  const baseUrl = ((env.KACOLA_URL ?? '').trim() || DEFAULT_BASE_URL).replace(/\/+$/, '')
  let host: string
  try {
    host = new URL(baseUrl).hostname
  } catch {
    throw new Error(`KACOLA_URL is not a URL: ${JSON.stringify(baseUrl)}`)
  }
  const token = tokenFor(env, baseUrl)
  let daemonArgs: string[] = []
  if (env.KACOLA_DAEMON_ARGS) {
    const parsed = JSON.parse(env.KACOLA_DAEMON_ARGS) as unknown
    if (!Array.isArray(parsed) || !parsed.every((a) => typeof a === 'string'))
      throw new Error('KACOLA_DAEMON_ARGS must be a JSON array of strings')
    daemonArgs = parsed
  }
  return {
    baseUrl,
    ...(token ? { token } : {}),
    loopback: LOOPBACK.has(host),
    background: argv.includes('--background'),
    daemonEntry: daemonEntry(env, o),
    daemonArgs,
    uiStatePath: uiStatePath(env),
    profile: profileFrom(env),
    userDataDir: (env.KACOLA_USER_DATA_DIR ?? '').trim() || null,
  }
}
