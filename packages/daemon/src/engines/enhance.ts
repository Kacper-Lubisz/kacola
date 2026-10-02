import { enhance, providerFromSettings } from '@gnomeola/llm'
import { isKeyedProvider } from '@gnomeola/protocol'
import type { EnhanceChunk, EnhanceRequest, NotesEngine } from '../notes/engine.ts'
import { notReadyError } from '../privacy.ts'
import { toWireError } from './llm.ts'

// N-2 — the real enhancement engine: @gnomeola/llm's `enhance` (effort high, cached transcript prefix,
// citations, refusal handling) behind the daemon's NotesEngine seam. Same provider selection and error
// mapping as Q&A, so Anthropic and Ollama both work.

export type LlmNotesEngineOptions = {
  /** Test seam: route provider HTTP through a replaying fetch. Production leaves this unset. */
  fetch?: typeof fetch
}

export class LlmNotesEngine implements NotesEngine {
  private readonly fetchImpl: typeof fetch | undefined
  constructor(opts: LlmNotesEngineOptions = {}) {
    this.fetchImpl = opts.fetch
  }

  ready(ctx: { settings: EnhanceRequest['settings']; apiKeyConfigured: boolean }): boolean {
    if (ctx.settings.provider === 'none') return false
    if (isKeyedProvider(ctx.settings.provider)) return ctx.apiKeyConfigured
    return true
  }

  async *enhance(req: EnhanceRequest): AsyncIterable<EnhanceChunk> {
    const provider = providerFromSettings(
      { ...req.settings, apiKeyConfigured: req.apiKey !== null },
      {
        ...(req.apiKey !== null ? { apiKey: req.apiKey } : {}),
        ...(this.fetchImpl ? { fetch: this.fetchImpl } : {}),
      },
    )
    if (!provider) throw notReadyError(req.settings, req.apiKey !== null, 'Enhance')
    try {
      for await (const ev of enhance({
        provider,
        transcript: { session: req.session, segments: req.segments },
        notes: req.notes,
        template: req.template,
        effort: 'high',
        signal: req.signal,
      })) {
        if (ev.type === 'delta') yield { type: 'delta', text: ev.text }
        else
          yield {
            type: 'final',
            markdown: ev.markdown,
            citations: ev.citations,
            model: ev.model,
            usage: ev.usage,
            stopReason: ev.refusal ? 'refusal' : ev.stopReason,
          }
      }
    } catch (err) {
      throw toWireError(err, req.settings.provider, 'Enhance')
    }
  }
}
