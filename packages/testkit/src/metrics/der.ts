// Diarization error rate (A-7). The NIST definition, computed exactly over the region sweep rather than
// on frames:
//
//   DER = (missed + false alarm + confusion) / scored reference speech
//
// The timeline is cut at every turn boundary. In a region of length d with R reference speakers and H
// hypothesis speakers, of which C are pairs the optimal mapping says are the same person:
//
//   scored += d·R    missed += d·max(0, R−H)    falseAlarm += d·max(0, H−R)    confusion += d·(min(R,H)−C)
//
// The mapping is one-to-one between reference and hypothesis speakers and maximises the total time
// they agree on (the Hungarian algorithm; unmapped hypothesis speakers count as confusion wherever they
// speak over reference speech). `collarMs` removes ±collar around every reference boundary from
// scoring (0.25 s is the customary forgiveness for boundary jitter); `skipOverlap` scores only regions
// where at most one reference speaker is talking.

export type Turn = { speaker: string; startMs: number; endMs: number }

export type DerOptions = {
  collarMs?: number
  skipOverlap?: boolean
}

export type DerResult = {
  /** (missed + falseAlarm + confusion) / scoredMs; 0 when there is nothing to score and nothing said. */
  der: number
  missedMs: number
  falseAlarmMs: number
  confusionMs: number
  /** Reference speaker-time scored (Σ d·R). */
  scoredMs: number
  /** hypothesis speaker → reference speaker, for every mapped hypothesis speaker. */
  mapping: Record<string, string>
}

type Region = { startMs: number; endMs: number; ref: Set<string>; hyp: Set<string> }

function clean(turns: readonly Turn[]): Turn[] {
  return turns.filter((t) => Number.isFinite(t.startMs) && Number.isFinite(t.endMs) && t.endMs > t.startMs)
}

/** Cut the timeline at every boundary and list who is talking in each piece (collar zones removed). */
function regions(ref: readonly Turn[], hyp: readonly Turn[], opts: DerOptions): Region[] {
  const collar = Math.max(0, opts.collarMs ?? 0)
  const noScore: [number, number][] = []
  if (collar > 0)
    for (const t of ref) {
      noScore.push([t.startMs - collar, t.startMs + collar])
      noScore.push([t.endMs - collar, t.endMs + collar])
    }
  const cuts = new Set<number>()
  for (const t of [...ref, ...hyp]) {
    cuts.add(t.startMs)
    cuts.add(t.endMs)
  }
  for (const [a, b] of noScore) {
    cuts.add(a)
    cuts.add(b)
  }
  const points = [...cuts].sort((a, b) => a - b)
  const out: Region[] = []
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!
    const b = points[i]!
    if (b <= a) continue
    const mid = (a + b) / 2
    if (noScore.some(([x, y]) => mid > x && mid < y)) continue
    const active = (list: readonly Turn[]) =>
      new Set(list.filter((t) => t.startMs <= a && t.endMs >= b).map((t) => t.speaker))
    const r = active(ref)
    if (opts.skipOverlap && r.size > 1) continue
    const h = active(hyp)
    if (!r.size && !h.size) continue
    out.push({ startMs: a, endMs: b, ref: r, hyp: h })
  }
  return out
}

export function der(
  reference: readonly Turn[],
  hypothesis: readonly Turn[],
  opts: DerOptions = {},
): DerResult {
  const ref = clean(reference)
  const hyp = clean(hypothesis)
  const regs = regions(ref, hyp, opts)
  const refSpk = [...new Set(ref.map((t) => t.speaker))].sort()
  const hypSpk = [...new Set(hyp.map((t) => t.speaker))].sort()

  // agreement[h][r] = time both h and r are talking (over scored regions)
  const agree = hypSpk.map(() => refSpk.map(() => 0))
  for (const g of regs) {
    const d = g.endMs - g.startMs
    hypSpk.forEach((h, i) => {
      if (!g.hyp.has(h)) return
      refSpk.forEach((r, j) => {
        if (g.ref.has(r)) agree[i]![j]! += d
      })
    })
  }
  const assignment = maxWeightMatching(agree)
  const mapping: Record<string, string> = {}
  assignment.forEach((j, i) => {
    if (j >= 0 && agree[i]![j]! > 0) mapping[hypSpk[i]!] = refSpk[j]!
  })

  let scored = 0
  let missed = 0
  let fa = 0
  let confusion = 0
  for (const g of regs) {
    const d = g.endMs - g.startMs
    const R = g.ref.size
    const H = g.hyp.size
    let correct = 0
    for (const h of g.hyp) {
      const r = mapping[h]
      if (r !== undefined && g.ref.has(r)) correct++
    }
    scored += d * R
    missed += d * Math.max(0, R - H)
    fa += d * Math.max(0, H - R)
    confusion += d * (Math.min(R, H) - correct)
  }
  const errors = missed + fa + confusion
  return {
    der: scored > 0 ? errors / scored : errors > 0 ? Number.POSITIVE_INFINITY : 0,
    missedMs: missed,
    falseAlarmMs: fa,
    confusionMs: confusion,
    scoredMs: scored,
    mapping,
  }
}

/**
 * Hungarian algorithm (Kuhn–Munkres, O(n³)) on a rectangular weight matrix: returns, for each row, the
 * column it is matched to (or -1), maximising the total weight of the matching.
 */
export function maxWeightMatching(weights: readonly (readonly number[])[]): number[] {
  const rows = weights.length
  const cols = rows ? weights[0]!.length : 0
  if (!rows || !cols) return new Array(rows).fill(-1)
  const n = Math.max(rows, cols)
  let max = 0
  for (const row of weights) for (const w of row) max = Math.max(max, w)
  // Minimise cost = max − weight on a square matrix padded with zero-weight (cost max) cells.
  const cost = (i: number, j: number) => max - (i < rows && j < cols ? weights[i]![j]! : 0)
  const u = new Array<number>(n + 1).fill(0)
  const v = new Array<number>(n + 1).fill(0)
  const p = new Array<number>(n + 1).fill(0) // p[j] = row matched to column j (1-based), 0 = none
  const way = new Array<number>(n + 1).fill(0)
  for (let i = 1; i <= n; i++) {
    p[0] = i
    let j0 = 0
    const minv = new Array<number>(n + 1).fill(Number.POSITIVE_INFINITY)
    const used = new Array<boolean>(n + 1).fill(false)
    do {
      used[j0] = true
      const i0 = p[j0]!
      let delta = Number.POSITIVE_INFINITY
      let j1 = 0
      for (let j = 1; j <= n; j++) {
        if (used[j]) continue
        const cur = cost(i0 - 1, j - 1) - u[i0]! - v[j]!
        if (cur < minv[j]!) {
          minv[j] = cur
          way[j] = j0
        }
        if (minv[j]! < delta) {
          delta = minv[j]!
          j1 = j
        }
      }
      for (let j = 0; j <= n; j++) {
        if (used[j]) {
          u[p[j]!]! += delta
          v[j]! -= delta
        } else minv[j]! -= delta
      }
      j0 = j1
    } while (p[j0] !== 0)
    do {
      const j1 = way[j0]!
      p[j0] = p[j1]!
      j0 = j1
    } while (j0)
  }
  const out = new Array<number>(rows).fill(-1)
  for (let j = 1; j <= n; j++) {
    const i = p[j]! - 1
    if (i >= 0 && i < rows && j - 1 < cols) out[i] = j - 1
  }
  return out
}
