import { LlmError } from '@gnomeola/llm'
import type { Usage } from '@gnomeola/protocol'
import { checkAnswers, validateQuestions } from './answers.ts'
import type {
  Answer,
  ConfidenceSource,
  DecideOptions,
  DecisionProvider,
  DecisionProviderId,
  DecisionRequest,
  DecisionResult,
  DecisionState,
  Question,
} from './types.ts'

// What every provider shares, so batching, timeouts, cancellation, retries and accounting behave the
// same whichever backend answers:
//
//   decide(req)
//     validate questions (bad_request, never sent)
//     split into batches of maxQuestionsPerCall
//     per batch: attempt → timeout (per attempt) + caller signal → retry retryable LlmErrors with backoff
//     check every question got an answer of the kind asked
//     sum usage, price it
//
// Providers only implement `call()`: one HTTP round trip for one batch, no retries of their own (SDK
// retries are switched off so the retry policy is this one, and is tested once).

export type CallResult = { answers: Record<string, Answer>; usage: Usage; model: string }

export type BaseOptions = {
  /** Retries after the first attempt for retryable failures (429/5xx/timeouts/network). Default 2. */
  maxRetries?: number
  /** Per-attempt timeout. */
  timeoutMs?: number
  /** Backoff before retry n (0-based); a server's retry-after wins when longer. */
  retryDelayMs?: (attempt: number) => number
  /** Batches in flight at once. Default 4. */
  concurrency?: number
}

export const ZERO: Usage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }

export function addUsage(a: Usage, b: Usage): Usage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheReadTokens: a.cacheReadTokens + b.cacheReadTokens,
    cacheWriteTokens: a.cacheWriteTokens + b.cacheWriteTokens,
  }
}

export abstract class BaseDecisionProvider implements DecisionProvider {
  abstract readonly id: DecisionProviderId
  abstract readonly model: string
  abstract readonly confidence: ConfidenceSource
  abstract readonly maxQuestionsPerCall: number
  protected readonly maxRetries: number
  protected readonly timeoutMs: number
  protected readonly retryDelayMs: (attempt: number) => number
  protected readonly concurrency: number

  constructor(opts: BaseOptions = {}, defaultTimeoutMs = 10_000) {
    this.maxRetries = opts.maxRetries ?? 2
    this.timeoutMs = opts.timeoutMs ?? defaultTimeoutMs
    this.retryDelayMs = opts.retryDelayMs ?? ((n) => Math.min(5_000, 500 * 2 ** n))
    this.concurrency = Math.max(1, opts.concurrency ?? 4)
  }

  /** One round trip for one batch. Throw LlmError; honour `signal`. */
  protected abstract call(
    state: DecisionState,
    questions: Question[],
    signal: AbortSignal,
  ): Promise<CallResult>

  /** USD for this usage, or null when the model has no known price. */
  protected abstract price(usage: Usage, model: string): number | null

  async decide(req: DecisionRequest, opts: DecideOptions = {}): Promise<DecisionResult> {
    validateQuestions(req.questions)
    if (opts.signal?.aborted) throw new LlmError('aborted', 'request aborted')
    const started = performance.now()
    const batches: Question[][] = []
    for (let i = 0; i < req.questions.length; i += this.maxQuestionsPerCall)
      batches.push(req.questions.slice(i, i + this.maxQuestionsPerCall))

    const results: { r: CallResult; calls: number; retries: number }[] = new Array(batches.length)
    let next = 0
    const worker = async () => {
      while (next < batches.length) {
        const i = next++
        results[i] = await this.#withRetries(req.state, batches[i]!, opts)
      }
    }
    await Promise.all(Array.from({ length: Math.min(this.concurrency, batches.length) }, worker))

    const answers: Record<string, Answer> = {}
    let usage = ZERO
    let calls = 0
    let retries = 0
    let model = this.model
    for (const [i, { r, calls: c, retries: n }] of results.entries()) {
      checkAnswers(this.id, batches[i]!, r.answers)
      for (const q of batches[i]!) answers[q.id] = r.answers[q.id]!
      usage = addUsage(usage, r.usage)
      calls += c
      retries += n
      model = r.model || model
    }
    return {
      answers,
      provider: this.id,
      model,
      usage,
      costUsd: this.price(usage, model),
      latencyMs: Math.round(performance.now() - started),
      calls,
      retries,
    }
  }

  async #withRetries(state: DecisionState, questions: Question[], opts: DecideOptions) {
    const timeoutMs = opts.timeoutMs ?? this.timeoutMs
    for (let attempt = 0; ; attempt++) {
      try {
        const r = await this.#attempt(state, questions, timeoutMs, opts.signal)
        return { r, calls: attempt + 1, retries: attempt }
      } catch (err) {
        const e = toLlm(err)
        if (!e.retryable || attempt >= this.maxRetries) throw e
        await sleep(Math.max(e.retryAfterMs ?? 0, this.retryDelayMs(attempt)), opts.signal)
      }
    }
  }

  async #attempt(state: DecisionState, questions: Question[], timeoutMs: number, signal?: AbortSignal) {
    const timer = new AbortController()
    const t = setTimeout(
      () => timer.abort(new LlmError('timeout', `no answer within ${timeoutMs} ms`)),
      timeoutMs,
    )
    const combined = signal ? AbortSignal.any([signal, timer.signal]) : timer.signal
    try {
      return await raceAbort(this.call(state, questions, combined), combined)
    } catch (err) {
      // which signal fired decides the error: the caller cancelling is not a timeout
      if (signal?.aborted) throw new LlmError('aborted', 'request aborted', { cause: err })
      if (timer.signal.aborted)
        throw new LlmError('timeout', `no answer within ${timeoutMs} ms`, { cause: err })
      throw err
    } finally {
      clearTimeout(t)
    }
  }
}

/** Reject as soon as the signal fires, even if the underlying call ignores it. */
function raceAbort<T>(p: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(new LlmError('aborted', 'request aborted'))
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new LlmError('aborted', 'request aborted'))
    signal.addEventListener('abort', onAbort, { once: true })
    p.then(
      (v) => {
        signal.removeEventListener('abort', onAbort)
        resolve(v)
      },
      (e) => {
        signal.removeEventListener('abort', onAbort)
        reject(e)
      },
    )
  })
}

export function toLlm(err: unknown): LlmError {
  if (err instanceof LlmError) return err
  if (err instanceof Error && (err.name === 'AbortError' || err.name === 'APIUserAbortError'))
    return new LlmError('aborted', 'request aborted', { cause: err })
  return new LlmError('unknown', err instanceof Error ? err.message : String(err), { cause: err })
}

export function sleep(ms: number, signal: AbortSignal | undefined): Promise<void> {
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

export function retryAfterMs(headers: Headers | undefined): number | null {
  const ms = headers?.get('retry-after-ms')
  if (ms && Number.isFinite(Number(ms))) return Number(ms)
  const s = headers?.get('retry-after')
  if (s && Number.isFinite(Number(s))) return Number(s) * 1000
  return null
}
