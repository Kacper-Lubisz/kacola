import { choiceAnswer, extractAnswer } from '../answers.ts'
import type { LocalRule, RuleContext } from '../local/provider.ts'
import type {
  Answer,
  ChoiceAnswer,
  DecisionProvider,
  DecisionResult,
  ExtractAnswer,
  Question,
} from '../types.ts'
import { contentWords, DEFER_CUE, DEFLECT_CUE, overlap, QUESTION, SETTLE_CUE, VALUE } from './text.ts'
import type { AgendaItemInput, TrackStatus, TranscriptLine } from './types.ts'

// Item status decisions — the tracker's core question, asked on each closed segment (and a heartbeat):
// for every open agenda item, where is it (not started / in progress / covered), which line shows it,
// and for info-to-get items, what answer was heard. One batched decision call per round.
//
// The state is small and focused on purpose (docs.typesafe.ai/model-jaggedness/jev-1.13.md, "large state
// full of irrelevant detail"): the recent transcript window plus the items being asked about.

export const TAG_STATUS = 'agenda.status'
export const TAG_EVIDENCE = 'agenda.evidence'
export const TAG_ANSWER = 'agenda.answer'

export type StatusRoundInput = {
  /** The items still open (the tracker stops asking about covered / manual items). */
  items: readonly AgendaItemInput[]
  /** The recent window, oldest first; `id` is what evidence points back to. */
  window: readonly TranscriptLine[]
  /**
   * The speaker label of the person the agenda belongs to (the mic track, `me`), when their lines should be
   * read as such: a question they ask raises an item to find out, someone else's answer covers it.
   */
  owner?: string
}

export type StatusDecision = {
  itemId: string
  status: TrackStatus
  pCovered: number
  pInProgress: number
  confidence: number
  /** The line that best shows the item's state, or null. */
  evidence: { lineId: string; quote: string; confidence: number } | null
  /** info-to-get: the answer heard (short), or null. */
  answer: string | null
  answerConfidence: number | null
  source: Answer['source']
}

const STATUS_OPTIONS = (item: AgendaItemInput): Record<TrackStatus, string> => ({
  not_started: 'Nobody has raised this item in the transcript yet.',
  in_progress:
    item.kind === 'info-to-get'
      ? 'The item has come up (for example the question was asked), but the answer has not been given yet, or was refused or deferred.'
      : 'The item has been raised or discussed, but nothing about it has been agreed, decided, answered or closed yet (or it was explicitly left open).',
  covered:
    item.kind === 'info-to-get'
      ? 'The information was given: someone stated the answer.'
      : item.kind === 'competency'
        ? 'The candidate gave concrete evidence of this competency.'
        : 'The item has been settled: something about it was agreed, decided or answered, or it was explicitly closed. An implicit settlement (e.g. "book it, I will approve it") counts.',
})

/** The batched questions for one round, plus how to read the answers back. */
export function statusQuestions(input: StatusRoundInput) {
  const state = {
    agenda: input.items.map((it, i) => ({ ref: `item${i}`, item: it.text, kind: it.kind })),
    transcript: input.window.map((l) => ({ speaker: l.speaker, text: l.text })),
  }
  const lines = uniqueLines(input.window)
  const questions: Question[] = []
  input.items.forEach((it, i) => {
    questions.push({
      id: `status.${i}`,
      kind: 'choice',
      tag: TAG_STATUS,
      instructions: `In \`transcript\`, what is the status of the agenda item \`agenda[${i}]\` ("${it.text}")?${ownerHint(it, input)}`,
      options: STATUS_OPTIONS(it),
    })
    if (lines.length)
      questions.push({
        id: `evidence.${i}`,
        kind: 'extract',
        tag: TAG_EVIDENCE,
        instructions: `Which transcript line best shows where the agenda item "${it.text}" stands (where it was settled, or else where it was last discussed)? Null if none is about it.`,
        candidates: lines.map((l) => l.text),
      })
    if (it.kind === 'info-to-get')
      questions.push({
        id: `answer.${i}`,
        kind: 'extract',
        tag: TAG_ANSWER,
        maxLength: 80,
        instructions: `What answer was given in \`transcript\` for "${it.text}"? A short value (a number, range, date, name or a few words). If it was corrected later, the corrected value. Null if it was not answered or was refused.`,
      })
  })
  return { state, questions }
}

/** Item kinds the agenda's owner asks about: their own question raises them, an answer covers them. */
export const ASKED_KINDS: ReadonlySet<string> = new Set(['info-to-get', 'question'])

function ownerHint(it: AgendaItemInput, input: StatusRoundInput): string {
  if (!input.owner || !ASKED_KINDS.has(it.kind) || !input.window.some((l) => l.speaker === input.owner))
    return ''
  return ` Speaker "${input.owner}" owns this agenda and wants this found out: their own question or guess only raises it; it is covered when another speaker gives the answer.`
}

function uniqueLines(window: readonly TranscriptLine[]): TranscriptLine[] {
  const seen = new Set<string>()
  return window.filter((l) => {
    const t = l.text.trim()
    if (!t || seen.has(t)) return false
    seen.add(t)
    return true
  })
}

export function readStatus(input: StatusRoundInput, r: DecisionResult): StatusDecision[] {
  const byText = new Map(uniqueLines(input.window).map((l) => [l.text.trim(), l]))
  return input.items.map((it, i) => {
    const s = r.answers[`status.${i}`] as ChoiceAnswer
    const e = r.answers[`evidence.${i}`] as ExtractAnswer | undefined
    const a = r.answers[`answer.${i}`] as ExtractAnswer | undefined
    const line = e?.value ? byText.get(e.value.trim()) : undefined
    return {
      itemId: it.id,
      status: s.choice as TrackStatus,
      pCovered: s.probabilities.covered ?? 0,
      pInProgress: s.probabilities.in_progress ?? 0,
      confidence: s.confidence,
      evidence: line && e ? { lineId: line.id, quote: line.text, confidence: e.confidence } : null,
      answer: a?.value ?? null,
      answerConfidence: a ? a.confidence : null,
      source: s.source,
    }
  })
}

/** One tracker round: ask, read back. Never throws past the caller's decision (errors propagate as LlmError). */
export async function decideStatus(
  provider: DecisionProvider,
  input: StatusRoundInput,
  opts: { signal?: AbortSignal } = {},
): Promise<{ decisions: StatusDecision[]; result: DecisionResult }> {
  if (!input.items.length) throw new Error('no open items to decide')
  const { state, questions } = statusQuestions(input)
  const result = await provider.decide({ state, questions }, opts)
  return { decisions: readStatus(input, result), result }
}

// ----------------------------------------------------------------------------------------- policy

export type StatusThresholds = { auto: number; suggest: number }
/** The brief's rules: ≥ 0.8 with evidence → auto check-off (undoable); 0.5–0.8 → "looks covered?". */
export const DEFAULT_THRESHOLDS: StatusThresholds = { auto: 0.8, suggest: 0.5 }

export type PolicyAction =
  | { kind: 'auto-covered'; evidence: NonNullable<StatusDecision['evidence']> }
  | { kind: 'suggest-covered' }
  | { kind: 'in-progress' }
  | { kind: 'none' }

/**
 * What the tracker does with a decision. Forward-only (covered never goes back; in-progress never goes
 * back to not started) and manual always wins (a user-set status is never touched).
 */
export function statusPolicy(
  current: TrackStatus,
  manual: boolean,
  d: StatusDecision,
  t: StatusThresholds = DEFAULT_THRESHOLDS,
): PolicyAction {
  if (manual || current === 'covered') return { kind: 'none' }
  if (d.pCovered >= t.auto && d.evidence) return { kind: 'auto-covered', evidence: d.evidence }
  if (d.pCovered >= t.suggest) return { kind: 'suggest-covered' }
  if (current === 'not_started' && (d.status === 'in_progress' || d.status === 'covered'))
    return { kind: 'in-progress' }
  return { kind: 'none' }
}

// ----------------------------------------------------------------------------------------- local rules

type Analysis = {
  related: number[]
  settle: number | null
  defer: number | null
  answer: { line: number; value: string } | null
}
type StatusState = {
  agenda: { item: string; kind: string }[]
  transcript: { speaker: string; text: string }[]
}

const cache = new WeakMap<object, Map<number, Promise<Analysis>>>()

/** Lexical overlap, then embedding similarity, decides which window lines are about an item. */
async function analyse(ctx: RuleContext, i: number): Promise<Analysis> {
  const st = ctx.state as unknown as StatusState
  let perState = cache.get(ctx.state as object)
  if (!perState) {
    perState = new Map()
    cache.set(ctx.state as object, perState)
  }
  let p = perState.get(i)
  if (!p) {
    p = (async () => {
      const item = st.agenda[i]!
      const lines = st.transcript
      const iw = contentWords(item.item)
      const [iv, ...lv] = await ctx.embed([item.item, ...lines.map((l) => l.text)])
      const related: number[] = []
      lines.forEach((l, j) => {
        let sim = 0
        for (let k = 0; k < iv!.length; k++) sim += iv![k]! * lv[j]![k]!
        if (overlap(iw, contentWords(l.text)) >= 1 || sim >= 0.45) related.push(j)
      })
      let settle: number | null = null
      let defer: number | null = null
      let answer: Analysis['answer'] = null
      if (related.length) {
        const first = related[0]!
        const last = related.at(-1)!
        // a cue counts when it comes after the item was raised and within two lines of the last mention
        for (let j = first; j < lines.length && j <= last + 2; j++) {
          const t = lines[j]!.text
          if (DEFER_CUE.test(t)) defer = j
          else if (SETTLE_CUE.test(t) && j > first - 1) settle = j
        }
        if (defer !== null && settle !== null && defer > settle) settle = null
        if (item.kind === 'info-to-get') {
          // the answer: a line by someone other than the asker, after a related question, that is not a deflection
          for (let j = first; j < lines.length; j++) {
            const l = lines[j]!
            if (QUESTION.test(l.text) || DEFLECT_CUE.test(l.text)) continue
            if (
              j > 0 &&
              lines.slice(first, j).some((q) => QUESTION.test(q.text) && q.speaker !== l.speaker)
            ) {
              const v = VALUE.exec(l.text)?.[0]?.trim()
              if (v || related.includes(j)) answer = { line: j, value: v ?? l.text }
            }
          }
          if (answer) settle = Math.max(settle ?? -1, answer.line)
        }
      }
      return { related, settle, defer, answer }
    })()
    perState.set(i, p)
  }
  return p
}

const idx = (q: Question) => Number(q.id.split('.')[1])

export const statusRule: LocalRule = {
  tag: TAG_STATUS,
  async answer(q, ctx) {
    if (q.kind !== 'choice') return null
    const a = await analyse(ctx, idx(q))
    let w: Record<TrackStatus, number>
    if (!a.related.length) w = { not_started: 0.85, in_progress: 0.12, covered: 0.03 }
    else if (a.settle !== null) w = { not_started: 0.02, in_progress: 0.13, covered: 0.85 }
    else if (a.defer !== null) w = { not_started: 0.05, in_progress: 0.85, covered: 0.1 }
    else w = { not_started: 0.1, in_progress: 0.7, covered: 0.2 }
    return choiceAnswer(q, w, 'heuristic')
  },
}

export const evidenceRule: LocalRule = {
  tag: TAG_EVIDENCE,
  async answer(q, ctx) {
    if (q.kind !== 'extract') return null
    const a = await analyse(ctx, idx(q))
    const st = ctx.state as unknown as StatusState
    const j = a.settle ?? a.related.at(-1)
    return j === undefined || j === null
      ? extractAnswer(q, null, 0.8, 'heuristic')
      : extractAnswer(q, st.transcript[j]!.text, a.settle !== null ? 0.8 : 0.5, 'heuristic')
  },
}

export const answerRule: LocalRule = {
  tag: TAG_ANSWER,
  async answer(q, ctx) {
    if (q.kind !== 'extract') return null
    const a = await analyse(ctx, idx(q))
    return a.answer
      ? extractAnswer(q, a.answer.value, 0.7, 'heuristic')
      : extractAnswer(q, null, 0.7, 'heuristic')
  },
}
