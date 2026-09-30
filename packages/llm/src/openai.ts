// The OpenAI provider, over the Responses API (`POST /v1/responses`, SSE streaming) with plain fetch —
// no SDK, the same way the Ollama provider works.
//
// Request shape:
//   { model, instructions: SYSTEM_PROMPT, input: [{ role: 'user', content: [ ...blocks as input_text ] }],
//     stream: true, store: false, reasoning: { effort }, max_output_tokens, prompt_cache_key }
//
// Caching: OpenAI caches prompt prefixes of ≥1024 tokens automatically — there are no breakpoints to
// place. The assembler's byte-stable layout (frozen instructions, closed transcript chunks first, the
// question last) is exactly what makes those automatic hits happen; `prompt_cache_key` keeps requests
// about the same meeting routed together. Cached tokens come back as `input_tokens_details.cached_tokens`
// and are INCLUDED in `input_tokens`, so they are split out to match the protocol's `Usage`.
//
// Refusals arrive as `refusal` content (streamed as `response.refusal.delta`), not as text: they end the
// turn with stopReason 'refusal' and an empty answer, like an Anthropic refusal.
import { createHash } from 'node:crypto'
import type { Usage } from '@gnomeola/protocol'
import { isAbort, LlmError } from './errors.ts'
import type { AssembledPrompt, LlmProvider, ProviderEvent, ProviderStreamOptions, Refusal } from './types.ts'

export const DEFAULT_OPENAI_MODEL = 'gpt-5.5'
export const DEFAULT_OPENAI_URL = 'https://api.openai.com/v1'
/** Room for reasoning + the answer; only generated tokens bill. */
export const DEFAULT_OPENAI_MAX_OUTPUT_TOKENS = 32_000
/** OpenAI's automatic prompt caching starts at this many prefix tokens. */
export const OPENAI_MIN_CACHE_TOKENS = 1024

/** Reasoning models accept `reasoning.effort`; older chat models reject it with a 400. */
export const supportsReasoning = (model: string): boolean => /^(gpt-5|gpt-6|o\d)/.test(model)

export type OpenAIProviderOptions = {
  apiKey: string
  model?: string
  /** Default: OPENAI_BASE_URL, else https://api.openai.com/v1. */
  baseURL?: string
  maxOutputTokens?: number
  /** Retries for 429 (not quota) / 5xx / connection failures before the stream starts. Default 2. */
  maxRetries?: number
  fetch?: typeof fetch
  /** Backoff between retries (tests shorten it). */
  retryDelayMs?: (attempt: number) => number
}

type StreamEvent = {
  type?: string
  delta?: string
  code?: string | null
  message?: string
  /** On `error` events the API nests the details (seen live 2026-09-30); older docs show them flat. */
  error?: { type?: string; code?: string | null; message?: string } | null
  response?: {
    model?: string
    status?: string
    error?: { code?: string; message?: string } | null
    incomplete_details?: { reason?: string } | null
    usage?: {
      input_tokens?: number
      output_tokens?: number
      input_tokens_details?: { cached_tokens?: number }
    } | null
  }
}

export class OpenAIProvider implements LlmProvider {
  readonly id = 'openai'
  readonly model: string
  readonly minCacheTokens = OPENAI_MIN_CACHE_TOKENS
  readonly #apiKey: string
  readonly #url: string
  readonly #fetch: typeof fetch
  readonly #maxOutputTokens: number
  readonly #maxRetries: number
  readonly #retryDelayMs: (attempt: number) => number

  constructor(opts: OpenAIProviderOptions) {
    this.model = opts.model || DEFAULT_OPENAI_MODEL
    this.#apiKey = opts.apiKey
    this.#url = (opts.baseURL ?? process.env.OPENAI_BASE_URL ?? DEFAULT_OPENAI_URL).replace(/\/+$/, '')
    this.#fetch = opts.fetch ?? globalThis.fetch
    this.#maxOutputTokens = opts.maxOutputTokens ?? DEFAULT_OPENAI_MAX_OUTPUT_TOKENS
    this.#maxRetries = opts.maxRetries ?? 2
    this.#retryDelayMs = opts.retryDelayMs ?? ((n) => 500 * 2 ** n)
  }

  /** The exact request body this provider sends for a prompt (exported for tests and docs). */
  buildBody(prompt: AssembledPrompt, effort: ProviderStreamOptions['effort']) {
    const first = prompt.blocks[0]?.text ?? ''
    return {
      model: this.model,
      instructions: prompt.system,
      input: [
        {
          role: 'user' as const,
          content: prompt.blocks.map((b) => ({ type: 'input_text' as const, text: b.text })),
        },
      ],
      stream: true,
      store: false,
      max_output_tokens: this.#maxOutputTokens,
      // Same meeting → same key, so its requests land where its prefix is already cached.
      prompt_cache_key: `gnomeola-${createHash('sha256').update(first).digest('hex').slice(0, 16)}`,
      ...(supportsReasoning(this.model) ? { reasoning: { effort } } : {}),
    }
  }

  async *stream(prompt: AssembledPrompt, opts: ProviderStreamOptions): AsyncGenerator<ProviderEvent> {
    const res = await this.#open(JSON.stringify(this.buildBody(prompt, opts.effort)), opts.signal)
    const decoder = new TextDecoder()
    let buf = ''
    let refusalText = ''
    try {
      for await (const bytes of res.body!) {
        // normalise after appending: a CRLF can be split across two network chunks
        buf = (buf + decoder.decode(bytes, { stream: true })).replace(/\r\n/g, '\n')
        let sep = buf.indexOf('\n\n')
        while (sep !== -1) {
          const frame = buf.slice(0, sep)
          buf = buf.slice(sep + 2)
          sep = buf.indexOf('\n\n')
          const ev = parseFrame(frame)
          if (!ev) continue
          switch (ev.type) {
            case 'response.output_text.delta':
              if (ev.delta) yield { type: 'delta', text: ev.delta }
              break
            case 'response.refusal.delta':
              refusalText += ev.delta ?? ''
              break
            case 'response.completed':
            case 'response.incomplete':
              yield this.#done(ev, refusalText)
              return
            case 'response.failed':
              throw failure(ev.response?.error?.code, ev.response?.error?.message)
            case 'error':
              throw failure(ev.error?.code ?? ev.code ?? ev.error?.type, ev.error?.message ?? ev.message)
          }
        }
      }
    } catch (err) {
      throw wrap(err, 'OpenAI stream failed')
    }
    throw new LlmError('network', 'OpenAI stream ended without a final event')
  }

  #done(ev: StreamEvent, refusalText: string): ProviderEvent {
    const r = ev.response ?? {}
    const reason = r.incomplete_details?.reason
    let refusal: Refusal | null = null
    let stopReason = 'end_turn'
    if (refusalText || reason === 'content_filter') {
      refusal = {
        category: reason === 'content_filter' ? 'content_filter' : null,
        explanation: refusalText || null,
      }
      stopReason = 'refusal'
    } else if (reason === 'max_output_tokens') stopReason = 'max_tokens'
    else if (reason) stopReason = reason
    return {
      type: 'done',
      stopReason,
      model: r.model ?? this.model,
      usage: toUsage(r.usage),
      refusal,
      fallback: null,
    }
  }

  async #open(body: string, signal: AbortSignal | undefined): Promise<Response> {
    for (let attempt = 0; ; attempt++) {
      let res: Response
      try {
        res = await this.#fetch(`${this.#url}/responses`, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${this.#apiKey}`,
            'content-type': 'application/json',
            accept: 'text/event-stream',
          },
          body,
          ...(signal ? { signal } : {}),
        })
      } catch (err) {
        const e = wrap(err, `cannot reach OpenAI at ${this.#url}`)
        if (e.code === 'network' && attempt < this.#maxRetries) {
          await sleep(this.#retryDelayMs(attempt), signal)
          continue
        }
        throw e
      }
      if (res.ok && res.body) return res
      const e = httpError(res.status, await res.text().catch(() => ''), res.headers)
      if (e.retryable && attempt < this.#maxRetries) {
        await sleep(e.retryAfterMs ?? this.#retryDelayMs(attempt), signal)
        continue
      }
      throw e
    }
  }
}

/** `input_tokens` includes the cached part; the protocol's `inputTokens` is the uncached remainder. */
export function toUsage(u: NonNullable<StreamEvent['response']>['usage']): Usage {
  const cached = u?.input_tokens_details?.cached_tokens ?? 0
  return {
    inputTokens: Math.max(0, (u?.input_tokens ?? 0) - cached),
    outputTokens: u?.output_tokens ?? 0,
    cacheReadTokens: cached,
    cacheWriteTokens: 0,
  }
}

function parseFrame(frame: string): StreamEvent | null {
  const data = frame
    .split('\n')
    .filter((l) => l.startsWith('data:'))
    .map((l) => l.slice(5).trimStart())
    .join('\n')
  if (!data || data === '[DONE]') return null
  try {
    return JSON.parse(data) as StreamEvent
  } catch {
    throw new LlmError('server', `OpenAI sent a malformed event: ${data.slice(0, 120)}`)
  }
}

const QUOTA_CODES = new Set(['insufficient_quota', 'credit_balance_exhausted', 'billing_hard_limit_reached'])

/** An error reported inside a 200 stream (`response.failed` or an `error` event). */
function failure(code: string | null | undefined, message: string | undefined): LlmError {
  const msg = message ?? code ?? 'unknown error'
  if (code && QUOTA_CODES.has(code)) return new LlmError('quota', `OpenAI: ${msg}`)
  if (code === 'rate_limit_exceeded') return new LlmError('rate_limited', `OpenAI: ${msg}`)
  if (code === 'server_error' || code === 'server_is_overloaded')
    return new LlmError(code === 'server_error' ? 'server' : 'overloaded', `OpenAI: ${msg}`)
  if (code === 'invalid_prompt' || code === 'context_length_exceeded')
    return new LlmError('bad_request', `OpenAI: ${msg}`)
  return new LlmError('unknown', `OpenAI: ${msg}`)
}

export function httpError(status: number, body: string, headers?: Headers): LlmError {
  let code: string | undefined
  let message: string | undefined
  try {
    const j = JSON.parse(body) as { error?: { code?: string; type?: string; message?: string } }
    code = j.error?.code ?? j.error?.type
    message = j.error?.message
  } catch {}
  const msg = `OpenAI: ${message ?? (body.trim().slice(0, 200) || `HTTP ${status}`)}`
  if (code && QUOTA_CODES.has(code)) return new LlmError('quota', msg, { status })
  if (status === 401) return new LlmError('auth', 'OpenAI API key missing or invalid', { status })
  if (status === 403) return new LlmError('permission', msg, { status })
  if (status === 404) return new LlmError('not_found', msg, { status })
  if (status === 429) return new LlmError('rate_limited', msg, { status, retryAfterMs: retryAfter(headers) })
  if (status >= 500)
    return new LlmError(status === 503 ? 'overloaded' : 'server', msg, {
      status,
      retryAfterMs: retryAfter(headers),
    })
  return new LlmError('bad_request', msg, { status })
}

function retryAfter(headers: Headers | undefined): number | null {
  const ms = headers?.get('retry-after-ms')
  if (ms && Number.isFinite(Number(ms))) return Number(ms)
  const s = headers?.get('retry-after')
  if (s && Number.isFinite(Number(s))) return Number(s) * 1000
  return null
}

function wrap(err: unknown, message: string): LlmError {
  if (err instanceof LlmError) return err
  if (isAbort(err)) return new LlmError('aborted', 'request aborted', { cause: err })
  return new LlmError('network', `${message}: ${err instanceof Error ? err.message : String(err)}`, {
    cause: err,
  })
}

function sleep(ms: number, signal: AbortSignal | undefined): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new LlmError('aborted', 'request aborted'))
    const t = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(t)
        reject(new LlmError('aborted', 'request aborted'))
      },
      { once: true },
    )
  })
}
