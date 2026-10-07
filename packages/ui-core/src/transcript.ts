import type { AnyEvent, Segment, SessionStatus, TrackKind, Transcript } from '@kacola/protocol'
import type { SpeakersState } from './speakers.ts'

// One session's transcript as the UI sees it, and the pure fold that keeps it current. Pure.
//
//   segments  durable, revisioned: a segment id is upserted live → final with a higher `revision`;
//             a lower or equal revision is a replay and is ignored.
//   partials  ephemeral `transcript.partial` hypotheses for the segment still open on each track —
//             replaced on every partial, dropped as soon as a segment closes over them.
//   speakers  (M3) attribution events move far-end segments between speakers and relabel them without
//             a new revision — exactly as the daemon's store applies them, so what is cached here
//             always matches what getTranscript would now return.

export type PartialLine = { track: TrackKind; speaker: string; startMs: number; text: string }

export type TranscriptState = {
  readonly byId: ReadonlyMap<string, Segment>
  /** By startMs, then track (mic first), then id — stable for equal start times. */
  readonly ordered: readonly Segment[]
  readonly partials: Readonly<Partial<Record<TrackKind, PartialLine>>>
  /** Latest segment start seen per track; a partial starting before it is stale. */
  readonly lastStart: Readonly<Partial<Record<TrackKind, number>>>
  /** Far-end speaker id → current label, from segments and speaker events. */
  readonly labels: ReadonlyMap<string, string>
}

export const emptyTranscript: TranscriptState = {
  byId: new Map(),
  ordered: [],
  partials: {},
  lastStart: {},
  labels: new Map(),
}

function labelsOf(segments: Iterable<Segment>): Map<string, string> {
  const out = new Map<string, string>()
  for (const s of segments) if (s.speakerId) out.set(s.speakerId, s.speaker)
  return out
}

export function compareSegments(a: Segment, b: Segment): number {
  if (a.startMs !== b.startMs) return a.startMs - b.startMs
  if (a.track !== b.track) return a.track === 'mic' ? -1 : 1
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

function lastStartOf(segments: Iterable<Segment>): Partial<Record<TrackKind, number>> {
  const out: Partial<Record<TrackKind, number>> = {}
  for (const s of segments) out[s.track] = Math.max(out[s.track] ?? -1, s.startMs)
  return out
}

export function fromSegments(segments: readonly Segment[]): TranscriptState {
  const byId = new Map<string, Segment>()
  for (const s of segments) {
    const cur = byId.get(s.id)
    if (!cur || cur.revision < s.revision) byId.set(s.id, s)
  }
  const ordered = [...byId.values()].sort(compareSegments)
  return { byId, ordered, partials: {}, lastStart: lastStartOf(ordered), labels: labelsOf(ordered) }
}

/** Index at which `s` belongs in `ordered` (binary search; appends are the common case). */
function insertionIndex(ordered: readonly Segment[], s: Segment): number {
  const n = ordered.length
  if (n === 0 || compareSegments(ordered[n - 1]!, s) < 0) return n
  let lo = 0
  let hi = n
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (compareSegments(ordered[mid]!, s) < 0) lo = mid + 1
    else hi = mid
  }
  return lo
}

/**
 * Fold one segment in. A revision at or below the one held is ignored (returns the same object), so
 * snapshot + replayed events converge whatever order they arrive in. A closed segment clears the
 * partial it finalises (the partial on its track that started at or before it).
 */
export function upsertSegment(state: TranscriptState, seg: Segment): TranscriptState {
  const cur = state.byId.get(seg.id)
  if (cur && cur.revision >= seg.revision) return state
  const byId = new Map(state.byId)
  byId.set(seg.id, seg)
  let ordered: Segment[]
  if (cur && cur.startMs === seg.startMs && cur.track === seg.track) {
    // replaced in place: same position, new object (live → final, text revised)
    const i = state.ordered.indexOf(cur)
    ordered = state.ordered.slice()
    ordered[i] = seg
  } else {
    ordered = cur ? state.ordered.filter((s) => s.id !== seg.id) : state.ordered.slice()
    ordered.splice(insertionIndex(ordered, seg), 0, seg)
  }
  let partials = state.partials
  const p = partials[seg.track]
  if (p && p.startMs <= seg.startMs) {
    partials = { ...partials }
    delete partials[seg.track]
  }
  const lastStart =
    (state.lastStart[seg.track] ?? -1) >= seg.startMs
      ? state.lastStart
      : { ...state.lastStart, [seg.track]: seg.startMs }
  const labels =
    seg.speakerId && state.labels.get(seg.speakerId) !== seg.speaker
      ? new Map(state.labels).set(seg.speakerId, seg.speaker)
      : state.labels
  return { byId, ordered, partials, lastStart, labels }
}

/**
 * Re-attribute segments in place (no new revision — the daemon's store does the same): every segment
 * `pick` selects becomes `speakerId`'s, labelled with its current label when known.
 */
function reattribute(
  state: TranscriptState,
  pick: (s: Segment) => boolean,
  speakerId: string,
  labels: ReadonlyMap<string, string> = state.labels,
): TranscriptState {
  const label = labels.get(speakerId)
  let changed = false
  const byId = new Map(state.byId)
  const ordered = state.ordered.map((s) => {
    if (s.track !== 'system' || !pick(s)) return s
    const next = { ...s, speakerId, speaker: label ?? s.speaker }
    if (next.speakerId === s.speakerId && next.speaker === s.speaker) return s
    changed = true
    byId.set(s.id, next)
    return next
  })
  if (!changed) return labels === state.labels ? state : { ...state, labels }
  return { ...state, byId, ordered, labels }
}

/** Replace the in-progress hypothesis for a track, unless a segment has already closed past it. */
export function applyPartial(state: TranscriptState, p: PartialLine): TranscriptState {
  if ((state.lastStart[p.track] ?? -1) >= p.startMs) return state
  const cur = state.partials[p.track]
  if (cur && cur.text === p.text && cur.startMs === p.startMs && cur.speaker === p.speaker) return state
  return { ...state, partials: { ...state.partials, [p.track]: p } }
}

export function clearPartials(state: TranscriptState): TranscriptState {
  return Object.keys(state.partials).length ? { ...state, partials: {} } : state
}

const LIVE: ReadonlySet<SessionStatus> = new Set(['recording', 'paused'])

/** Fold any event that concerns `sessionId`; everything else returns `state` unchanged. */
export function applyTranscriptEvent(
  state: TranscriptState,
  sessionId: string,
  e: AnyEvent,
): TranscriptState {
  const d = e.data
  if (d.type === 'segment.upserted') {
    return d.segment.sessionId === sessionId ? upsertSegment(state, d.segment) : state
  }
  if (d.type === 'speaker.upserted') {
    const p = d.speaker
    if (p.sessionId !== sessionId || p.mergedInto) return state
    const labels =
      state.labels.get(p.id) === p.label ? state.labels : new Map(state.labels).set(p.id, p.label)
    return reattribute(state, (s) => s.speakerId === p.id, p.id, labels)
  }
  if (d.type === 'speaker.merged') {
    if (d.sessionId !== sessionId) return state
    return reattribute(state, (s) => s.speakerId === d.fromId, d.intoId)
  }
  if (d.type === 'segments.attributed') {
    if (d.sessionId !== sessionId) return state
    const ids = new Set(d.segmentIds)
    return reattribute(state, (s) => ids.has(s.id), d.speakerId)
  }
  if (e.sessionId !== sessionId) return state
  if (d.type === 'transcript.partial') {
    return applyPartial(state, { track: d.track, speaker: d.speaker, startMs: d.startMs, text: d.text })
  }
  if (d.type === 'session.upserted' && !LIVE.has(d.session.status)) return clearPartials(state)
  return state
}

// ------------------------------------------------------------------------------------- display rows

export type TranscriptRow = {
  /** Segment id, or `partial:<track>` for an in-progress line. */
  id: string
  kind: 'segment' | 'partial'
  segmentId: string | null
  track: TrackKind
  /** Display label: `me`, `them`, or the far-end speaker's current name. */
  speaker: string
  /** The far-end speaker (M3), when attributed. */
  speakerId: string | null
  /** Palette slot of the speaker's chip (the daemon's, stable for the session); null for me/them. */
  colour: number | null
  startMs: number
  text: string
  /** A live (tier-1) segment or a partial: may still change. */
  provisional: boolean
  /** First row of a run by the same speaker: shows the speaker label. */
  groupStart: boolean
}

/**
 * The rows the transcript view shows: every segment in order, then the in-progress partials (oldest
 * first). Consecutive lines by one speaker form a group; only the first carries the speaker label.
 * `speakers` (the session's speaker list) supplies chip colours and the freshest names.
 */
export function transcriptRows(state: TranscriptState, speakers?: SpeakersState): TranscriptRow[] {
  const rows: TranscriptRow[] = []
  let prev: string | null = null
  for (const s of state.ordered) {
    const who = s.speakerId ? speakers?.byId.get(s.speakerId) : undefined
    const key = s.speakerId ?? s.speaker
    rows.push({
      id: s.id,
      kind: 'segment',
      segmentId: s.id,
      track: s.track,
      speaker: who?.label ?? s.speaker,
      speakerId: s.speakerId ?? null,
      colour: who?.colour ?? null,
      startMs: s.startMs,
      text: s.text,
      provisional: s.quality === 'live',
      groupStart: key !== prev,
    })
    prev = key
  }
  const partials = Object.values(state.partials).sort((a, b) => a.startMs - b.startMs)
  for (const p of partials) {
    rows.push({
      id: `partial:${p.track}`,
      kind: 'partial',
      segmentId: null,
      track: p.track,
      speaker: p.speaker,
      speakerId: null,
      colour: null,
      startMs: p.startMs,
      text: p.text,
      provisional: true,
      groupStart: p.speaker !== prev,
    })
    prev = p.speaker
  }
  return rows
}

// --------------------------------------------------------------------------------------------- feed

export type TranscriptFeedState =
  | { status: 'loading'; transcript: TranscriptState }
  | { status: 'ready'; transcript: TranscriptState; total: number }
  | { status: 'error'; transcript: TranscriptState; error: string }

export type TranscriptFeedDeps = {
  load: (sessionId: string, signal: AbortSignal) => Promise<Transcript>
  onEvent: (l: (e: AnyEvent) => void) => () => void
}

/**
 * Loads one session's transcript and keeps it live: listens to the event stream *first*, then
 * fetches the snapshot, then folds the events that arrived meanwhile — revisions make the overlap
 * harmless, and nothing that happened during the fetch is lost. A plain external store for
 * useSyncExternalStore.
 */
export class TranscriptFeed {
  private state: TranscriptFeedState = { status: 'loading', transcript: emptyTranscript }
  private readonly listeners = new Set<() => void>()
  private readonly abort = new AbortController()
  private unsubscribe: (() => void) | null = null
  private buffered: AnyEvent[] | null = []
  readonly sessionId: string
  private readonly deps: TranscriptFeedDeps

  constructor(sessionId: string, deps: TranscriptFeedDeps) {
    this.sessionId = sessionId
    this.deps = deps
  }

  subscribe = (l: () => void): (() => void) => {
    this.listeners.add(l)
    return () => this.listeners.delete(l)
  }

  getSnapshot = (): TranscriptFeedState => this.state

  private set(next: TranscriptFeedState) {
    if (next === this.state) return
    this.state = next
    for (const l of [...this.listeners]) l()
  }

  private fold(e: AnyEvent) {
    const t = applyTranscriptEvent(this.state.transcript, this.sessionId, e)
    if (t !== this.state.transcript) this.set({ ...this.state, transcript: t })
  }

  start(): this {
    this.unsubscribe = this.deps.onEvent((e) => {
      if (this.buffered) this.buffered.push(e)
      else this.fold(e)
    })
    void this.load()
    return this
  }

  private async load() {
    try {
      const t = await this.deps.load(this.sessionId, this.abort.signal)
      if (this.abort.signal.aborted) return
      let transcript = fromSegments(t.segments)
      for (const e of this.buffered ?? []) transcript = applyTranscriptEvent(transcript, this.sessionId, e)
      this.buffered = null
      this.set({ status: 'ready', transcript, total: t.total })
    } catch (err) {
      if (this.abort.signal.aborted) return
      this.buffered = null
      this.set({
        status: 'error',
        transcript: this.state.transcript,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  dispose() {
    this.abort.abort()
    this.unsubscribe?.()
    this.unsubscribe = null
    this.listeners.clear()
  }
}
