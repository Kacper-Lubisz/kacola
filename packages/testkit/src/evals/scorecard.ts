import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  type Band,
  type Baseline,
  type Comparison,
  compareToBaseline,
  readBaseline,
  writeBaseline,
} from '../metrics/baseline.ts'

// A scorecard: one eval suite × one provider configuration. Printed as a table, written to
// __artifacts__/evals/<suite>/<config>.json, and — where the numbers are deterministic (the on-device
// provider, replayed cassettes) — compared against a committed baseline with tolerance bands.

export type EvalMode =
  /** Deterministic, no network: the on-device provider or replayed cassettes. */
  | 'offline'
  /** A scripted fake server: exercises the provider's plumbing; the numbers say nothing about quality. */
  | 'fake'
  /** A real hosted API, key-gated. */
  | 'live'

export type Budget = {
  name: string
  metric: string
  op: '>=' | '<='
  threshold: number
  /** Budgets from the brief are only asserted where they are meaningful (live / real models). */
  enforced: boolean
}

export type Scorecard = {
  suite: string
  provider: string
  model: string
  mode: EvalMode
  dataset: { name: string; n: number }
  metrics: Record<string, number | null>
  budgets: (Budget & { value: number | null; passed: boolean | null })[]
  cost: { usd: number | null; calls: number; inputTokens: number; outputTokens: number }
  /** Wall-clock per decision round (p50/p90 ms). */
  latency: { p50: number | null; p90: number | null }
  notes: string[]
  /** Set when the run could not happen (no key, quota): numbers are then absent, never faked. */
  skipped: string | null
  generatedAt: string
  /** Per-case / per-item outcomes, for reading failures (artifact only; never printed in full). */
  details?: unknown[]
}

export const ARTIFACTS_DIR = join(import.meta.dirname, '..', '..', '..', '..', '__artifacts__', 'evals')
export const EVAL_BASELINES_DIR = join(import.meta.dirname, '..', '..', 'fixtures', 'baselines', 'evals')

export function checkBudgets(
  metrics: Scorecard['metrics'],
  budgets: readonly Budget[],
): Scorecard['budgets'] {
  return budgets.map((b) => {
    const value = metrics[b.metric] ?? null
    const passed = value === null ? null : b.op === '>=' ? value >= b.threshold : value <= b.threshold
    return { ...b, value, passed }
  })
}

export const configOf = (sc: Pick<Scorecard, 'provider' | 'model' | 'mode'>) =>
  `${sc.mode}_${sc.provider}_${sc.model}`

const f = (v: number | null | undefined) =>
  v === null || v === undefined
    ? '—'
    : Number.isInteger(v)
      ? String(v)
      : Math.abs(v) >= 100
        ? v.toFixed(0)
        : v.toFixed(3)

export function formatScorecard(sc: Scorecard): string {
  const head = `── ${sc.suite} · ${sc.provider} (${sc.model}) · ${sc.mode} · ${sc.dataset.name} n=${sc.dataset.n}`
  if (sc.skipped) return `${head}\n   SKIPPED: ${sc.skipped}\n`
  const lines = [head]
  const keys = Object.keys(sc.metrics)
  const w = Math.max(...keys.map((k) => k.length), 8)
  for (const k of keys) lines.push(`   ${k.padEnd(w)}  ${f(sc.metrics[k])}`)
  for (const b of sc.budgets)
    lines.push(
      `   budget ${b.name}: ${b.metric} ${b.op} ${b.threshold} → ${f(b.value)} ${b.passed === null ? '(n/a)' : b.passed ? 'PASS' : b.enforced ? 'FAIL' : 'miss (not enforced)'}`,
    )
  lines.push(
    `   cost ${sc.cost.usd === null ? 'unknown' : `$${sc.cost.usd.toFixed(5)}`} · ${sc.cost.calls} calls · ${sc.cost.inputTokens}/${sc.cost.outputTokens} tok · round p50 ${f(sc.latency.p50)} ms p90 ${f(sc.latency.p90)} ms`,
  )
  for (const n of sc.notes) lines.push(`   note: ${n}`)
  return `${lines.join('\n')}\n`
}

export function writeScorecard(sc: Scorecard, dir = ARTIFACTS_DIR): string {
  const d = join(dir, sc.suite)
  mkdirSync(d, { recursive: true })
  const p = join(d, `${configOf(sc).replace(/[^a-zA-Z0-9._-]+/g, '_')}.json`)
  writeFileSync(p, `${JSON.stringify(sc, null, 2)}\n`)
  return p
}

/**
 * Compare a deterministic scorecard with its committed baseline (KACOLA_UPDATE_BASELINES=1 records a
 * new one). Returns null when there is no baseline yet and none is being recorded.
 */
export function checkBaseline(
  sc: Scorecard,
  bands: Record<string, Band>,
  opts: { dir?: string; update?: boolean; notes?: string } = {},
): Comparison | null {
  const dir = opts.dir ?? EVAL_BASELINES_DIR
  const config = configOf(sc)
  const metrics = Object.fromEntries(
    Object.entries(sc.metrics).filter(
      (e): e is [string, number] => typeof e[1] === 'number' && e[0] in bands,
    ),
  )
  const update = opts.update ?? process.env.KACOLA_UPDATE_BASELINES === '1'
  if (update) {
    const b: Baseline = {
      fixture: sc.suite,
      config,
      metrics,
      bands,
      recordedAt: new Date().toISOString(),
      notes: opts.notes ?? `${sc.dataset.name} n=${sc.dataset.n}`,
    }
    writeBaseline(b, dir)
  }
  const base = readBaseline(sc.suite, config, dir)
  return base ? compareToBaseline(base, metrics) : null
}

/** Summary line per scorecard, for a combined report at the end of an eval run. */
export function summaryTable(cards: readonly Scorecard[], metrics: readonly string[]): string {
  const rows = cards.map((c) => [
    c.suite,
    `${c.provider}/${c.mode}`,
    ...(c.skipped ? metrics.map(() => 'skip') : metrics.map((m) => f(c.metrics[m]))),
  ])
  const header = ['suite', 'provider', ...metrics]
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((r) => (r[i] ?? '').length)))
  const line = (r: string[]) => r.map((c, i) => c.padEnd(widths[i]!)).join('  ')
  return [line(header), ...rows.map(line)].join('\n')
}
