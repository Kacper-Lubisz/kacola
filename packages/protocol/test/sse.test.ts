import { describe, expect, it } from 'vitest'
import { encodeSse, encodeSseComment, SseDecoder, type SseMessage } from '../src/sse.ts'

// Deterministic PRNG so a failing fuzz case is reproducible from its seed.
function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}

const corpus: SseMessage[] = [
  { id: '1', event: 'segment.upserted', data: '{"a":1}' },
  { data: 'plain' },
  { id: '2', data: 'multi\nline\npayload' },
  { event: 'qa.delta', data: '' },
  { id: '3', event: 'x', data: 'unicode — ✓ 日本語 🎙️', retry: 1500 },
  { id: '40000', data: ': not a comment because it is data' },
]

describe('SSE codec', () => {
  it('round-trips every message in one chunk', () => {
    const d = new SseDecoder()
    const wire = corpus.map(encodeSse).join(encodeSseComment('keepalive'))
    expect(d.push(wire)).toEqual(corpus)
  })

  it('is invariant to chunk boundaries (fuzzed, 500 seeds)', () => {
    const wire = corpus.map(encodeSse).join(encodeSseComment('ping'))
    for (let seed = 1; seed <= 500; seed++) {
      const r = rng(seed)
      const d = new SseDecoder()
      const got: SseMessage[] = []
      let i = 0
      while (i < wire.length) {
        const n = 1 + Math.floor(r() * 12)
        got.push(...d.push(wire.slice(i, i + n)))
        i += n
      }
      expect(got, `seed ${seed}`).toEqual(corpus)
    }
  })

  it('handles CRLF and bare CR line endings, including CRLF split across chunks', () => {
    const crlf = 'id: 7\r\nevent: e\r\ndata: hi\r\n\r\n'
    const d = new SseDecoder()
    expect([...d.push(crlf.slice(0, 5)), ...d.push(crlf.slice(5, 17)), ...d.push(crlf.slice(17))]).toEqual([
      { id: '7', event: 'e', data: 'hi' },
    ])
    const cr = new SseDecoder()
    expect(cr.push('data: a\r\r')).toEqual([{ data: 'a' }])
    const split = new SseDecoder()
    expect([...split.push('data: z\r'), ...split.push('\n\r'), ...split.push('\n')]).toEqual([{ data: 'z' }])
  })

  it('ignores comments and unknown fields, never emits empty messages', () => {
    const d = new SseDecoder()
    expect(d.push(': hello\n\nfoo: bar\n\n\n\ndata: ok\n\n')).toEqual([{ data: 'ok' }])
  })
})

describe('SSE codec — edge cases pinned by mutation testing', () => {
  const decode = (...chunks: string[]) => {
    const d = new SseDecoder()
    return chunks.flatMap((c) => d.push(c))
  }

  it('produces exactly the fields present (no undefined keys)', () => {
    expect(decode('data: x\n\n')).toStrictEqual([{ data: 'x' }])
    expect(decode('id: 9\ndata: x\n\n')).toStrictEqual([{ id: '9', data: 'x' }])
    expect(decode('event: e\ndata: x\n\n')).toStrictEqual([{ event: 'e', data: 'x' }])
    expect(decode('retry: 10\ndata: x\n\n')).toStrictEqual([{ retry: 10, data: 'x' }])
  })

  it('dispatches id-only and event-only messages (the daemon never sends them, but the cursor must survive)', () => {
    expect(decode('id: 5\n\n')).toStrictEqual([{ id: '5', data: '' }])
    expect(decode('event: ping\n\n')).toStrictEqual([{ event: 'ping', data: '' }])
  })

  it('treats a data field with an empty value as data, not a comment', () => {
    expect(decode('data:\n\n')).toStrictEqual([{ data: '' }])
    expect(decode('data\n\n')).toStrictEqual([{ data: '' }])
  })

  it('strips exactly one leading space from a value', () => {
    expect(decode('data:x\n\n')).toStrictEqual([{ data: 'x' }])
    expect(decode('data:  x\n\n')).toStrictEqual([{ data: ' x' }])
  })

  it('ignores a malformed retry and ids containing NUL', () => {
    expect(decode('retry: 12a\ndata: x\n\n')).toStrictEqual([{ data: 'x' }])
    expect(decode('retry: a12\ndata: x\n\n')).toStrictEqual([{ data: 'x' }])
    expect(decode('id: a\0b\ndata: x\n\n')).toStrictEqual([{ data: 'x' }])
  })

  it('joins a CR at a chunk end with an LF at the next chunk start — and only then', () => {
    // CR ends chunk 1; chunk 2 starts with LF but does not end with one.
    expect(decode('data: a\r', '\ndata: b', '\n\n')).toStrictEqual([{ data: 'a\nb' }])
    // An LF after a chunk that did NOT end in CR is a real (blank) line terminator.
    expect(decode('data: a\n', '\ndata: b\n\n')).toStrictEqual([{ data: 'a' }, { data: 'b' }])
  })

  it('encodes retry, and comments that cannot break framing', () => {
    expect(encodeSse({ data: 'x', retry: 3000 })).toBe('retry: 3000\ndata: x\n\n')
    expect(encodeSseComment('a\r\nb\nc')).toBe(': a b c\n\n')
    expect(decode(encodeSseComment('evil\n\ndata: injected'), encodeSse({ data: 'real' }))).toStrictEqual([
      { data: 'real' },
    ])
  })
})
