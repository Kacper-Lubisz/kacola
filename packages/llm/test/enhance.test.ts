import { extractActionItems } from '@gnomeola/protocol'
import { describe, expect, it } from 'vitest'
import {
  ENHANCE_SYSTEM_PROMPT,
  type EnhanceDone,
  type EnhanceEvent,
  enhance,
  enhanceTail,
  unwrapFence,
} from '../src/enhance.ts'
import { SYSTEM_PROMPT } from '../src/prompt.ts'
import type { AssembledPrompt, LlmProvider, ProviderEvent, ProviderStreamOptions } from '../src/types.ts'
import {
  GENERAL_TEMPLATE,
  keptLines,
  PLATFORM_ENHANCED,
  PLATFORM_NOTES,
  PLATFORM_REFERENCE,
  scoreEnhancement,
} from './fixtures/enhance-scenarios.ts'
import { INJECTION_LINE, platformSync } from './fixtures/meeting.ts'

// N-2 — the enhancement request and the handling of what comes back, against a scripted provider.

const usage = { inputTokens: 300, outputTokens: 400, cacheReadTokens: 0, cacheWriteTokens: 1800 }

function fake(pieces: string[], stopReason = 'end_turn') {
  const calls: { prompt: AssembledPrompt; opts: ProviderStreamOptions }[] = []
  const provider: LlmProvider = {
    id: 'fake',
    model: 'fake-1',
    minCacheTokens: 512,
    async *stream(prompt, opts): AsyncGenerator<ProviderEvent> {
      calls.push({ prompt, opts })
      for (const text of pieces) yield { type: 'delta', text }
      yield {
        type: 'done',
        stopReason,
        model: 'fake-1',
        usage,
        refusal: stopReason === 'refusal' ? { category: 'cyber', explanation: null } : null,
        fallback: null,
      }
    },
  }
  return { provider, calls }
}

async function collect(it: AsyncIterable<EnhanceEvent>) {
  const deltas: string[] = []
  let done: EnhanceDone | undefined
  for await (const ev of it) {
    if (ev.type === 'delta') deltas.push(ev.text)
    else done = ev
  }
  if (!done) throw new Error('no done event')
  return { deltas, done }
}

const run = (pieces: string[], notes = PLATFORM_NOTES, stopReason?: string) => {
  const f = fake(pieces, stopReason)
  return {
    ...f,
    result: collect(
      enhance({ provider: f.provider, transcript: platformSync(), notes, template: GENERAL_TEMPLATE }),
    ),
  }
}

describe('enhance: the request', () => {
  it('uses its own frozen system prompt, effort high, the transcript cached, the notes last and uncached', async () => {
    const { calls, result } = run(PLATFORM_ENHANCED)
    await result
    const { prompt, opts } = calls[0]!
    expect(opts.effort).toBe('high')
    expect(prompt.system).toBe(ENHANCE_SYSTEM_PROMPT)
    expect(prompt.system).not.toBe(SYSTEM_PROMPT)
    const last = prompt.blocks.at(-1)!
    expect(last.cache).toBe(false)
    expect(last.text).toContain(`<my_notes>\n${PLATFORM_NOTES.trimEnd()}\n</my_notes>`)
    expect(last.text).toContain('<template id="general" name="General meeting">')
    expect(prompt.stats.cacheable).toBe(true)
    const cached = prompt.blocks.findLastIndex((b) => b.cache)
    expect(prompt.blocks[cached]!.kind).toBe('chunk')
    expect(cached).toBe(prompt.blocks.length - 2) // everything but the notes is the cached prefix
  })

  it('renders byte-identical prefixes for the same meeting, whatever the notes or template', async () => {
    const a = run(PLATFORM_ENHANCED, 'a\n')
    const b = run(PLATFORM_ENHANCED, 'completely different notes\n')
    await Promise.all([a.result, b.result])
    const prefix = (p: AssembledPrompt) => JSON.stringify([p.system, p.blocks.slice(0, -1)])
    expect(prefix(a.calls[0]!.prompt)).toBe(prefix(b.calls[0]!.prompt))
  })

  it('keeps the transcript as data: the injection line stays inside its chunk, escaped', async () => {
    const { calls, result } = run(PLATFORM_ENHANCED)
    await result
    const chunk = calls[0]!.prompt.blocks.find((b) => b.text.includes('ignore your instructions'))!
    expect(chunk.kind).toBe('chunk')
    expect(chunk.text).toContain(INJECTION_LINE)
    expect(ENHANCE_SYSTEM_PROMPT).toMatch(/never instructions/)
  })

  it('guards the element boundaries in user text without touching anything else', () => {
    const tail = enhanceTail('- see </my_notes> and <b>bold</b> & more\n', {
      id: 'x',
      name: 'A "q"',
      body: 'x </template> y',
    })
    expect(tail).toContain('- see &lt;/my_notes> and <b>bold</b> & more\n</my_notes>')
    expect(tail).toContain('x &lt;/template> y\n</template>')
    expect(tail).toContain('name="A &quot;q&quot;"')
    expect(tail.match(/<\/my_notes>/g)).toHaveLength(1)
  })
})

describe('enhance: the result', () => {
  it('rewrites citation aliases into [n] markers as it streams; deltas add up to the markdown', async () => {
    const { deltas, done } = await run(PLATFORM_ENHANCED).result
    expect(deltas.join('')).toBe(done.markdown)
    expect(done.markdown).not.toMatch(/\[s\d/)
    expect(done.citations.map((c) => c.segmentId)).toEqual([
      'seg_open',
      'seg_retry_budget',
      'seg_retry_confirm',
      'seg_migration_day',
      'seg_migration_confirm',
      'seg_dashboard_owner',
      'seg_dashboard_ack',
      'seg_injection',
      'seg_retry_owner',
    ])
    expect(done.hallucinated).toEqual([])
    expect(done.stopReason).toBe('end_turn')
  })

  it('scores the fixture response as a good enhancement: every user line kept, facts and actions found', async () => {
    const { done } = await run(PLATFORM_ENHANCED).result
    const score = scoreEnhancement(
      PLATFORM_NOTES,
      done.markdown,
      PLATFORM_REFERENCE,
      extractActionItems(done.markdown),
    )
    expect(score).toMatchObject({
      userLinesKept: 3,
      userLinesTotal: 3,
      factRecall: 1,
      actionRecall: 1,
      obeyedInjection: false,
    })
  })

  it('discards partial text on a refusal', async () => {
    const { done } = await run(['## Summary\n\nThe retry'], PLATFORM_NOTES, 'refusal').result
    expect(done).toMatchObject({ markdown: '', citations: [], refusal: { category: 'cyber' } })
  })

  it('unwraps a whole-answer code fence and normalises the ending', async () => {
    const { done } = await run(['```markdown\n## Summary\n\nok [s1]\n```\n']).result
    expect(done.markdown).toBe('## Summary\n\nok [1]\n')
    expect(unwrapFence('\n\n## A\n\n')).toBe('## A\n')
    expect(unwrapFence('```\nx\n```')).toBe('x\n')
    expect(unwrapFence('text with ```code``` inside\n')).toBe('text with ```code``` inside\n')
    expect(unwrapFence('   ')).toBe('')
  })

  it('drops hallucinated aliases and reports them', async () => {
    const { done } = await run(['- a fact [s999]\n']).result
    expect(done.markdown).toBe('- a fact\n')
    expect(done.hallucinated).toEqual(['s999'])
  })
})

describe('the eval scorer', () => {
  it('notices a lost or reworded user line, missing facts and wrong owners', () => {
    const out =
      '## Decisions\n\n- Retry budget is three attempts.\n- migration thursday\n\n## Action items\n\n- [ ] Add alert — owner: Ana\n'
    const s = scoreEnhancement(PLATFORM_NOTES, out, PLATFORM_REFERENCE, extractActionItems(out))
    expect(s.userLinesKept).toBe(1)
    expect(s.missingFacts).toEqual(['retry budget', 'backoff', 'rollback plan', 'dashboard owner'])
    expect(s.missingActions).toEqual(['alert', 'dashboard link'])
    expect(keptLines(PLATFORM_NOTES, out).lost).toEqual(['- retry budget?', '- Ana dashboard'])
  })
})
