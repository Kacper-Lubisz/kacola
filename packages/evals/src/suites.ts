import {
  type AgendaDraftingCase,
  type AgendaItemTruth,
  type Budget,
  binary,
  binaryCalibration,
  checkBudgets,
  extraction,
  type InjectionCase,
  type InterviewExtractionCase,
  mean,
  mentions,
  multiclass,
  type NextPointCase,
  type RecapCase,
  type RelevanceCase,
  ranking,
  rubric,
  type Scorecard,
  settleLatency,
} from '@kacola/testkit/evals'
import type { GroundTruth } from '@kacola/testkit/fixtures'
import type {
  DraftRunner,
  InjectionRunner,
  InterviewRunner,
  NextPointRunner,
  RecapRunner,
  RelevanceRunner,
  ReplayUtterance,
  RunnerMeta,
  RunUsage,
  StatusRunner,
} from './types.ts'

// The eval suites: dataset × runner → scorecard. No thresholds are tuned here; budgets are the brief's
// and are only enforced for live runs (offline numbers are honest baselines, not targets).

/** The brief's budgets (agendas plan, "Budgets (asserted by evals where measurable)"). */
export const SETTLE_BUDGET_MS = 30_000
export const STATUS_BUDGETS = (enforced: boolean): Budget[] => [
  { name: 'auto check-off precision', metric: 'autoPrecision', op: '>=', threshold: 0.9, enforced },
  {
    name: 'check-off within 30 s of settling (p90, fixture time)',
    metric: 'latencyP90Ms',
    op: '<=',
    threshold: SETTLE_BUDGET_MS,
    enforced,
  },
]

export class Meter {
  usd: number | null = 0
  inputTokens = 0
  outputTokens = 0
  calls = 0
  walls: number[] = []
  add(u: RunUsage | undefined, wallMs: number) {
    this.walls.push(wallMs)
    if (!u) return
    this.usd = this.usd === null || u.usd === null ? null : this.usd + u.usd
    this.inputTokens += u.inputTokens
    this.outputTokens += u.outputTokens
    this.calls += u.calls
  }
  cost() {
    return {
      usd: this.usd,
      calls: this.calls,
      inputTokens: this.inputTokens,
      outputTokens: this.outputTokens,
    }
  }
  latency() {
    const s = [...this.walls].sort((a, b) => a - b)
    const q = (f: number) =>
      s.length ? Math.round(s[Math.min(s.length - 1, Math.ceil(f * s.length) - 1)]!) : null
    return { p50: q(0.5), p90: q(0.9) }
  }
}

async function timed<T>(
  m: Meter,
  f: () => Promise<T & { usage?: RunUsage }>,
): Promise<T & { usage?: RunUsage }> {
  const t0 = performance.now()
  const r = await f()
  m.add(r.usage, performance.now() - t0)
  return r
}

export function card(
  suite: string,
  runner: RunnerMeta,
  dataset: string,
  n: number,
  metrics: Scorecard['metrics'],
  meter: Meter,
  extra: Partial<Pick<Scorecard, 'budgets' | 'notes' | 'details'>> = {},
): Scorecard {
  return {
    suite,
    provider: runner.provider,
    model: runner.model,
    mode: runner.mode,
    dataset: { name: dataset, n },
    metrics,
    budgets: extra.budgets ?? [],
    cost: meter.cost(),
    latency: meter.latency(),
    notes: [`runner: ${runner.name}`, ...(extra.notes ?? [])],
    skipped: null,
    generatedAt: new Date().toISOString(),
    ...(extra.details ? { details: extra.details } : {}),
  }
}

/** A scorecard for a run that could not happen, with the reason (never numbers). */
export function skippedCard(
  suite: string,
  runner: Pick<RunnerMeta, 'provider' | 'model' | 'mode'>,
  dataset: string,
  reason: string,
): Scorecard {
  return {
    suite,
    provider: runner.provider,
    model: runner.model,
    mode: runner.mode,
    dataset: { name: dataset, n: 0 },
    metrics: {},
    budgets: [],
    cost: { usd: null, calls: 0, inputTokens: 0, outputTokens: 0 },
    latency: { p50: null, p90: null },
    notes: [],
    skipped: reason,
    generatedAt: new Date().toISOString(),
  }
}

// ------------------------------------------------------------------------------ item status (live replay)

export type StatusFixture = { id: string; truth: GroundTruth }

type ItemOutcome = {
  meeting: string
  itemId: string
  truth: AgendaItemTruth['expected']
  autoAtMs: number | null
  autoEvidence: number | null
  inProgressAtMs: number | null
  suggestions: number
  answer: string | null
}

/**
 * Replays each fixture meeting segment by segment (in the order segments close), as the tracker would see
 * it live, and grades what the runner did. Decision time = the segment's end + the runner's wall time
 * (so a slow provider is late in fixture time too).
 */
export async function runStatusSuite(runner: StatusRunner, fixtures: readonly StatusFixture[]) {
  const meter = new Meter()
  const outcomes: ItemOutcome[] = []
  const probes: { p: number; truth: boolean }[] = []
  let durationMs = 0
  let segments = 0
  for (const f of fixtures) {
    const agenda = f.truth.agenda
    if (!agenda) throw new Error(`${f.id} has no agenda ground truth`)
    durationMs += f.truth.durationMs
    const session = runner.start({
      id: f.id,
      agenda: agenda.items.map(({ expected: _e, ...it }) => it),
      durationMs: f.truth.durationMs,
      scheduledEndMs: agenda.meeting.scheduledEndMs,
    })
    const state = new Map<string, ItemOutcome>(
      agenda.items.map((it) => [
        it.id,
        {
          meeting: f.id,
          itemId: it.id,
          truth: it.expected,
          autoAtMs: null,
          autoEvidence: null,
          inProgressAtMs: null,
          suggestions: 0,
          answer: null,
        },
      ]),
    )
    const utts: ReplayUtterance[] = f.truth.utterances
      .map((u, index) => ({ index, speaker: u.speaker, text: u.text, startMs: u.startMs, endMs: u.endMs }))
      .sort((a, b) => a.endMs - b.endMs || a.index - b.index)
    const history: ReplayUtterance[] = []
    for (const u of utts) {
      history.push(u)
      segments++
      const t0 = performance.now()
      const { reports, usage } = await session.onSegment(u, history)
      const wall = performance.now() - t0
      meter.add(usage, wall)
      const at = Math.round(u.endMs + wall)
      for (const r of reports) {
        const o = state.get(r.itemId)
        if (!o) throw new Error(`runner reported unknown item ${r.itemId}`)
        probes.push({ p: r.pCovered, truth: o.truth.settledAtMs !== null && u.endMs >= o.truth.settledAtMs })
        if (r.action === 'auto-covered' && o.autoAtMs === null) {
          o.autoAtMs = at
          o.autoEvidence = r.evidenceIndex
        } else if (r.action === 'suggest-covered') o.suggestions++
        else if (r.action === 'in-progress' && o.inProgressAtMs === null) o.inProgressAtMs = at
        if (r.answer) o.answer = r.answer
      }
    }
    outcomes.push(...state.values())
  }

  // auto check-off: right when the item really was covered and it was not checked off before it came up
  const autos = outcomes.filter((o) => o.autoAtMs !== null)
  const tp = autos.filter((o) => o.truth.status === 'covered' && o.autoAtMs! >= (o.truth.startedAtMs ?? 0))
  const truthCovered = outcomes.filter((o) => o.truth.status === 'covered')
  const auto = binary(
    outcomes.map((o) => ({
      pred: o.autoAtMs !== null && (o.truth.status !== 'covered' || o.autoAtMs >= (o.truth.startedAtMs ?? 0)),
      truth: o.truth.status === 'covered',
    })),
  )
  const lat = settleLatency(
    truthCovered.map((o) => ({ settledAtMs: o.truth.settledAtMs!, decidedAtMs: o.autoAtMs })),
    SETTLE_BUDGET_MS,
  )
  const final = multiclass(
    outcomes.map((o) => ({
      pred: o.autoAtMs !== null ? 'covered' : o.inProgressAtMs !== null ? 'in_progress' : 'not_started',
      truth: o.truth.status,
    })),
  )
  const cal = binaryCalibration(probes)
  const infoItems = outcomes.filter((o) =>
    fixtures.some((f) =>
      f.truth.agenda!.items.some(
        (it) => it.id === o.itemId && f.id === o.meeting && it.kind === 'info-to-get',
      ),
    ),
  )
  const ex = extraction(
    infoItems.map((o) => ({ pred: o.answer, truth: o.truth.answer, aliases: o.truth.answerAliases })),
  )
  const hours = durationMs / 3_600_000
  const metrics: Scorecard['metrics'] = {
    items: outcomes.length,
    autoCheckoffs: autos.length,
    autoPrecision: autos.length ? tp.length / autos.length : null,
    autoRecall: truthCovered.length ? tp.length / truthCovered.length : null,
    autoF1: auto.f1,
    latencyP50Ms: lat.p50,
    latencyP90Ms: lat.p90,
    within30sRate: lat.n ? lat.withinBudget / lat.n : null,
    earlyCheckoffs: lat.early,
    finalStatusAccuracy: final.accuracy,
    finalStatusMacroF1: final.macroF1,
    suggestions: outcomes.reduce((a, o) => a + o.suggestions, 0),
    evidenceHitRate: tp.length
      ? tp.filter((o) => o.autoEvidence !== null && o.truth.evidence.includes(o.autoEvidence)).length /
        tp.length
      : null,
    coveredEce: cal.ece,
    coveredBrier: cal.brier,
    answerAccuracy: ex.n ? ex.accuracy : null,
    answerHallucinated: ex.n ? ex.hallucinated : null,
    costPerMeetingHourUsd: meter.usd === null ? null : meter.usd / hours,
  }
  return {
    card: card(
      'item-status',
      runner,
      `agenda fixtures (${fixtures.map((f) => f.id).join(', ')})`,
      outcomes.length,
      metrics,
      meter,
      {
        budgets: checkBudgets(metrics, STATUS_BUDGETS(runner.mode === 'live')),
        notes: [
          `${segments} segments replayed over ${(durationMs / 60_000).toFixed(1)} min of meetings; ${probes.length} status probes`,
        ],
        details: outcomes,
      },
    ),
    outcomes,
  }
}

// ------------------------------------------------------------------------------ relevance pre-check

export async function runRelevanceSuite(runner: RelevanceRunner, cases: readonly RelevanceCase[]) {
  const meter = new Meter()
  const rows = []
  for (const c of cases) {
    const r = await timed(meter, () => runner.run(c))
    rows.push({
      id: c.id,
      truth: c.label.relevant,
      pred: r.relevant,
      p: r.p,
      itemIds: r.itemIds,
      truthItems: c.label.itemIds,
    })
  }
  const b = binary(rows)
  const cal = binaryCalibration(rows.map((r) => ({ p: r.p, truth: r.truth })))
  const withItems = rows.filter((r) => r.truth && r.truthItems.length)
  const metrics = {
    precision: b.precision,
    recall: b.recall,
    f1: b.f1,
    accuracy: b.accuracy,
    ece: cal.ece,
    brier: cal.brier,
    itemAccuracy: withItems.length
      ? withItems.filter((r) => r.itemIds.some((i) => r.truthItems.includes(i))).length / withItems.length
      : null,
  }
  return card('relevance-precheck', runner, 'relevance-precheck.jsonl', cases.length, metrics, meter, {
    details: rows.filter((r) => r.pred !== r.truth),
  })
}

// ------------------------------------------------------------------------------ injection guardrail

export async function runInjectionSuite(runner: InjectionRunner, cases: readonly InjectionCase[]) {
  const meter = new Meter()
  const rows: { id: string; category: string; truth: boolean; pred: boolean; p: number }[] = []
  for (const c of cases) {
    const r = await timed(meter, () => runner.run(c))
    rows.push({ id: c.id, category: c.category, truth: c.label.injection, pred: r.injection, p: r.p })
  }
  const b = binary(rows)
  const cal = binaryCalibration(rows.map((r) => ({ p: r.p, truth: r.truth })))
  const cats = [...new Set(rows.map((r) => r.category))].sort()
  return card(
    'injection-guardrail',
    runner,
    'injection-guardrail.jsonl',
    cases.length,
    {
      precision: b.precision,
      recall: b.recall,
      f1: b.f1,
      accuracy: b.accuracy,
      ece: cal.ece,
      brier: cal.brier,
    },
    meter,
    {
      notes: [
        `per category accuracy: ${cats
          .map((k) => {
            const rs = rows.filter((r) => r.category === k)
            return `${k} ${rs.filter((r) => r.pred === r.truth).length}/${rs.length}`
          })
          .join(', ')}`,
      ],
      details: rows.filter((r) => r.pred !== r.truth),
    },
  )
}

// ------------------------------------------------------------------------------ next talking point

export async function runNextPointSuite(runner: NextPointRunner, cases: readonly NextPointCase[]) {
  const meter = new Meter()
  const rows = []
  for (const c of cases) {
    const r = await timed(meter, () => runner.run(c))
    rows.push({ id: c.id, ranked: r.ranked, best: c.label.best, acceptable: c.label.acceptable })
  }
  const rk = ranking(rows)
  return card(
    'next-point',
    runner,
    'next-point.jsonl',
    cases.length,
    { top1: rk.top1, acceptableTop1: rk.acceptableTop1, mrr: rk.mrr },
    meter,
    {
      details: rows.filter((r) => r.ranked[0] !== r.best),
    },
  )
}

// ------------------------------------------------------------------------------ interview extraction

export async function runInterviewSuite(runner: InterviewRunner, cases: readonly InterviewExtractionCase[]) {
  const meter = new Meter()
  const rows = []
  for (const c of cases) {
    const r = await timed(meter, () => runner.run(c))
    rows.push({
      id: c.id,
      truth: c.label.answered,
      pred: r.answered,
      p: r.p,
      answer: r.answer,
      want: c.label.answer,
      aliases: c.label.aliases,
    })
  }
  const b = binary(rows)
  const cal = binaryCalibration(rows.map((r) => ({ p: r.p, truth: r.truth })))
  const ex = extraction(rows.map((r) => ({ pred: r.answer, truth: r.want, aliases: r.aliases })))
  return card(
    'interview-extraction',
    runner,
    'interview-extraction.jsonl',
    cases.length,
    {
      answeredPrecision: b.precision,
      answeredRecall: b.recall,
      answeredF1: b.f1,
      answerAccuracy: ex.accuracy,
      answerExactAccuracy: ex.exactAccuracy,
      answerRecall: ex.recall,
      hallucinated: ex.hallucinated,
      ece: cal.ece,
      brier: cal.brier,
    },
    meter,
    { details: rows },
  )
}

// ------------------------------------------------------------------------------ agenda drafting

export async function runDraftSuite(runner: DraftRunner, cases: readonly AgendaDraftingCase[]) {
  const meter = new Meter()
  const rows = []
  for (const c of cases) {
    const r = await timed(meter, () => runner.run(c))
    const all = r.items.map((i) => i.text).join('\n')
    const concepts = c.expected.mustInclude.map((m) => {
      const item = r.items.find((i) => m.keywords.some((k) => mentions(i.text, k)))
      return { concept: m.concept, covered: !!item, kindOk: m.kind ? item?.kind === m.kind : null }
    })
    const leaks = c.expected.mustNotInclude.filter((p) => mentions(all, p))
    const countOk = r.items.length >= c.expected.minItems && r.items.length <= c.expected.maxItems
    const recall = concepts.length ? concepts.filter((x) => x.covered).length / concepts.length : 1
    rows.push({
      id: c.id,
      n: r.items.length,
      recall,
      concepts,
      leaks,
      countOk,
      pass: recall === 1 && !leaks.length && countOk,
    })
  }
  const kinds = rows.flatMap((r) => r.concepts.filter((c) => c.kindOk !== null))
  return card(
    'agenda-drafting',
    runner,
    'agenda-drafting.jsonl',
    cases.length,
    {
      conceptRecall: mean(rows.map((r) => r.recall)),
      passRate: mean(rows.map((r) => (r.pass ? 1 : 0))),
      privateLeaks: rows.reduce((a, r) => a + r.leaks.length, 0),
      itemCountOkRate: mean(rows.map((r) => (r.countOk ? 1 : 0))),
      kindAccuracy: kinds.length ? kinds.filter((k) => k.kindOk).length / kinds.length : null,
    },
    meter,
    { details: rows.filter((r) => !r.pass) },
  )
}

// ------------------------------------------------------------------------------ recap per item

export async function runRecapSuite(runner: RecapRunner, cases: readonly RecapCase[]) {
  const meter = new Meter()
  const rows = []
  for (const c of cases) {
    const r = await timed(meter, () => runner.run(c))
    const res = rubric(r.text, {
      mustInclude: [...c.expected.outcomeKeywords, ...c.expected.actions.map((a) => a.keywords)],
      mustNotInclude: c.expected.mustNotInclude,
      maxChars: 1_200,
    })
    const ownersOk = c.expected.actions.every((a) => mentions(r.text, a.owner))
    const leaked = c.expected.mustNotInclude.filter((p) => mentions(r.text, p))
    rows.push({
      id: c.id,
      score: res.score,
      passed: res.passed && ownersOk,
      failures: res.failures,
      leaked,
      status: r.status,
      want: c.expected.status,
    })
  }
  const withStatus = rows.filter((r) => r.status !== undefined)
  return card(
    'recap',
    runner,
    'recap.jsonl',
    cases.length,
    {
      rubricScore: mean(rows.map((r) => r.score)),
      passRate: mean(rows.map((r) => (r.passed ? 1 : 0))),
      injectedOrForbidden: rows.reduce((a, r) => a + r.leaked.length, 0),
      statusAccuracy: withStatus.length
        ? withStatus.filter((r) => r.status === r.want).length / withStatus.length
        : null,
    },
    meter,
    { details: rows.filter((r) => !r.passed) },
  )
}
