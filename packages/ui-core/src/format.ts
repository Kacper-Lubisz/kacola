import type { Session, SessionStatus } from '@kacola/protocol'
import { _, fmt } from './i18n.ts'

// Pure display formatting. No DOM here, so it is unit-tested under plain vitest. Words go through
// `_()` (translated once the app installs gettext); weekday and month names are still English —
// moving them to Intl.DateTimeFormat is the next step when a real translation arrives.

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const pad2 = (n: number) => String(n).padStart(2, '0')

/**
 * "just now", "5 min ago", "3 h ago", "Yesterday", "Tuesday", "12 Mar", "12 Mar 2025".
 * Calendar words ("Yesterday", weekday) are computed in local time, like the GNOME apps do.
 * A timestamp in the future (clock skew between daemon and UI) reads as "just now", never "in 3 s".
 */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso)
  const t = then.getTime()
  if (Number.isNaN(t)) return ''
  const diff = now.getTime() - t
  if (diff < MINUTE) return _('just now')
  if (diff < HOUR) return fmt(_('{n} min ago'), { n: Math.floor(diff / MINUTE) })
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  if (t >= startOfToday) return fmt(_('{n} h ago'), { n: Math.floor(diff / HOUR) })
  if (t >= startOfToday - DAY) return _('Yesterday')
  if (t >= startOfToday - 6 * DAY) return WEEKDAYS[then.getDay()]!
  const dm = `${then.getDate()} ${MONTHS[then.getMonth()]}`
  return then.getFullYear() === now.getFullYear() ? dm : `${dm} ${then.getFullYear()}`
}

/** A wall-clock time for the detail pane: "14:05", or "12 Mar, 14:05" when not today. */
export function formatClockTime(iso: string, now: Date = new Date()): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const hm = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
  const sameDay =
    d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
  if (sameDay) return hm
  const dm = `${d.getDate()} ${MONTHS[d.getMonth()]}`
  return d.getFullYear() === now.getFullYear() ? `${dm}, ${hm}` : `${dm} ${d.getFullYear()}, ${hm}`
}

/** Recording length as a stopwatch: "0:07", "12:34", "1:02:03". Negative or NaN reads as 0. */
export function formatDuration(ms: number): string {
  const total = Number.isFinite(ms) && ms > 0 ? Math.floor(ms / 1000) : 0
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return h ? `${h}:${pad2(m)}:${pad2(s)}` : `${m}:${pad2(s)}`
}

// functions, not strings: evaluated after the translator is installed, not at import time
const STATUS_LABELS: Record<SessionStatus, () => string> = {
  idle: () => _('Not started'),
  recording: () => _('Recording'),
  paused: () => _('Paused'),
  stopped: () => _('Finished'),
  recovered: () => _('Recovered'),
  failed: () => _('Failed'),
}

export const statusLabel = (s: SessionStatus): string => STATUS_LABELS[s]()

/**
 * How long a session has been recording. The daemon updates `durationMs` when a recording stops (or
 * pauses), not every second, so while it records the clock runs from `startedAt`.
 */
export function elapsedMs(
  session: Pick<Session, 'status' | 'durationMs' | 'startedAt'>,
  now: Date = new Date(),
): number {
  if (session.status !== 'recording' || !session.startedAt) return session.durationMs
  const since = now.getTime() - Date.parse(session.startedAt)
  return Number.isFinite(since) ? Math.max(session.durationMs, since) : session.durationMs
}

/** The status part of a row subtitle: "Recording · 3:12", "Finished · 45:00", "Not started". */
export function statusSummary(
  session: Pick<Session, 'status' | 'durationMs'> & Partial<Pick<Session, 'startedAt'>>,
  now: Date = new Date(),
): string {
  if (session.status === 'idle') return statusLabel('idle')
  const ms = elapsedMs({ startedAt: null, ...session }, now)
  return `${statusLabel(session.status)} · ${formatDuration(ms)}`
}

/** The sidebar row subtitle: "5 min ago · Recording · 3:12". */
export function sessionSubtitle(session: Session, now: Date = new Date()): string {
  const when = formatRelativeTime(session.startedAt ?? session.createdAt, now)
  return `${when} · ${statusSummary(session, now)}`
}

/** Escape text for widgets whose string props are Pango markup (AdwStatusPage.description, …). */
export const escapeMarkup = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

/** The title the store gives a recording nobody named: "Meeting 2026-10-01 16:02", in UTC. */
const DEFAULT_TITLE = /^Meeting (\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})$/

/**
 * Was this title made up by the store rather than given by someone? Its time is UTC (so it disagrees
 * with the local clock shown next to it) and, with `createdAt`, it must be the session's own creation
 * minute — a meeting someone really called "Meeting 2026-10-01 16:02" on another day keeps its name.
 */
export function isDefaultTitle(
  session: Pick<Session, 'title'> & Partial<Pick<Session, 'createdAt'>>,
): boolean {
  const m = DEFAULT_TITLE.exec(session.title.trim())
  if (!m) return false
  if (!session.createdAt) return true
  const t = Date.parse(`${m[1]}T${m[2]}:00Z`)
  const c = Date.parse(session.createdAt)
  return Number.isNaN(c) || Math.abs(c - t) < 5 * 60_000
}

/**
 * Titles are never blank on screen, nor the store's stand-in: an unnamed session reads as "Untitled
 * meeting" (its time is next to it, in local time, wherever it is listed).
 */
export const displayTitle = (
  session: Pick<Session, 'title'> & Partial<Pick<Session, 'createdAt'>>,
): string => (session.title.trim() === '' || isDefaultTitle(session) ? _('Untitled meeting') : session.title)
