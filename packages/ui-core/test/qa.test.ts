import type { AnyEvent, AskStreamEvent, Citation, QaMessage } from '@gnomeola/protocol'
import { describe, expect, it } from 'vitest'
import {
  applyAskStream,
  applyQaEvent,
  beginAsk,
  emptyQa,
  fromHistory,
  isUnavailable,
  QaFeed,
  splitCitations,
  viewTurn,
} from '../src/qa.ts'

const SES = 'ses_1'
const cite = (segmentId: string): Citation => ({
  sessionId: SES,
  segmentId,
  startMs: 66_000,
  endMs: 70_000,
  speaker: 'them',
})
const msg = (over: Partial<QaMessage>): QaMessage => ({
  id: 'qa_x',
  sessionId: SES,
  requestId: 'req_1',
  role: 'user',
  text: 'q',
  citations: [],
  model: null,
  usage: null,
  stopReason: null,
  createdAt: '2026-09-28T12:00:00.000Z',
  ...over,
})
const question = msg({ id: 'qa_q', text: 'What about retries?' })
const answer = msg({
  id: 'qa_a',
  role: 'assistant',
  text: 'Three attempts, then dead-letter [1]; see also [2].',
  citations: [cite('seg_3'), cite('seg_5')],
  stopReason: 'end_turn',
})
const ev = (data: AnyEvent['data'], seq: number | null = 1): AnyEvent =>
  ({ seq, at: '2026-09-28T12:00:00.000Z', sessionId: SES, data }) as AnyEvent

describe('Q&A fold', () => {
  it('groups history into turns by requestId', () => {
    const s = fromHistory([question, answer, msg({ id: 'qa_q2', requestId: 'req_2', text: 'Who?' })])
    expect(s.turns.map((t) => [t.requestId, t.question, t.answer?.id ?? null])).toEqual([
      ['req_1', 'What about retries?', 'qa_a'],
      ['req_2', 'Who?', null],
    ])
    expect(viewTurn(s.turns[0]!)).toMatchObject({ kind: 'answer', citations: answer.citations })
    expect(viewTurn(s.turns[1]!)).toEqual({ kind: 'unanswered' })
  })

  it('streams this window’s own ask: placeholder → real requestId → deltas → answer', () => {
    let s = beginAsk(emptyQa, 'local:1', 'What about retries?')
    expect(viewTurn(s.turns[0]!)).toEqual({ kind: 'streaming', text: '' })
    const steps: AskStreamEvent[] = [
      { type: 'question', message: question },
      { type: 'delta', text: 'Three attempts, ' },
      { type: 'delta', text: 'then dead-letter [1]' },
    ]
    for (const e of steps) s = applyAskStream(s, 'local:1', e)
    expect(s.turns).toHaveLength(1)
    expect(s.turns[0]!.requestId).toBe('req_1')
    expect(viewTurn(s.turns[0]!)).toEqual({ kind: 'streaming', text: 'Three attempts, then dead-letter [1]' })
    s = applyAskStream(s, 'local:1', { type: 'answer', message: answer })
    expect(s.turns[0]!.pending).toBe(false)
    expect(viewTurn(s.turns[0]!)).toMatchObject({ kind: 'answer', text: answer.text })
  })

  it('does not double-count deltas that arrive both on the ask stream and as qa.delta events', () => {
    let s = beginAsk(emptyQa, 'local:1', 'q')
    // the durable question event races ahead of the stream's question
    s = applyQaEvent(s, SES, ev({ type: 'qa.message', message: question }))
    s = applyAskStream(s, 'local:1', { type: 'question', message: question })
    expect(s.turns).toHaveLength(1)
    s = applyAskStream(s, 'local:1', { type: 'delta', text: 'Three' })
    s = applyQaEvent(s, SES, ev({ type: 'qa.delta', requestId: 'req_1', text: 'Three' }, null))
    expect(viewTurn(s.turns[0]!)).toEqual({ kind: 'streaming', text: 'Three' })
    // and the persisted answer arriving from the bus first is the same answer
    s = applyQaEvent(s, SES, ev({ type: 'qa.message', message: answer }))
    s = applyAskStream(s, 'local:1', { type: 'answer', message: answer })
    expect(s.turns).toHaveLength(1)
    expect(viewTurn(s.turns[0]!).kind).toBe('answer')
  })

  it('shows another client’s answer streaming in from qa.delta', () => {
    let s = fromHistory([])
    s = applyQaEvent(s, SES, ev({ type: 'qa.message', message: question }))
    s = applyQaEvent(s, SES, ev({ type: 'qa.delta', requestId: 'req_1', text: 'Three ' }, null))
    s = applyQaEvent(s, SES, ev({ type: 'qa.delta', requestId: 'req_1', text: 'attempts' }, null))
    expect(viewTurn(s.turns[0]!)).toEqual({ kind: 'streaming', text: 'Three attempts' })
  })

  it('a refusal replaces whatever partial text streamed before it', () => {
    let s = beginAsk(emptyQa, 'local:1', 'q')
    s = applyAskStream(s, 'local:1', { type: 'question', message: question })
    s = applyAskStream(s, 'local:1', { type: 'delta', text: 'The retry budget ' })
    s = applyAskStream(s, 'local:1', {
      type: 'answer',
      message: msg({ id: 'qa_r', role: 'assistant', text: '', stopReason: 'refusal' }),
    })
    expect(viewTurn(s.turns[0]!)).toEqual({ kind: 'refusal' })
  })

  it('an error ends the turn with the error, unavailable included', () => {
    let s = beginAsk(emptyQa, 'local:1', 'q')
    s = applyAskStream(s, 'local:1', { type: 'question', message: question })
    s = applyAskStream(s, 'local:1', { type: 'error', error: { code: 'unavailable', message: 'no key' } })
    expect(s.turns[0]!.pending).toBe(false)
    expect(viewTurn(s.turns[0]!)).toEqual({
      kind: 'error',
      error: { code: 'unavailable', message: 'no key' },
    })
  })

  it('splits [n] markers that have citations, leaving the rest as text', () => {
    expect(splitCitations('A [1]; B [2] and [3].', 2)).toEqual([
      { kind: 'text', text: 'A ' },
      { kind: 'cite', n: 1 },
      { kind: 'text', text: '; B ' },
      { kind: 'cite', n: 2 },
      { kind: 'text', text: ' and [3].' },
    ])
    expect(splitCitations('[1][2]', 2)).toEqual([
      { kind: 'cite', n: 1 },
      { kind: 'cite', n: 2 },
    ])
  })
})

describe('QaFeed', () => {
  it('loads history, then asks: the turn streams and ends with the answer', async () => {
    const listeners = new Set<(e: AnyEvent) => void>()
    const feed = new QaFeed(SES, {
      history: async () => [],
      onEvent: (l) => {
        listeners.add(l)
        return () => listeners.delete(l)
      },
      async *ask(body) {
        expect(body).toEqual({ question: 'What about retries?', sessionId: SES, includePrivate: true })
        yield { type: 'question', message: question }
        yield { type: 'delta', text: 'Three attempts, then dead-letter [1]; see also [2].' }
        yield { type: 'answer', message: answer }
      },
    }).start()
    await new Promise((r) => setTimeout(r, 0))
    expect(feed.getSnapshot().status).toBe('ready')
    await feed.ask('What about retries?')
    const t = feed.getSnapshot().qa.turns
    expect(t).toHaveLength(1)
    expect(viewTurn(t[0]!)).toMatchObject({ kind: 'answer' })
    expect(feed.asking).toBe(false)
    feed.dispose()
  })

  it('turns a failure before the stream (404, unreachable) into an error on the turn', async () => {
    const feed = new QaFeed(SES, {
      history: async () => [],
      onEvent: () => () => {},
      // biome-ignore lint/correctness/useYield: fails before yielding, like a 404 before the stream
      async *ask() {
        throw Object.assign(new Error('no session ses_1'), { code: 'not_found' })
      },
    }).start()
    await feed.ask('q')
    expect(viewTurn(feed.getSnapshot().qa.turns[0]!)).toEqual({
      kind: 'error',
      error: { code: 'not_found', message: 'no session ses_1' },
    })
  })

  it('never leaves a spinner when the stream ends without an answer', async () => {
    const feed = new QaFeed(SES, {
      history: async () => [],
      onEvent: () => () => {},
      async *ask() {
        yield { type: 'question', message: question }
      },
    }).start()
    await feed.ask('q')
    expect(viewTurn(feed.getSnapshot().qa.turns[0]!).kind).toBe('error')
  })
})

describe('isUnavailable', () => {
  it('sends the user to Preferences only when a provider needs setting up', () => {
    expect(isUnavailable({ code: 'unavailable', message: 'x' })).toBe(true)
    expect(isUnavailable({ code: 'unavailable', message: 'x', reason: 'no-provider' })).toBe(true)
    expect(isUnavailable({ code: 'unavailable', message: 'x', reason: 'no-key' })).toBe(true)
    // an overloaded or out-of-credits provider is not fixed by "add an API key"
    expect(isUnavailable({ code: 'unavailable', message: 'x', reason: 'overloaded' })).toBe(false)
    expect(isUnavailable({ code: 'unavailable', message: 'x', reason: 'no-credits' })).toBe(false)
    expect(isUnavailable({ code: 'conflict', message: 'x', reason: 'private-meeting' })).toBe(false)
  })
})
