import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { LEGACY_NAME, platformPaths } from '@kacola/protocol'

// Tokens from `kacola pair`, one per host, in ${XDG_CONFIG_HOME:-~/.config}/kacola/hosts.json (0600).
// A loopback daemon needs none; every remote host does. Resolution order for a request: --token, then
// KACOLA_TOKEN, then this file (by the host's base URL).

export type HostEntry = { token: string; deviceId: string; name: string; pairedAt: string }
export type Hosts = Record<string, HostEntry>

export function hostsFile(
  env: Record<string, string | undefined>,
  platform: string = process.platform,
): string {
  // macOS: ~/Library/Application Support/kacola unless XDG_CONFIG_HOME is set (platformPaths)
  return join(platformPaths({ platform, env, home: env.HOME || homedir() }).configDir, 'hosts.json')
}

/** Base URLs are compared without a trailing slash. */
export const hostKey = (url: string) => url.replace(/\/+$/, '')

export function readHosts(env: Record<string, string | undefined>): Hosts {
  let f = hostsFile(env)
  // until the daemon or the window has moved the config dir from its gnomeola name (one release)
  if (!existsSync(f)) {
    const old = join(
      platformPaths({ platform: process.platform, env, home: env.HOME || homedir(), name: LEGACY_NAME })
        .configDir,
      'hosts.json',
    )
    if (!existsSync(old)) return {}
    f = old
  }
  try {
    return JSON.parse(readFileSync(f, 'utf8')) as Hosts
  } catch {
    return {}
  }
}

export function saveHost(env: Record<string, string | undefined>, url: string, entry: HostEntry): string {
  const f = hostsFile(env)
  mkdirSync(dirname(f), { recursive: true, mode: 0o700 })
  const next = { ...readHosts(env), [hostKey(url)]: entry }
  const tmp = `${f}.tmp-${process.pid}`
  writeFileSync(tmp, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 })
  renameSync(tmp, f)
  chmodSync(f, 0o600)
  return f
}

export function tokenFor(
  env: Record<string, string | undefined>,
  url: string,
  explicit?: string,
): string | undefined {
  return explicit ?? (env.KACOLA_TOKEN || undefined) ?? readHosts(env)[hostKey(url)]?.token
}
