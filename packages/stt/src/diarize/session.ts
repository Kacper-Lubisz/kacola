import {
  agglomerate,
  cosine,
  DEFAULT_CLUSTER_THRESHOLD,
  DEFAULT_VOICE_THRESHOLD,
  type KnownVoice,
  normalize,
  OnlineClusterer,
  stabilise,
} from './clustering.ts'
import type {
  ClusterInfo,
  DiarizationSession,
  DiarizationSessionOptions,
  DiarizerProvider,
  LocalTurn,
  SegmentSpan,
  SpeakerAttribution,
  SpeakerEmbedder,
  TurnDetector,
} from './types.ts'

// A-2/A-3 — diarization from an embedding model (+ an optional local turn detector): the provider the
// daemon uses with sherpa-onnx, and the one tests drive with fake embedders.
//
//   changes()  a closed far-end segment long enough to hold two people is run through the turn
//              detector; stable runs of a different speaker become split points
//   assign()   one embedding per (split) segment, clustered online — ids are stable for the session
//   finish()   average-linkage re-clustering of every embedding, mapped back onto the online ids

export type EmbeddingDiarizerOptions = {
  embedder: SpeakerEmbedder
  turns?: TurnDetector | null
  /** Online: cosine similarity needed to join an existing speaker. */
  threshold?: number
  /** End of session: average-linkage threshold, or null to keep the online clustering. */
  reclusterThreshold?: number | null
  /** Segments shorter than this never found a speaker nor move one (too little voice to trust). */
  minFoundMs?: number
  /** Segments shorter than this get no embedding at all: they follow the previous far-end speaker. */
  minEmbedMs?: number
  /** Only segments at least this long are checked for a change of speaker. */
  splitMinMs?: number
  /** A split never leaves a piece shorter than this. */
  minTurnMs?: number
  voiceThreshold?: number
}

export const DIARIZATION_DEFAULTS = {
  threshold: DEFAULT_CLUSTER_THRESHOLD,
  reclusterThreshold: 0.5,
  minFoundMs: 1000,
  minEmbedMs: 300,
  splitMinMs: 2000,
  minTurnMs: 700,
  voiceThreshold: DEFAULT_VOICE_THRESHOLD,
} as const

export class EmbeddingDiarizer implements DiarizerProvider {
  readonly id: string
  readonly embeddingModel: string
  private readonly opts: EmbeddingDiarizerOptions

  constructor(opts: EmbeddingDiarizerOptions) {
    this.opts = opts
    this.embeddingModel = opts.embedder.modelId
    this.id = [opts.turns?.modelId, opts.embedder.modelId].filter(Boolean).join('+')
  }

  createSession(o: DiarizationSessionOptions = {}): DiarizationSession {
    return new EmbeddingDiarizationSession(this.opts, o.voices ?? [])
  }

  close(): void {
    this.opts.embedder.close?.()
    this.opts.turns?.close?.()
  }
}

type Item = {
  segmentId: string
  embedding: Float32Array | null
  weightMs: number
  cluster: number
}

class EmbeddingDiarizationSession implements DiarizationSession {
  readonly embeddingModel: string
  private readonly o: Required<Omit<EmbeddingDiarizerOptions, 'turns'>> & { turns: TurnDetector | null }
  private readonly voices: readonly KnownVoice[]
  private readonly clusterer: OnlineClusterer
  private readonly items: Item[] = []
  private reclustered: ClusterInfo[] | null = null
  private last: number | null = null

  constructor(opts: EmbeddingDiarizerOptions, voices: readonly KnownVoice[]) {
    this.o = {
      ...DIARIZATION_DEFAULTS,
      ...Object.fromEntries(Object.entries(opts).filter(([, v]) => v !== undefined)),
      turns: opts.turns ?? null,
    } as EmbeddingDiarizationSession['o']
    this.embeddingModel = opts.embedder.modelId
    this.voices = voices
    this.clusterer = new OnlineClusterer({
      threshold: this.o.threshold,
      minFoundMs: this.o.minFoundMs,
      voices,
      voiceThreshold: this.o.voiceThreshold,
    })
  }

  async changes(span: { startMs: number; endMs: number }, samples: Float32Array): Promise<number[]> {
    if (!this.o.turns || span.endMs - span.startMs < this.o.splitMinMs) return []
    const local = await this.o.turns.turns(samples)
    return changePoints(local, span.endMs - span.startMs, this.o.minTurnMs).map((ms) => span.startMs + ms)
  }

  async assign(span: SegmentSpan, samples: Float32Array): Promise<{ cluster: number; created: boolean }> {
    const dur = Math.max(0, span.endMs - span.startMs)
    let embedding: Float32Array | null = null
    if (dur >= this.o.minEmbedMs || this.last === null) {
      try {
        embedding = normalize(await this.o.embedder.embed(samples))
        if (!embedding.some((x) => x !== 0)) embedding = null
      } catch {
        embedding = null
      }
    }
    let cluster: number
    let created = false
    if (embedding) {
      const a = this.clusterer.assign(embedding, dur)
      cluster = a.cluster
      created = a.created
    } else if (this.last !== null) cluster = this.last
    else {
      // nothing to go on and nobody yet: a speaker of its own, to be sorted out at the end
      const a = this.clusterer.assign(new Float32Array(0), 0)
      cluster = a.cluster
      created = a.created
    }
    this.items.push({ segmentId: span.segmentId, embedding, weightMs: dur, cluster })
    this.last = cluster
    return { cluster, created }
  }

  async finish(): Promise<SpeakerAttribution[]> {
    const thr = this.o.reclusterThreshold
    const scored = this.items.filter((i) => i.embedding && i.weightMs >= this.o.minFoundMs)
    if (thr === null || scored.length < 2) return []
    const offline = agglomerate(
      scored.map((i) => ({ embedding: i.embedding!, weightMs: i.weightMs })),
      thr,
    )
    const nextId = Math.max(-1, ...this.clusterer.clusters.map((c) => c.id)) + 1
    const mapped = stabilise(
      scored.map((i) => i.cluster),
      offline,
      scored.map((i) => i.weightMs),
      nextId,
    )
    const next = new Map<Item, number>()
    scored.forEach((it, k) => {
      next.set(it, mapped[k]!)
    })
    // centroids of the new clusters, for everything too short to have been clustered
    const sums = new Map<number, { sum: Float32Array; w: number; n: number }>()
    for (const [it, c] of next) {
      const acc = sums.get(c) ?? { sum: new Float32Array(it.embedding!.length), w: 0, n: 0 }
      for (let i = 0; i < acc.sum.length; i++) acc.sum[i]! += it.embedding![i]! * it.weightMs
      acc.w += it.weightMs
      sums.set(c, acc)
    }
    let prev: number | null = null
    for (const it of this.items) {
      if (!next.has(it)) {
        let best: number | null = null
        let bs = -Infinity
        if (it.embedding)
          for (const [c, acc] of sums) {
            const s = cosine(acc.sum, it.embedding)
            if (s > bs) {
              bs = s
              best = c
            }
          }
        next.set(it, best ?? prev ?? it.cluster)
      }
      prev = next.get(it)!
    }
    const changed: SpeakerAttribution[] = []
    for (const it of this.items) {
      const c = next.get(it)!
      if (c !== it.cluster) changed.push({ segmentId: it.segmentId, cluster: c })
      it.cluster = c
      const acc = sums.get(c)
      if (acc) acc.n++
    }
    const online = new Map(this.clusterer.clusters.map((c) => [c.id, c.voiceprintId]))
    const taken = new Set<string>()
    this.reclustered = [...sums.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([cluster, acc]) => {
        const centroid = normalize(acc.sum)
        let voiceprintId = online.get(cluster) ?? null
        if (voiceprintId && taken.has(voiceprintId)) voiceprintId = null
        if (voiceprintId) taken.add(voiceprintId)
        return { cluster, centroid, weightMs: acc.w, segments: acc.n, voiceprintId }
      })
    // a cluster born at re-clustering can still be recognised
    for (const c of this.reclustered)
      if (!c.voiceprintId) {
        let best: { id: string; s: number } | null = null
        for (const v of this.voices) {
          if (taken.has(v.id) || v.embedding.length !== c.centroid.length) continue
          const s = cosine(c.centroid, v.embedding)
          if (s >= this.o.voiceThreshold && (!best || s > best.s)) best = { id: v.id, s }
        }
        if (best) {
          c.voiceprintId = best.id
          taken.add(best.id)
        }
      }
    return changed
  }

  clusters(): ClusterInfo[] {
    if (this.reclustered) return this.reclustered
    return this.clusterer.clusters
      .filter((c) => c.sum.length > 0)
      .map((c) => ({
        cluster: c.id,
        centroid: normalize(c.sum),
        weightMs: c.weightMs,
        segments: c.segments,
        voiceprintId: c.voiceprintId,
      }))
  }
}

/**
 * Split points from local turns: at 20 ms resolution, who is the dominant speaker (the one already
 * talking wins an overlap; silence belongs to whoever spoke last); runs shorter than `minTurnMs` are
 * absorbed by their neighbours; every remaining change of speaker is a split point, and no piece at
 * either end is shorter than `minTurnMs`.
 */
export function changePoints(turns: readonly LocalTurn[], durationMs: number, minTurnMs: number): number[] {
  const step = 20
  const n = Math.ceil(durationMs / step)
  if (n <= 0 || !turns.length) return []
  const who = new Array<number>(n).fill(-1)
  let cur = -1
  for (let f = 0; f < n; f++) {
    const t = f * step + step / 2
    const active = turns.filter((x) => x.startMs <= t && x.endMs > t).map((x) => x.speaker)
    if (active.length && !active.includes(cur)) cur = active[0]!
    who[f] = cur
  }
  const first = who.findIndex((x) => x >= 0)
  if (first < 0) return []
  for (let f = 0; f < first; f++) who[f] = who[first]!
  // runs
  type Run = { speaker: number; from: number; to: number }
  let runs: Run[] = []
  for (let f = 0; f < n; f++) {
    const last = runs.at(-1)
    if (last && last.speaker === who[f]) last.to = f + 1
    else runs.push({ speaker: who[f]!, from: f, to: f + 1 })
  }
  const minFrames = Math.ceil(minTurnMs / step)
  // absorb short runs into the longer neighbour until none is left (or one run remains)
  for (;;) {
    const i = runs.findIndex((r) => r.to - r.from < minFrames)
    if (i < 0 || runs.length === 1) break
    const prev = runs[i - 1]
    const next = runs[i + 1]
    const into = !next || (prev && prev.to - prev.from >= next.to - next.from) ? prev! : next
    into.from = Math.min(into.from, runs[i]!.from)
    into.to = Math.max(into.to, runs[i]!.to)
    runs.splice(i, 1)
    // neighbours that now share a speaker become one run
    runs = runs.reduce<Run[]>((acc, r) => {
      const l = acc.at(-1)
      if (l && l.speaker === r.speaker) l.to = r.to
      else acc.push({ ...r })
      return acc
    }, [])
  }
  return runs.slice(1).map((r) => r.from * step)
}
