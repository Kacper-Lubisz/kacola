import { type AnyEvent, ME, SPEAKER_COLOURS, type SpeakerSummary, THEM } from '@kacola/protocol'

// M3 — who speaks in one session, as the UI sees it, and the pure fold that keeps it current. Pure.
//
// The list comes from listSpeakers (`me`, each far-end speaker, `them` while anything is unattributed)
// and follows the durable events the daemon's store applies:
//   speaker.upserted     a new speaker, or a rename / voiceprint link (a merged tombstone disappears)
//   speaker.merged       `fromId` folds into `intoId`: its segments and talk time move with it
//   segments.attributed  segments changed hands — per-speaker counts need the daemon's numbers, so the
//                        feed marks itself stale and refetches (so does any far-end segment.upserted)
// Colours are the daemon's (Speaker.colour, assigned at creation, never reused): a chip keeps its
// colour through renames and merges, whatever order the list is in.

export type SpeakersState = {
  readonly list: readonly SpeakerSummary[]
  readonly byId: ReadonlyMap<string, SpeakerSummary>
}

export const emptySpeakers: SpeakersState = { list: [], byId: new Map() }

/** `me` first, far-end speakers by colour (creation order), `them` last. */
function order(list: SpeakerSummary[]): SpeakerSummary[] {
  const rank = (s: SpeakerSummary) => (s.id === ME ? -2 : s.id === THEM ? SPEAKER_COLOURS * 1000 : 0)
  return list
    .map((s, i) => ({ s, i }))
    .sort((a, b) => rank(a.s) - rank(b.s) || a.i - b.i)
    .map((x) => x.s)
}

export function fromSummaries(list: readonly SpeakerSummary[]): SpeakersState {
  const ordered = order([...list])
  return { list: ordered, byId: new Map(ordered.map((s) => [s.id, s])) }
}

/** The CSS class of a speaker's chip: `me`, `them`, or one of the palette slots. */
export function speakerClass(s: { id: string; colour: number | null } | undefined, speaker: string): string {
  if (speaker === ME || s?.id === ME) return 'speaker-me'
  if (!s || s.colour === null || s.id === THEM) return 'speaker-them'
  return `speaker-c${((s.colour % SPEAKER_COLOURS) + SPEAKER_COLOURS) % SPEAKER_COLOURS}`
}

export type SpeakerFold = { state: SpeakersState; stale: boolean }

/**
 * Fold one event. Returns the same state object when nothing concerns this session. `stale` means
 * the talk-time numbers can no longer be derived locally and should be refetched.
 */
export function applySpeakerEvent(state: SpeakersState, sessionId: string, e: AnyEvent): SpeakerFold {
  const d = e.data
  if (d.type === 'speaker.upserted') {
    const p = d.speaker
    if (p.sessionId !== sessionId) return { state, stale: false }
    if (p.mergedInto) {
      if (!state.byId.has(p.id)) return { state, stale: false }
      return { state: fromSummaries(state.list.filter((s) => s.id !== p.id)), stale: true }
    }
    const cur = state.byId.get(p.id)
    const next: SpeakerSummary = {
      id: p.id,
      label: p.label,
      track: 'system',
      named: p.named,
      colour: p.colour,
      voiceprintId: p.voiceprintId,
      segments: cur?.segments ?? 0,
      talkMs: cur?.talkMs ?? 0,
    }
    const list = cur ? state.list.map((s) => (s.id === p.id ? next : s)) : [...state.list, next]
    return { state: fromSummaries(list), stale: false }
  }
  if (d.type === 'speaker.merged') {
    if (d.sessionId !== sessionId) return { state, stale: false }
    const from = state.byId.get(d.fromId)
    const into = state.byId.get(d.intoId)
    const list = state.list
      .filter((s) => s.id !== d.fromId)
      .map((s) =>
        s.id === d.intoId && from && into
          ? { ...s, segments: s.segments + from.segments, talkMs: s.talkMs + from.talkMs }
          : s,
      )
    return { state: fromSummaries(list), stale: !from || !into }
  }
  if (d.type === 'segments.attributed') {
    return { state, stale: d.sessionId === sessionId && d.segmentIds.length > 0 }
  }
  if (d.type === 'segment.upserted') {
    return { state, stale: d.segment.sessionId === sessionId }
  }
  return { state, stale: false }
}

// --------------------------------------------------------------------------------------------- feed

export type SpeakersFeedState =
  | { status: 'loading'; speakers: SpeakersState }
  | { status: 'ready'; speakers: SpeakersState }
  | { status: 'error'; speakers: SpeakersState; error: string }

export type SpeakersFeedDeps = {
  load: (sessionId: string, signal: AbortSignal) => Promise<SpeakerSummary[]>
  onEvent: (l: (e: AnyEvent) => void) => () => void
  /** How long to gather changes before refetching the numbers (ms). */
  refreshMs?: number
  setTimeout?: (fn: () => void, ms: number) => unknown
  clearTimeout?: (h: unknown) => void
}

/**
 * One session's speakers, loaded and kept live — the TranscriptFeed pattern: listen first, fetch, fold
 * what arrived meanwhile. Label/colour changes fold instantly; counts are refetched (debounced).
 */
export class SpeakersFeed {
  private state: SpeakersFeedState = { status: 'loading', speakers: emptySpeakers }
  private readonly listeners = new Set<() => void>()
  private abort = new AbortController()
  private unsubscribe: (() => void) | null = null
  private buffered: AnyEvent[] | null = []
  private timer: unknown = null
  private disposed = false
  readonly sessionId: string
  private readonly deps: SpeakersFeedDeps

  constructor(sessionId: string, deps: SpeakersFeedDeps) {
    this.sessionId = sessionId
    this.deps = deps
  }

  subscribe = (l: () => void): (() => void) => {
    this.listeners.add(l)
    return () => this.listeners.delete(l)
  }

  getSnapshot = (): SpeakersFeedState => this.state

  private set(next: SpeakersFeedState) {
    if (next === this.state) return
    this.state = next
    for (const l of [...this.listeners]) l()
  }

  start(): this {
    this.unsubscribe = this.deps.onEvent((e) => {
      if (this.buffered) this.buffered.push(e)
      else this.fold(e)
    })
    void this.load()
    return this
  }

  private fold(e: AnyEvent) {
    const r = applySpeakerEvent(this.state.speakers, this.sessionId, e)
    if (r.state !== this.state.speakers) this.set({ ...this.state, speakers: r.state })
    if (r.stale) this.refreshSoon()
  }

  /** Refetch the list (after a change this window made, or when the numbers went stale). */
  refreshSoon() {
    if (this.disposed || this.timer !== null) return
    const setT = this.deps.setTimeout ?? ((fn: () => void, ms: number) => setTimeout(fn, ms))
    this.timer = setT(() => {
      this.timer = null
      void this.reload()
    }, this.deps.refreshMs ?? 400)
  }

  private async reload() {
    try {
      const list = await this.deps.load(this.sessionId, this.abort.signal)
      if (this.abort.signal.aborted) return
      this.set({ status: 'ready', speakers: fromSummaries(list) })
    } catch {
      // keep what we have; the next change tries again
    }
  }

  private async load() {
    try {
      const list = await this.deps.load(this.sessionId, this.abort.signal)
      if (this.abort.signal.aborted) return
      let speakers = fromSummaries(list)
      let stale = false
      for (const e of this.buffered ?? []) {
        const r = applySpeakerEvent(speakers, this.sessionId, e)
        speakers = r.state
        stale ||= r.stale
      }
      this.buffered = null
      this.set({ status: 'ready', speakers })
      if (stale) this.refreshSoon()
    } catch (err) {
      if (this.abort.signal.aborted) return
      this.buffered = null
      this.set({
        status: 'error',
        speakers: this.state.speakers,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  dispose() {
    this.disposed = true
    this.abort.abort()
    if (this.timer !== null)
      (this.deps.clearTimeout ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>)))(this.timer)
    this.timer = null
    this.unsubscribe?.()
    this.unsubscribe = null
    this.listeners.clear()
  }
}
