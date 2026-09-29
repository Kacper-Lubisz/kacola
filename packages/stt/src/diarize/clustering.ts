// A-3 — speaker clustering over embeddings, pure and deterministic.
//
// Online (during the meeting): each closed far-end segment's embedding joins the most similar cluster
// if it is similar enough, else founds a new one — so the number of speakers is estimated as the
// meeting goes, and a cluster's id never changes once issued. Short segments carry little identity:
// they may join a cluster but never found one (unless there is none yet) and never move a centroid.
//
// Offline (at the end): average-linkage agglomerative clustering over every segment's embedding, then
// the new clusters are mapped back onto the online ids by the time they share, so what a reader has
// been looking at all meeting keeps its name wherever the two agree.

import { maxWeightMatching } from './matching.ts'

export type Vec = Float32Array | readonly number[]

export function norm(v: Vec): number {
  let s = 0
  for (let i = 0; i < v.length; i++) s += v[i]! * v[i]!
  return Math.sqrt(s)
}

export function cosine(a: Vec, b: Vec): number {
  if (a.length !== b.length) throw new Error(`dimension mismatch: ${a.length} vs ${b.length}`)
  let dot = 0
  for (let i = 0; i < a.length; i++) dot += a[i]! * b[i]!
  const d = norm(a) * norm(b)
  return d > 0 ? dot / d : 0
}

export function normalize(v: Vec): Float32Array {
  const n = norm(v)
  const out = new Float32Array(v.length)
  if (n > 0) for (let i = 0; i < v.length; i++) out[i] = v[i]! / n
  return out
}

/** A person remembered from earlier sessions (A-6). */
export type KnownVoice = { id: string; embedding: Vec }

export type ClusterState = {
  id: number
  /** Duration-weighted sum of unit embeddings; its direction is the centroid. */
  sum: Float32Array
  weightMs: number
  segments: number
  /** The known voice this cluster was recognised as, if any. */
  voiceprintId: string | null
}

export type OnlineClustererOptions = {
  /** Cosine similarity to a centroid needed to join it. */
  threshold?: number
  /** Segments shorter than this can join a cluster but never found one or move a centroid. */
  minFoundMs?: number
  voices?: readonly KnownVoice[]
  /** Similarity between a centroid and a known voice needed to recognise them. */
  voiceThreshold?: number
}

export type Assignment = { cluster: number; similarity: number; created: boolean }

export const DEFAULT_CLUSTER_THRESHOLD = 0.4
export const DEFAULT_VOICE_THRESHOLD = 0.6

export class OnlineClusterer {
  private readonly threshold: number
  private readonly minFoundMs: number
  private readonly voices: readonly KnownVoice[]
  private readonly voiceThreshold: number
  private readonly list: ClusterState[] = []

  constructor(opts: OnlineClustererOptions = {}) {
    this.threshold = opts.threshold ?? DEFAULT_CLUSTER_THRESHOLD
    this.minFoundMs = opts.minFoundMs ?? 1000
    this.voices = opts.voices ?? []
    this.voiceThreshold = opts.voiceThreshold ?? DEFAULT_VOICE_THRESHOLD
  }

  get clusters(): readonly ClusterState[] {
    return this.list
  }

  centroid(id: number): Float32Array {
    const c = this.list.find((x) => x.id === id)
    if (!c) throw new Error(`no cluster ${id}`)
    return normalize(c.sum)
  }

  /** The best cluster for an embedding without changing anything, or null when there are none. */
  nearest(emb: Vec): { cluster: number; similarity: number } | null {
    let best: { cluster: number; similarity: number } | null = null
    for (const c of this.list) {
      if (c.sum.length !== emb.length) continue // a placeholder for speech too short to embed
      const s = cosine(c.sum, emb)
      if (!best || s > best.similarity) best = { cluster: c.id, similarity: s }
    }
    return best
  }

  assign(embedding: Vec, durationMs: number): Assignment {
    const e = normalize(embedding)
    const near = this.nearest(e)
    const short = durationMs < this.minFoundMs
    if (near && (near.similarity >= this.threshold || short)) {
      const c = this.list.find((x) => x.id === near.cluster)!
      c.segments++
      if (!short) {
        for (let i = 0; i < e.length; i++) c.sum[i]! += e[i]! * durationMs
        c.weightMs += durationMs
        this.recognise(c)
      }
      return { cluster: c.id, similarity: near.similarity, created: false }
    }
    const c: ClusterState = {
      id: this.list.length,
      sum: e.map((x) => x * Math.max(1, durationMs)),
      weightMs: Math.max(1, durationMs),
      segments: 1,
      voiceprintId: null,
    }
    this.list.push(c)
    this.recognise(c)
    return { cluster: c.id, similarity: near?.similarity ?? 0, created: true }
  }

  /**
   * Link a cluster to the known voice it matches best, if that voice is not already some other
   * cluster's. Once linked a cluster stays linked (a person's name does not flicker).
   */
  private recognise(c: ClusterState): void {
    if (c.voiceprintId || !this.voices.length) return
    const taken = new Set(this.list.map((x) => x.voiceprintId).filter(Boolean))
    let best: { id: string; s: number } | null = null
    for (const v of this.voices) {
      if (taken.has(v.id) || v.embedding.length !== c.sum.length) continue
      const s = cosine(c.sum, v.embedding)
      if (s >= this.voiceThreshold && (!best || s > best.s)) best = { id: v.id, s }
    }
    if (best) c.voiceprintId = best.id
  }
}

// ------------------------------------------------------------------------------------------- offline

export type Item = { embedding: Vec; weightMs: number }

/**
 * Average-linkage agglomerative clustering on cosine similarity: repeatedly merge the two most similar
 * clusters while their average pairwise similarity is at least `threshold`. Returns a label per item
 * (0..k-1, in order of first appearance). O(n³) on segments — a meeting has hundreds, not thousands.
 */
export function agglomerate(items: readonly Item[], threshold: number): number[] {
  const n = items.length
  if (!n) return []
  const unit = items.map((x) => normalize(x.embedding))
  const sim: number[][] = unit.map((a) => unit.map((b) => cosine(a, b)))
  // clusters as member lists; avg[i][j] maintained via sums
  let groups = unit.map((_, i) => [i])
  const pairSum = (a: number[], b: number[]) => {
    let s = 0
    for (const i of a) for (const j of b) s += sim[i]![j]!
    return s / (a.length * b.length)
  }
  for (;;) {
    let best = -Infinity
    let bi = -1
    let bj = -1
    for (let i = 0; i < groups.length; i++)
      for (let j = i + 1; j < groups.length; j++) {
        const s = pairSum(groups[i]!, groups[j]!)
        if (s > best) {
          best = s
          bi = i
          bj = j
        }
      }
    if (bi < 0 || best < threshold) break
    groups[bi] = [...groups[bi]!, ...groups[bj]!]
    groups = groups.filter((_, k) => k !== bj)
  }
  const label = new Array<number>(n).fill(-1)
  groups
    .map((g) => [...g].sort((a, b) => a - b))
    .sort((a, b) => a[0]! - b[0]!)
    .forEach((g, k) => {
      for (const i of g) label[i] = k
    })
  return label
}

/**
 * Map offline labels onto online cluster ids so ids stay stable: the one-to-one mapping that maximises
 * the time both agree on. Offline clusters with no partner get fresh ids after `nextId`.
 */
export function stabilise(
  online: readonly number[],
  offline: readonly number[],
  weights: readonly number[],
  nextId: number,
): number[] {
  const on = [...new Set(online)].sort((a, b) => a - b)
  const off = [...new Set(offline)].sort((a, b) => a - b)
  const w = off.map(() => on.map(() => 0))
  offline.forEach((o, i) => {
    w[off.indexOf(o)]![on.indexOf(online[i]!)]! += weights[i]!
  })
  const match = maxWeightMatching(w)
  const map = new Map<number, number>()
  let fresh = nextId
  off.forEach((o, k) => {
    const j = match[k]!
    map.set(o, j >= 0 && w[k]![j]! > 0 ? on[j]! : fresh++)
  })
  return offline.map((o) => map.get(o)!)
}
