import { LlmError } from '@gnomeola/llm'
import type {
  Answer,
  ChoiceAnswer,
  ChoiceQuestion,
  ConfidenceSource,
  DecisionState,
  ExtractAnswer,
  ExtractQuestion,
  Question,
  ScoreAnswer,
  ScoreQuestion,
  YesNoAnswer,
} from './types.ts'

// Building and checking answers, shared by every provider so they agree on what an answer means.

export const MAX_CHOICE_OPTIONS = 255
export const MAX_SCORE_LEVELS = 10
export const NONE_OPTION = '__none__'

const clamp01 = (x: number) => (Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0)

/**
 * TypeSafe's confidence for a distribution over n outcomes: (n·max − 1)/(n − 1), clamped to 0..1
 * (docs.typesafe.ai/confidence.md). 1 when all mass is on one outcome, 0 when it is uniform.
 */
export function peakConfidence(probs: readonly number[]): number {
  const n = probs.length
  if (n < 2) return 1
  const peak = Math.max(...probs)
  return clamp01((n * peak - 1) / (n - 1))
}

/** Scale non-negative weights to sum to 1 (uniform when they are all zero or invalid). */
export function normalize(weights: readonly number[]): number[] {
  const w = weights.map((x) => (Number.isFinite(x) && x > 0 ? x : 0))
  const sum = w.reduce((a, b) => a + b, 0)
  return sum > 0 ? w.map((x) => x / sum) : w.map(() => 1 / w.length)
}

export function softmax(xs: readonly number[], temperature = 1): number[] {
  const m = Math.max(...xs)
  return normalize(xs.map((x) => Math.exp((x - m) / temperature)))
}

export function choiceAnswer(
  q: ChoiceQuestion,
  weights: Record<string, number>,
  source: ConfidenceSource,
): ChoiceAnswer {
  const keys = Object.keys(q.options)
  const probs = normalize(keys.map((k) => weights[k] ?? 0))
  const probabilities = Object.fromEntries(keys.map((k, i) => [k, probs[i]!]))
  let best = 0
  for (let i = 1; i < keys.length; i++) if (probs[i]! > probs[best]!) best = i
  return { kind: 'choice', choice: keys[best]!, probabilities, confidence: peakConfidence(probs), source }
}

export function scoreAnswer(
  q: ScoreQuestion,
  weights: readonly number[],
  source: ConfidenceSource,
): ScoreAnswer {
  const n = q.levels.length
  const probabilities = normalize(Array.from({ length: n }, (_, i) => weights[i] ?? 0))
  const level = probabilities.reduce((acc, p, i) => acc + p * i, 0)
  return {
    kind: 'score',
    level,
    score: n > 1 ? level / (n - 1) : 0,
    probabilities,
    confidence: peakConfidence(probabilities),
    source,
  }
}

export function yesNoAnswer(p: number, source: ConfidenceSource): YesNoAnswer {
  const pp = clamp01(p)
  return { kind: 'yesno', p: pp, confidence: Math.abs(2 * pp - 1), source }
}

export function extractAnswer(
  q: ExtractQuestion,
  value: string | null,
  confidence: number,
  source: ConfidenceSource,
): ExtractAnswer {
  let v = value?.trim() || null
  if (v && q.maxLength && v.length > q.maxLength) v = v.slice(0, q.maxLength).trimEnd()
  return { kind: 'extract', value: v, confidence: clamp01(confidence), source }
}

/** Throws (as a non-retryable bad_request) when the questions cannot be sent anywhere. */
export function validateQuestions(questions: readonly Question[]): void {
  if (questions.length === 0) throw new LlmError('bad_request', 'no questions to decide')
  const seen = new Set<string>()
  for (const q of questions) {
    if (!q.id || !/^[A-Za-z0-9_.:-]{1,128}$/.test(q.id))
      throw new LlmError(
        'bad_request',
        `question id ${JSON.stringify(q.id)} must match [A-Za-z0-9_.:-]{1,128}`,
      )
    if (seen.has(q.id)) throw new LlmError('bad_request', `duplicate question id ${q.id}`)
    seen.add(q.id)
    if (!q.instructions.trim()) throw new LlmError('bad_request', `question ${q.id} has no instructions`)
    if (q.kind === 'choice') {
      const n = Object.keys(q.options).length
      if (n < 2 || n > MAX_CHOICE_OPTIONS)
        throw new LlmError('bad_request', `choice ${q.id} needs 2–${MAX_CHOICE_OPTIONS} options, got ${n}`)
      if (NONE_OPTION in q.options)
        throw new LlmError('bad_request', `choice ${q.id}: ${NONE_OPTION} is reserved`)
    } else if (q.kind === 'score') {
      if (q.levels.length < 2 || q.levels.length > MAX_SCORE_LEVELS)
        throw new LlmError('bad_request', `score ${q.id} needs 2–${MAX_SCORE_LEVELS} levels`)
    } else if (q.kind === 'extract' && q.candidates && q.candidates.length > MAX_CHOICE_OPTIONS - 1) {
      throw new LlmError('bad_request', `extract ${q.id}: at most ${MAX_CHOICE_OPTIONS - 1} candidates`)
    }
  }
}

/** A provider answered something other than what was asked: the response is broken, not the request. */
export function invalidResponse(provider: string, detail: string): LlmError {
  return new LlmError('server', `${provider} returned an invalid decision: ${detail}`)
}

/** Every question answered, with the kind asked. */
export function checkAnswers(
  provider: string,
  questions: readonly Question[],
  answers: Record<string, Answer>,
) {
  for (const q of questions) {
    const a = answers[q.id]
    if (!a) throw invalidResponse(provider, `no answer for ${q.id}`)
    if (a.kind !== q.kind)
      throw invalidResponse(provider, `${q.id} answered as ${a.kind}, asked as ${q.kind}`)
    if (a.kind === 'choice' && !(a.choice in (q as ChoiceQuestion).options))
      throw invalidResponse(provider, `${q.id} chose unknown option ${JSON.stringify(a.choice)}`)
  }
}

/** A deterministic text rendering of a state (for embedders and prompts). */
export function stateText(state: DecisionState): string {
  return typeof state === 'string' ? state : JSON.stringify(state, null, 1)
}

/**
 * Candidate spans for an extraction when the caller gave none: the state's sentences (and, for a
 * transcript-shaped state, each line), deduplicated, in order. Recall-tuned, like the regex step in
 * docs.typesafe.ai/cookbooks/pre_parsed_value_extraction_cookbook.md.
 */
/** Fields of a structured state that label content rather than being content (never candidates). */
const LABEL_KEYS = /^(speaker|who|id|ids|kind|type|role|tag|status|owner|at|atMs|startMs|endMs|segmentId)$/

export function deriveCandidates(state: DecisionState, max = MAX_CHOICE_OPTIONS - 1): string[] {
  const texts: string[] = []
  const walk = (v: unknown) => {
    if (typeof v === 'string') texts.push(v)
    else if (Array.isArray(v)) for (const x of v) walk(x)
    else if (v && typeof v === 'object')
      for (const [k, x] of Object.entries(v)) if (!LABEL_KEYS.test(k)) walk(x)
  }
  walk(state)
  const out: string[] = []
  const seen = new Set<string>()
  for (const t of texts)
    for (const s of t.split(/(?<=[.!?])\s+|\n+/)) {
      const c = s.trim()
      if (c.length < 2 || seen.has(c)) continue
      seen.add(c)
      out.push(c)
    }
  return out.slice(-max)
}
