// The public entry point: one question against one or more transcripts, streamed.
//
// Q-7 (ask during a meeting): `ask` snapshots the transcript synchronously when called — the caller can
// keep appending segments while the answer streams — and then does nothing but await the provider. It
// holds no locks and never touches capture or STT, so it cannot block them; `signal` cancels it.
import type { Citation, Usage } from '@gnomeola/protocol'
import { CitationRewriter } from './citations.ts'
import { LlmError } from './errors.ts'
import { assemblePrompt } from './prompt.ts'
import type { Effort, FallbackInfo, LlmProvider, PromptStats, Refusal, TranscriptInput } from './types.ts'

export type AskOptions = {
  provider: LlmProvider
  transcripts: readonly TranscriptInput[]
  question: string
  /** Default `low`: live Q&A, where latency is the feature. */
  effort?: Effort
  signal?: AbortSignal
}

export type AskDone = {
  type: 'done'
  /** Final answer with `[n]` markers indexing `citations` (1-based). Empty on a refusal. */
  text: string
  citations: Citation[]
  usage: Usage
  /** Provider stop reason: `end_turn`, `max_tokens`, `refusal`, … */
  stopReason: string
  /** The model that produced the answer (differs from the requested one after a fallback). */
  model: string
  /** Aliases the model cited that were not in the prompt; dropped from `text`. */
  hallucinated: string[]
  refusal: Refusal | null
  fallback: FallbackInfo | null
  prompt: PromptStats
}

export type AskEvent = { type: 'delta'; text: string } | AskDone

export function ask(opts: AskOptions): AsyncIterable<AskEvent> {
  const question = opts.question.trim()
  if (!question) throw new LlmError('bad_request', 'question is empty')
  // snapshot now, not when iteration starts
  const prompt = assemblePrompt({
    transcripts: opts.transcripts,
    question,
    minCacheTokens: opts.provider.minCacheTokens,
  })
  const effort = opts.effort ?? 'low'
  const { provider, signal } = opts

  async function* run(): AsyncGenerator<AskEvent> {
    const rewriter = new CitationRewriter(prompt.aliases)
    for await (const ev of provider.stream(prompt, { effort, signal })) {
      if (ev.type === 'delta') {
        const text = rewriter.push(ev.text)
        if (text) yield { type: 'delta', text }
        continue
      }
      const tail = rewriter.flush()
      if (tail) yield { type: 'delta', text: tail }
      // A refusal's partial text is not an answer: discard it (the skill's rule for mid-stream declines).
      const refused = ev.stopReason === 'refusal'
      yield {
        type: 'done',
        text: refused ? '' : rewriter.text,
        citations: refused ? [] : rewriter.citations,
        usage: ev.usage,
        stopReason: ev.stopReason,
        model: ev.model,
        hallucinated: rewriter.hallucinated,
        refusal: ev.refusal,
        fallback: ev.fallback,
        prompt: prompt.stats,
      }
      return
    }
    throw new LlmError('network', 'provider stream ended without a final message')
  }
  return run()
}
