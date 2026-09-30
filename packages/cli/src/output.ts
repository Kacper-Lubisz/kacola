export type Io = {
  stdout: (s: string) => void
  stderr: (s: string) => void
  /** Whether stdout is a terminal. Agents and pipes get JSON by default. */
  isTTY: boolean
  env: Record<string, string | undefined>
  /** All of standard input (for `--stdin`); absent where there is none (MCP). */
  stdin?: () => Promise<string>
}

export type Format = 'json' | 'text'

export function resolveFormat(flags: { json?: boolean; text?: boolean }, io: Io): Format {
  if (flags.json && flags.text) return 'json'
  if (flags.json) return 'json'
  if (flags.text) return 'text'
  return io.isTTY ? 'text' : 'json'
}

/** Compact when piped (every byte is a token to an agent), indented for a human at a terminal. */
export function renderJson(value: unknown, io: Io): string {
  return `${io.isTTY ? JSON.stringify(value, null, 2) : JSON.stringify(value)}\n`
}

export function relativeTime(iso: string, now: Date = new Date()): string {
  const ms = now.getTime() - new Date(iso).getTime()
  const min = Math.round(ms / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const h = Math.round(min / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.round(h / 24)
  return `${d}d ago`
}

export function localStamp(iso: string): string {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export function truncate(s: string, max: number): string {
  if (s.length <= max) return s
  return `${s.slice(0, max - 1).trimEnd()}…`
}
