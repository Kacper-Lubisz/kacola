import { randomBytes } from 'node:crypto'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { type DaemonHandle, startDaemon, waitFor } from '@gnomeola/testkit/daemon'
import { afterEach, describe, expect, it } from 'vitest'

// A planted API key must never appear in any HTTP response, any SSE frame, the event log, the database
// file (or its WAL), the log file, or the process's stdout/stderr. We grep all of them, byte for byte.

let d: DaemonHandle | undefined
afterEach(async () => {
  await d?.stop()
  d = undefined
})

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    return statSync(p).isDirectory() ? filesUnder(p) : [p]
  })
}

/** Fetch every route (JSON and SSE) and return the raw response bodies. */
async function hitEverything(d: DaemonHandle, sessionId: string, question: string): Promise<string[]> {
  const bodies: string[] = []
  const get = async (path: string, init: RequestInit = {}) => {
    const res = await fetch(d.baseUrl + path, init)
    bodies.push(`${path} ${res.status} ${JSON.stringify([...res.headers])} ${await res.text()}`)
  }
  const json = (method: string, body: unknown): RequestInit => ({
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  await get('/health')
  await get('/devices')
  await get('/sessions?includePrivate=true')
  await get(`/sessions/${sessionId}?includePrivate=true`)
  await get(`/sessions/${sessionId}/transcript?includePrivate=true`)
  await get(`/sessions/${sessionId}/qa?includePrivate=true`)
  await get('/search?q=retry&includePrivate=true')
  await get('/models')
  await get('/settings')
  await get('/settings', json('PATCH', { llm: { model: 'claude-opus-5' } }))
  await get('/diagnostics')
  await get('/sessions/nope/transcript')
  await get('/settings/api-key', json('PUT', { key: 5 }))
  for (const q of [question, `${question} LEAK`])
    await get('/ask', json('POST', { question: q, sessionId, includePrivate: true }))
  // the whole event log, as SSE
  const { lastSeq } = (await (await fetch(`${d.baseUrl}/health`)).json()) as { lastSeq: number }
  const ac = new AbortController()
  const res = await fetch(`${d.baseUrl}/events?since=0`, {
    signal: ac.signal,
    headers: { accept: 'text/event-stream' },
  })
  const reader = res.body!.getReader()
  let text = ''
  while (!text.includes(`id: ${lastSeq}\n`)) text += new TextDecoder().decode((await reader.read()).value)
  ac.abort()
  bodies.push(text)
  return bodies
}

async function exercise(d: DaemonHandle): Promise<string> {
  const c = d.client
  const s = await c.call('createSession', { body: { title: 'secret test', private: true } })
  await c.call('startSession', { params: { id: s.id } })
  await waitFor(
    async () =>
      (await c.call('getTranscript', { params: { id: s.id }, query: { includePrivate: true } })).total >= 3,
  )
  await c.call('stopSession', { params: { id: s.id } })
  return s.id
}

function assertAbsent(secret: string, haystacks: [string, string][]): void {
  const hits = haystacks.filter(([, text]) => text.includes(secret)).map(([where]) => where)
  expect(hits, `planted key found in: ${hits.join(', ')}`).toEqual([])
}

describe('secrets never leak', () => {
  it('a key set via PUT /settings/api-key (keyring) appears nowhere', async () => {
    // deliberately NOT shaped like an Anthropic key, so pattern-based redaction cannot be what saves us
    const key = `planted${randomBytes(12).toString('hex')}`
    d = await startDaemon({ env: { GNOMEOLA_FAKE_QA: '1' } })
    expect(await d.client.call('setApiKey', { body: { key } })).toEqual({ configured: true })
    expect((await d.client.call('getSettings')).llm.apiKeyConfigured).toBe(true)
    const id = await exercise(d)
    const bodies = await hitEverything(d, id, 'what is the budget?')
    // the LEAK question really did make the engine put the key in its error — and it was redacted
    expect(bodies.some((b) => b.includes('invalid x-api-key [REDACTED]'))).toBe(true)
    await d.kill('SIGTERM')
    assertAbsent(key, [
      ...bodies.map((b, i) => [`response #${i}`, b] as [string, string]),
      ['stdout/stderr', d.output()],
      ...filesUnder(d.dataDir).map((f) => [f, readFileSync(f, 'latin1')] as [string, string]),
    ])
  })

  it('a key from ANTHROPIC_API_KEY appears nowhere, even with logs echoed to stderr', async () => {
    const key = `sk-ant-api03-${randomBytes(24).toString('base64url')}`
    d = await startDaemon({ env: { GNOMEOLA_FAKE_QA: '1', ANTHROPIC_API_KEY: key, GNOMEOLA_ECHO_LOGS: '1' } })
    expect((await d.client.call('getSettings')).llm.apiKeyConfigured).toBe(true)
    expect((await d.client.call('health')).llm).toEqual({ provider: 'anthropic', ready: true })
    const id = await exercise(d)
    const bodies = await hitEverything(d, id, 'who owns the rollout?')
    await d.kill('SIGTERM')
    expect(d.output()).toContain('"msg":"listening"') // stderr echo really was on
    assertAbsent(key, [
      ...bodies.map((b, i) => [`response #${i}`, b] as [string, string]),
      ['stdout/stderr', d.output()],
      ...filesUnder(d.dataDir).map((f) => [f, readFileSync(f, 'latin1')] as [string, string]),
    ])
  })
})
