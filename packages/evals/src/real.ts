import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { DecisionProvider } from '@kacola/decisions'
import {
  type AgendaItemInput,
  EVAL_DATASETS_DIR,
  type EvalMode,
  extraction,
  ItemKind,
  type Scorecard,
} from '@kacola/testkit/evals'
import { liveSkipReason, type ProviderSetup } from './providers.ts'
import { card, Meter, skippedCard } from './suites.ts'
import type { ReplayUtterance, StatusRunner } from './types.ts'

// The real-meeting coverage suite: a recorded meeting (exported read-only from the daemon with
// scripts/export-real.ts) plus agenda items someone labelled by hand against it, replayed segment by
// segment through a status runner — in the tracker's case the live tracker's own path (relevance gate →
// batched status round → policy, real thresholds, forward-only). Scored against the labels: auto-tick
// precision / recall, false ticks on items never answered, "looks covered" suggestions, tick lag (seconds
// from the labelled answer to the tick), cost, calls, latency.
//
// Real meetings are private: fixtures live in a gitignored directory (fixtures/evals/private/<name>/,
// or KACOLA_EVAL_PRIVATE_DIR) and the suite skips with the reason when there are none. Scorecards carry
// item ids and numbers only, never transcript text.
//
//   <dir>/transcript.json   RealTranscript (export-real.ts writes it)
//   <dir>/labels.json       RealLabels (written by a person, or drafted by a model and reviewed)

export const REAL_SUITE = 'real-interview-coverage'

/** A tiny synthetic fixture (a made-up interview) for tests of the suite's plumbing; never scored as real. */
export const REAL_SAMPLE_FIXTURE = join(EVAL_DATASETS_DIR, 'real-sample')

export function privateEvalsDir(env: NodeJS.ProcessEnv = process.env): string {
  return env.KACOLA_EVAL_PRIVATE_DIR?.trim() || join(EVAL_DATASETS_DIR, 'private')
}

export type RealSegment = {
  id: string
  speaker: string
  track?: string
  startMs: number
  endMs: number
  text: string
}

export type RealTranscript = {
  sessionId: string
  startedAt: string | null
  durationMs: number
  exportedAt: string
  segments: RealSegment[]
}

/** full: answered; partial: only partly (scored apart: never a miss, a tick on it is not a false tick). */
export type Coverage = 'full' | 'partial' | 'none'

export type RealLabel = AgendaItemInput & {
  coverage: Coverage
  /** Segment id where the topic first comes up (a tick before it is wrong); null for coverage none. */
  startedAt: string | null
  /** Segment id by whose end a reasonable listener would say it was answered (or partly); null if never. */
  answeredAt: string | null
  /** Segment ids that show it. */
  evidence: string[]
  /** info-to-get: the answer heard, short; null when not answered. */
  answer?: string | null
  answerAliases?: string[]
  /** One line on why (private file only). */
  why: string
  /** Segments that sound related but do not answer it (shown on the review page). */
  nearMisses?: string[]
}

export type RealLabels = {
  name: string
  sessionId: string
  labelledBy: string
  reviewed: boolean
  labelledAt?: string
  /** How to label (for whoever edits the file). */
  guide?: string
  /** Calendar end relative to the recording start, when known (the tracker's time-pressure prior). */
  scheduledEndMs?: number
  items: RealLabel[]
}

export type RealFixture = { name: string; dir: string; transcript: RealTranscript; labels: RealLabels }

const has = (dir: string, f: string) => existsSync(join(dir, f))

/** Fixture directories under `root` that have both files. */
export function listRealFixtures(root = privateEvalsDir()): string[] {
  if (!existsSync(root)) return []
  return readdirSync(root)
    .map((d) => join(root, d))
    .filter((d) => statSync(d).isDirectory() && has(d, 'transcript.json') && has(d, 'labels.json'))
    .sort()
}

/** Why the suite cannot run here, or null when there is at least one fixture. */
export function realFixtureSkipReason(root = privateEvalsDir()): string | null {
  if (listRealFixtures(root).length) return null
  return `no private real-meeting fixture in ${root} (export one with packages/evals/scripts/export-real.ts and label it; see docs/decisions.md, "Real meetings")`
}

/** Load and check one fixture: every segment id a label names must exist, and the fields must agree. */
export function loadRealFixture(dir: string): RealFixture {
  const transcript = JSON.parse(readFileSync(join(dir, 'transcript.json'), 'utf8')) as RealTranscript
  const labels = JSON.parse(readFileSync(join(dir, 'labels.json'), 'utf8')) as RealLabels
  const where = (m: string) => new Error(`${join(dir, 'labels.json')}: ${m}`)
  if (!Array.isArray(transcript.segments) || !transcript.segments.length)
    throw new Error(`${join(dir, 'transcript.json')}: no segments`)
  if (!Array.isArray(labels.items) || !labels.items.length) throw where('no items')
  const ids = new Set(transcript.segments.map((s) => s.id))
  const seen = new Set<string>()
  for (const it of labels.items) {
    if (!it.id || seen.has(it.id)) throw where(`missing or duplicate item id "${it.id}"`)
    seen.add(it.id)
    if (!it.text) throw where(`${it.id}: no text`)
    if (!ItemKind.safeParse(it.kind).success) throw where(`${it.id}: unknown kind "${it.kind}"`)
    if (!['full', 'partial', 'none'].includes(it.coverage)) throw where(`${it.id}: bad coverage`)
    if (it.coverage === 'none' && (it.answeredAt || it.answer))
      throw where(`${it.id}: coverage none but answeredAt / answer set`)
    if (it.coverage !== 'none' && !it.answeredAt) throw where(`${it.id}: covered but no answeredAt`)
    for (const s of [it.startedAt, it.answeredAt, ...(it.evidence ?? []), ...(it.nearMisses ?? [])])
      if (s && !ids.has(s)) throw where(`${it.id}: unknown segment id ${s}`)
  }
  return { name: labels.name || dir.split('/').at(-1)!, dir, transcript, labels }
}

// ------------------------------------------------------------------------------ replay

/** Per item: what the runner did over the whole replay (first tick, first suggestion, max P). */
export type RealOutcome = {
  itemId: string
  /** Decision time of the first auto tick (segment end + the runner's wall time), session ms. */
  tickAtMs: number | null
  /** The segment (index into transcript.segments) on which it ticked. */
  tickSegment: number | null
  tickEvidence: number | null
  /** First "looks covered" suggestion (suggest-covered), session ms. */
  suggestAtMs: number | null
  maxP: number
  answer: string | null
}

export type ReplayResult = {
  outcomes: RealOutcome[]
  meter: Meter
  segments: number
}

/** Utterances in the order they close (end time, then transcript order); index = transcript position. */
export function replayOrder(t: RealTranscript): ReplayUtterance[] {
  return t.segments
    .map((s, index) => ({ index, speaker: s.speaker, text: s.text, startMs: s.startMs, endMs: s.endMs }))
    .sort((a, b) => a.endMs - b.endMs || a.index - b.index)
}

/**
 * How the pipeline publishes segments while they are spoken (packages/stt/src/reconciler.ts): an open
 * segment is upserted with its committed words as they come (quality live), then closed with all of them.
 * The fixture has no word times, so words are spread evenly over the segment and published every
 * `chunkMs`; the full text lands at the segment's end as final.
 */
export function livePublications(t: RealTranscript, chunkMs: number): ReplayUtterance[] {
  const out: ReplayUtterance[] = []
  t.segments.forEach((s, index) => {
    const words = s.text.trim().split(/\s+/).filter(Boolean)
    const dur = s.endMs - s.startMs
    let shown = 0
    for (let at = s.startMs + chunkMs; dur > 0 && at < s.endMs; at += chunkMs) {
      const n = Math.floor((words.length * (at - s.startMs)) / dur)
      if (n <= shown || n >= words.length) continue
      shown = n
      out.push({
        index,
        speaker: s.speaker,
        text: words.slice(0, n).join(' '),
        startMs: s.startMs,
        endMs: at,
        quality: 'live',
      })
    }
    out.push({
      index,
      speaker: s.speaker,
      text: s.text,
      startMs: s.startMs,
      endMs: s.endMs,
      quality: 'final',
    })
  })
  return out.sort((a, b) => a.endMs - b.endMs || a.index - b.index)
}

export type ReplayOptions = {
  /** Publish segments as the live pipeline does, growing every `chunkMs` (null: each once, complete). */
  liveChunkMs?: number | null
}

export async function replayReal(
  runner: StatusRunner,
  fx: RealFixture,
  opts: ReplayOptions = {},
): Promise<ReplayResult> {
  const meter = new Meter()
  const agenda: AgendaItemInput[] = fx.labels.items.map((it) => ({
    id: it.id,
    text: it.text,
    kind: it.kind,
    ...(it.owner ? { owner: it.owner } : {}),
  }))
  const session = runner.start({
    id: fx.name,
    agenda,
    durationMs: fx.transcript.durationMs,
    scheduledEndMs: fx.labels.scheduledEndMs ?? fx.transcript.durationMs,
  })
  const state = new Map<string, RealOutcome>(
    agenda.map((it) => [
      it.id,
      {
        itemId: it.id,
        tickAtMs: null,
        tickSegment: null,
        tickEvidence: null,
        suggestAtMs: null,
        maxP: 0,
        answer: null,
      },
    ]),
  )
  const history: ReplayUtterance[] = []
  const order = opts.liveChunkMs
    ? livePublications(fx.transcript, opts.liveChunkMs)
    : replayOrder(fx.transcript)
  for (const u of order) {
    history.push(u)
    const t0 = performance.now()
    const { reports, usage } = await session.onSegment(u, history)
    const wall = performance.now() - t0
    meter.add(usage, wall)
    const at = Math.round(u.endMs + wall)
    for (const r of reports) {
      const o = state.get(r.itemId)
      if (!o) throw new Error(`runner reported unknown item ${r.itemId}`)
      o.maxP = Math.max(o.maxP, r.pCovered)
      if (r.action === 'auto-covered' && o.tickAtMs === null) {
        o.tickAtMs = at
        o.tickSegment = u.index
        o.tickEvidence = r.evidenceIndex
      } else if (r.action === 'suggest-covered' && o.suggestAtMs === null) o.suggestAtMs = at
      if (r.answer) o.answer = r.answer
    }
  }
  return { outcomes: [...state.values()], meter, segments: fx.transcript.segments.length }
}

// ------------------------------------------------------------------------------ scoring

export type ItemScore = {
  itemId: string
  kind: string
  coverage: Coverage
  verdict: 'hit' | 'miss' | 'false-tick' | 'premature-tick' | 'partial-tick' | 'quiet' | 'partial-quiet'
  /** Seconds from the labelled answer (end of answeredAt) to the tick; negative = before it. */
  lagS: number | null
  /** A suggestion or a tick ("looks covered") at or after the topic came up. */
  looksCovered: boolean
  evidenceHit: boolean | null
  maxP: number
}

export function quantile(xs: readonly number[], q: number): number | null {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil(q * s.length) - 1))]!
}

const round = (x: number | null, d = 3) => (x === null ? null : Math.round(x * 10 ** d) / 10 ** d)

/**
 * Grade a replay against the labels. A tick is a hit when the item is fully covered and the tick came at
 * or after the topic first came up; a tick on a never-answered item is a false tick; a tick before the
 * topic came up is premature (wrong). Ticks on partly covered items are counted apart: precision counts
 * them as wrong (strict) or right (lenient), recall leaves partial items out.
 */
export function scoreReal(fx: RealFixture, outcomes: readonly RealOutcome[]) {
  const seg = new Map(fx.transcript.segments.map((s, i) => [s.id, { ...s, index: i }]))
  const byId = new Map(outcomes.map((o) => [o.itemId, o]))
  const items: ItemScore[] = fx.labels.items.map((it) => {
    const o = byId.get(it.id)
    if (!o) throw new Error(`no outcome for item ${it.id}`)
    const first = it.startedAt ?? it.answeredAt
    const startedMs = first ? seg.get(first)!.startMs : null
    const answeredMs = it.answeredAt ? seg.get(it.answeredAt)!.endMs : null
    const afterStart = (ms: number | null) => ms !== null && (startedMs === null || ms >= startedMs)
    const ticked = o.tickAtMs !== null
    const evidenceIds = new Set(it.evidence ?? [])
    let verdict: ItemScore['verdict']
    if (it.coverage === 'none') verdict = ticked ? 'false-tick' : 'quiet'
    else if (ticked && !afterStart(o.tickAtMs)) verdict = 'premature-tick'
    else if (it.coverage === 'partial') verdict = ticked ? 'partial-tick' : 'partial-quiet'
    else verdict = ticked ? 'hit' : 'miss'
    const looks =
      it.coverage !== 'none'
        ? afterStart(o.tickAtMs) || afterStart(o.suggestAtMs)
        : o.tickAtMs !== null || o.suggestAtMs !== null
    return {
      itemId: it.id,
      kind: it.kind,
      coverage: it.coverage,
      verdict,
      lagS:
        (verdict === 'hit' || verdict === 'partial-tick') && answeredMs !== null
          ? Math.round((o.tickAtMs! - answeredMs) / 100) / 10
          : null,
      looksCovered: looks,
      evidenceHit:
        verdict === 'hit'
          ? o.tickEvidence !== null && evidenceIds.has(fx.transcript.segments[o.tickEvidence]?.id ?? '')
          : null,
      maxP: round(o.maxP)!,
    }
  })
  const n = (v: ItemScore['verdict']) => items.filter((i) => i.verdict === v).length
  const full = items.filter((i) => i.coverage === 'full')
  const negatives = items.filter((i) => i.coverage === 'none')
  const ticks = items.filter((i) => byId.get(i.itemId)!.tickAtMs !== null).length
  const hits = n('hit')
  const lags = items.filter((i) => i.verdict === 'hit').map((i) => i.lagS!)
  const info = fx.labels.items.filter((it) => it.kind === 'info-to-get')
  const ex = extraction(
    info.map((it) => ({
      pred: byId.get(it.id)!.answer,
      truth: it.coverage === 'none' ? null : (it.answer ?? null),
      aliases: it.answerAliases ?? [],
    })),
  )
  const evid = items.filter((i) => i.evidenceHit !== null)
  const metrics: Scorecard['metrics'] = {
    items: items.length,
    fullItems: full.length,
    partialItems: items.filter((i) => i.coverage === 'partial').length,
    negativeItems: negatives.length,
    autoCheckoffs: ticks,
    autoPrecision: ticks ? round(hits / ticks) : null,
    autoPrecisionLenient: ticks ? round((hits + n('partial-tick')) / ticks) : null,
    autoRecall: full.length ? round(hits / full.length) : null,
    falseTicksOnNegatives: n('false-tick'),
    falseTickRateOnNegatives: negatives.length ? round(n('false-tick') / negatives.length) : null,
    prematureTicks: n('premature-tick'),
    partialTicks: n('partial-tick'),
    looksCoveredRecall: full.length ? round(full.filter((i) => i.looksCovered).length / full.length) : null,
    looksCoveredOnNegatives: negatives.filter((i) => i.looksCovered).length,
    tickLagMedianS: quantile(lags, 0.5),
    tickLagP90S: quantile(lags, 0.9),
    tickLagMaxS: lags.length ? Math.max(...lags) : null,
    ticksBeforeAnswer: lags.filter((l) => l < 0).length,
    evidenceHitRate: evid.length ? round(evid.filter((i) => i.evidenceHit).length / evid.length) : null,
    answerAccuracy: ex.n ? round(ex.accuracy) : null,
    answerHallucinated: ex.n ? ex.hallucinated : null,
  }
  return { metrics, items }
}

/** Replay every fixture through the runner and grade it: one scorecard per fixture. */
export async function runRealCoverageSuite(runner: StatusRunner, fx: RealFixture, opts: ReplayOptions = {}) {
  const { outcomes, meter, segments } = await replayReal(runner, fx, opts)
  const { metrics, items } = scoreReal(fx, outcomes)
  const hours = fx.transcript.durationMs / 3_600_000
  metrics.costUsd = meter.usd === null ? null : round(meter.usd, 4)
  metrics.costPerMeetingHourUsd = meter.usd === null || !hours ? null : round(meter.usd / hours, 4)
  metrics.decisionCalls = meter.calls
  const sc = card(REAL_SUITE, runner, `private:${fx.name}`, items.length, metrics, meter, {
    notes: [
      `${segments} segments replayed over ${(fx.transcript.durationMs / 60_000).toFixed(1)} min${opts.liveChunkMs ? `, published live every ${opts.liveChunkMs} ms` : ''}`,
      `labels: ${fx.labels.labelledBy}${fx.labels.reviewed ? ', reviewed' : ', NOT reviewed'}`,
    ],
    details: items,
  })
  return { card: sc, outcomes, items }
}

export type RealRun = Awaited<ReturnType<typeof runRealCoverageSuite>>

/**
 * The suite for one provider setup over every private fixture, with the same skip semantics as the other
 * suites: no provider / no key → skipped card; no fixture here → skipped card with the reason; quota /
 * auth / unreachable on a live run → skipped card with the error. `makeRunner` is the pipeline under test
 * (the daemon's trackerStatusRunner for the live tracker's path).
 */
export async function runRealSuites(
  setup: ProviderSetup,
  makeRunner: (p: DecisionProvider, mode: EvalMode) => StatusRunner,
  opts: { root?: string; onRun?: (fx: RealFixture, r: RealRun) => void; replay?: ReplayOptions } = {},
): Promise<Scorecard[]> {
  const meta = {
    provider: setup.provider?.id ?? setup.label,
    model: setup.provider?.model ?? '',
    mode: setup.mode,
  }
  if (!setup.provider || setup.skip)
    return [
      skippedCard(REAL_SUITE, { ...meta, provider: setup.label }, REAL_SUITE, setup.skip ?? 'no provider'),
    ]
  const root = opts.root ?? privateEvalsDir()
  const skip = realFixtureSkipReason(root)
  if (skip) return [skippedCard(REAL_SUITE, meta, REAL_SUITE, skip)]
  const cards: Scorecard[] = []
  for (const dir of listRealFixtures(root)) {
    const fx = loadRealFixture(dir)
    try {
      const r = await runRealCoverageSuite(makeRunner(setup.provider, setup.mode), fx, opts.replay)
      opts.onRun?.(fx, r)
      cards.push(r.card)
    } catch (err) {
      const reason = setup.mode === 'live' ? liveSkipReason(err) : null
      if (!reason) throw err
      cards.push(skippedCard(REAL_SUITE, meta, `private:${fx.name}`, reason))
      break
    }
  }
  return cards
}

/** Keep a run's per-item outcome next to the (private) fixture, for the review page. Never committed. */
export function writeRealResults(fx: RealFixture, r: RealRun, label: string): string {
  const path = join(fx.dir, `results-${label.replace(/[^\w.-]+/g, '_')}.json`)
  const { provider, model, mode, generatedAt, metrics, cost, latency } = r.card
  const out = {
    label,
    provider,
    model,
    mode,
    generatedAt,
    metrics,
    cost,
    latency,
    items: r.items,
    outcomes: r.outcomes,
  }
  writeFileSync(path, `${JSON.stringify(out, null, 2)}\n`)
  return path
}
