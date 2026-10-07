// Q-1 — the Anthropic provider.
//
// Request shape (see docs/llm.md for the why):
//   client.beta.messages.stream({
//     model: 'claude-opus-5', max_tokens: 64000,
//     thinking: { type: 'adaptive' }, output_config: { effort },
//     betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
//     system: [{ type: 'text', text: SYSTEM_PROMPT }],
//     messages: [{ role: 'user', content: [ ...transcript blocks (cache_control on the stable boundary), question ] }],
//   })
//
// Refusals: Opus 5's classifiers can decline at HTTP 200 with stop_reason 'refusal'. We opt into
// server-side fallbacks (`fallbacks: "default"` + beta `server-side-fallback-2026-07-01`, which routes by
// refusal category) and always branch on stop_reason before trusting the text.
import Anthropic from '@anthropic-ai/sdk'
import type { Usage } from '@kacola/protocol'
import { LlmError } from './errors.ts'
import type {
  AssembledPrompt,
  FallbackInfo,
  LlmProvider,
  ProviderEvent,
  ProviderStreamOptions,
  Refusal,
} from './types.ts'

export const DEFAULT_ANTHROPIC_MODEL = 'claude-opus-5'
export const SERVER_SIDE_FALLBACK_BETA = 'server-side-fallback-2026-07-01'
/** Streaming default from the skill: room for adaptive thinking + answer; only generated tokens bill. */
export const DEFAULT_MAX_TOKENS = 64_000

/** Minimum cacheable prefix by model (shared/prompt-caching.md). Unknown models get the largest value. */
const MIN_CACHE_TOKENS: Record<string, number> = {
  'claude-opus-5': 512,
  'claude-fable-5': 512,
  'claude-fable-5-1': 512,
  'claude-opus-4-8': 1024,
  'claude-sonnet-5': 1024,
  'claude-sonnet-4-6': 1024,
  'claude-opus-4-7': 2048,
  'claude-opus-4-6': 4096,
  'claude-haiku-4-5': 4096,
}
const UNKNOWN_MODEL_MIN_CACHE = 4096

/** Models the skill documents `fallbacks: "default"` for. Others get no fallback params (they may 400). */
const DEFAULT_FALLBACK_MODELS: ReadonlySet<string> = new Set(['claude-opus-5', 'claude-fable-5-1'])

export type AnthropicProviderOptions = {
  /** Omit to let the SDK resolve credentials (ANTHROPIC_API_KEY, auth token, `ant` profile). */
  apiKey?: string
  model?: string
  maxTokens?: number
  /** SDK retries for 408/409/429/5xx/connection errors. Default 2 (the SDK default). */
  maxRetries?: number
  timeoutMs?: number
  baseURL?: string
  /** Custom fetch — this is where cassettes plug in. */
  fetch?: typeof fetch
  /** `'default'` = server-side fallbacks on (default for models that support it); `'off'` = none. */
  fallbacks?: 'default' | 'off'
}

export class AnthropicProvider implements LlmProvider {
  readonly id = 'anthropic'
  readonly model: string
  readonly minCacheTokens: number
  readonly #client: Anthropic
  readonly #maxTokens: number
  readonly #fallbacks: boolean

  constructor(opts: AnthropicProviderOptions = {}) {
    this.model = opts.model ?? DEFAULT_ANTHROPIC_MODEL
    this.minCacheTokens = MIN_CACHE_TOKENS[this.model] ?? UNKNOWN_MODEL_MIN_CACHE
    this.#maxTokens = opts.maxTokens ?? DEFAULT_MAX_TOKENS
    this.#fallbacks = (opts.fallbacks ?? 'default') === 'default' && DEFAULT_FALLBACK_MODELS.has(this.model)
    this.#client = new Anthropic({
      ...(opts.apiKey !== undefined ? { apiKey: opts.apiKey } : {}),
      ...(opts.baseURL !== undefined ? { baseURL: opts.baseURL } : {}),
      ...(opts.fetch !== undefined ? { fetch: opts.fetch } : {}),
      ...(opts.timeoutMs !== undefined ? { timeout: opts.timeoutMs } : {}),
      maxRetries: opts.maxRetries ?? 2,
    })
  }

  /** The exact request body this provider sends for a prompt (exported for tests and docs). */
  buildParams(prompt: AssembledPrompt, effort: ProviderStreamOptions['effort']) {
    const params: Anthropic.Beta.Messages.MessageCreateParamsStreaming = {
      model: this.model,
      max_tokens: this.#maxTokens,
      stream: true,
      thinking: { type: 'adaptive' },
      output_config: { effort },
      system: [{ type: 'text', text: prompt.system }],
      messages: [
        {
          role: 'user',
          content: prompt.blocks.map(
            (b): Anthropic.Beta.Messages.BetaTextBlockParam =>
              b.cache
                ? { type: 'text', text: b.text, cache_control: { type: 'ephemeral' } }
                : { type: 'text', text: b.text },
          ),
        },
      ],
    }
    if (this.#fallbacks) {
      params.betas = [SERVER_SIDE_FALLBACK_BETA]
      params.fallbacks = 'default'
    }
    return params
  }

  async *stream(prompt: AssembledPrompt, opts: ProviderStreamOptions): AsyncGenerator<ProviderEvent> {
    const { stream: _stream, ...body } = this.buildParams(prompt, opts.effort)
    try {
      const stream = this.#client.beta.messages.stream(
        body,
        opts.signal ? { signal: opts.signal } : undefined,
      )
      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          yield { type: 'delta', text: event.delta.text }
        }
      }
      const msg = await stream.finalMessage()
      yield {
        type: 'done',
        stopReason: msg.stop_reason ?? 'unknown',
        model: msg.model,
        usage: toUsage(msg.usage),
        refusal: refusalOf(msg),
        fallback: fallbackOf(msg, this.model),
      }
    } catch (err) {
      throw toLlmError(err)
    }
  }
}

/** Map Anthropic usage to the protocol's `Usage`. Top-level usage = the attempt that produced the message. */
export function toUsage(u: Anthropic.Beta.Messages.BetaUsage): Usage {
  return {
    inputTokens: u.input_tokens ?? 0,
    outputTokens: u.output_tokens ?? 0,
    cacheReadTokens: u.cache_read_input_tokens ?? 0,
    cacheWriteTokens: u.cache_creation_input_tokens ?? 0,
  }
}

function refusalOf(msg: Anthropic.Beta.Messages.BetaMessage): Refusal | null {
  // branch on stop_reason, never on stop_details: details are informational and may be null on a refusal
  if (msg.stop_reason !== 'refusal') return null
  return { category: msg.stop_details?.category ?? null, explanation: msg.stop_details?.explanation ?? null }
}

function fallbackOf(msg: Anthropic.Beta.Messages.BetaMessage, requested: string): FallbackInfo | null {
  let last: FallbackInfo | null = null
  for (const b of msg.content) if (b.type === 'fallback') last = { from: b.from.model, to: b.to.model }
  if (last) return last
  // sticky-routed turns carry no fallback block; the served-by signal is a fallback_message iteration
  const served = (msg.usage.iterations ?? []).some((it) => it.type === 'fallback_message')
  return served ? { from: requested, to: msg.model } : null
}

function retryAfterMs(headers: Headers | undefined): number | null {
  const ms = headers?.get('retry-after-ms')
  if (ms && Number.isFinite(Number(ms))) return Number(ms)
  const s = headers?.get('retry-after')
  if (s && Number.isFinite(Number(s))) return Number(s) * 1000
  return null
}

function errorType(err: InstanceType<typeof Anthropic.APIError>): string | undefined {
  const body = err.error as { type?: string; error?: { type?: string } } | undefined
  return body?.error?.type ?? body?.type
}

/** Typed SDK errors, most specific first (APIConnectionError is a subclass of APIError in the TS SDK). */
export function toLlmError(err: unknown): LlmError {
  if (err instanceof LlmError) return err
  if (err instanceof Anthropic.APIUserAbortError)
    return new LlmError('aborted', 'request aborted', { cause: err })
  if (err instanceof Anthropic.AuthenticationError) {
    return new LlmError('auth', 'Anthropic API key missing or invalid', { status: 401, cause: err })
  }
  if (err instanceof Anthropic.PermissionDeniedError) {
    return new LlmError('permission', err.message, { status: 403, cause: err })
  }
  if (err instanceof Anthropic.NotFoundError)
    return new LlmError('not_found', err.message, { status: 404, cause: err })
  if (err instanceof Anthropic.BadRequestError) {
    return new LlmError('bad_request', err.message, { status: 400, cause: err })
  }
  if (err instanceof Anthropic.RateLimitError) {
    return new LlmError('rate_limited', 'rate limited by the Anthropic API', {
      status: 429,
      retryAfterMs: retryAfterMs(err.headers),
      cause: err,
    })
  }
  if (err instanceof Anthropic.InternalServerError) {
    const overloaded = err.status === 529 || errorType(err) === 'overloaded_error'
    return new LlmError(overloaded ? 'overloaded' : 'server', err.message, {
      status: err.status,
      retryAfterMs: retryAfterMs(err.headers),
      cause: err,
    })
  }
  if (err instanceof Anthropic.APIConnectionTimeoutError)
    return new LlmError('timeout', err.message, { cause: err })
  if (err instanceof Anthropic.APIConnectionError) return new LlmError('network', err.message, { cause: err })
  if (err instanceof Anthropic.APIError) {
    // e.g. an `event: error` frame inside a 200 stream: status is undefined, the type is in the body
    const type = errorType(err)
    if (type === 'overloaded_error') return new LlmError('overloaded', err.message, { cause: err })
    if (type === 'rate_limit_error') return new LlmError('rate_limited', err.message, { cause: err })
    if (type === 'api_error' || (err.status ?? 0) >= 500) {
      return new LlmError('server', err.message, { status: err.status ?? null, cause: err })
    }
    return new LlmError('unknown', err.message, { status: err.status ?? null, cause: err })
  }
  // The message stream wraps transport failures during iteration in a bare AnthropicError with the
  // original as `cause` (e.g. undici's `TypeError: terminated` when the socket dies mid-body).
  if (err instanceof Anthropic.AnthropicError && err.cause !== undefined && err.cause !== err) {
    const inner = toLlmError(err.cause)
    if (inner.code !== 'unknown') return new LlmError(inner.code, inner.message, { cause: err })
  }
  if (err instanceof Error && err.name === 'AbortError')
    return new LlmError('aborted', 'request aborted', { cause: err })
  // the body stream dying mid-response surfaces from undici as `TypeError: terminated`
  if (err instanceof TypeError)
    return new LlmError('network', `connection failed: ${err.message}`, { cause: err })
  return new LlmError('unknown', err instanceof Error ? err.message : String(err), { cause: err })
}
