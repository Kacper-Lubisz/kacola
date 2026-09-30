// Typed decisions on OpenAI: the Responses API (`POST /v1/responses`, non-streaming) with structured
// outputs, plain fetch — the same transport and error mapping as @gnomeola/llm's OpenAIProvider.
//
// Request:
//   { model, instructions: DECISION_SYSTEM_PROMPT, input: [{ role: 'user', content: [{ type: 'input_text', text }] }],
//     store: false, max_output_tokens, text: { format: { type: 'json_schema', name: 'decisions', schema, strict: true } },
//     include: ['message.output_text.logprobs'], top_logprobs: 10, temperature: 0 }      ← non-reasoning models
//   reasoning models (gpt-5*, o*) get { reasoning: { effort: 'low' } } instead and no logprobs (unsupported).
// Response: { model, status, output: [ …, { type: 'message', content: [{ type: 'output_text', text,
//   logprobs: [{ token, logprob, top_logprobs: [{ token, logprob }] }] } | { type: 'refusal', refusal }] }],
//   usage: { input_tokens, input_tokens_details: { cached_tokens }, output_tokens }, incomplete_details }
//
// Confidence: where the model returns logprobs, each choice/level/yes-no answer's probabilities are read
// off the distribution of the token that starts the answer value (`source: 'logprobs'`); when that is
// ambiguous (options sharing a first token, or too little probability mass mapping onto options) the
// answer falls back to the model's self-reported numbers, marked `self-reported`.
import { LlmError, openAIHttpError, supportsReasoning } from '@gnomeola/llm'
import type { Usage } from '@gnomeola/protocol'
import { choiceAnswer, invalidResponse, scoreAnswer, yesNoAnswer } from './answers.ts'
import { BaseDecisionProvider, type BaseOptions, type CallResult } from './base.ts'
import { batchSchema, DECISION_SYSTEM_PROMPT, parseBatch, userPrompt } from './llm-json.ts'
import type { Answer, ChoiceQuestion, DecisionState, Question, ScoreQuestion } from './types.ts'

/** Non-reasoning, so it returns logprobs; cheap and fast enough for per-segment decisions. */
export const DEFAULT_OPENAI_DECISION_MODEL = 'gpt-4.1-mini'
export const DEFAULT_OPENAI_URL = 'https://api.openai.com/v1'

/** USD per million tokens (platform.openai.com/docs/pricing, 2026-09). Unknown models → null. */
const PRICES: Record<string, { input: number; cached: number; output: number }> = {
  'gpt-4.1-mini': { input: 0.4, cached: 0.1, output: 1.6 },
  'gpt-4.1-nano': { input: 0.1, cached: 0.025, output: 0.4 },
  'gpt-4.1': { input: 2, cached: 0.5, output: 8 },
  'gpt-4o-mini': { input: 0.15, cached: 0.075, output: 0.6 },
}

export const supportsLogprobs = (model: string) => !supportsReasoning(model)

export type OpenAIDecisionOptions = BaseOptions & {
  apiKey: string
  model?: string
  baseURL?: string
  fetch?: typeof fetch
  maxQuestionsPerCall?: number
  maxOutputTokens?: number
}

type LogProb = { token: string; logprob: number; top_logprobs?: { token: string; logprob: number }[] }
type OutputContent = { type?: string; text?: string; refusal?: string; logprobs?: LogProb[] }
type ResponseBody = {
  model?: string
  status?: string
  output?: { type?: string; content?: OutputContent[] }[]
  usage?: { input_tokens?: number; output_tokens?: number; input_tokens_details?: { cached_tokens?: number } }
  incomplete_details?: { reason?: string } | null
  error?: { code?: string; message?: string } | null
}

export class OpenAIDecisionProvider extends BaseDecisionProvider {
  readonly id = 'openai' as const
  readonly model: string
  readonly confidence
  readonly maxQuestionsPerCall: number
  readonly #apiKey: string
  readonly #url: string
  readonly #fetch: typeof fetch
  readonly #maxOutputTokens: number

  constructor(opts: OpenAIDecisionOptions) {
    super(opts)
    this.model = opts.model || DEFAULT_OPENAI_DECISION_MODEL
    this.confidence = supportsLogprobs(this.model) ? ('logprobs' as const) : ('self-reported' as const)
    this.maxQuestionsPerCall = opts.maxQuestionsPerCall ?? 24
    this.#apiKey = opts.apiKey
    this.#url = (opts.baseURL ?? process.env.OPENAI_BASE_URL ?? DEFAULT_OPENAI_URL).replace(/\/+$/, '')
    this.#fetch = opts.fetch ?? globalThis.fetch
    this.#maxOutputTokens = opts.maxOutputTokens ?? 4_096
  }

  /** The exact request body for a batch (exported for tests and docs). */
  buildBody(state: DecisionState, questions: readonly Question[]) {
    const logprobs = supportsLogprobs(this.model)
    return {
      model: this.model,
      instructions: DECISION_SYSTEM_PROMPT,
      input: [
        {
          role: 'user' as const,
          content: [{ type: 'input_text' as const, text: userPrompt(state, questions) }],
        },
      ],
      store: false,
      max_output_tokens: this.#maxOutputTokens,
      text: {
        format: { type: 'json_schema', name: 'decisions', schema: batchSchema(questions), strict: true },
      },
      ...(logprobs
        ? { include: ['message.output_text.logprobs'], top_logprobs: 10, temperature: 0 }
        : { reasoning: { effort: 'low' } }),
    }
  }

  protected async call(
    state: DecisionState,
    questions: Question[],
    signal: AbortSignal,
  ): Promise<CallResult> {
    let res: Response
    try {
      res = await this.#fetch(`${this.#url}/responses`, {
        method: 'POST',
        headers: { authorization: `Bearer ${this.#apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify(this.buildBody(state, questions)),
        signal,
      })
    } catch (err) {
      throw wrap(err, `cannot reach OpenAI at ${this.#url}`)
    }
    const text = await res.text().catch((err) => {
      throw wrap(err, 'OpenAI response failed')
    })
    if (!res.ok) throw openAIHttpError(res.status, text, res.headers)
    let body: ResponseBody
    try {
      body = JSON.parse(text) as ResponseBody
    } catch {
      throw invalidResponse('openai', `malformed JSON body: ${text.slice(0, 120)}`)
    }
    if (body.error) throw openAIHttpError(500, JSON.stringify({ error: body.error }))
    const content = (body.output ?? []).filter((o) => o.type === 'message').flatMap((o) => o.content ?? [])
    const refusal = content.find((c) => c.type === 'refusal')
    if (refusal) throw new LlmError('bad_request', `OpenAI refused: ${refusal.refusal ?? ''}`.trim())
    const out = content.find((c) => c.type === 'output_text')
    if (body.status === 'incomplete' || !out?.text)
      throw invalidResponse('openai', `incomplete response (${body.incomplete_details?.reason ?? 'no text'})`)
    let json: unknown
    try {
      json = JSON.parse(out.text)
    } catch {
      throw invalidResponse('openai', 'output is not JSON')
    }
    const answers = parseBatch('openai', questions, json, 'self-reported')
    if (supportsLogprobs(this.model) && out.logprobs?.length)
      applyLogprobs(questions, answers, out.text, out.logprobs)
    return { answers, usage: toUsage(body.usage), model: body.model ?? this.model }
  }

  protected price(usage: Usage, model: string): number | null {
    const p = PRICES[model] ?? PRICES[model.replace(/-\d{4}-\d{2}-\d{2}$/, '')]
    if (!p) return null
    return (
      (usage.inputTokens * p.input + usage.cacheReadTokens * p.cached + usage.outputTokens * p.output) / 1e6
    )
  }
}

function toUsage(u: ResponseBody['usage']): Usage {
  const cached = u?.input_tokens_details?.cached_tokens ?? 0
  return {
    inputTokens: Math.max(0, (u?.input_tokens ?? 0) - cached),
    outputTokens: u?.output_tokens ?? 0,
    cacheReadTokens: cached,
    cacheWriteTokens: 0,
  }
}

/** Keys the JSON value of each answer lives under, per question kind. */
const VALUE_KEY = { choice: 'choice', score: 'level', yesno: 'answer' } as const
/** Below this much top-k mass mapping unambiguously onto options, logprobs say too little to use. */
const MIN_MAPPED_MASS = 0.9

/**
 * Replace self-reported probabilities with ones read off token logprobs, where that is unambiguous.
 * Exported for tests. Mutates `answers`.
 */
export function applyLogprobs(
  questions: readonly Question[],
  answers: Record<string, Answer>,
  text: string,
  logprobs: readonly LogProb[],
): void {
  // token spans; if they do not reassemble the text exactly, the offsets cannot be trusted
  const starts: number[] = []
  let pos = 0
  for (const lp of logprobs) {
    starts.push(pos)
    pos += lp.token.length
  }
  if (logprobs.map((l) => l.token).join('') !== text) return

  let cursor = 0
  for (const q of questions) {
    const keyAt = text.indexOf(JSON.stringify(q.id), cursor)
    if (keyAt < 0) return
    cursor = keyAt + q.id.length + 2
    if (q.kind === 'extract') continue
    const m = new RegExp(`"${VALUE_KEY[q.kind]}"\\s*:\\s*"`, 'g')
    m.lastIndex = cursor
    const hit = m.exec(text)
    if (!hit) continue
    const valueAt = hit.index + hit[0].length
    const options =
      q.kind === 'choice'
        ? Object.keys((q as ChoiceQuestion).options)
        : q.kind === 'score'
          ? (q as ScoreQuestion).levels.map((_, i) => String(i))
          : ['yes', 'no']
    const dist = distributionAt(valueAt, starts, logprobs, options)
    if (!dist) continue
    if (q.kind === 'choice') answers[q.id] = choiceAnswer(q as ChoiceQuestion, dist, 'logprobs')
    else if (q.kind === 'score')
      answers[q.id] = scoreAnswer(
        q as ScoreQuestion,
        options.map((o) => dist[o] ?? 0),
        'logprobs',
      )
    else answers[q.id] = yesNoAnswer((dist.yes ?? 0) / ((dist.yes ?? 0) + (dist.no ?? 0) || 1), 'logprobs')
  }
}

function distributionAt(
  valueAt: number,
  starts: readonly number[],
  logprobs: readonly LogProb[],
  options: readonly string[],
): Record<string, number> | null {
  // the token covering the value's first character (a token may also carry the opening quote)
  let t = -1
  for (let i = 0; i < starts.length; i++)
    if (starts[i]! <= valueAt && valueAt < starts[i]! + logprobs[i]!.token.length) t = i
  if (t < 0) return null
  const lp = logprobs[t]!
  const pre = valueAt - starts[t]!
  const head = lp.token.slice(0, pre)
  const alts = [...(lp.top_logprobs ?? [])]
  if (!alts.some((a) => a.token === lp.token)) alts.push({ token: lp.token, logprob: lp.logprob })
  const matches = (rest: string) =>
    options.filter((o) => rest.length > 0 && (`${o}"`.startsWith(rest) || rest.startsWith(`${o}"`)))

  // the chosen token must identify one option, or the distinction happens later and we cannot see it
  if (matches(lp.token.slice(pre)).length !== 1) return null
  const mass: Record<string, number> = Object.fromEntries(options.map((o) => [o, 0]))
  let total = 0
  let mapped = 0
  for (const a of alts) {
    const p = Math.exp(a.logprob)
    total += p
    if (a.token.length <= pre || a.token.slice(0, pre) !== head) continue
    const m = matches(a.token.slice(pre))
    if (m.length !== 1) continue
    mass[m[0]!]! += p
    mapped += p
  }
  if (total <= 0 || mapped / total < MIN_MAPPED_MASS) return null
  return mass
}

function wrap(err: unknown, message: string): LlmError {
  if (err instanceof LlmError) return err
  if (err instanceof Error && err.name === 'AbortError')
    return new LlmError('aborted', 'request aborted', { cause: err })
  return new LlmError('network', `${message}: ${err instanceof Error ? err.message : String(err)}`, {
    cause: err,
  })
}
