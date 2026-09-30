// TypeSafe AI's Jev ("System One") over the official JS SDK (@typesafe-ai/sdk, MIT — GPL-compatible).
//
// Wire format (docs.typesafe.ai/api.md):
//   POST {baseURL}/v1/systemone   Authorization: Bearer <TYPESAFE_API_KEY>
//   { state, model: 'jev-latest', questions: { <id>: { type: 'choice'|'score'|'noul', instructions, criteria } } }
//   → { model: 'jev-1.13.0', answers: { <id>: { type, choice, probabilities, confidence } | { type, score,
//       legend, probabilities, confidence } | { type, noul } }, usage: { input_tokens, output_tokens } }
//
// Mapping of our question kinds (docs.typesafe.ai/primitives.md and primitives/*):
//   choice  → Choice (criteria: option → description | null; ≤ 255 options)
//   score   → Score  (criteria: ordered levels, 2–10); answer normalised to 0..1
//   yesno   → Noul   (criteria { true, false } when yes/no descriptions are given)
//   extract → Choice over candidate spans + a "none" escape hatch — Jev chooses, it does not generate
//             (docs.typesafe.ai/cookbooks/pre_parsed_value_extraction_cookbook.md); the value is the
//             chosen span copied verbatim.
//
// Probabilities are calibrated by training (docs.typesafe.ai/confidence.md). All questions about one
// state go in one request: Jev evaluates them in parallel and independently (primitives.md, "Ask
// multiple questions together"; patterns/fan-out.md). Price: $0.042 per million input tokens, output
// free (docs.typesafe.ai/models.md, jev-1.13).

import { LlmError } from '@gnomeola/llm'
import type { Usage } from '@gnomeola/protocol'
import {
  APIConnectionError,
  APIError,
  APITimeoutError,
  APIUserAbortError,
  AuthenticationError,
  BadRequestError,
  InternalServerError,
  NotFoundError,
  PermissionDeniedError,
  RateLimitError,
  type Question as TsQuestion,
  TypeSafeClient,
  UnprocessableEntityError,
} from '@typesafe-ai/sdk'
import {
  choiceAnswer,
  deriveCandidates,
  extractAnswer,
  invalidResponse,
  scoreAnswer,
  yesNoAnswer,
} from './answers.ts'
import { BaseDecisionProvider, type BaseOptions, type CallResult } from './base.ts'
import type { Answer, DecisionState, ExtractQuestion, JsonValue, Question } from './types.ts'

export const DEFAULT_JEV_MODEL = 'jev-latest'
export const DEFAULT_TYPESAFE_URL = 'https://api.typesafe.ai'
/** USD per million input tokens (jev-1.13); output tokens are free. */
export const JEV_PRICE_PER_MTOK = 0.042
/** The escape hatch on every extraction: "none of the candidates fits". */
export const JEV_NONE = 'none'
const NONE_DESCRIPTION = 'None of these is the requested value.'

export type JevProviderOptions = BaseOptions & {
  apiKey: string
  model?: string
  /** Default: TYPESAFE_BASE_URL, else https://api.typesafe.ai. */
  baseURL?: string
  fetch?: typeof fetch
  /** Questions per request. Jev packs many cheaply (64k context); keep batches modest for latency. */
  maxQuestionsPerCall?: number
}

type RawAnswer = {
  type?: string
  choice?: string
  probabilities?: Record<string, number>
  confidence?: number
  score?: number
  noul?: number
}

export class JevDecisionProvider extends BaseDecisionProvider {
  readonly id = 'jev' as const
  readonly model: string
  readonly confidence = 'calibrated' as const
  readonly maxQuestionsPerCall: number
  readonly #client: TypeSafeClient

  constructor(opts: JevProviderOptions) {
    super(opts)
    this.model = opts.model || DEFAULT_JEV_MODEL
    this.maxQuestionsPerCall = opts.maxQuestionsPerCall ?? 64
    this.#client = new TypeSafeClient({
      apiKey: opts.apiKey,
      baseURL: opts.baseURL ?? process.env.TYPESAFE_BASE_URL ?? DEFAULT_TYPESAFE_URL,
      defaultModel: this.model,
      // our retry policy and timeout (base.ts) own this; the SDK's would double them
      retry: { maxRetries: 0 },
      timeout: this.timeoutMs + 1_000,
      logLevel: 'off',
      ...(opts.fetch
        ? { fetch: opts.fetch as (input: string, init?: RequestInit) => Promise<Response> }
        : {}),
    })
  }

  /** The request body this provider sends for a batch (exported for tests and docs). */
  buildRequest(state: DecisionState, questions: readonly Question[]) {
    const out: Record<string, TsQuestion> = {}
    for (const q of questions) out[q.id] = toTsQuestion(q, state)
    return { state: state as JsonValue as never, model: this.model, questions: out }
  }

  protected async call(
    state: DecisionState,
    questions: Question[],
    signal: AbortSignal,
  ): Promise<CallResult> {
    let res: Awaited<ReturnType<TypeSafeClient['systemOne']>>
    try {
      res = await this.#client.systemOne(this.buildRequest(state, questions), { signal })
    } catch (err) {
      throw toJevError(err)
    }
    const answers: Record<string, Answer> = {}
    const raw = res.answers as Record<string, RawAnswer | undefined>
    for (const q of questions) {
      const a = raw[q.id]
      if (!a) throw invalidResponse('jev', `no answer for ${q.id}`)
      answers[q.id] = fromTsAnswer(q, a, state)
    }
    return { answers, usage: toUsage(res.usage), model: res.model }
  }

  protected price(usage: Usage): number {
    return ((usage.inputTokens + usage.cacheReadTokens) * JEV_PRICE_PER_MTOK) / 1_000_000
  }
}

function candidatesOf(q: ExtractQuestion, state: DecisionState): string[] {
  const c = q.candidates ?? deriveCandidates(state)
  return [...new Set(c.map((s) => s.trim()).filter((s) => s && s !== JEV_NONE))]
}

export function toTsQuestion(q: Question, state: DecisionState): TsQuestion {
  switch (q.kind) {
    case 'choice':
      return { type: 'choice', instructions: q.instructions, criteria: q.options }
    case 'score':
      return {
        type: 'score',
        instructions: q.instructions,
        criteria: q.levels as unknown as readonly [string, string, ...string[]],
      }
    case 'yesno':
      return q.yes || q.no
        ? {
            type: 'noul',
            instructions: q.instructions,
            criteria: { ...(q.yes ? { true: q.yes } : {}), ...(q.no ? { false: q.no } : {}) },
          }
        : { type: 'noul', instructions: q.instructions }
    case 'extract': {
      const criteria: Record<string, string | null> = {}
      for (const c of candidatesOf(q, state)) criteria[c] = null
      criteria[JEV_NONE] = NONE_DESCRIPTION
      return { type: 'choice', instructions: q.instructions, criteria }
    }
  }
}

export function fromTsAnswer(q: Question, a: RawAnswer, state: DecisionState): Answer {
  const want = q.kind === 'yesno' ? 'noul' : q.kind === 'extract' ? 'choice' : q.kind
  if (a.type !== want) throw invalidResponse('jev', `${q.id}: expected a ${want} answer, got ${a.type}`)
  switch (q.kind) {
    case 'choice': {
      if (!a.probabilities || typeof a.choice !== 'string')
        throw invalidResponse('jev', `${q.id}: malformed choice`)
      const ans = choiceAnswer(q, a.probabilities, 'calibrated')
      // the API's own confidence is the same statistic; prefer it when present
      return typeof a.confidence === 'number' ? { ...ans, confidence: a.confidence } : ans
    }
    case 'score': {
      if (!a.probabilities) throw invalidResponse('jev', `${q.id}: malformed score`)
      const ans = scoreAnswer(
        q,
        q.levels.map((_, i) => a.probabilities![String(i)] ?? 0),
        'calibrated',
      )
      return typeof a.confidence === 'number' ? { ...ans, confidence: a.confidence } : ans
    }
    case 'yesno':
      if (typeof a.noul !== 'number') throw invalidResponse('jev', `${q.id}: malformed noul`)
      return yesNoAnswer(a.noul, 'calibrated')
    case 'extract': {
      if (typeof a.choice !== 'string' || !a.probabilities)
        throw invalidResponse('jev', `${q.id}: malformed choice`)
      const p = a.probabilities[a.choice] ?? 0
      if (a.choice === JEV_NONE) return extractAnswer(q, null, p, 'calibrated')
      if (!candidatesOf(q, state).includes(a.choice))
        throw invalidResponse('jev', `${q.id} chose a span that was not offered`)
      return extractAnswer(q, a.choice, p, 'calibrated')
    }
  }
}

function toUsage(u: { input_tokens?: number; output_tokens?: number } | undefined): Usage {
  return {
    inputTokens: u?.input_tokens ?? 0,
    outputTokens: u?.output_tokens ?? 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  }
}

function bodyCode(body: unknown): string | undefined {
  if (body && typeof body === 'object') {
    const b = body as { error?: { code?: string; type?: string } | string; code?: string; type?: string }
    if (typeof b.error === 'object') return b.error?.code ?? b.error?.type
    return b.code ?? b.type
  }
  return undefined
}

/** SDK errors, most specific first (docs.typesafe.ai/sdk/javascript/api — classes; api.md — Errors). */
export function toJevError(err: unknown): LlmError {
  if (err instanceof LlmError) return err
  if (err instanceof APIUserAbortError) return new LlmError('aborted', 'request aborted', { cause: err })
  if (err instanceof AuthenticationError)
    return new LlmError('auth', 'TypeSafe API key missing or invalid', { status: 401, cause: err })
  if (err instanceof PermissionDeniedError)
    return new LlmError('permission', `TypeSafe: ${err.message}`, { status: 403, cause: err })
  if (err instanceof NotFoundError)
    return new LlmError('not_found', `TypeSafe: ${err.message}`, { status: 404, cause: err })
  if (err instanceof BadRequestError || err instanceof UnprocessableEntityError)
    return new LlmError('bad_request', `TypeSafe: ${err.message}`, { status: err.status, cause: err })
  if (err instanceof RateLimitError) {
    const code = bodyCode(err.body)
    if (code && /quota|credit|billing|balance/i.test(code))
      return new LlmError('quota', `TypeSafe: ${err.message}`, { status: 429, cause: err })
    return new LlmError('rate_limited', 'rate limited by the TypeSafe API', {
      status: 429,
      retryAfterMs: err.retryAfterMs ?? null,
      cause: err,
    })
  }
  if (err instanceof InternalServerError)
    return new LlmError(
      err.status === 529 || err.status === 503 ? 'overloaded' : 'server',
      `TypeSafe: ${err.message}`,
      {
        status: err.status,
        cause: err,
      },
    )
  if (err instanceof APIError) {
    if (err.status === 402)
      return new LlmError('quota', `TypeSafe: ${err.message}`, { status: 402, cause: err })
    return new LlmError(err.status >= 500 ? 'server' : 'unknown', `TypeSafe: ${err.message}`, {
      status: err.status,
      cause: err,
    })
  }
  if (err instanceof APITimeoutError) return new LlmError('timeout', err.message, { cause: err })
  if (err instanceof APIConnectionError)
    return new LlmError('network', `TypeSafe: ${err.message}`, { cause: err })
  if (err instanceof Error && err.name === 'AbortError')
    return new LlmError('aborted', 'request aborted', { cause: err })
  return new LlmError('unknown', err instanceof Error ? err.message : String(err), { cause: err })
}
