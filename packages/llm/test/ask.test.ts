import { QaMessage } from '@gnomeola/protocol'
import { describe, expect, it } from 'vitest'
import { type AskDone, type AskEvent, ask } from '../src/ask.ts'
import { LlmError } from '../src/errors.ts'
import type { AssembledPrompt, LlmProvider, ProviderEvent, ProviderStreamOptions } from '../src/types.ts'
import { platformSync, segmentsFrom } from './fixtures/meeting.ts'

const usage = { inputTokens: 30, outputTokens: 40, cacheReadTokens: 1000, cacheWriteTokens: 0 }

type Script = (prompt: AssembledPrompt, opts: ProviderStreamOptions) => AsyncGenerator<ProviderEvent>

function fake(script: Script) {
  const calls: { prompt: AssembledPrompt; opts: ProviderStreamOptions }[] = []
  const provider: LlmProvider = {
    id: 'fake',
    model: 'fake-1',
    minCacheTokens: 512,
    stream(prompt, opts) {
      calls.push({ prompt, opts })
      return script(prompt, opts)
    },
  }
  return { provider, calls }
}

function textScript(pieces: string[], stopReason = 'end_turn'): Script {
  return async function* () {
    for (const text of pieces) yield { type: 'delta', text }
    yield { type: 'done', stopReason, model: 'fake-1', usage, refusal: null, fallback: null }
  }
}

async function collect(it: AsyncIterable<AskEvent>): Promise<{ deltas: string[]; done: AskDone }> {
  const deltas: string[] = []
  let done: AskDone | undefined
  for await (const ev of it) {
    if (ev.type === 'delta') deltas.push(ev.text)
    else done = ev
  }
  if (!done) throw new Error('no done event')
  return { deltas, done }
}

describe('ask', () => {
  it('streams deltas whose concatenation is exactly the final cited text', async () => {
    const { provider } = fake(
      textScript(['The retry budget is three attempts, then dead-letter [s', '3', '].']),
    )
    const { deltas, done } = await collect(
      ask({ provider, transcripts: [platformSync()], question: 'What is the retry budget?' }),
    )
    expect(deltas.join('')).toBe(done.text)
    expect(done.text).toBe('The retry budget is three attempts, then dead-letter [1].')
    expect(done.citations).toEqual([
      expect.objectContaining({ segmentId: 'seg_retry_budget', sessionId: 'ses_fixture_platform' }),
    ])
    expect(done.usage).toEqual(usage)
    expect(done.stopReason).toBe('end_turn')
    expect(done.prompt.cacheable).toBe(true)
  })

  it('produces everything a protocol QaMessage needs', async () => {
    const { provider } = fake(textScript(['Thursday [s10].']))
    const { done } = await collect(ask({ provider, transcripts: [platformSync()], question: 'When?' }))
    const msg = {
      id: 'qa_1',
      sessionId: 'ses_fixture_platform',
      requestId: 'req_1',
      role: 'assistant',
      text: done.text,
      citations: done.citations,
      model: done.model,
      usage: done.usage,
      stopReason: done.stopReason,
      createdAt: '2026-09-28T10:00:00.000Z',
    }
    expect(QaMessage.parse(msg).citations[0]!.segmentId).toBe('seg_migration_day')
  })

  it('defaults to effort low and passes the requested effort and signal through', async () => {
    const f = fake(textScript(['ok']))
    await collect(ask({ provider: f.provider, transcripts: [platformSync()], question: 'q' }))
    const ctl = new AbortController()
    await collect(
      ask({
        provider: f.provider,
        transcripts: [platformSync()],
        question: 'q',
        effort: 'high',
        signal: ctl.signal,
      }),
    )
    expect(f.calls.map((c) => c.opts.effort)).toEqual(['low', 'high'])
    expect(f.calls[1]!.opts.signal).toBe(ctl.signal)
  })

  it('discards partial text on a refusal and reports the category', async () => {
    const { provider } = fake(async function* () {
      yield { type: 'delta', text: 'Partial [s3] answer' }
      yield {
        type: 'done',
        stopReason: 'refusal',
        model: 'fake-1',
        usage,
        refusal: { category: 'cyber', explanation: null },
        fallback: null,
      }
    })
    const { done } = await collect(ask({ provider, transcripts: [platformSync()], question: 'q' }))
    expect(done.stopReason).toBe('refusal')
    expect(done.text).toBe('')
    expect(done.citations).toEqual([])
    expect(done.refusal).toEqual({ category: 'cyber', explanation: null })
  })

  it('rejects an empty question before calling the provider', () => {
    const f = fake(textScript(['x']))
    expect(() => ask({ provider: f.provider, transcripts: [], question: '   ' })).toThrow(LlmError)
    expect(f.calls).toHaveLength(0)
  })

  it('fails loudly when the provider ends without a final message', async () => {
    const { provider } = fake(async function* () {
      yield { type: 'delta', text: 'half' }
    })
    await expect(
      collect(ask({ provider, transcripts: [platformSync()], question: 'q' })),
    ).rejects.toMatchObject({
      code: 'network',
    })
  })
})

describe('ask during a live meeting (Q-7)', () => {
  it('snapshots the transcript when called; segments appended during the request do not leak in', async () => {
    const t = platformSync()
    const live = { session: { ...t.session, status: 'recording' as const }, segments: [...t.segments] }
    const f = fake(textScript(['ok']))
    const stream = ask({ provider: f.provider, transcripts: [live], question: 'q' })
    live.segments.push(
      ...segmentsFrom(live.session.id, [['seg_new', '12:00', 'me', 'a line spoken after asking']]),
    )
    await collect(stream)
    const sent = f.calls[0]!.prompt
    expect(sent.blocks.some((b) => b.text.includes('a line spoken after asking'))).toBe(false)
    expect(sent.aliases.size).toBe(19)
  })

  it('never blocks the event loop while waiting on the model, and aborts promptly', async () => {
    const f = fake(async function* (_p, opts) {
      yield { type: 'delta', text: 'thinking about it' }
      // a model that never answers until cancelled
      await new Promise((_, reject) =>
        opts.signal?.addEventListener('abort', () => reject(new LlmError('aborted', 'request aborted'))),
      )
    })
    const ctl = new AbortController()
    const run = collect(
      ask({ provider: f.provider, transcripts: [platformSync()], question: 'q', signal: ctl.signal }),
    )
    // meanwhile, other work (capture, STT, the UI's SSE) keeps getting scheduled
    let ticks = 0
    await new Promise<void>((resolve) => {
      const iv = setInterval(() => {
        if (++ticks === 5) {
          clearInterval(iv)
          resolve()
        }
      }, 1)
    })
    expect(ticks).toBe(5)
    const t0 = performance.now()
    ctl.abort()
    await expect(run).rejects.toMatchObject({ code: 'aborted' })
    expect(performance.now() - t0).toBeLessThan(100)
  })
})
