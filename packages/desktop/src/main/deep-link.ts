import { resolve } from 'node:path'
import {
  formatAgendaLink,
  formatMeetingLink,
  formatShareLink,
  KACOLA_SCHEME,
  parseKacolaLink,
  parseShareLink,
} from '@kacola/protocol'

// kacola:// deep links, main's half (docs/desktop-app.md, "Deep links"): which argument is a link, when
// to register as the scheme's handler, and the queue that holds a link until the window can take it.
// Pure — index.ts wires it to argv, 'second-instance', macOS 'open-url' and the bridge.

/** Longer than any link we write; anything longer is not ours. */
export const MAX_DEEP_LINK = 4000

/** Plain http is only for a share host on this machine (a local server in development and tests). */
const LOOPBACK = /^http:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?(\/|$)/i

/**
 * A valid `kacola://agenda/<id>` or `kacola://meeting/<uid>[?start=]`, or a shared agenda's web link
 * (`https://<host>/a/<token>`, team sharing: the window offers to follow it), in its canonical form (the
 * form formatAgendaLink / formatMeetingLink / formatShareLink write), or null. The renderer only ever
 * sees this form.
 */
export function normalizeDeepLink(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length > MAX_DEEP_LINK) return null
  const trimmed = raw.trim()
  if (/^https:\/\//i.test(trimmed) || LOOPBACK.test(trimmed)) {
    const share = parseShareLink(trimmed)
    return share ? formatShareLink(share.base, share.token) : null
  }
  const link = parseKacolaLink(raw)
  if (!link) return null
  return link.kind === 'agenda'
    ? formatAgendaLink(link.agendaId)
    : formatMeetingLink(link.eventUid, link.start)
}

/** The first argument that is a kacola link (desktop files pass it as %U; a second launch forwards it). */
export function deepLinkFromArgv(argv: readonly string[]): string | null {
  for (const a of argv) {
    const url = normalizeDeepLink(a)
    if (url) return url
  }
  return null
}

export type SchemeRegistration = {
  scheme: typeof KACOLA_SCHEME
  /** The executable to register (with `args`), or null for the running app itself. */
  path: string | null
  /** Arguments before the URL (the unpackaged main script), or null for none. */
  args: string[] | null
}

/**
 * What `app.setAsDefaultProtocolClient` should be called with, or null to leave the system alone.
 * Packaged macOS registers itself (Info.plist declares the scheme too). Packaged Linux never does: the
 * desktop file's / Flatpak's MimeType is the registration. Unpackaged (dev) registers on macOS unless
 * KACOLA_REGISTER_SCHEME=0, and on Linux only with KACOLA_REGISTER_SCHEME=1 — there it runs
 * xdg-settings and changes the user's real default handler, which a test or CI run must never do.
 */
export function schemeRegistration(o: {
  packaged: boolean
  platform: NodeJS.Platform
  env: Record<string, string | undefined>
  execPath: string
  argv: readonly string[]
}): SchemeRegistration | null {
  const flag = o.env.KACOLA_REGISTER_SCHEME
  if (flag === '0') return null
  if (o.packaged) return o.platform === 'darwin' ? { scheme: KACOLA_SCHEME, path: null, args: null } : null
  const main = o.argv[1]
  if (!main) return null
  if (o.platform === 'darwin' || (o.platform === 'linux' && flag === '1'))
    return { scheme: KACOLA_SCHEME, path: o.execPath, args: [resolve(main)] }
  return null
}

/**
 * The link waiting for the window. A link is pushed to a window only once that window's renderer has
 * asked for pending links (take) — before that it could arrive before anyone listens — and otherwise
 * waits for the take. One slot: a newer link replaces one not yet taken. The same link twice within
 * `dedupeMs` (a double click, argv + open-url) counts once.
 */
export class DeepLinkQueue {
  private pending: string | null = null
  private last: { url: string; at: number } | null = null
  private readonly ready = new Set<number>()
  private readonly now: () => number
  private readonly dedupeMs: number

  constructor(now: () => number = Date.now, dedupeMs = 1000) {
    this.now = now
    this.dedupeMs = dedupeMs
  }

  /** Queue a link; false for a duplicate of the last one. */
  push(url: string): boolean {
    const t = this.now()
    if (this.last?.url === url && t - this.last.at < this.dedupeMs) return false
    this.last = { url, at: t }
    this.pending = url
    return true
  }

  get hasPending(): boolean {
    return this.pending !== null
  }

  markReady(webContentsId: number): void {
    this.ready.add(webContentsId)
  }

  /** The renderer asked (IPC.deepLinkTake): it is ready from now on; returns and clears the pending link. */
  take(webContentsId: number): string | null {
    this.markReady(webContentsId)
    const url = this.pending
    this.pending = null
    return url
  }

  /** The pending link, to push to this window now — null unless its renderer has taken once. */
  deliverTo(webContentsId: number): string | null {
    return this.ready.has(webContentsId) ? this.take(webContentsId) : null
  }

  /** The window reloaded or went away: wait for its next take. */
  reset(webContentsId: number): void {
    this.ready.delete(webContentsId)
  }
}
