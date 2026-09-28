// Q-6 — token and cost telemetry.
import type { Usage } from '@gnomeola/protocol'

/** USD per million tokens. Source: claude-api skill model table (cached 2026-06-24). */
type Price = { input: number; output: number; cacheRead: number }

// Cache writes (5-minute TTL) bill at 1.25× input; reads at 0.1× input except where the table says otherwise.
const PRICES: Record<string, Price> = {
  'claude-opus-5': { input: 5, output: 25, cacheRead: 0.5 },
  'claude-opus-5-5': { input: 4, output: 20, cacheRead: 0.2 },
  'claude-opus-4-8': { input: 5, output: 25, cacheRead: 0.5 },
  'claude-fable-5-1': { input: 10, output: 50, cacheRead: 0.25 },
  'claude-sonnet-5': { input: 2, output: 10, cacheRead: 0.2 },
  'claude-haiku-4-5': { input: 1, output: 5, cacheRead: 0.1 },
}
const CACHE_WRITE_MULTIPLIER = 1.25

export const ZERO_USAGE: Usage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }

/**
 * Estimated cost in USD, or null for a model we have no price for (including local Ollama models, which
 * cost nothing per token but we do not pretend to know that from the name).
 */
export function estimateCostUsd(usage: Usage, model: string): number | null {
  const p = PRICES[model]
  if (!p) return null
  const perToken = (x: number) => x / 1_000_000
  return (
    usage.inputTokens * perToken(p.input) +
    usage.cacheWriteTokens * perToken(p.input * CACHE_WRITE_MULTIPLIER) +
    usage.cacheReadTokens * perToken(p.cacheRead) +
    usage.outputTokens * perToken(p.output)
  )
}

/** Total prompt size: `input_tokens` is only the uncached remainder. */
export const promptTokens = (u: Usage): number => u.inputTokens + u.cacheReadTokens + u.cacheWriteTokens
