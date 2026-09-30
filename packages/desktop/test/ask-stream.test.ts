import type { AskStreamEvent, QaMessage } from '@gnomeola/protocol'
import { fromHistory } from '@gnomeola/ui-core/qa'
import { describe, expect, it } from 'vitest'
import { createEphemeralStore } from '../src/renderer/data/ephemeral.ts'
import { mergeTurns, type OwnAsk, runOwnAsk } from '../src/renderer/features/ask/ask-stream.ts'

// This window's own questions: tokens into the ephemeral store, the requestId from the stream's
// `question` event, and the pane's turns = history with the own asks laid over it until the durable
// answer is in.

const msg = (
  requestId: string,
  role: 'user' | 'assistant',
  text: string,
  over: Partial<QaMessage> = {},
): QaMessage => ({
  id: `${requestId}-${role}`,
  sessionId: 's1',
  requestId,
  role,
  text,
  citations: [],
  model: null,
  usage: null,
  stopReason: role === 'assistant' ? 'end_turn' : null,
  createdAt: '2026-09-30T10:00:00.000Z',
  ...over,
})

async function* events(list: AskStreamEvent[]): AsyncGenerator<AskStreamEvent> {
  for (const e of list) yield e
}

describe('runOwnAsk', () => {
  it('streams tokens into the store, reports the requestId and the final answer', async () => {
    const store = createEphemeralStore()
    const seen: string[] = []
    const r = await runOwnAsk(
      {
        ask: () =>
          events([
            { type: 'question', message: msg('r1', 'user', 'Q?') },
            { type: 'delta', text: 'Three ' },
            { type: 'delta', text: 'attempts [1].' },
            { type: 'answer', message: msg('r1', 'assistant', 'Three attempts [1].') },
          ]),
      },
      store,
      'l1',
      { question: 'Q?', sessionId: 's1', effort: 'low' },
      { onQuestion: (id) => seen.push(`q:${id}`), onAnswer: (m) => seen.push(`a:${m.text}`) },
    )
    expect(r).toEqual({ text: 'Three attempts [1].', status: 'done' })
    expect(store.getState().streams.l1).toEqual(r)
    expect(seen).toEqual(['q:r1', 'a:Three attempts [1].'])
  })

  it('ends in an error for an error event, a thrown call, or a stream that just stops', async () => {
    const store = createEphemeralStore()
    const on = { onQuestion: () => {}, onAnswer: () => {} }
    const body = { question: 'Q?', sessionId: 's1', effort: 'low' as const }
    const quota = await runOwnAsk(
      { ask: () => events([{ type: 'error', error: { code: 'unavailable', message: 'no credits left' } }]) },
      store,
      'e1',
      body,
      on,
    )
    expect(quota).toMatchObject({ status: 'error', error: { code: 'unavailable' } })
    const thrown = await runOwnAsk(
      {
        ask: () => {
          throw Object.assign(new Error('daemon down'), { code: 'unreachable' })
        },
      },
      store,
      'e2',
      body,
      on,
    )
    expect(thrown).toMatchObject({ status: 'error', error: { code: 'unreachable', message: 'daemon down' } })
    const cut = await runOwnAsk(
      { ask: () => events([{ type: 'delta', text: 'half' }]) },
      store,
      'e3',
      body,
      on,
    )
    expect(cut).toMatchObject({ status: 'error', text: 'half', error: { code: 'internal' } })
  })
})

describe('mergeTurns', () => {
  const own = (o: Partial<OwnAsk>): OwnAsk => ({
    localId: 'l1',
    question: 'Q?',
    since: null,
    requestId: null,
    answer: null,
    ...o,
  })

  it('shows a placeholder turn streaming before the daemon has echoed the question', () => {
    const turns = mergeTurns(fromHistory([]), [own({})], { l1: { text: 'Thr', status: 'streaming' } })
    expect(turns).toMatchObject([{ requestId: 'l1', question: 'Q?', own: 'Thr', pending: true }])
  })

  it('puts the streaming text under the echoed question, in its place, not as a second turn', () => {
    const qa = fromHistory([
      msg('r0', 'user', 'Earlier?'),
      msg('r0', 'assistant', 'Yes.'),
      msg('r1', 'user', 'Q?'),
    ])
    const turns = mergeTurns(qa, [own({ requestId: 'r1' })], { l1: { text: 'Three', status: 'streaming' } })
    expect(turns.map((t) => [t.requestId, t.own, t.pending])).toEqual([
      ['r0', null, false],
      ['r1', 'Three', true],
    ])
  })

  it('lets the durable answer win once it is in the history', () => {
    const qa = fromHistory([msg('r1', 'user', 'Q?'), msg('r1', 'assistant', 'Final.')])
    const turns = mergeTurns(qa, [own({ requestId: 'r1' })], { l1: { text: 'Fin', status: 'done' } })
    expect(turns).toHaveLength(1)
    expect(turns[0]).toMatchObject({ own: null, answer: { text: 'Final.' } })
  })

  it('shows a cross-meeting answer from the stream (no history holds it), and an error on its turn', () => {
    const answer = msg('r2', 'assistant', 'Across [1].', { sessionId: null })
    const turns = mergeTurns(
      fromHistory([]),
      [
        own({ localId: 'l2', requestId: 'r2', since: '30d', answer }),
        own({ localId: 'l3', question: 'Broken?' }),
      ],
      {
        l2: { text: 'Across [1].', status: 'done' },
        l3: { text: '', status: 'error', error: { code: 'unavailable', message: 'no key' } },
      },
    )
    expect(turns).toMatchObject([
      { requestId: 'r2', answer: { text: 'Across [1].' }, pending: false },
      { requestId: 'l3', question: 'Broken?', pending: false, error: { code: 'unavailable' } },
    ])
  })
})
