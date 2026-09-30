import { normalizeWords } from '../metrics/wer.ts'

// Graders for the AI evals. Pure functions over (prediction, truth) pairs; every one is unit-tested
// against hand-computed values (test/eval-graders.test.ts) so a number in a scorecard means what it says.

// ------------------------------------------------------------------------------ classification

export type BinaryCounts = { tp: number; fp: number; fn: number; tn: number }
export type BinaryScores = BinaryCounts & {
  n: number
  /** null when undefined (no positive predictions / no positive truths). */
  precision: number | null
  recall: number | null
  f1: number | null
  accuracy: number | null
}

export function binary(pairs: readonly { pred: boolean; truth: boolean }[]): BinaryScores {
  const c: BinaryCounts = { tp: 0, fp: 0, fn: 0, tn: 0 }
  for (const { pred, truth } of pairs) {
    if (pred && truth) c.tp++
    else if (pred) c.fp++
    else if (truth) c.fn++
    else c.tn++
  }
  return scores(c)
}

export function scores(c: BinaryCounts): BinaryScores {
  const n = c.tp + c.fp + c.fn + c.tn
  const precision = c.tp + c.fp ? c.tp / (c.tp + c.fp) : null
  const recall = c.tp + c.fn ? c.tp / (c.tp + c.fn) : null
  const f1 =
    precision !== null && recall !== null && precision + recall > 0
      ? (2 * precision * recall) / (precision + recall)
      : precision === null || recall === null
        ? null
        : 0
  return { ...c, n, precision, recall, f1, accuracy: n ? (c.tp + c.tn) / n : null }
}

/** Macro-averaged per-class precision/recall/F1 plus accuracy, for multi-class labels. */
export function multiclass(pairs: readonly { pred: string; truth: string }[]) {
  const classes = [...new Set(pairs.flatMap((p) => [p.pred, p.truth]))].sort()
  const perClass = Object.fromEntries(
    classes.map((k) => [k, binary(pairs.map((p) => ({ pred: p.pred === k, truth: p.truth === k })))]),
  )
  const f1s = classes.map((k) => perClass[k]!.f1 ?? 0)
  return {
    n: pairs.length,
    accuracy: pairs.length ? pairs.filter((p) => p.pred === p.truth).length / pairs.length : null,
    macroF1: classes.length ? f1s.reduce((a, b) => a + b, 0) / classes.length : null,
    perClass,
  }
}

// ------------------------------------------------------------------------------ calibration

export type CalibrationBin = {
  lo: number
  hi: number
  count: number
  meanConfidence: number
  accuracy: number
}
export type Calibration = { n: number; ece: number | null; brier: number | null; bins: CalibrationBin[] }

/**
 * Expected calibration error over equal-width confidence bins (the top-label confidence of each
 * prediction vs whether it was right), and the multi-class Brier score (mean over items of
 * Σ_k (p_k − y_k)², 0 = perfect, 2 = confidently wrong). Brier needs full distributions; ECE only the
 * top-label confidence.
 */
export function calibration(
  items: readonly { probs: Record<string, number>; truth: string }[],
  nBins = 10,
): Calibration {
  if (!items.length) return { n: 0, ece: null, brier: null, bins: [] }
  const bins = Array.from({ length: nBins }, (_, i) => ({
    lo: i / nBins,
    hi: (i + 1) / nBins,
    sumC: 0,
    sumA: 0,
    count: 0,
  }))
  let brier = 0
  for (const { probs, truth } of items) {
    const keys = new Set([...Object.keys(probs), truth])
    for (const k of keys) brier += ((probs[k] ?? 0) - (k === truth ? 1 : 0)) ** 2
    const [top, conf] = Object.entries(probs).sort((a, b) => b[1] - a[1])[0] ?? ['', 0]
    const b = bins[Math.min(nBins - 1, Math.floor(conf * nBins))]!
    b.count++
    b.sumC += conf
    b.sumA += top === truth ? 1 : 0
  }
  const n = items.length
  const ece = bins.reduce(
    (acc, b) => acc + (b.count ? (b.count / n) * Math.abs(b.sumA / b.count - b.sumC / b.count) : 0),
    0,
  )
  return {
    n,
    ece,
    brier: brier / n,
    bins: bins
      .filter((b) => b.count)
      .map((b) => ({
        lo: b.lo,
        hi: b.hi,
        count: b.count,
        meanConfidence: b.sumC / b.count,
        accuracy: b.sumA / b.count,
      })),
  }
}

/** Calibration of yes/no probabilities: `p` = P(yes). */
export function binaryCalibration(items: readonly { p: number; truth: boolean }[], nBins = 10): Calibration {
  return calibration(
    items.map(({ p, truth }) => ({ probs: { yes: p, no: 1 - p }, truth: truth ? 'yes' : 'no' })),
    nBins,
  )
}

// ------------------------------------------------------------------------------ latency vs fixture time

export type LatencyScores = {
  /** Items that were settled in the fixture. */
  n: number
  /** Settled items the system marked at all. */
  detected: number
  /** Marked no later than settledAt + budget (and not before the item was first raised). */
  withinBudget: number
  /** Marked before the settling utterance ended: a guess, not a detection. */
  early: number
  p50: number | null
  p90: number | null
  max: number | null
}

/** Delay = decidedAtMs − settledAtMs on the session timeline (fixture time, not wall clock). */
export function settleLatency(
  items: readonly { settledAtMs: number; decidedAtMs: number | null }[],
  budgetMs: number,
): LatencyScores {
  const delays = items.filter((i) => i.decidedAtMs !== null).map((i) => i.decidedAtMs! - i.settledAtMs)
  const sorted = [...delays].sort((a, b) => a - b)
  const q = (f: number) =>
    sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil(f * sorted.length) - 1)]! : null
  return {
    n: items.length,
    detected: delays.length,
    withinBudget: delays.filter((d) => d >= 0 && d <= budgetMs).length,
    early: delays.filter((d) => d < 0).length,
    p50: q(0.5),
    p90: q(0.9),
    max: sorted.at(-1) ?? null,
  }
}

// ------------------------------------------------------------------------------ extraction

const normText = (s: string) => normalizeWords(s).join(' ')

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++)
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1))
    prev = cur
  }
  return prev[b.length]!
}

/** Token-overlap F1 between two strings after normalisation (SQuAD-style). */
export function tokenF1(pred: string, truth: string): number {
  const p = normalizeWords(pred)
  const t = normalizeWords(truth)
  if (!p.length || !t.length) return p.length === t.length ? 1 : 0
  const counts = new Map<string, number>()
  for (const w of t) counts.set(w, (counts.get(w) ?? 0) + 1)
  let common = 0
  for (const w of p) {
    const c = counts.get(w) ?? 0
    if (c > 0) {
      common++
      counts.set(w, c - 1)
    }
  }
  if (!common) return 0
  const precision = common / p.length
  const recall = common / t.length
  return (2 * precision * recall) / (precision + recall)
}

export type MatchResult = { exact: boolean; fuzzy: boolean; score: number }

/**
 * Does an extracted value match the truth or one of its aliases? Exact = equal after normalisation;
 * fuzzy = token F1 ≥ threshold, or the truth's words all appear in the prediction (a longer but
 * correct span), or a close edit distance for short values.
 */
export function matchValue(
  pred: string | null,
  truth: string | null,
  aliases: readonly string[] = [],
  threshold = 0.6,
): MatchResult {
  if (pred === null || truth === null) {
    const same = pred === null && truth === null
    return { exact: same, fuzzy: same, score: same ? 1 : 0 }
  }
  const p = normText(pred)
  let best: MatchResult = { exact: false, fuzzy: false, score: 0 }
  for (const t of [truth, ...aliases].map(normText)) {
    if (!t) continue
    const exact = p === t
    const f1 = tokenF1(p, t)
    const contains = t.split(' ').every((w) => ` ${p} `.includes(` ${w} `))
    const edit = 1 - levenshtein(p, t) / Math.max(p.length, t.length)
    const score = Math.max(exact ? 1 : 0, f1, contains ? 0.9 : 0, t.length <= 12 ? edit : 0)
    const r = { exact, fuzzy: exact || score >= threshold, score }
    if (r.score > best.score || (r.exact && !best.exact)) best = r
  }
  return best
}

export type ExtractionScores = {
  n: number
  /** Right value when answered, null when not answered. */
  accuracy: number | null
  exactAccuracy: number | null
  /** Of the non-null predictions, how many matched (fuzzy). */
  precision: number | null
  /** Of the answered items, how many were extracted correctly (fuzzy). */
  recall: number | null
  /** Non-null predictions for items that were never answered (hallucinated answers). */
  hallucinated: number
}

export function extraction(
  items: readonly { pred: string | null; truth: string | null; aliases?: readonly string[] }[],
): ExtractionScores {
  let correct = 0
  let exact = 0
  let predicted = 0
  let predictedRight = 0
  let answered = 0
  let answeredRight = 0
  let hallucinated = 0
  for (const it of items) {
    const m = matchValue(it.pred, it.truth, it.aliases ?? [])
    if (m.fuzzy) correct++
    if (m.exact) exact++
    if (it.pred !== null) {
      predicted++
      if (it.truth !== null && m.fuzzy) predictedRight++
      if (it.truth === null) hallucinated++
    }
    if (it.truth !== null) {
      answered++
      if (m.fuzzy) answeredRight++
    }
  }
  const n = items.length
  return {
    n,
    accuracy: n ? correct / n : null,
    exactAccuracy: n ? exact / n : null,
    precision: predicted ? predictedRight / predicted : null,
    recall: answered ? answeredRight / answered : null,
    hallucinated,
  }
}

// ------------------------------------------------------------------------------ ranking

export function ranking(
  items: readonly { ranked: readonly string[]; best: string; acceptable: readonly string[] }[],
) {
  let top1 = 0
  let acceptable1 = 0
  let rr = 0
  for (const it of items) {
    const first = it.ranked[0]
    if (first === it.best) top1++
    if (first === it.best || (first !== undefined && it.acceptable.includes(first))) acceptable1++
    const idx = it.ranked.indexOf(it.best)
    rr += idx >= 0 ? 1 / (idx + 1) : 0
  }
  const n = items.length
  return { n, top1: n ? top1 / n : null, acceptableTop1: n ? acceptable1 / n : null, mrr: n ? rr / n : null }
}

// ------------------------------------------------------------------------------ rubric checks (LLM text)

export type Rubric = {
  /** Each group is any-of: the text must mention at least one keyword from every group. */
  mustInclude?: readonly (readonly string[])[]
  /** None of these may appear. */
  mustNotInclude?: readonly string[]
  maxChars?: number
  minChars?: number
}
export type RubricResult = { passed: boolean; score: number; failures: string[] }

/** Case/punctuation-insensitive phrase containment on word boundaries. */
export function mentions(text: string, phrase: string): boolean {
  const t = ` ${normText(text)} `
  const p = normText(phrase)
  return p.length > 0 && t.includes(` ${p} `)
}

/**
 * Deterministic rubric for generated text: required concept groups (score = share satisfied),
 * forbidden phrases (any hit fails), length bounds. The optional LLM judge is a separate, key-gated hook.
 */
export function rubric(text: string, r: Rubric): RubricResult {
  const failures: string[] = []
  const groups = r.mustInclude ?? []
  let hit = 0
  for (const g of groups) {
    if (g.some((k) => mentions(text, k))) hit++
    else failures.push(`missing any of: ${g.join(' | ')}`)
  }
  for (const f of r.mustNotInclude ?? []) if (mentions(text, f)) failures.push(`contains forbidden: ${f}`)
  if (r.maxChars !== undefined && text.length > r.maxChars)
    failures.push(`too long: ${text.length} > ${r.maxChars}`)
  if (r.minChars !== undefined && text.length < r.minChars)
    failures.push(`too short: ${text.length} < ${r.minChars}`)
  const score = groups.length ? hit / groups.length : 1
  return { passed: failures.length === 0, score, failures }
}

/** An optional LLM-as-judge: returns a 0..1 grade for `text` against `criteria`. Live evals only. */
export type LlmJudge = (args: {
  task: string
  criteria: string
  text: string
}) => Promise<{ score: number; reason: string }>

export const mean = (xs: readonly number[]): number | null =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null
