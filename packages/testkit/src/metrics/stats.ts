/** Linear-interpolated percentile (p in [0, 100]) of a sample; NaN for an empty one. */
export function percentile(values: readonly number[], p: number): number {
  if (!values.length) return Number.NaN
  if (p < 0 || p > 100) throw new Error(`percentile out of range: ${p}`)
  const s = [...values].sort((a, b) => a - b)
  const rank = (p / 100) * (s.length - 1)
  const lo = Math.floor(rank)
  const hi = Math.ceil(rank)
  return s[lo]! + (s[hi]! - s[lo]!) * (rank - lo)
}

export type LatencySummary = { n: number; p50: number; p95: number; max: number; mean: number }

export function summarizeLatency(values: readonly number[]): LatencySummary {
  return {
    n: values.length,
    p50: percentile(values, 50),
    p95: percentile(values, 95),
    max: values.length ? Math.max(...values) : Number.NaN,
    mean: values.length ? values.reduce((a, b) => a + b, 0) / values.length : Number.NaN,
  }
}
