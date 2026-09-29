// The Hungarian algorithm, for mapping re-clustered speakers onto the ids a session already shows.
// (testkit's DER has its own copy on purpose: the metric must not share code with what it measures.)

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
