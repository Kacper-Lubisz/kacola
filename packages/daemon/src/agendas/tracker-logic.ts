import {
  type AgendaItemInput,
  contentWords,
  DEFAULT_THRESHOLDS,
  type DecisionProvider,
  type DecisionResult,
  decideInjection,
  decideInterview,
  decideNextPoint,
  decideRelevance,
  decideStatus,
  FILLER,
  type InterviewDecision,
  type NextPointItem,
  type PolicyAction,
  type StatusDecision,
  type StatusThresholds,
  statusPolicy,
  type TrackStatus,
  type TranscriptLine,
} from '@gnomeola/decisions'
import type { AgendaItem, AgendaItemStatus } from '@gnomeola/protocol'

// The live tracker's decisions, as plain functions over a DecisionProvider: the tracker (tracker.ts) calls
// them per round, and the eval runners (tracker-eval.ts) call exactly the same ones, so an eval of the
// runners is an eval of the tracker's code path. No state, no store, no clock of their own.
//
// Decision calls per closed segment (the budget the gate exists for):
//   trivial line (filler, < 3 words)      → 0 calls
//   otherwise                              → 1 relevance call (+ the injection guard, same moment)
//   relevant                               → + 1 batched status call (all open items in one call)
//   an interview item came up              → + 1 interview call per such item (in parallel)
// plus at most one next-point call per `nextPointEveryMs`.

/** An agenda item as the tracker reasons about it. */
export type LiveItem = AgendaItemInput & {
  status: AgendaItemStatus
  /** The user set the status by hand (an override): the tracker leaves it alone ("manual wins"). */
  manual: boolean
  /** Who made the latest change: interview answers the tracker found may be corrected, the user's not. */
  changedBy: string
  outcome: string | null
}

export const INTERVIEW_KINDS: ReadonlySet<string> = new Set(['info-to-get', 'competency'])

export function toLiveItem(it: AgendaItem, manual: boolean): LiveItem {
  return {
    id: it.id,
    text: it.text,
    kind: it.kind,
    ...(it.owner ? { owner: it.owner } : {}),
    ...(it.timeboxMin ? { timeboxMin: it.timeboxMin } : {}),
    status: it.status,
    manual,
    changedBy: it.changedBy,
    outcome: it.outcome,
  }
}

/** The tasks' three-state view of a protocol status. Terminal statuses are never asked about. */
export function trackStatus(s: AgendaItemStatus): TrackStatus {
  return s === 'open' ? 'not_started' : s === 'in-progress' ? 'in_progress' : 'covered'
}

export const isOpen = (s: AgendaItemStatus): boolean => s === 'open' || s === 'in-progress'

// ------------------------------------------------------------------------------ gate + guard

/** Not worth even a relevance call: filler ("yeah", "can you hear me?") or under three words. */
export function trivialLine(text: string): boolean {
  const t = text.trim()
  return !t || FILLER.test(t) || t.split(/\s+/).length < 3
}

export type GateResult = { relevant: boolean; p: number; itemIds: string[]; result: DecisionResult | null }

/** The relevance pre-check: is this closed segment worth a status round? */
export async function gateSegment(
  provider: DecisionProvider,
  input: {
    items: readonly AgendaItemInput[]
    recent: readonly Pick<TranscriptLine, 'speaker' | 'text'>[]
    segment: Pick<TranscriptLine, 'speaker' | 'text'>
  },
  threshold = 0.5,
): Promise<GateResult> {
  if (trivialLine(input.segment.text) || !input.items.length)
    return { relevant: false, p: 0, itemIds: [], result: null }
  const { decision, result } = await decideRelevance(
    provider,
    { agenda: input.items, recent: input.recent, segment: input.segment },
    threshold,
  )
  return { relevant: decision.relevant, p: decision.p, itemIds: decision.itemIds, result }
}

export type GuardResult = { injection: boolean; p: number; result: DecisionResult | null }

/** The injection guardrail on one line of live speech. Trivial lines are never injections. */
export async function guardLine(
  provider: DecisionProvider,
  line: Pick<TranscriptLine, 'speaker' | 'text'>,
  threshold = 0.5,
): Promise<GuardResult> {
  if (trivialLine(line.text)) return { injection: false, p: 0, result: null }
  const { decision, result } = await decideInjection(provider, line, threshold)
  return { injection: decision.injection, p: decision.p, result }
}

// ------------------------------------------------------------------------------ status round

export type ItemVerdict = {
  itemId: string
  pCovered: number
  action: PolicyAction
  /** The line that shows it (for auto-covered, the one the policy required). */
  evidence: { lineId: string; quote: string; confidence: number } | null
  /** info-to-get: the answer heard (from the interview decision when one ran, else the status round). */
  answer: string | null
  status: StatusDecision
  interview: InterviewDecision | null
}

export type RoundResult = { verdicts: ItemVerdict[]; results: DecisionResult[] }

const norm = (s: string) => [...contentWords(s)].join(' ')

/** The window line that carries `answer` (its content words all present), latest first. */
export function lineWithAnswer(window: readonly TranscriptLine[], answer: string): TranscriptLine | null {
  const want = contentWords(answer)
  if (!want.size) return null
  for (let i = window.length - 1; i >= 0; i--) {
    const have = contentWords(window[i]!.text)
    if ([...want].every((w) => have.has(w))) return window[i]!
  }
  return null
}

/**
 * One status round over the open items: the batched status question, then the interview question for
 * interview items that have come up (and covered info-to-get items the tracker answered, when the talk
 * returns to them: an answer can be corrected), then the policy. Returns what to do; applying it is the
 * caller's (the store's rules have the last word).
 */
export async function statusRound(
  provider: DecisionProvider,
  o: {
    items: readonly LiveItem[]
    window: readonly TranscriptLine[]
    /** Items the relevance pre-check pointed at (re-check interview answers of these). */
    focus?: readonly string[]
    thresholds?: StatusThresholds
  },
): Promise<RoundResult> {
  const t = o.thresholds ?? DEFAULT_THRESHOLDS
  const results: DecisionResult[] = []
  const open = o.items.filter((it) => isOpen(it.status) && !it.manual)
  const verdicts: ItemVerdict[] = []
  if (!o.window.length) return { verdicts, results }
  let decisions: StatusDecision[] = []
  if (open.length) {
    const r = await decideStatus(provider, { items: open, window: o.window })
    results.push(r.result)
    decisions = r.decisions
  }
  const byId = new Map(o.items.map((it) => [it.id, it]))
  // interview items: those the status round says have come up, and tracker-answered ones in focus
  const interviewFor = [
    ...decisions
      .filter((d) => INTERVIEW_KINDS.has(byId.get(d.itemId)!.kind) && d.status !== 'not_started')
      .map((d) => byId.get(d.itemId)!),
    ...o.items.filter(
      (it) =>
        it.kind === 'info-to-get' &&
        it.status === 'covered' &&
        it.changedBy === 'tracker' &&
        o.focus?.includes(it.id),
    ),
  ]
  const interviews = new Map<string, InterviewDecision>()
  await Promise.all(
    interviewFor.map(async (item) => {
      const r = await decideInterview(provider, {
        item,
        transcript: o.window.map((l) => ({ speaker: l.speaker, text: l.text })),
      })
      results.push(r.result)
      interviews.set(item.id, r.decision)
    }),
  )
  for (const d of decisions) {
    const item = byId.get(d.itemId)!
    const iv = interviews.get(d.itemId) ?? null
    let pCovered = d.pCovered
    let evidence = d.evidence
    let answer = d.answer
    if (iv) {
      // the interview decision is the more specific question: answered? + the value
      pCovered = iv.p
      answer = iv.answer
      const line = iv.answer ? lineWithAnswer(o.window, iv.answer) : null
      if (line) evidence = { lineId: line.id, quote: line.text, confidence: iv.answerConfidence }
    }
    const decision: StatusDecision = { ...d, pCovered, evidence, answer }
    verdicts.push({
      itemId: d.itemId,
      pCovered,
      action: statusPolicy(trackStatus(item.status), item.manual, decision, t),
      evidence,
      answer,
      status: decision,
      interview: iv,
    })
  }
  // corrections of answers the tracker already recorded: no status move, maybe a new outcome
  for (const [id, iv] of interviews) {
    if (verdicts.some((v) => v.itemId === id)) continue
    const line = iv.answer ? lineWithAnswer(o.window, iv.answer) : null
    verdicts.push({
      itemId: id,
      pCovered: iv.p,
      action: { kind: 'none' },
      evidence: line ? { lineId: line.id, quote: line.text, confidence: iv.answerConfidence } : null,
      answer: iv.answered ? iv.answer : null,
      status: {
        itemId: id,
        status: 'covered',
        pCovered: iv.p,
        pInProgress: 0,
        confidence: iv.answerConfidence,
        evidence: null,
        answer: iv.answer,
        answerConfidence: iv.answerConfidence,
        source: iv.source,
      },
      interview: iv,
    })
  }
  return { verdicts, results }
}

/** A corrected answer worth writing: answered with confidence, and a different value than recorded. */
export function correctedAnswer(item: LiveItem, v: ItemVerdict, t = DEFAULT_THRESHOLDS): string | null {
  if (!v.interview?.answered || !v.answer || v.pCovered < t.auto) return null
  if (!item.outcome) return v.answer
  return norm(item.outcome) === norm(v.answer) ? null : v.answer
}

// ------------------------------------------------------------------------------ next talking point

export type NextPointContext = {
  items: readonly LiveItem[]
  /** Minutes since the recording started. */
  elapsedMin: number
  /** Minutes until the calendar end; null without a meeting end (no time pressure then). */
  remainingMin: number | null
  recent: readonly Pick<TranscriptLine, 'speaker' | 'text'>[]
  /** Item id → minutes since it was last discussed (from the tracker's evidence). */
  lastDiscussedMinAgo?: ReadonlyMap<string, number>
  /** Items not to propose (dismissed a moment ago, or being discussed right now). */
  exclude?: ReadonlySet<string>
}

/** Rank the open items for "what next" (decision × code-side prior). */
export async function rankNextPoint(provider: DecisionProvider, c: NextPointContext) {
  const agenda: NextPointItem[] = c.items
    .filter((it) => !c.exclude?.has(it.id) || !isOpen(it.status))
    .map((it) => ({
      id: it.id,
      text: it.text,
      kind: it.kind,
      ...(it.owner ? { owner: it.owner } : {}),
      ...(it.timeboxMin ? { timeboxMin: it.timeboxMin } : {}),
      status: it.status,
      ...(c.lastDiscussedMinAgo?.has(it.id)
        ? { lastDiscussedMinAgo: c.lastDiscussedMinAgo.get(it.id)! }
        : {}),
    }))
  return decideNextPoint(provider, {
    agenda,
    elapsedMin: c.elapsedMin,
    // no calendar end: no time pressure (the prior only reacts at ≤ 10 min)
    remainingMin: c.remainingMin ?? 60,
    recent: c.recent,
  })
}

const minutes = (m: number) => `${Math.max(0, Math.round(m))} min`

/** The next-point line when no text LLM is configured. */
export function nextPointTemplate(
  item: Pick<LiveItem, 'text' | 'kind'>,
  remainingMin: number | null,
): string {
  const why =
    item.kind === 'must-cover'
      ? remainingMin !== null && remainingMin <= 10
        ? ` — must cover, ${minutes(remainingMin)} left`
        : ' — must cover'
      : item.kind === 'info-to-get'
        ? ' — still to find out'
        : item.kind === 'decision'
          ? ' — needs a decision'
          : ''
  return `Next: ${item.text}${why}`
}

/** The T-5 min nudge: must-cover (then info-to-get) items still open, or null when none are. */
export function notCoveredText(items: readonly LiveItem[], remainingMin: number): string | null {
  const left = items.filter(
    (it) => isOpen(it.status) && (it.kind === 'must-cover' || it.kind === 'info-to-get'),
  )
  if (!left.length) return null
  left.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'must-cover' ? -1 : 1))
  const list = left.map((it) => it.text).join('; ')
  return `Not covered yet, ${minutes(remainingMin)} left: ${list}`.slice(0, 1000)
}
