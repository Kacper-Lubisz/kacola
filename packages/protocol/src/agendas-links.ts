// Deep links and the invitation block (kacola phases 1–2). Pure, shared by the daemon, the CLI and the
// window, so every surface writes and reads exactly the same text.
//
//   kacola://agenda/<agendaId>                       one agenda
//   kacola://meeting/<eventUid>?start=<iso>          one occurrence of a calendar event: opens its agenda
//                                                    (or offers to create one); live → Join and record
//   kacola://meeting/<eventUid>                      a series: its current or next occurrence
//
// The user-facing scheme is already `kacola` (the product rename); code identifiers stay `gnomeola`.

export const KACOLA_SCHEME = 'kacola'

export type KacolaLink =
  | { kind: 'agenda'; agendaId: string }
  | { kind: 'meeting'; eventUid: string; start: string | null }

export const formatAgendaLink = (agendaId: string): string =>
  `${KACOLA_SCHEME}://agenda/${encodeURIComponent(agendaId)}`

export function formatMeetingLink(eventUid: string, start?: string | null): string {
  const base = `${KACOLA_SCHEME}://meeting/${encodeURIComponent(eventUid)}`
  return start ? `${base}?start=${encodeURIComponent(new Date(start).toISOString())}` : base
}

/** Parse a `kacola://` link; null for anything else (including malformed ones). */
export function parseKacolaLink(input: string): KacolaLink | null {
  const s = input.trim()
  const m = /^kacola:\/\/(agenda|meeting)\/([^?#]+)(?:\?([^#]*))?(?:#.*)?$/i.exec(s)
  if (!m) return null
  const raw = m[2]!.replace(/\/+$/, '')
  if (!raw || raw.includes('/')) return null
  let target: string
  try {
    target = decodeURIComponent(raw)
  } catch {
    return null
  }
  if (!target) return null
  if (m[1]!.toLowerCase() === 'agenda') return { kind: 'agenda', agendaId: target }
  const start = new URLSearchParams(m[3] ?? '').get('start')
  if (start !== null) {
    const t = new Date(start)
    if (Number.isNaN(t.getTime())) return null
    return { kind: 'meeting', eventUid: target, start: t.toISOString() }
  }
  return { kind: 'meeting', eventUid: target, start: null }
}

// --------------------------------------------------------------------------- the invitation block
//
// A marked block appended to a calendar event's description. The rules: the organiser's text is never
// changed (the block goes after it, separated by a blank line); updating replaces only what lies between
// our markers, so writing twice is a no-op; removing takes out our block and the blank line before it
// (the organiser's text comes back as it was, up to trailing newlines).

export const INVITE_BLOCK_START = '-- kacola agenda --'
export const INVITE_BLOCK_END = '-- /kacola --'

/**
 * The block. With a web page (a shared agenda) its https link comes first — it opens for everyone — and
 * the kacola link second, for attendees who use kacola. Without one only the kacola link is possible,
 * which a person without kacola cannot open: `sendAgenda` never hands that out (see agenda-send.ts).
 */
export function renderInviteBlock(o: { appLink: string; webLink?: string | null }): string {
  const lines = o.webLink ? `Agenda: ${o.webLink}\nOpen in kacola: ${o.appLink}` : `Agenda: ${o.appLink}`
  return `${INVITE_BLOCK_START}\n${lines}\n${INVITE_BLOCK_END}`
}

/** Where our block sits in a description (from the start marker to the end marker inclusive), or null. */
function locate(description: string): { start: number; end: number } | null {
  const start = description.lastIndexOf(INVITE_BLOCK_START)
  if (start === -1) return null
  const endMarker = description.indexOf(INVITE_BLOCK_END, start)
  if (endMarker === -1) return null
  return { start, end: endMarker + INVITE_BLOCK_END.length }
}

/** The block currently in a description, if any. */
export function extractInviteBlock(description: string): string | null {
  const at = locate(description)
  return at ? description.slice(at.start, at.end) : null
}

/**
 * The description with our block added or updated. Idempotent: upsert(upsert(d, b), b) === upsert(d, b).
 * Everything outside our markers is preserved byte for byte.
 */
export function upsertInviteBlock(description: string, block: string): string {
  const at = locate(description)
  if (at) return description.slice(0, at.start) + block + description.slice(at.end)
  if (description === '') return block
  const sep = description.endsWith('\n\n') ? '' : description.endsWith('\n') ? '\n' : '\n\n'
  return `${description}${sep}${block}`
}

/** The description without our block (and the blank line we put before it). */
export function removeInviteBlock(description: string): string {
  const at = locate(description)
  if (!at) return description
  const before = description.slice(0, at.start).replace(/\n{1,2}$/, '')
  return before + description.slice(at.end)
}
