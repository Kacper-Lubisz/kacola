// V-7 — live notes-enhancement eval against the real Anthropic API (T4, opt-in).
//
//   ANTHROPIC_API_KEY=… pnpm exec vitest run --project eval packages/llm/test/enhance.eval.test.ts
//
// Add KACOLA_CASSETTES=record to also write the traffic to
// test/fixtures/cassettes/recorded/enhance-eval.json. The deterministic stand-in that runs in CI is
// enhance.cassettes.int.test.ts, which scores hand-authored responses with the same scorer.
//
// Two bars. Quality (facts and action items recalled against reference notes) can disappoint and is
// reported with a soft threshold. The invariant cannot: every line of the user's notes must come back
// verbatim — and even when it does not, the daemon never loses them (they stay the head until the user
// merges; see protocol notes-diff.ts and store notes.ts), which is what this eval's hard assertion
// double-checks at the model level.
//
// Without a key every test here is skipped and the reason is printed; nothing passes vacuously.
import { join } from 'node:path'
import { extractActionItems } from '@kacola/protocol'
import { cassetteMode, useCassette } from '@kacola/testkit/cassettes'
import { afterAll, describe, expect, it } from 'vitest'
import { AnthropicProvider } from '../src/anthropic.ts'
import { estimateCostUsd } from '../src/cost.ts'
import { type EnhanceDone, enhance, unwrapFence } from '../src/enhance.ts'
import { CASSETTE_DIR } from './fixtures/cassette-builder.ts'
import {
  drainEnhance,
  GENERAL_TEMPLATE,
  keptLines,
  PLATFORM_NOTES,
  PLATFORM_REFERENCE,
  type Reference,
  STANDUP_NOTES,
  STANDUP_REFERENCE,
  STANDUP_TEMPLATE,
  scoreEnhancement,
  teamStandup,
} from './fixtures/enhance-scenarios.ts'
import { platformSync } from './fixtures/meeting.ts'

const KEY = process.env.ANTHROPIC_API_KEY
const SKIP_REASON = KEY ? null : 'ANTHROPIC_API_KEY is not set, so the live Anthropic API cannot be called'
if (SKIP_REASON) console.warn(`[enhance.eval] SKIPPED: ${SKIP_REASON}`)
const title = SKIP_REASON
  ? `live enhancement eval — SKIPPED: ${SKIP_REASON}`
  : 'live enhancement eval (claude-opus-5)'

/** Soft quality bar: a good enhancement recalls most reference facts and action items. */
const MIN_FACT_RECALL = 0.8
const MIN_ACTION_RECALL = 0.5

describe.skipIf(SKIP_REASON !== null)(title, () => {
  const mode = KEY ? cassetteMode() : 'replay'
  const tape =
    mode === 'record' ? useCassette(join(CASSETTE_DIR, 'recorded', 'enhance-eval.json'), { mode }) : null
  const provider = new AnthropicProvider(tape ? { fetch: tape.fetch } : {})
  const results: { name: string; done: EnhanceDone }[] = []

  afterAll(() => {
    tape?.save()
    for (const { name, done } of results) {
      const cost = estimateCostUsd(done.usage, done.model)
      console.log(
        `[enhance.eval] ${name} → ${done.model} ${done.stopReason} usage=${JSON.stringify(done.usage)} cost≈$${cost?.toFixed(4) ?? '?'}\n${done.markdown}`,
      )
    }
  })

  const cases: [string, () => ReturnType<typeof platformSync>, string, typeof GENERAL_TEMPLATE, Reference][] =
    [
      ['platform sync', platformSync, PLATFORM_NOTES, GENERAL_TEMPLATE, PLATFORM_REFERENCE],
      ['team standup', teamStandup, STANDUP_NOTES, STANDUP_TEMPLATE, STANDUP_REFERENCE],
    ]

  it.each(cases)(
    '%s: keeps every user line verbatim, recalls the reference facts',
    async (name, meeting, notes, template, ref) => {
      const out = await drainEnhance(enhance({ provider, transcript: meeting(), notes, template }))
      if (out.error) throw out.error
      const done = out.done!
      results.push({ name, done })
      expect(done.refusal).toBeNull()
      expect(unwrapFence(out.deltas.join(''))).toBe(done.markdown) // what streamed is what was stored
      const score = scoreEnhancement(notes, done.markdown, ref, extractActionItems(done.markdown))
      console.log(`[enhance.eval] ${name} score ${JSON.stringify(score)}`)
      // the invariant: their words, verbatim
      expect(keptLines(notes, done.markdown).lost, done.markdown).toEqual([])
      expect(done.hallucinated).toEqual([])
      expect(score.obeyedInjection).toBe(false)
      // quality: soft thresholds
      expect(score.factRecall, `missing facts: ${score.missingFacts.join(', ')}`).toBeGreaterThanOrEqual(
        MIN_FACT_RECALL,
      )
      expect(
        score.actionRecall,
        `missing actions: ${score.missingActions.join(', ')}`,
      ).toBeGreaterThanOrEqual(MIN_ACTION_RECALL)
    },
  )

  it('re-enhancing the same meeting reads the cached transcript prefix', async () => {
    const first = await drainEnhance(
      enhance({ provider, transcript: platformSync(), notes: '- a\n', template: GENERAL_TEMPLATE }),
    )
    const second = await drainEnhance(
      enhance({ provider, transcript: platformSync(), notes: '- b\n', template: STANDUP_TEMPLATE }),
    )
    expect(first.done!.usage.cacheReadTokens + first.done!.usage.cacheWriteTokens).toBeGreaterThan(0)
    expect(second.done!.usage.cacheReadTokens).toBeGreaterThan(0)
  })
})
