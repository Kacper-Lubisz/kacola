import { GnomeolaApiError, type Segment } from '@gnomeola/protocol'
import { type DaemonHandle, startDaemon, waitFor } from '@gnomeola/testkit/daemon'
import { assertNoViolations, checkSegmentHistory, checkSegments } from '@gnomeola/testkit/invariants'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { durable, readEvents, sleep } from './helpers.ts'

const FAST = JSON.stringify({
  segmentEveryMs: 120,
  finalizeAfterMs: 80,
  partialEveryMs: 40,
  levelEveryMs: 50,
})

async function status(p: Promise<unknown>): Promise<number> {
  try {
    await p
    return 200
  } catch (err) {
    if (err instanceof GnomeolaApiError) return err.status
    throw err
  }
}

describe('session lifecycle through the real daemon', () => {
  let d: DaemonHandle
  beforeAll(async () => {
    d = await startDaemon({ env: { GNOMEOLA_FAKE_PIPELINE: FAST } })
  })
  afterAll(async () => {
    await d?.stop()
  })

  it('create → start → pause → resume → stop, refusing every illegal transition with 409', async () => {
    const c = d.client
    const s = await c.call('createSession', { body: { title: 'Standup' } })
    expect(s).toMatchObject({ status: 'idle', title: 'Standup', private: false, startedAt: null, tracks: [] })
    const id = { id: s.id }

    for (const bad of ['pauseSession', 'resumeSession', 'stopSession'] as const)
      expect(await status(c.call(bad, { params: id })), `${bad} from idle`).toBe(409)

    const rec = await c.call('startSession', { params: id })
    expect(rec.status).toBe('recording')
    expect(rec.startedAt).not.toBeNull()
    expect(rec.tracks.map((t) => t.kind)).toEqual(['mic', 'system'])
    expect(rec.tracks.every((t) => t.audioPath?.startsWith(d.dataDir))).toBe(true)
    for (const bad of ['startSession', 'resumeSession'] as const)
      expect(await status(c.call(bad, { params: id })), `${bad} while recording`).toBe(409)

    await waitFor(async () => (await c.call('getTranscript', { params: id })).total >= 4, 10_000, 'segments')

    const paused = await c.call('pauseSession', { params: id })
    expect(paused.status).toBe('paused')
    expect(paused.durationMs).toBeGreaterThan(0)
    for (const bad of ['startSession', 'pauseSession'] as const)
      expect(await status(c.call(bad, { params: id })), `${bad} while paused`).toBe(409)
    // paused audio produces no new segments
    const n = (await c.call('getTranscript', { params: id })).total
    await sleep(400)
    expect((await c.call('getTranscript', { params: id })).total).toBe(n)

    expect((await c.call('resumeSession', { params: id })).status).toBe('recording')
    await waitFor(
      async () => (await c.call('getTranscript', { params: id })).total > n,
      10_000,
      'more segments',
    )

    const stopped = await c.call('stopSession', { params: id })
    expect(stopped.status).toBe('stopped')
    expect(stopped.endedAt).not.toBeNull()
    expect(stopped.durationMs).toBeGreaterThanOrEqual(paused.durationMs)
    for (const bad of ['startSession', 'pauseSession', 'resumeSession', 'stopSession'] as const)
      expect(await status(c.call(bad, { params: id })), `${bad} after stop`).toBe(409)

    // the transcript satisfies the invariants, and stop() flushed everything to final
    const t = await c.call('getTranscript', { params: id })
    expect(t.total).toBe(t.segments.length)
    assertNoViolations(
      checkSegments(t.segments, { durationMs: stopped.durationMs, requireFinal: true }),
      'transcript',
    )

    // the log tells the same story: status transitions in order, segment histories legal
    const health = await c.call('health')
    const events = durable(await readEvents(c, { since: 0, untilSeq: health.lastSeq }))
    const statuses = events.flatMap((e) =>
      e.data.type === 'session.upserted' && e.data.session.id === s.id ? [e.data.session.status] : [],
    )
    expect(dedupeRuns(statuses)).toEqual(['idle', 'recording', 'paused', 'recording', 'stopped'])
    const history: Segment[] = events.flatMap((e) =>
      e.data.type === 'segment.upserted' ? [e.data.segment] : [],
    )
    assertNoViolations(checkSegmentHistory(history), 'segment history')
    expect(history.some((g) => g.revision > 1)).toBe(true)
  })

  it('serialises racing transitions: of five concurrent starts exactly one wins', async () => {
    const c = d.client
    const s = await c.call('createSession', {})
    const results = await Promise.all(
      Array.from({ length: 5 }, () => status(c.call('startSession', { params: { id: s.id } }))),
    )
    expect(results.sort()).toEqual([200, 409, 409, 409, 409])
    const stops = await Promise.all(
      Array.from({ length: 3 }, () => status(c.call('stopSession', { params: { id: s.id } }))),
    )
    expect(stops.sort()).toEqual([200, 409, 409])
  })

  it('refuses to delete a running session, deletes a stopped one with its audio', async () => {
    const c = d.client
    const s = await c.call('createSession', {})
    const rec = await c.call('startSession', { params: { id: s.id } })
    expect(await status(c.call('deleteSession', { params: { id: s.id } }))).toBe(409)
    await c.call('stopSession', { params: { id: s.id } })
    expect(await c.call('deleteSession', { params: { id: s.id } })).toEqual({ deleted: true })
    expect(await status(c.call('getSession', { params: { id: s.id } }))).toBe(404)
    expect(await status(c.call('deleteSession', { params: { id: s.id } }))).toBe(404)
    const { existsSync } = await import('node:fs')
    expect(existsSync(rec.tracks[0]!.audioPath!)).toBe(false)
  })

  it('answers errors as ApiError JSON with the right status', async () => {
    const raw = async (method: string, path: string, body?: string, headers: Record<string, string> = {}) => {
      const res = await fetch(d.baseUrl + path, {
        method,
        body,
        headers: { 'content-type': 'application/json', ...headers },
      })
      return { status: res.status, json: (await res.json()) as { error: { code: string; message: string } } }
    }
    expect(await raw('GET', '/sessions/ses_nope')).toMatchObject({
      status: 404,
      json: { error: { code: 'not_found' } },
    })
    expect(await raw('GET', '/nowhere')).toMatchObject({
      status: 404,
      json: { error: { code: 'not_found' } },
    })
    expect(await raw('PUT', '/sessions')).toMatchObject({
      status: 405,
      json: { error: { code: 'bad_request' } },
    })
    expect(await raw('POST', '/sessions', '{not json')).toMatchObject({
      status: 400,
      json: { error: { code: 'bad_request' } },
    })
    expect(await raw('POST', '/sessions', JSON.stringify({ title: 5 }))).toMatchObject({ status: 400 })
    expect(await raw('GET', '/search')).toMatchObject({ status: 400 })
    expect(await raw('GET', '/search?q=x&limit=1000')).toMatchObject({ status: 400 })
    expect(await raw('GET', '/sessions?since=yesterday-ish')).toMatchObject({ status: 400 })
    expect(await raw('POST', '/sessions', 'x'.repeat(2 * 1024 * 1024))).toMatchObject({ status: 413 })
    const s = await d.client.call('createSession', {})
    expect(await raw('GET', `/sessions/${s.id}/transcript?fromMs=10&toMs=5`)).toMatchObject({ status: 400 })
    expect(await raw('GET', '/events?since=999999')).toMatchObject({
      status: 409,
      json: { error: { code: 'conflict' } },
    })
    // browser-originated and DNS-rebound requests are refused
    expect(await raw('POST', '/sessions', '{}', { origin: 'https://evil.example' })).toMatchObject({
      status: 403,
    })
    const rebound = await rawHost(d.baseUrl, 'evil.example')
    expect(rebound).toBe(403)
  })
})

describe('pipeline failures', () => {
  it('a fatal pipeline error ends the session as failed, keeping what was captured', async () => {
    const d = await startDaemon({
      env: { GNOMEOLA_FAKE_PIPELINE: JSON.stringify({ segmentEveryMs: 100, failAfterMs: 450 }) },
    })
    try {
      const s = await d.client.call('createSession', {})
      await d.client.call('startSession', { params: { id: s.id } })
      const failed = await waitFor(
        async () => {
          const x = await d.client.call('getSession', { params: { id: s.id } })
          return x.status === 'failed' ? x : null
        },
        10_000,
        'failed status',
      )
      expect(failed.error).toMatch(/vanished/)
      expect(failed.endedAt).not.toBeNull()
      expect((await d.client.call('getTranscript', { params: { id: s.id } })).total).toBeGreaterThan(0)
      expect(await status(d.client.call('stopSession', { params: { id: s.id } }))).toBe(409)
    } finally {
      await d.stop()
    }
  })

  it('a pipeline that cannot start is a 503 and leaves the session idle with the reason', async () => {
    const d = await startDaemon({
      env: { GNOMEOLA_FAKE_PIPELINE: JSON.stringify({ failStart: 'no microphone' }) },
    })
    try {
      const s = await d.client.call('createSession', {})
      expect(await status(d.client.call('startSession', { params: { id: s.id } }))).toBe(503)
      expect(await d.client.call('getSession', { params: { id: s.id } })).toMatchObject({
        status: 'idle',
        error: 'no microphone',
      })
    } finally {
      await d.stop()
    }
  })

  it('without fakes and without models, recording is honestly unavailable, naming the model', async () => {
    const { mkdtempSync } = await import('node:fs')
    const { tmpdir } = await import('node:os')
    const { join } = await import('node:path')
    const models = mkdtempSync(join(tmpdir(), 'gnomeola-nomodels-'))
    const d = await startDaemon({ fake: false, env: { GNOMEOLA_MODELS_DIR: models } })
    try {
      const h = await d.client.call('health')
      if (h.capture.available) expect(h.capture.detail).toMatch(/models not ready: .*live-nemo/)
      const s = await d.client.call('createSession', {})
      const err = await d.client.call('startSession', { params: { id: s.id } }).catch((e) => e)
      expect(err.status).toBe(503)
      expect(err.message).toMatch(
        /speech model live-nemo-fastconformer-en-80ms-int8 is missing; download it first/,
      )
      const after = await d.client.call('getSession', { params: { id: s.id } })
      expect(after.status).toBe('idle')
      expect(after.error).toMatch(/is missing/)
      const { models: listed } = await d.client.call('listModels')
      expect(listed.find((m) => m.id === 'live-nemo-fastconformer-en-80ms-int8')?.state).toBe('missing')
    } finally {
      await d.stop()
    }
  })

  it('without PipeWire tools, health says so plainly', async () => {
    const d = await startDaemon({ fake: false, env: { PATH: '/nonexistent' } })
    try {
      const h = await d.client.call('health')
      expect(h.capture).toEqual({
        available: false,
        backend: 'pipewire',
        detail: 'pw-record is not installed',
      })
    } finally {
      await d.stop()
    }
  })
})

function dedupeRuns<T>(xs: T[]): T[] {
  return xs.filter((x, i) => i === 0 || x !== xs[i - 1])
}

async function rawHost(baseUrl: string, host: string): Promise<number> {
  const { request } = await import('node:http')
  const u = new URL(baseUrl)
  return new Promise((resolve, reject) => {
    const req = request({ host: u.hostname, port: u.port, path: '/health', headers: { host } }, (res) => {
      res.resume()
      resolve(res.statusCode ?? 0)
    })
    req.on('error', reject)
    req.end()
  })
}
