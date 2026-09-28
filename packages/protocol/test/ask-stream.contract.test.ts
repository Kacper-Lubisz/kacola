import { describe, expect, it } from 'vitest'
import { AskStreamEvent, SearchResult, Transcript } from '../src/routes.ts'

const msg = {
  id: 'qa_1',
  sessionId: null,
  requestId: 'req_1',
  role: 'assistant',
  text: 'a',
  citations: [],
  model: 'm',
  usage: null,
  stopReason: 'end_turn',
  createdAt: '2026-09-28T10:00:00.000Z',
}

describe('AskStreamEvent — every variant parses, nothing else does', () => {
  it.each([
    [{ type: 'question', message: { ...msg, role: 'user' } }],
    [{ type: 'delta', text: 'hi' }],
    [{ type: 'answer', message: msg }],
    [{ type: 'error', error: { code: 'unavailable', message: 'no llm' } }],
  ])('%o', (ev) => expect(AskStreamEvent.parse(ev)).toEqual(ev))

  it.each([
    [{ type: 'delta' }],
    [{ type: 'answer' }],
    [{ type: 'question', message: { ...msg, role: 'robot' } }],
    [{ type: 'error', error: { code: 'nope', message: 'x' } }],
    [{ type: 'mystery', text: 'x' }],
  ])('rejects %o', (ev) => expect(AskStreamEvent.safeParse(ev).success).toBe(false))
})

describe('response shapes', () => {
  it('Transcript requires the window shape and a total', () => {
    const base = { session: undefined, segments: [], window: null, total: 0 }
    expect(Transcript.safeParse(base).success).toBe(false)
    expect(Transcript.shape.window.safeParse({ fromMs: 0, toMs: 5 }).success).toBe(true)
    expect(Transcript.shape.window.safeParse({ fromMs: 0 }).success).toBe(false)
    expect(Transcript.shape.window.safeParse(null).success).toBe(true)
  })
  it('SearchResult requires hits and a non-negative total', () => {
    expect(SearchResult.safeParse({ hits: [], total: 0 }).success).toBe(true)
    expect(SearchResult.safeParse({ hits: [] }).success).toBe(false)
    expect(SearchResult.safeParse({ hits: [], total: -1 }).success).toBe(false)
  })
})
