import { formatOffset, type Session, type TrackKind } from '@gnomeola/protocol'
import { formatDuration } from '@gnomeola/ui-core/format'
import { _, fmt } from '@gnomeola/ui-core/i18n'
import type { SpeakersState } from '@gnomeola/ui-core/speakers'
import {
  applyPartial,
  type PartialLine,
  type TranscriptRow,
  type TranscriptState,
  transcriptRows,
} from '@gnomeola/ui-core/transcript'

// What the transcript list shows, as pure data (unit-tested without a DOM):
//
//   segment  every segment of the transcript query, in order (ui-core's transcriptRows: speaker runs,
//            provisional = still live-quality);
//   partial  the line being spoken right now, per track, from the ephemeral store — dropped as soon as a
//            segment on its track closes over it (ui-core's applyPartial rule, so a late partial never
//            resurrects a finished line);
//   gap      a recorded gap in the audio (device switch, suspend): reported where it happened, never
//            papered over.

export type GapRow = {
  id: string
  kind: 'gap'
  startMs: number
  durationMs: number
  reason: string
  tracks: TrackKind[]
}

export type LineRow = TranscriptRow
export type DisplayRow = LineRow | GapRow

export const isLine = (r: DisplayRow): r is LineRow => r.kind !== 'gap'

export const speakerName = (speaker: string): string =>
  speaker === 'me' ? _('Me') : speaker === 'them' ? _('Them') : speaker

/** Recorded gaps of every track, merged when both tracks lost the same stretch. */
export function gapsOf(session: Pick<Session, 'tracks'> | undefined): GapRow[] {
  const byAt = new Map<number, GapRow>()
  for (const t of session?.tracks ?? []) {
    for (const g of t.gaps) {
      const cur = byAt.get(g.atMs)
      if (cur) {
        cur.durationMs = Math.max(cur.durationMs, g.durationMs)
        if (!cur.tracks.includes(t.kind)) cur.tracks.push(t.kind)
        continue
      }
      byAt.set(g.atMs, {
        id: `gap:${g.atMs}`,
        kind: 'gap',
        startMs: g.atMs,
        durationMs: g.durationMs,
        reason: g.reason,
        tracks: [t.kind],
      })
    }
  }
  return [...byAt.values()].sort((a, b) => a.startMs - b.startMs)
}

/**
 * The rows, in order: segments with gap markers merged in by time, then the in-progress partials.
 * A gap never splits a speaker run's label off (the line after a gap shows its speaker again).
 */
export function buildRows(
  transcript: TranscriptState,
  speakers: SpeakersState | undefined,
  partials: Partial<Record<TrackKind, PartialLine>> | undefined,
  gaps: readonly GapRow[] = [],
): DisplayRow[] {
  let t = transcript
  for (const p of Object.values(partials ?? {})) if (p) t = applyPartial(t, p)
  const lines = transcriptRows(t, speakers)
  if (!gaps.length) return lines
  const out: DisplayRow[] = []
  let g = 0
  for (const r of lines) {
    let gapped = false
    while (g < gaps.length && r.kind === 'segment' && gaps[g]!.startMs <= r.startMs) {
      out.push(gaps[g++]!)
      gapped = true
    }
    out.push(gapped && !r.groupStart ? { ...r, groupStart: true } : r)
  }
  // gaps after the last segment (before the partials, which are "now")
  const firstPartial = out.findIndex((r) => r.kind === 'partial')
  const rest = gaps.slice(g)
  if (rest.length) out.splice(firstPartial === -1 ? out.length : firstPartial, 0, ...rest)
  return out
}

/** What a screen reader reads for one row (and what the e2e tests find rows by — the GTK app's names). */
export function rowName(r: DisplayRow): string {
  if (r.kind === 'gap') {
    return fmt(_('Recording gap at {time}, {duration}: {reason}'), {
      time: formatOffset(r.startMs),
      duration: formatDuration(r.durationMs),
      reason: r.reason,
    })
  }
  const state = r.kind === 'partial' ? _('in progress') : r.provisional ? _('provisional') : null
  const base = fmt(_('{speaker} at {time}: {text}'), {
    speaker: speakerName(r.speaker),
    time: formatOffset(r.startMs),
    text: r.text,
  })
  return state ? `${base} (${state})` : base
}

/** Indices of the rows whose text contains `query` (case-insensitive); gaps never match. */
export function findMatches(rows: readonly DisplayRow[], query: string): number[] {
  const q = query.trim().toLocaleLowerCase()
  if (!q) return []
  const out: number[] = []
  rows.forEach((r, i) => {
    if (isLine(r) && r.text.toLocaleLowerCase().includes(q)) out.push(i)
  })
  return out
}

/** `text` cut around every occurrence of `query`, for highlighting. */
export function splitMatches(text: string, query: string): { text: string; hit: boolean }[] {
  const q = query.trim().toLocaleLowerCase()
  if (!q) return [{ text, hit: false }]
  const lower = text.toLocaleLowerCase()
  const out: { text: string; hit: boolean }[] = []
  let at = 0
  for (let i = lower.indexOf(q); i !== -1; i = lower.indexOf(q, i + q.length)) {
    if (i > at) out.push({ text: text.slice(at, i), hit: false })
    out.push({ text: text.slice(i, i + q.length), hit: true })
    at = i + q.length
  }
  if (at < text.length) out.push({ text: text.slice(at), hit: false })
  return out
}

/** The row a citation points at: by segment id, else the last line starting at or before `tMs`. */
export function citedIndex(
  rows: readonly DisplayRow[],
  seg: string | undefined,
  tMs: number | undefined,
): number {
  if (seg) {
    const i = rows.findIndex((r) => isLine(r) && r.segmentId === seg)
    if (i !== -1 || tMs === undefined) return i
  }
  if (tMs === undefined) return -1
  let best = -1
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]!
    if (!isLine(r) || r.kind !== 'segment') continue
    if (r.startMs > tMs) break
    best = i
  }
  return best
}
