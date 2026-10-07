import { newId, type Segment, speakerForTrack, type TrackKind } from '@kacola/protocol'
import type { LiveHypothesis, TimedWord } from './types.ts'

// T-5 — the reconciler: a pure, deterministic state machine per session that turns what the speech
// engines say into the segment lifecycle clients see.
//
//   inputs   VAD speech start/end per track · tier-1 partials and endpoints · tier-2 results ·
//            pause / resume / recorded gaps · end of session
//   outputs  `transcript.partial` (ephemeral) · `segment.upserted` (durable) · `finalize` requests
//            (asks the caller to run tier 2 over [startMs, endMs) of a track and feed the result back)
//            · `closed` (a segment's speech is over: its bounds are known, e.g. for diarization)
//
// A closed segment can be `split` at speaker changes (A-2) until its final lands: the first piece keeps
// the id, later pieces get new ids, words go to the piece they were spoken in, and each piece gets its
// own tier-2 request.
//
// Segment boundaries come from the VAD — it sees the audio directly and is the same for every tier.
// Tier-1 words are attached to segments by their timestamps; tier 2 replaces a closed segment's text
// exactly once. Per segment:
//
//     (vad.start)──► open ──(vad.end | pause | gap | end)──► closed ──(final)──► final
//                     │  live words extend it                 │  late live words still revise it
//                     └─ published (live) once it has text    └─ an empty final on an unpublished
//                                                                segment drops it silently
//
// Guarantees, for any input order (property-tested): ids are stable; revisions start at 1 and increase
// by one per upsert; quality goes live→final at most once and never back; per-track segments never
// overlap; mic is always `me`; nothing is emitted for a segment after it is final.

export type FinalPass = 'during' | 'after' | 'off'

export type ReconcilerInput =
  | { type: 'vad.start'; track: TrackKind; atMs: number }
  | { type: 'vad.end'; track: TrackKind; startMs: number; endMs: number }
  | { type: 'live'; hyp: LiveHypothesis }
  | { type: 'final'; segmentId: string; text: string; confidence: number | null }
  | { type: 'final.failed'; segmentId: string; error: string }
  | { type: 'pause'; atMs: number }
  | { type: 'resume'; atMs: number }
  | { type: 'gap'; track: TrackKind | null; atMs: number; durationMs: number; reason: string }
  | { type: 'end'; atMs: number }
  /** Split a closed, not-yet-final segment at these session times (speaker changes). */
  | { type: 'split'; segmentId: string; atMs: number[] }

export type PartialOut = {
  type: 'transcript.partial'
  track: TrackKind
  speaker: string
  startMs: number
  text: string
}
export type UpsertOut = { type: 'segment.upserted'; segment: Segment }
export type FinalizeRequest = {
  type: 'finalize'
  segmentId: string
  track: TrackKind
  startMs: number
  endMs: number
  /**
   * Context padding must not reach past these (set on split pieces: across a split is another
   * speaker's voice, which tier 2 would happily transcribe into this piece).
   */
  contextFromMs?: number
  contextToMs?: number
}
export type ClosedOut = {
  type: 'closed'
  segmentId: string
  track: TrackKind
  startMs: number
  endMs: number
  /** Set on the pieces a split creates: the segment they were cut from. */
  splitFrom?: string
}
export type ReconcilerOutput = PartialOut | UpsertOut | FinalizeRequest | ClosedOut

export type ReconcilerOptions = {
  sessionId: string
  finalPass?: FinalPass
  /** Segment id factory; inject a counter for deterministic tests. */
  newSegmentId?: () => string
}

type SegStatus = 'open' | 'closed' | 'final' | 'dropped'

type SegState = {
  id: string
  track: TrackKind
  startMs: number
  endMs: number
  status: SegStatus
  committed: TimedWord[]
  revision: number
  /** What the last upsert carried, to suppress no-op upserts. */
  published: { text: string; startMs: number; endMs: number } | null
  finalizeRequested: boolean
  finalFailed: boolean
  confidence: number | null
}

type TrackState = {
  segments: SegState[]
  partialWords: TimedWord[]
  lastPartialText: string
  orphans: TimedWord[]
  nowMs: number
}

export type ReconcilerStats = {
  segmentsOpened: number
  segmentsDropped: number
  finalsApplied: number
  finalsIgnored: number
  finalFailures: number
  droppedLiveWords: number
  ignoredInputs: number
  splits: number
  gaps: { track: TrackKind | null; atMs: number; durationMs: number; reason: string }[]
}

/** A tier-1 word may be stamped slightly before the VAD onset… */
const LEAD_TOL_MS = 200
/** …and a streaming transducer emits tokens a few hundred ms after they are spoken. */
const TAIL_TOL_MS = 1000
const PARTIAL_TAIL_TOL_MS = 400

const clampMs = (n: number): number => (Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0)

export class Reconciler {
  readonly sessionId: string
  readonly finalPass: FinalPass
  private readonly newSegmentId: () => string
  private readonly tracks = new Map<TrackKind, TrackState>()
  private readonly byId = new Map<string, SegState>()
  private readonly deferred: FinalizeRequest[] = []
  private paused = false
  private ended = false
  readonly stats: ReconcilerStats = {
    segmentsOpened: 0,
    segmentsDropped: 0,
    finalsApplied: 0,
    finalsIgnored: 0,
    finalFailures: 0,
    droppedLiveWords: 0,
    ignoredInputs: 0,
    splits: 0,
    gaps: [],
  }

  constructor(opts: ReconcilerOptions) {
    this.sessionId = opts.sessionId
    this.finalPass = opts.finalPass ?? 'during'
    this.newSegmentId = opts.newSegmentId ?? (() => newId('seg'))
  }

  get isPaused(): boolean {
    return this.paused
  }
  get isEnded(): boolean {
    return this.ended
  }

  /** Current state of every published segment, ordered by track then start. */
  segments(): Segment[] {
    const out: Segment[] = []
    for (const t of this.tracks.values())
      for (const s of t.segments) if (s.published && s.status !== 'dropped') out.push(this.toSegment(s))
    return out
  }

  /** Segments awaiting a tier-2 result (requested, not yet final or failed). */
  pendingFinals(): string[] {
    return [...this.byId.values()]
      .filter((s) => s.finalizeRequested && s.status === 'closed' && !s.finalFailed)
      .map((s) => s.id)
  }

  step(input: ReconcilerInput): ReconcilerOutput[] {
    const out: ReconcilerOutput[] = []
    switch (input.type) {
      case 'vad.start':
        this.onVadStart(input.track, clampMs(input.atMs), out)
        break
      case 'vad.end':
        this.onVadEnd(input.track, clampMs(input.startMs), clampMs(input.endMs), out)
        break
      case 'live':
        this.onLive(input.hyp, out)
        break
      case 'final':
        this.onFinal(input.segmentId, input.text, input.confidence, out)
        break
      case 'final.failed': {
        const s = this.byId.get(input.segmentId)
        if (s && s.status === 'closed' && s.finalizeRequested) {
          s.finalFailed = true
          this.stats.finalFailures++
        } else this.stats.ignoredInputs++
        break
      }
      case 'pause':
        if (this.paused || this.ended) {
          this.stats.ignoredInputs++
          break
        }
        for (const track of this.tracks.keys()) this.closeOpen(track, clampMs(input.atMs), out)
        this.clearPartials(out)
        this.paused = true
        break
      case 'resume':
        if (!this.paused || this.ended) this.stats.ignoredInputs++
        this.paused = false
        break
      case 'gap': {
        const at = clampMs(input.atMs)
        const dur = clampMs(input.durationMs)
        this.stats.gaps.push({ track: input.track, atMs: at, durationMs: dur, reason: input.reason })
        const tracks = input.track ? [input.track] : [...this.tracks.keys()]
        for (const track of tracks) {
          this.closeOpen(track, at, out)
          const t = this.track(track)
          t.nowMs = Math.max(t.nowMs, at + dur)
        }
        break
      }
      case 'end':
        if (this.ended) {
          this.stats.ignoredInputs++
          break
        }
        for (const track of this.tracks.keys()) this.closeOpen(track, clampMs(input.atMs), out)
        this.clearPartials(out)
        this.ended = true
        this.paused = false
        out.push(...this.deferred.splice(0))
        break
      case 'split':
        this.onSplit(input.segmentId, input.atMs, out)
        break
    }
    return out
  }

  // ------------------------------------------------------------------------------------ handlers

  private track(track: TrackKind): TrackState {
    let t = this.tracks.get(track)
    if (!t) {
      t = { segments: [], partialWords: [], lastPartialText: '', orphans: [], nowMs: 0 }
      this.tracks.set(track, t)
    }
    return t
  }

  private openSeg(t: TrackState): SegState | undefined {
    const last = t.segments.at(-1)
    return last?.status === 'open' ? last : undefined
  }

  /** End of the segment before `s` (or of the last segment), i.e. the earliest `s` may start. */
  private floorFor(t: TrackState, s?: SegState): number {
    const idx = s ? t.segments.indexOf(s) : t.segments.length
    for (let i = idx - 1; i >= 0; i--) {
      const p = t.segments[i]!
      if (p.status !== 'dropped' || p.published) return p.endMs
    }
    return 0
  }

  private onVadStart(track: TrackKind, atMs: number, out: ReconcilerOutput[]): void {
    const t = this.track(track)
    if (this.ended || this.paused || this.openSeg(t)) {
      this.stats.ignoredInputs++
      return
    }
    const start = Math.max(atMs, this.floorFor(t))
    const s: SegState = {
      id: this.newSegmentId(),
      track,
      startMs: start,
      endMs: start,
      status: 'open',
      committed: [],
      revision: 0,
      published: null,
      finalizeRequested: false,
      finalFailed: false,
      confidence: null,
    }
    t.segments.push(s)
    this.byId.set(s.id, s)
    this.stats.segmentsOpened++
    t.nowMs = Math.max(t.nowMs, start)
    // Adopt committed words that arrived before the VAD caught up with the speech.
    const adopt = t.orphans.filter((w) => w.startMs + LEAD_TOL_MS >= start)
    this.stats.droppedLiveWords += t.orphans.length - adopt.length
    t.orphans = []
    if (adopt.length) {
      s.committed.push(...adopt)
      s.endMs = Math.max(s.endMs, Math.min(t.nowMs, Math.max(...adopt.map((w) => w.endMs))))
      this.publishLive(s, out)
    }
  }

  private onVadEnd(track: TrackKind, startMs: number, endMs: number, out: ReconcilerOutput[]): void {
    const t = this.track(track)
    const s = this.openSeg(t)
    if (!s) {
      this.stats.ignoredInputs++
      return
    }
    t.nowMs = Math.max(t.nowMs, endMs)
    this.close(t, s, startMs, endMs, out)
  }

  private closeOpen(track: TrackKind, atMs: number, out: ReconcilerOutput[]): void {
    const t = this.track(track)
    const s = this.openSeg(t)
    if (s) this.close(t, s, s.startMs, Math.max(s.startMs, atMs), out)
  }

  private close(t: TrackState, s: SegState, startMs: number, endMs: number, out: ReconcilerOutput[]): void {
    s.startMs = Math.max(this.floorFor(t, s), startMs)
    s.endMs = Math.max(s.startMs, endMs)
    s.status = 'closed'
    this.publishLive(s, out, true)
    out.push({ type: 'closed', segmentId: s.id, track: s.track, startMs: s.startMs, endMs: s.endMs })
    this.requestFinal(s, out)
  }

  private requestFinal(
    s: SegState,
    out: ReconcilerOutput[],
    limits: { from?: number; to?: number } = {},
  ): void {
    if (this.finalPass === 'off') return
    s.finalizeRequested = true
    const req: FinalizeRequest = {
      type: 'finalize',
      segmentId: s.id,
      track: s.track,
      startMs: s.startMs,
      endMs: s.endMs,
      ...(limits.from !== undefined ? { contextFromMs: limits.from } : {}),
      ...(limits.to !== undefined ? { contextToMs: limits.to } : {}),
    }
    if (this.finalPass === 'during' || this.ended) out.push(req)
    else this.deferred.push(req)
  }

  /**
   * Split a closed segment at speaker changes. Points outside (start, end) are ignored; a split after
   * the final has landed is ignored (a final is never revised). The first piece keeps the id and is
   * republished with its new bounds even if no words are left in it, so the old extent never lingers.
   */
  private onSplit(id: string, points: number[], out: ReconcilerOutput[]): void {
    const s = this.byId.get(id)
    const cuts = [...new Set(points.map(clampMs))]
      .filter((p) => s && p > s.startMs && p < s.endMs)
      .sort((a, b) => a - b)
    if (s?.status !== 'closed' || !cuts.length) {
      this.stats.ignoredInputs++
      return
    }
    const t = this.track(s.track)
    const bounds = [s.startMs, ...cuts, s.endMs]
    const pieceOf = (w: TimedWord) => {
      let k = 0
      while (k + 1 < cuts.length + 1 && w.startMs >= bounds[k + 1]!) k++
      return k
    }
    const words = s.committed
    const pieces: SegState[] = [s]
    for (let k = 1; k < bounds.length - 1; k++) {
      const p: SegState = {
        id: this.newSegmentId(),
        track: s.track,
        startMs: bounds[k]!,
        endMs: bounds[k + 1]!,
        status: 'closed',
        committed: words.filter((w) => pieceOf(w) === k),
        revision: 0,
        published: null,
        finalizeRequested: false,
        finalFailed: false,
        confidence: null,
      }
      this.byId.set(p.id, p)
      this.stats.segmentsOpened++
      pieces.push(p)
    }
    s.committed = words.filter((w) => pieceOf(w) === 0)
    s.endMs = bounds[1]!
    t.segments.splice(t.segments.indexOf(s) + 1, 0, ...pieces.slice(1))
    this.stats.splits++
    // the first piece: republish with its new bounds (forced — even with no words left)
    if (s.published) this.upsert(s, this.liveText(s), out)
    for (const p of pieces.slice(1)) {
      this.publishLive(p, out, true)
      out.push({
        type: 'closed',
        segmentId: p.id,
        track: p.track,
        startMs: p.startMs,
        endMs: p.endMs,
        splitFrom: s.id,
      })
    }
    // tier 2 for every piece: drop the stale request, ask again with the new bounds
    const stale = this.deferred.findIndex((d) => d.segmentId === s.id)
    if (stale >= 0) this.deferred.splice(stale, 1)
    // (a piece is new audio to tier 2, so a failure on the whole is worth a retry per piece)
    if (s.finalizeRequested) {
      s.finalFailed = false
      pieces.forEach((p, k) => {
        this.requestFinal(p, out, {
          ...(k > 0 ? { from: p.startMs } : {}),
          ...(k < pieces.length - 1 ? { to: p.endMs } : {}),
        })
      })
    }
  }

  private onLive(h: LiveHypothesis, out: ReconcilerOutput[]): void {
    if (this.ended) {
      this.stats.ignoredInputs++
      return
    }
    const t = this.track(h.track)
    t.nowMs = Math.max(t.nowMs, clampMs(h.endMs))
    const words = h.words
      .filter((w) => w.text.trim())
      .map((w) => ({
        text: w.text.trim(),
        startMs: clampMs(w.startMs),
        endMs: clampMs(Math.max(w.startMs, w.endMs)),
      }))
    if (h.kind === 'partial') {
      t.partialWords = words
      const text = words.map((w) => w.text).join(' ')
      if (text !== t.lastPartialText) {
        t.lastPartialText = text
        out.push({
          type: 'transcript.partial',
          track: h.track,
          speaker: speakerForTrack(h.track),
          startMs: words[0]?.startMs ?? clampMs(h.startMs),
          text,
        })
      }
      return
    }
    // endpoint: the recognizer committed these words.
    t.partialWords = []
    const touched = new Set<SegState>()
    for (const w of words) {
      const s = this.segmentFor(t, w)
      if (!s) {
        t.orphans.push(w)
        continue
      }
      if (s.status === 'final' || s.status === 'dropped') {
        this.stats.droppedLiveWords++
        continue
      }
      s.committed.push(w)
      touched.add(s)
    }
    for (const s of touched) {
      if (s.status === 'open')
        s.endMs = Math.max(s.endMs, Math.min(t.nowMs, Math.max(...s.committed.map((w) => w.endMs))))
      this.publishLive(s, out)
    }
    if (t.lastPartialText) {
      t.lastPartialText = ''
      out.push({
        type: 'transcript.partial',
        track: h.track,
        speaker: speakerForTrack(h.track),
        startMs: clampMs(h.endMs),
        text: '',
      })
    }
  }

  /** The segment a committed word belongs to: the latest one starting at or before it, if close enough. */
  private segmentFor(t: TrackState, w: TimedWord): SegState | undefined {
    for (let i = t.segments.length - 1; i >= 0; i--) {
      const s = t.segments[i]!
      if (s.startMs <= w.startMs + LEAD_TOL_MS) {
        if (s.status === 'open' || w.startMs <= s.endMs + TAIL_TOL_MS) return s
        return undefined
      }
    }
    return undefined
  }

  private onFinal(id: string, text: string, confidence: number | null, out: ReconcilerOutput[]): void {
    const s = this.byId.get(id)
    if (s?.status !== 'closed' || !s.finalizeRequested || s.finalFailed) {
      this.stats.finalsIgnored++
      return
    }
    const clean = text.replace(/\s+/g, ' ').trim()
    if (!clean && !s.published) {
      s.status = 'dropped'
      this.stats.segmentsDropped++
      return
    }
    s.status = 'final'
    this.stats.finalsApplied++
    s.confidence =
      confidence === null || !Number.isFinite(confidence) ? null : Math.max(0, Math.min(1, confidence))
    this.upsert(s, clean, out)
  }

  private liveText(s: SegState): string {
    const t = this.track(s.track)
    const words = [...s.committed]
    if (s.status !== 'final') {
      const limit = s.status === 'open' ? Number.POSITIVE_INFINITY : s.endMs + PARTIAL_TAIL_TOL_MS
      for (const w of t.partialWords)
        if (w.startMs + LEAD_TOL_MS >= s.startMs && w.startMs < limit) words.push(w)
    }
    return words
      .sort((a, b) => a.startMs - b.startMs)
      .map((w) => w.text)
      .join(' ')
  }

  /** Publish the segment's live text if it has any and something changed. */
  private publishLive(s: SegState, out: ReconcilerOutput[], closing = false): void {
    if (s.status === 'final' || s.status === 'dropped') return
    const text = this.liveText(s)
    if (!text) return
    const p = s.published
    if (p && p.text === text && p.startMs === s.startMs && p.endMs === s.endMs) return
    // While a segment is open we publish on committed text only; a close publishes whatever we have.
    if (!p && s.status === 'open' && !closing && !s.committed.length) return
    this.upsert(s, text, out)
  }

  private upsert(s: SegState, text: string, out: ReconcilerOutput[]): void {
    s.revision++
    s.published = { text, startMs: s.startMs, endMs: s.endMs }
    out.push({ type: 'segment.upserted', segment: this.toSegment(s) })
  }

  private toSegment(s: SegState): Segment {
    return {
      id: s.id,
      sessionId: this.sessionId,
      track: s.track,
      speaker: speakerForTrack(s.track),
      startMs: s.published?.startMs ?? s.startMs,
      endMs: s.published?.endMs ?? s.endMs,
      text: s.published?.text ?? '',
      quality: s.status === 'final' ? 'final' : 'live',
      revision: Math.max(1, s.revision),
      confidence: s.status === 'final' ? s.confidence : null,
    }
  }

  private clearPartials(out: ReconcilerOutput[]): void {
    for (const [track, t] of this.tracks) {
      t.partialWords = []
      if (!t.lastPartialText) continue
      t.lastPartialText = ''
      out.push({
        type: 'transcript.partial',
        track,
        speaker: speakerForTrack(track),
        startMs: t.nowMs,
        text: '',
      })
    }
  }
}
