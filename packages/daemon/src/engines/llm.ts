import { ask, LlmError, providerFromSettings } from '@gnomeola/llm'
import { isKeyedProvider } from '@gnomeola/protocol'
import { DaemonError } from '../errors.ts'
import type { QaChunk, QaEngine, QaRequest } from '../interfaces.ts'

// The real question-answering engine: @gnomeola/llm behind the daemon's QaEngine seam. The llm package
// owns prompt layout, caching and citations; this adapter only translates between the two contracts and
// maps provider failures onto wire error codes a client can act on.

export type LlmQaEngineOptions = {
  /** Test seam: route provider HTTP through a replaying fetch. Production leaves this unset. */
  fetch?: typeof fetch
}

export class LlmQaEngine implements QaEngine {
  private readonly fetchImpl: typeof fetch | undefined
  constructor(opts: LlmQaEngineOptions = {}) {
    this.fetchImpl = opts.fetch
  }

  ready(ctx: { settings: QaRequest['settings']; apiKeyConfigured: boolean }): boolean {
    if (ctx.settings.provider === 'none') return false
    if (isKeyedProvider(ctx.settings.provider)) return ctx.apiKeyConfigured
    return true // ollama: reachability is only knowable by asking
  }

  async *ask(req: QaRequest): AsyncIterable<QaChunk> {
    const provider = providerFromSettings(
      { ...req.settings, apiKeyConfigured: req.apiKey !== null },
      {
        ...(req.apiKey !== null ? { apiKey: req.apiKey } : {}),
        ...(this.fetchImpl ? { fetch: this.fetchImpl } : {}),
      },
    )
    if (!provider) throw new DaemonError('unavailable', 'question answering is switched off in settings')
    try {
      for await (const ev of ask({
        provider,
        transcripts: req.transcripts,
        question: req.question,
        effort: req.effort,
        signal: req.signal,
      })) {
        if (ev.type === 'delta') yield { type: 'delta', text: ev.text }
        else
          yield {
            type: 'final',
            // On a refusal the llm package empties the text; clients must discard any deltas they showed.
            text: ev.text,
            citations: ev.citations,
            model: ev.model,
            usage: ev.usage,
            stopReason: ev.refusal ? 'refusal' : ev.stopReason,
          }
      }
    } catch (err) {
      throw toWireError(err)
    }
  }
}

export function toWireError(err: unknown): unknown {
  if (!(err instanceof LlmError)) return err
  switch (err.code) {
    case 'auth':
    case 'permission':
      return new DaemonError('unauthorized', 'the LLM provider rejected the API key')
    case 'quota':
      return new DaemonError(
        'unavailable',
        'the LLM provider account has no credits left (add credits or switch provider in Preferences)',
      )
    case 'rate_limited': {
      const after = err.retryAfterMs ? ` (retry in ${Math.ceil(err.retryAfterMs / 1000)}s)` : ''
      return new DaemonError('unavailable', `the LLM provider is rate-limiting requests${after}`)
    }
    case 'overloaded':
    case 'server':
    case 'network':
    case 'timeout':
      return new DaemonError('unavailable', `the LLM provider is unavailable: ${err.message}`)
    case 'bad_request':
      return new DaemonError('bad_request', err.message)
    case 'not_found':
      return new DaemonError('not_found', err.message)
    default:
      return err
  }
}
