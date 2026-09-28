import { describe, expect, it } from 'vitest'
import { toUsage } from '../src/anthropic.ts'
import { estimateCostUsd, promptTokens } from '../src/cost.ts'

describe('usage and cost telemetry (Q-6)', () => {
  it('maps API usage to protocol Usage, treating absent cache counters as 0', () => {
    const u = toUsage({
      input_tokens: 38,
      output_tokens: 61,
      cache_read_input_tokens: null,
      cache_creation_input_tokens: 1372,
    } as never)
    expect(u).toEqual({ inputTokens: 38, outputTokens: 61, cacheReadTokens: 0, cacheWriteTokens: 1372 })
    expect(promptTokens(u)).toBe(1410)
  })

  it('prices claude-opus-5: $5 in, $25 out, 1.25x cache write, $0.50 cache read per MTok', () => {
    const M = 1_000_000
    expect(
      estimateCostUsd(
        { inputTokens: M, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
        'claude-opus-5',
      ),
    ).toBeCloseTo(5)
    expect(
      estimateCostUsd(
        { inputTokens: 0, outputTokens: M, cacheReadTokens: 0, cacheWriteTokens: 0 },
        'claude-opus-5',
      ),
    ).toBeCloseTo(25)
    expect(
      estimateCostUsd(
        { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: M },
        'claude-opus-5',
      ),
    ).toBeCloseTo(6.25)
    expect(
      estimateCostUsd(
        { inputTokens: 0, outputTokens: 0, cacheReadTokens: M, cacheWriteTokens: 0 },
        'claude-opus-5',
      ),
    ).toBeCloseTo(0.5)
  })

  it('reproduces the docs/llm.md worked example for a one-hour meeting', () => {
    const first = estimateCostUsd(
      { inputTokens: 40, outputTokens: 450, cacheReadTokens: 0, cacheWriteTokens: 10_000 },
      'claude-opus-5',
    )!
    const again = estimateCostUsd(
      { inputTokens: 40, outputTokens: 450, cacheReadTokens: 10_000, cacheWriteTokens: 0 },
      'claude-opus-5',
    )!
    expect(first).toBeCloseTo(0.074, 3)
    expect(again).toBeCloseTo(0.0165, 3)
  })

  it('returns null for models it has no price for (e.g. local Ollama models)', () => {
    expect(
      estimateCostUsd(
        { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 },
        'llama3.2',
      ),
    ).toBeNull()
  })
})
