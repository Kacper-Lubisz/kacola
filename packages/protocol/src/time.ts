// Parsing helpers shared by every client, so "11:02" means the same thing in the CLI, the UI and the API.

const UNIT_MS: Record<string, number> = {
  ms: 1,
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
  w: 604_800_000,
}

/**
 * Offset into a recording. Accepts `mm:ss`, `h:mm:ss`, a unit form (`90s`, `12m`, `1h30m`), or bare ms.
 * Throws on anything else — silently guessing a window is how an agent ends up citing the wrong minute.
 */
export function parseOffset(input: string): number {
  const s = input.trim()
  if (/^\d+$/.test(s)) return Number(s)
  const clock = /^(?:(\d+):)?(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?$/.exec(s)
  if (clock) {
    const [, h, m, sec, frac] = clock
    if (Number(sec) >= 60 || (h !== undefined && Number(m) >= 60)) throw new Error(`invalid time: ${input}`)
    return (
      ((Number(h ?? 0) * 60 + Number(m)) * 60 + Number(sec)) * 1000 + Number((frac ?? '0').padEnd(3, '0'))
    )
  }
  return parseDuration(s)
}

/** `1h30m`, `90s`, `7d`, `250ms`. */
export function parseDuration(input: string): number {
  const s = input.trim()
  const parts = [...s.matchAll(/(\d+(?:\.\d+)?)(ms|s|m|h|d|w)/g)]
  if (!parts.length || parts.map((p) => p[0]).join('') !== s) throw new Error(`invalid duration: ${input}`)
  return Math.round(parts.reduce((acc, [, n, u]) => acc + Number(n) * UNIT_MS[u!]!, 0))
}

/** A `since` bound: an ISO timestamp, or a duration meaning "that long before now". */
export function parseSince(input: string, now: Date = new Date()): Date {
  const s = input.trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s)
    if (Number.isNaN(d.getTime())) throw new Error(`invalid date: ${input}`)
    return d
  }
  return new Date(now.getTime() - parseDuration(s))
}

/** Render an offset as `m:ss` / `h:mm:ss`. Round-trips through parseOffset at second precision. */
export function formatOffset(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const sec = total % 60
  const ss = String(sec).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}
