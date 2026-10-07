import { ask, LlmError, providerFromSettings } from '@kacola/llm'
import { type AiFeature, aiErrorCopy, type ErrorReason, isKeyedProvider } from '@kacola/protocol'
import { DaemonError } from '../errors.ts'
import type { QaChunk, QaEngine, QaRequest } from '../interfaces.ts'
import { notReadyError } from '../privacy.ts'

// The real question-answering engine: @kacola/llm behind the daemon's QaEngine seam. The llm package
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
    if (!provider) throw notReadyError(req.settings, req.apiKey !== null, 'Ask')
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
      throw toWireError(err, req.settings.provider, 'Ask')
    }
  }
}

/**
 * Map a provider failure onto a wire error: the HTTP family, human copy that names the provider and
 * says whose problem it is, and the stable `reason` + `action` a client branches on. Never the raw
 * provider body (an overloaded 529 arrives as JSON): that goes to the log, not to the user.
 */
export function toWireError(err: unknown, provider?: string, feature?: AiFeature): unknown {
  if (!(err instanceof LlmError)) return err
  const wire = (code: ConstructorParameters<typeof DaemonError>[0], reason: ErrorReason) => {
    const { message, ...detail } = aiErrorCopy(reason, {
      ...(provider ? { provider } : {}),
      ...(feature ? { feature } : {}),
      retryAfterMs: err.retryAfterMs,
    })
    return new DaemonError(code, message, undefined, detail)
  }
  switch (err.code) {
    case 'auth':
    case 'permission':
      return wire('unauthorized', 'bad-key')
    case 'quota':
      return wire('unavailable', 'no-credits')
    case 'rate_limited':
      return wire('unavailable', 'rate-limited')
    case 'overloaded':
      return wire('unavailable', 'overloaded')
    case 'server':
    case 'network':
    case 'timeout':
      return wire('unavailable', 'provider-down')
    case 'bad_request':
      return new DaemonError('bad_request', err.message)
    case 'not_found':
      return new DaemonError('not_found', err.message)
    default:
      return err
  }
}
