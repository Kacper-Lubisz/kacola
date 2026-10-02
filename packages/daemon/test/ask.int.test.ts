import type { AskStreamEvent } from '@gnomeola/protocol'
import { type DaemonHandle, startDaemon, waitFor } from '@gnomeola/testkit/daemon'
import { afterEach, describe, expect, it } from 'vitest'
import { durable, readEvents } from './helpers.ts'

let d: DaemonHandle | undefined
afterEach(async () => {
  await d?.stop()
  d = undefined
})

async function collect(it: AsyncIterable<AskStreamEvent>): Promise<AskStreamEvent[]> {
  const out: AskStreamEvent[] = []
  for await (const x of it) out.push(x)
  return out
}

describe('/ask', () => {
  it('with no engine configured: question persisted, then an `unavailable` error', async () => {
    d = await startDaemon()
    const s = await d.client.call('createSession', {})
    const events = await collect(d.client.ask({ question: 'what did we decide?', sessionId: s.id }))
    expect(events.map((e) => e.type)).toEqual(['question', 'error'])
    expect(events[1]).toEqual({
      type: 'error',
      error: {
        code: 'unavailable',
        message: expect.any(String),
        reason: expect.stringMatching(/^no-(provider|key)$/),
        action: 'set-up-provider',
        ...(events[1]?.type === 'error' && events[1].error.provider ? { provider: expect.any(String) } : {}),
      },
    })
    const { messages } = await d.client.call('getQaHistory', { params: { id: s.id } })
    expect(messages.map((m) => m.role)).toEqual(['user'])
  })

  it('streams question, deltas, answer; persists both as qa.message events; fans out qa.delta', async () => {
    d = await startDaemon({
      env: {
        GNOMEOLA_FAKE_QA: '1',
        GNOMEOLA_FAKE_PIPELINE: JSON.stringify({ segmentEveryMs: 60, finalizeAfterMs: 30 }),
      },
    })
    const c = d.client
    const s = await c.call('createSession', { body: { title: 'Planning' } })
    await c.call('startSession', { params: { id: s.id } })
    await waitFor(async () => (await c.call('getTranscript', { params: { id: s.id } })).total >= 3, 10_000)
    await c.call('stopSession', { params: { id: s.id } })

    const deltas: string[] = []
    const ac = new AbortController()
    const watcher = c.subscribe({
      signal: ac.signal,
      onEvent: (e) => {
        if (e.data.type === 'qa.delta') deltas.push(e.data.text)
      },
      onConnect: () => {},
    })
    await new Promise((r) => setTimeout(r, 100))
    const events = await collect(
      c.ask({ question: 'what is the retry budget?', sessionId: s.id, effort: 'low' }),
    )
    const types = events.map((e) => e.type)
    expect(types[0]).toBe('question')
    expect(types.at(-1)).toBe('answer')
    expect(types.slice(1, -1).every((t) => t === 'delta')).toBe(true)
    const q = events[0]!
    const a = events.at(-1)!
    if (q.type !== 'question' || a.type !== 'answer') throw new Error('unreachable')
    expect(a.message.requestId).toBe(q.message.requestId)
    expect(a.message.text).toBe(events.flatMap((e) => (e.type === 'delta' ? [e.text] : [])).join(''))
    expect(a.message.citations.length).toBeGreaterThan(0)
    const segs = (await c.call('getTranscript', { params: { id: s.id } })).segments.map((x) => x.id)
    for (const cit of a.message.citations) expect(segs).toContain(cit.segmentId)
    expect(a.message).toMatchObject({
      role: 'assistant',
      model: 'fake-qa',
      stopReason: 'end_turn',
      sessionId: s.id,
    })

    await waitFor(() => deltas.join('') === a.message.text, 5_000, 'qa.delta fan-out')
    ac.abort()
    await watcher

    const history = (await c.call('getQaHistory', { params: { id: s.id } })).messages
    expect(history).toEqual([q.message, a.message])
    const { lastSeq } = await c.call('health')
    const log = durable(await readEvents(c, { since: 0, untilSeq: lastSeq }))
    expect(log.filter((e) => e.data.type === 'qa.message').map((e) => e.data)).toEqual([
      { type: 'qa.message', message: q.message },
      { type: 'qa.message', message: a.message },
    ])
  })

  it('an engine failure mid-stream ends with an error event and no answer persisted', async () => {
    d = await startDaemon({ env: { GNOMEOLA_FAKE_QA: '1' } })
    const s = await d.client.call('createSession', {})
    const events = await collect(d.client.ask({ question: 'please FAIL', sessionId: s.id }))
    expect(events[0]?.type).toBe('question')
    expect(events.at(-1)).toEqual({
      type: 'error',
      error: { code: 'unavailable', message: 'fake upstream failure' },
    })
    expect(
      (await d.client.call('getQaHistory', { params: { id: s.id } })).messages.map((m) => m.role),
    ).toEqual(['user'])
  })

  it('validates before streaming: unknown session → 404, bad body → 400', async () => {
    d = await startDaemon({ env: { GNOMEOLA_FAKE_QA: '1' } })
    await expect(collect(d.client.ask({ question: 'x', sessionId: 'ses_missing' }))).rejects.toMatchObject({
      status: 404,
    })
    await expect(collect(d.client.ask({ question: '' }))).rejects.toMatchObject({ status: 400 })
    await expect(collect(d.client.ask({ question: 'x', since: 'last tuesday' }))).rejects.toMatchObject({
      status: 400,
    })
  })
})
