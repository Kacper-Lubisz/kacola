import { existsSync, readFileSync, statSync, unwatchFile, watchFile } from 'node:fs'
import { homedir } from 'node:os'
import { platformPaths } from '@kacola/protocol'

// kacola.env: the settings Preferences does not show — which AI answers questions and judges decisions,
// its model, and the API keys — as KEY=value lines in the config dir (macOS: ~/Library/Application
// Support/kacola/kacola.env; Linux: ~/.config/kacola/kacola.env). The window's "Open config file" creates
// it from @kacola/protocol's CONFIG_TEMPLATE. Read once at start into the environment, under the real environment (a
// variable set in the shell wins); a saved change restarts the daemon once nothing is recording.

export function configFilePath(env: NodeJS.ProcessEnv, platform: string): string {
  return platformPaths({ env, home: homedir(), platform }).configFile
}

/** KEY=value lines; `#` comments, blank lines, `export ` prefixes and matching quotes are allowed. */
export function parseConfigFile(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const m = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line)
    if (!m) continue
    let value = m[2]!
    const quoted = /^(["'])(.*)\1$/.exec(value)
    if (quoted) value = quoted[2]!
    else value = value.replace(/\s+#.*$/, '').trim()
    out[m[1]!] = value
  }
  return out
}

/** Fill `env` from the file: only variables the environment does not set already, and only non-empty ones. */
export function applyConfigFile(path: string, env: NodeJS.ProcessEnv): string[] {
  if (!existsSync(path)) return []
  const applied: string[] = []
  for (const [k, v] of Object.entries(parseConfigFile(readFileSync(path, 'utf8')))) {
    if (!v || env[k]?.trim()) continue
    env[k] = v
    applied.push(k)
  }
  return applied
}

/** Calls `onChange` when the file is saved (created, edited or removed). Returns a stop function. */
export function watchConfigFile(path: string, onChange: () => void, intervalMs = 2000): () => void {
  const stamp = () => (existsSync(path) ? statSync(path).mtimeMs : -1)
  let last = stamp()
  const listener = () => {
    const now = stamp()
    if (now === last) return
    last = now
    onChange()
  }
  watchFile(path, { interval: intervalMs, persistent: false }, listener)
  return () => unwatchFile(path, listener)
}
