import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  type Cassette,
  cassetteMode,
  normaliseRequest,
  parseSse,
  replayResponse,
  saveCassette,
  sseBody,
  useCassette,
} from '../src/cassettes/index.ts'

const dirs: string[] = []
const tmp = () => {
  const d = mkdtempSync(join(tmpdir(), 'cassette-'))
  dirs.push(d)
  return d
}
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})

const URL_ = 'https://api.example.test/v1/messages?beta=true'
const init = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: {
    'X-Api-Key': 'sk-secret',
    Authorization: 'Bearer secret',
    'content-type': 'application/json',
    'anthropic-version': '2023-06-01',
    'x-stainless-os': 'Linux',
    'x-stainless-retry-count': '0',
    'user-agent': 'Anthropic/JS 0.128.0',
  },
  body: JSON.stringify(body),
})

describe('cassetteMode', () => {
  it('replays unless both the flag and a key are present', () => {
    expect(cassetteMode({})).toBe('replay')
    expect(cassetteMode({ ANTHROPIC_API_KEY: 'k' })).toBe('replay')
    expect(cassetteMode({ ANTHROPIC_API_KEY: 'k', GNOMEOLA_CASSETTES: 'record' })).toBe('record')
    expect(cassetteMode({ OPENAI_API_KEY: 'k', GNOMEOLA_CASSETTES: 'record' })).toBe('record')
  })
  it('refuses to "record" without a key instead of silently replaying', () => {
    expect(() => cassetteMode({ GNOMEOLA_CASSETTES: 'record' })).toThrow(/needs ANTHROPIC_API_KEY/)
  })
})

describe('normaliseRequest', () => {
  it('drops credentials and per-machine SDK telemetry, lowercases and sorts headers, parses JSON', () => {
    const r = normaliseRequest(URL_, init({ b: 1, a: 2 }))
    expect(r).toEqual({
      method: 'POST',
      url: URL_,
      headers: { 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: { b: 1, a: 2 },
    })
  })
})

describe('replay', () => {
  const cassette: Cassette = {
    version: 1,
    name: 't',
    source: 'hand-authored',
    interactions: [
      {
        request: { method: 'POST', url: URL_, headers: {}, body: { n: 1 } },
        response: { status: 200, headers: { 'content-type': 'application/json' }, body: '{"ok":1}' },
      },
      {
        request: { method: 'POST', url: URL_, headers: {}, body: { n: 2 } },
        response: { status: 429, headers: { 'retry-after': '3' }, body: '{"type":"error"}' },
      },
    ],
  }

  it('serves interactions in order and records what was actually sent', async () => {
    const path = join(tmp(), 't.json')
    saveCassette(path, cassette)
    const tape = useCassette(path, { mode: 'replay' })
    const a = await tape.fetch(URL_, init({ n: 1 }))
    expect(await a.json()).toEqual({ ok: 1 })
    const b = await tape.fetch(URL_, init({ n: 'different body is recorded, not rejected' }))
    expect(b.status).toBe(429)
    expect(b.headers.get('retry-after')).toBe('3')
    expect(tape.requests.map((r) => r.body)).toEqual([
      { n: 1 },
      { n: 'different body is recorded, not rejected' },
    ])
    tape.assertExhausted()
    await expect(tape.fetch(URL_, init({}))).rejects.toThrow(/request #3 .* only 2 recorded/)
  })

  it('fails loudly on a different endpoint, and on unused interactions', async () => {
    const path = join(tmp(), 't.json')
    saveCassette(path, cassette)
    const tape = useCassette(path, { mode: 'replay' })
    expect(() => tape.assertExhausted()).toThrow(/2 recorded interaction\(s\) unused/)
    await expect(tape.fetch('https://elsewhere.test/', init({}))).rejects.toThrow(/recorded POST/)
  })

  it('names the missing file and how to create it', () => {
    expect(() => useCassette(join(tmp(), 'nope.json'), { mode: 'replay' })).toThrow(
      /cassette not found.*record/,
    )
  })
})

describe('replayResponse', () => {
  const body = sseBody([
    { type: 'message_start', message: { id: 'm' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'hello' } },
    { type: 'message_stop' },
  ])

  it('round-trips SSE through sseBody/parseSse and streams it in several chunks', async () => {
    expect(parseSse(body).map((e) => e.type)).toEqual([
      'message_start',
      'content_block_delta',
      'message_stop',
    ])
    const res = replayResponse({ status: 200, headers: {}, body })
    const chunks: Uint8Array[] = []
    for await (const c of res.body!) chunks.push(c)
    expect(chunks.length).toBe(3)
    expect(Buffer.concat(chunks).toString()).toBe(body)
  })

  it('simulates a connection reset after N bytes', async () => {
    const res = replayResponse({
      status: 200,
      headers: {},
      body,
      streamError: { afterBytes: 20, message: 'reset' },
    })
    const got: Uint8Array[] = []
    const err = await (async () => {
      try {
        for await (const c of res.body!) got.push(c)
      } catch (e) {
        return e as TypeError & { cause: { code: string } }
      }
    })()
    expect(Buffer.concat(got).length).toBe(20)
    expect(err).toBeInstanceOf(TypeError)
    expect(err!.message).toBe('terminated')
    expect(err!.cause.code).toBe('ECONNRESET')
  })

  it('honours an abort signal mid-body', async () => {
    const ctl = new AbortController()
    const res = replayResponse({ status: 200, headers: {}, body }, ctl.signal)
    const reader = res.body!.getReader()
    await reader.read()
    ctl.abort()
    await expect(reader.read()).rejects.toMatchObject({ name: 'AbortError' })
  })
})

describe('record', () => {
  it('passes through to the real fetch and writes a replayable cassette without credentials', async () => {
    const path = join(tmp(), 'rec.json')
    const realFetch = (async () =>
      new Response('event: ping\ndata: {"type":"ping"}\n\n', {
        status: 200,
        headers: { 'content-type': 'text/event-stream', 'set-cookie': 'x=1', 'request-id': 'req_1' },
      })) as typeof fetch
    const rec = useCassette(path, { mode: 'record', realFetch, note: 'recorded in a test' })
    const res = await rec.fetch(URL_, init({ q: 1 }))
    expect(await res.text()).toContain('ping')
    rec.save()
    const raw = readFileSync(path, 'utf8')
    expect(raw).not.toMatch(/sk-secret|Bearer|set-cookie/i)
    const saved = JSON.parse(raw) as Cassette
    expect(saved.source).toBe('recorded')
    expect(saved.interactions[0]!.response.headers).toEqual({
      'content-type': 'text/event-stream',
      'request-id': 'req_1',
    })
    const tape = useCassette(path, { mode: 'replay' })
    expect(await (await tape.fetch(URL_, init({ q: 1 }))).text()).toContain('ping')
  })
})
