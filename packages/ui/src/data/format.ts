import type { Session, SessionStatus } from '@gnomeola/protocol'

// Pure display formatting. No GTK here, so it is unit-tested under plain vitest.

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
  if (diff < MINUTE) return 'just now'
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} min ago`
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  if (t >= startOfToday) return `${Math.floor(diff / HOUR)} h ago`
  if (t >= startOfToday - DAY) return 'Yesterday'
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

const STATUS_LABELS: Record<SessionStatus, string> = {
  idle: 'Not started',
  recording: 'Recording',
  paused: 'Paused',
  stopped: 'Finished',
  recovered: 'Recovered',
  failed: 'Failed',
}

export const statusLabel = (s: SessionStatus): string => STATUS_LABELS[s]

/** The status part of a row subtitle: "Recording · 3:12", "Finished · 45:00", "Not started". */
export function statusSummary(session: Pick<Session, 'status' | 'durationMs'>): string {
  if (session.status === 'idle') return statusLabel('idle')
  return `${statusLabel(session.status)} · ${formatDuration(session.durationMs)}`
}

/** The sidebar row subtitle: "5 min ago · Recording · 3:12". */
export function sessionSubtitle(session: Session, now: Date = new Date()): string {
  const when = formatRelativeTime(session.startedAt ?? session.createdAt, now)
  return `${when} · ${statusSummary(session)}`
}

/** Escape text for widgets whose string props are Pango markup (AdwStatusPage.description, …). */
export const escapeMarkup = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

/** Titles are never blank on screen: an unnamed session reads as "Untitled session". */
export const displayTitle = (session: Pick<Session, 'title'>): string =>
  session.title.trim() === '' ? 'Untitled session' : session.title
