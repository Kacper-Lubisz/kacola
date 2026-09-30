import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { platformPaths } from '@gnomeola/protocol'

// Tokens from `gnomeola pair`, one per host, in ${XDG_CONFIG_HOME:-~/.config}/gnomeola/hosts.json (0600).
// A loopback daemon needs none; every remote host does. Resolution order for a request: --token, then
// GNOMEOLA_TOKEN, then this file (by the host's base URL).

export type HostEntry = { token: string; deviceId: string; name: string; pairedAt: string }
export type Hosts = Record<string, HostEntry>

export function hostsFile(
  env: Record<string, string | undefined>,
  platform: string = process.platform,
): string {
  // macOS: ~/Library/Application Support/gnomeola unless XDG_CONFIG_HOME is set (platformPaths)
  return join(platformPaths({ platform, env, home: env.HOME || homedir() }).configDir, 'hosts.json')
}

/** Base URLs are compared without a trailing slash. */
export const hostKey = (url: string) => url.replace(/\/+$/, '')

export function readHosts(env: Record<string, string | undefined>): Hosts {
  const f = hostsFile(env)
  if (!existsSync(f)) return {}
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
  return explicit ?? (env.GNOMEOLA_TOKEN || undefined) ?? readHosts(env)[hostKey(url)]?.token
}
