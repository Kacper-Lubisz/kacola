// Typed decisions on a local Ollama model: `POST /api/chat` (non-streaming) with `format` set to the
// batch JSON schema, so the output is constrained to it (Ollama structured outputs).
//
//   { model, stream: false, format: batchSchema(questions), options: { temperature: 0 },
//     messages: [{ role: 'system', content: DECISION_SYSTEM_PROMPT }, { role: 'user', content: userPrompt(…) }] }
//   → { model, message: { role: 'assistant', content: '<json>' }, done: true, prompt_eval_count, eval_count }
//
// Probabilities are self-reported and marked so. No per-token price (local).
import { LlmError } from '@gnomeola/llm'
import { invalidResponse } from './answers.ts'
import { BaseDecisionProvider, type BaseOptions, type CallResult } from './base.ts'
import { batchSchema, DECISION_SYSTEM_PROMPT, parseBatch, userPrompt } from './llm-json.ts'
import type { DecisionState, Question } from './types.ts'

export const DEFAULT_OLLAMA_URL = 'http://127.0.0.1:11434'
export const DEFAULT_OLLAMA_DECISION_MODEL = 'llama3.1'

export type OllamaDecisionOptions = BaseOptions & {
  model?: string
  url?: string
  fetch?: typeof fetch
  maxQuestionsPerCall?: number
}

type ChatResponse = {
  model?: string
  message?: { content?: string }
  done?: boolean
  prompt_eval_count?: number
  eval_count?: number
  error?: string
}

export class OllamaDecisionProvider extends BaseDecisionProvider {
  readonly id = 'ollama' as const
  readonly model: string
  readonly confidence = 'self-reported' as const
  readonly maxQuestionsPerCall: number
  readonly #url: string
  readonly #fetch: typeof fetch

  constructor(opts: OllamaDecisionOptions = {}) {
    // a cold local model can take a while to load
    super({ ...opts, maxRetries: opts.maxRetries ?? 1 }, 30_000)
    this.model = opts.model || DEFAULT_OLLAMA_DECISION_MODEL
    this.maxQuestionsPerCall = opts.maxQuestionsPerCall ?? 12
    this.#url = (opts.url ?? DEFAULT_OLLAMA_URL).replace(/\/+$/, '')
    this.#fetch = opts.fetch ?? globalThis.fetch
  }

  buildBody(state: DecisionState, questions: readonly Question[]) {
    return {
      model: this.model,
      stream: false,
      format: batchSchema(questions),
      options: { temperature: 0 },
      messages: [
        { role: 'system', content: DECISION_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt(state, questions) },
      ],
    }
  }

  protected async call(
    state: DecisionState,
    questions: Question[],
    signal: AbortSignal,
  ): Promise<CallResult> {
    let res: Response
    try {
      res = await this.#fetch(`${this.#url}/api/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(this.buildBody(state, questions)),
        signal,
      })
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError')
        throw new LlmError('aborted', 'request aborted', { cause: err })
      throw new LlmError('network', `cannot reach Ollama at ${this.#url}: ${(err as Error).message}`, {
        cause: err,
      })
    }
    const text = await res.text().catch(() => '')
    let body: ChatResponse = {}
    try {
      body = JSON.parse(text) as ChatResponse
    } catch {
      if (res.ok) throw invalidResponse('ollama', `malformed body: ${text.slice(0, 120)}`)
    }
    if (!res.ok || body.error) {
      const msg = `Ollama: ${body.error ?? (text.trim().slice(0, 200) || `HTTP ${res.status}`)}`
      const code =
        res.status === 404 ? 'not_found' : res.status >= 500 ? 'server' : res.ok ? 'server' : 'bad_request'
      throw new LlmError(code, msg, { status: res.status })
    }
    let json: unknown
    try {
      json = JSON.parse(body.message?.content ?? '')
    } catch {
      throw invalidResponse('ollama', 'output is not JSON')
    }
    return {
      answers: parseBatch('ollama', questions, json, 'self-reported'),
      usage: {
        inputTokens: body.prompt_eval_count ?? 0,
        outputTokens: body.eval_count ?? 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
      },
      model: body.model ?? this.model,
    }
  }

  protected price(): number | null {
    return null
  }
}
