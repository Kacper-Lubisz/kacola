import type { Citation, Segment, Session, Usage } from '@gnomeola/protocol'

/** Mirrors protocol `Effort`. `low` for live Q&A (latency is the feature), `high` for heavier work. */
export type Effort = 'low' | 'medium' | 'high'

/** One session's transcript as input to prompt assembly. Segments may be in any order. */
export type TranscriptInput = { session: Session; segments: readonly Segment[] }

export type PromptBlock = {
  kind: 'session' | 'chunk' | 'question'
  text: string
  /** Put a `cache_control` breakpoint on this block. */
  cache: boolean
}

export type PromptStats = {
  /** Blocks (session headers + chunks) in the byte-stable prefix. */
  stableBlocks: number
  /** Blocks after the stable prefix: in-progress chunks of a live meeting, plus the question. */
  tailBlocks: number
  breakpoints: number
  /** Conservative (under-)estimate of tokens up to and including the last stable block. */
  estimatedStableTokens: number
  /** The minimum cacheable prefix the assembler was told to respect. */
  minCacheTokens: number
  /** False when the stable prefix is below the minimum: no breakpoint is placed rather than pretend. */
  cacheable: boolean
}

/** Provider-neutral prompt: frozen system text, then the user turn as ordered blocks, question last. */
export type AssembledPrompt = {
  system: string
  blocks: PromptBlock[]
  /** Citation alias (`s12`) → what it points at. */
  aliases: ReadonlyMap<string, Citation>
  stats: PromptStats
}

export type Refusal = { category: string | null; explanation: string | null }
export type FallbackInfo = { from: string; to: string }

/** What a provider streams back. Providers do not know about citations; `ask` handles those. */
export type ProviderEvent =
  | { type: 'delta'; text: string }
  | {
      type: 'done'
      stopReason: string
      model: string
      usage: Usage
      refusal: Refusal | null
      fallback: FallbackInfo | null
    }

export type ProviderStreamOptions = { effort: Effort; signal?: AbortSignal | undefined }

export interface LlmProvider {
  readonly id: string
  readonly model: string
  /** Smallest prefix (tokens) this provider can cache. `Infinity` = no explicit caching. */
  readonly minCacheTokens: number
  stream(prompt: AssembledPrompt, opts: ProviderStreamOptions): AsyncIterable<ProviderEvent>
}
