import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

// Accuracy baselines with tolerance bands (V-2b). Models are allowed to disagree with themselves a
// little; they are not allowed to get worse beyond the band without a reviewed baseline change.
// Baselines are committed JSON, one per fixture × pipeline configuration.

export type Direction = 'lower-is-better' | 'higher-is-better'

/** A metric may move by max(abs, rel × baseline) in the bad direction before it counts as a regression. */
export type Band = { abs?: number; rel?: number; direction?: Direction }

export type Baseline = {
  fixture: string
  /** What produced the numbers, e.g. "live=…+final=…". */
  config: string
  metrics: Record<string, number>
  bands: Record<string, Band>
  recordedAt: string
  /** Free text: machine, sherpa version, why the baseline last changed. */
  notes?: string
}

export type ComparisonRow = {
  metric: string
  baseline: number
  actual: number
  /** Worst acceptable value. */
  limit: number
  ok: boolean
  /** Better than the baseline by more than the band — worth recording a new baseline. */
  improved: boolean
}

export type Comparison = { ok: boolean; rows: ComparisonRow[]; failures: string[] }

export function compareToBaseline(baseline: Baseline, actual: Record<string, number>): Comparison {
  const rows: ComparisonRow[] = []
  const failures: string[] = []
  for (const [metric, base] of Object.entries(baseline.metrics)) {
    const band = baseline.bands[metric] ?? {}
    const slack = Math.max(band.abs ?? 0, (band.rel ?? 0) * Math.abs(base))
    const lower = (band.direction ?? 'lower-is-better') === 'lower-is-better'
    const limit = lower ? base + slack : base - slack
    const value = actual[metric]
    if (value === undefined || !Number.isFinite(value)) {
      failures.push(`${metric}: no measurement (baseline ${base})`)
      rows.push({ metric, baseline: base, actual: Number.NaN, limit, ok: false, improved: false })
      continue
    }
    const ok = lower ? value <= limit : value >= limit
    const improved = lower ? value < base - slack : value > base + slack
    rows.push({ metric, baseline: base, actual: value, limit, ok, improved })
    if (!ok)
      failures.push(
        `${metric}: ${fmt(value)} is worse than baseline ${fmt(base)} beyond the band (limit ${fmt(limit)})`,
      )
  }
  return { ok: failures.length === 0, rows, failures }
}

const fmt = (n: number) => (Math.abs(n) < 10 ? n.toFixed(4) : n.toFixed(1))

/** Where committed baselines live. */
export const BASELINES_DIR = join(import.meta.dirname, '..', '..', 'fixtures', 'baselines')

export function baselinePath(fixture: string, config: string, dir = BASELINES_DIR): string {
  const safe = config.replace(/[^a-zA-Z0-9._-]+/g, '_')
  return join(dir, `${fixture}__${safe}.json`)
}

export function readBaseline(fixture: string, config: string, dir = BASELINES_DIR): Baseline | null {
  const p = baselinePath(fixture, config, dir)
  if (!existsSync(p)) return null
  return JSON.parse(readFileSync(p, 'utf8')) as Baseline
}

export function writeBaseline(b: Baseline, dir = BASELINES_DIR): string {
  const p = baselinePath(b.fixture, b.config, dir)
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, `${JSON.stringify(b, null, 2)}\n`)
  return p
}

/** `GNOMEOLA_UPDATE_BASELINES=1` turns a baseline check into a (reviewable) baseline write. */
export const updatingBaselines = (env: NodeJS.ProcessEnv = process.env): boolean =>
  env.GNOMEOLA_UPDATE_BASELINES === '1'
