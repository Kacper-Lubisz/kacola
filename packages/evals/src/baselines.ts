import type { Scorecard } from '@gnomeola/testkit/evals'
import type { Band } from '@gnomeola/testkit/metrics'

// Tolerance bands for committed baselines of deterministic runs. Lower-is-better metrics (errors,
// calibration error, latency, leaks) may rise, higher-is-better ones may fall, by the band before a run
// counts as a regression. Offline numbers are deterministic on one machine; the bands absorb float noise
// in ONNX inference across CPUs, nothing more.

const LOWER = /(ece|brier|latency|early|leak|hallucinat|forbidden|injected|cost)/i
const COUNT = /^(items|autoCheckoffs|suggestions)$/

export function bandsFor(sc: Scorecard): Record<string, Band> {
  const out: Record<string, Band> = {}
  for (const [k, v] of Object.entries(sc.metrics)) {
    if (typeof v !== 'number' || COUNT.test(k)) continue
    if (/latency/i.test(k)) out[k] = { abs: 1_000, direction: 'lower-is-better' }
    else if (/cost/i.test(k)) continue
    else if (LOWER.test(k)) out[k] = { abs: Math.abs(v) >= 1 ? 1 : 0.03, direction: 'lower-is-better' }
    else out[k] = { abs: 0.03, direction: 'higher-is-better' }
  }
  return out
}
