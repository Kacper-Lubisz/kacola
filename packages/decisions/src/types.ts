import type { Usage } from '@kacola/protocol'

// The typed-decision contract. A decision is not text: it is an answer drawn from a set the caller
// defined (an option, a level, yes/no, or a short value copied from the input), with a probability the
// caller can threshold. Many questions about the same state go in one call (they are evaluated
// independently, so adding one never changes another's answer on a provider that honours that).

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

/** What the questions are about: text, or structured data (a transcript window, an agenda). */
export type DecisionState = string | { [key: string]: JsonValue } | JsonValue[]

type QuestionBase = {
  /** Your key; the answer comes back under it. Never sent to a model as meaning — write it all in `instructions`. */
  id: string
  /** The question, phrased so a knowledgeable person could answer it in a second from the state. */
  instructions: string
  /** Optional routing label (`agenda.status`, `guardrail.injection`): selects local rules and groups evals. */
  tag?: string
}

/** Pick one option. Options map a key to a description (null = the key says it all). Max 255. */
export type ChoiceQuestion = QuestionBase & { kind: 'choice'; options: Record<string, string | null> }
/** Rate on ordered levels (2–10), lowest first. The answer is normalised to 0..1. */
export type ScoreQuestion = QuestionBase & { kind: 'score'; levels: string[] }
/** A yes/no question: the answer is the probability of yes (TypeSafe's "noul"). */
export type YesNoQuestion = QuestionBase & { kind: 'yesno'; yes?: string; no?: string }
/**
 * Pull a short value out of the state, or null when it is not there. With `candidates`, the value is
 * one of them copied verbatim (the pre-parsed pattern: code finds spans, the model picks one); without,
 * providers that can only choose (jev, local) derive candidates from the state's sentences.
 */
export type ExtractQuestion = QuestionBase & { kind: 'extract'; candidates?: string[]; maxLength?: number }

export type Question = ChoiceQuestion | ScoreQuestion | YesNoQuestion | ExtractQuestion
export type QuestionKind = Question['kind']

/**
 * Where a probability came from — callers must not treat these alike:
 *  - `calibrated`: the model is trained to return calibrated probabilities (TypeSafe Jev).
 *  - `logprobs`: read off the model's token distribution (OpenAI non-reasoning models).
 *  - `self-reported`: the model wrote a number. Uncalibrated; use only after measuring it.
 *  - `heuristic`: similarity / rules on device. Uncalibrated.
 */
export type ConfidenceSource = 'calibrated' | 'logprobs' | 'self-reported' | 'heuristic'

export type ChoiceAnswer = {
  kind: 'choice'
  choice: string
  /** Every option → probability; sums to 1. */
  probabilities: Record<string, number>
  /** 0..1, how peaked the distribution is (TypeSafe's definition: (n·max − 1)/(n − 1)). */
  confidence: number
  source: ConfidenceSource
}
export type ScoreAnswer = {
  kind: 'score'
  /** Probability-weighted level, normalised to 0..1 (level / (levels − 1)). */
  score: number
  /** Probability-weighted level on the original 0..levels−1 scale. */
  level: number
  /** Per level, lowest first; sums to 1. */
  probabilities: number[]
  confidence: number
  source: ConfidenceSource
}
export type YesNoAnswer = {
  kind: 'yesno'
  /** Probability the answer is yes. */
  p: number
  /** |2p − 1|: 0 at a coin flip, 1 when certain either way. */
  confidence: number
  source: ConfidenceSource
}
export type ExtractAnswer = {
  kind: 'extract'
  value: string | null
  /** Probability the value is right (or, for null, that it is really absent). */
  confidence: number
  source: ConfidenceSource
}
export type Answer = ChoiceAnswer | ScoreAnswer | YesNoAnswer | ExtractAnswer
export type AnswerFor<Q extends Question> = Q extends ChoiceQuestion
  ? ChoiceAnswer
  : Q extends ScoreQuestion
    ? ScoreAnswer
    : Q extends YesNoQuestion
      ? YesNoAnswer
      : ExtractAnswer

export type DecisionRequest = { state: DecisionState; questions: Question[] }

export type DecideOptions = {
  signal?: AbortSignal | undefined
  /** Per attempt. Default: the provider's (10 s for hosted providers, 30 s for Ollama). */
  timeoutMs?: number
}

export type DecisionResult = {
  answers: Record<string, Answer>
  provider: DecisionProviderId
  /** The model that answered (a versioned id when the API reports one). */
  model: string
  usage: Usage
  /** Null when the model has no known price (local models cost nothing per token). */
  costUsd: number | null
  /** Wall clock for the whole decide(), retries included. */
  latencyMs: number
  /** HTTP calls made (batches × attempts). */
  calls: number
  retries: number
}

export type DecisionProviderId = 'jev' | 'openai' | 'anthropic' | 'ollama' | 'local' | 'replay'

export interface DecisionProvider {
  readonly id: DecisionProviderId
  readonly model: string
  /** How this provider's probabilities are produced (see ConfidenceSource). */
  readonly confidence: ConfidenceSource
  /** Most questions sent in one call; larger requests are split. */
  readonly maxQuestionsPerCall: number
  decide(req: DecisionRequest, opts?: DecideOptions): Promise<DecisionResult>
}
