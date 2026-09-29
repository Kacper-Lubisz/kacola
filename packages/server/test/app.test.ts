import {
  AnyEvent,
  createClient,
  GnomeolaApiError,
  type RouteName,
  routes,
  type Session,
} from '@gnomeola/protocol'
import { afterEach, describe, expect, it } from 'vitest'
import { ADMIN, type Hosted, SECRET, startHosted } from './helpers.ts'

// T1 contract for the hosted server: every route in the table, through the typed client (which
// validates every response against the route's schema). A route is either served with a valid
// response or answers a typed 501 — never a 404, a crash, or drift.

let servers: Hosted[] = []
afterEach(async () => {
  await Promise.all(servers.map((s) => s.close()))
  servers = []
})
const hosted = async (o: Parameters<typeof startHosted>[0] = {}) => {
  const h = await startHosted(o)
  servers.push(h)
  return h
}

const notHere = (p: Promise<unknown>) =>
  p.then(
    () => {
      throw new Error('expected 501')
    },
    (e: GnomeolaApiError) => {
      expect(e).toBeInstanceOf(GnomeolaApiError)
      expect([e.status, e.code]).toEqual([501, 'unavailable'])
      return e
    },
  )

describe('hosted contract: every route', () => {
  it('serves or explicitly refuses each route with schema-valid answers', async () => {
    const h = await hosted({ auth: { secret: SECRET, adminToken: ADMIN }, heartbeatMs: 30 })
    const c = h.client
    const s = await c.call('createSession', { body: { title: 'hosted' } })
    const priv = await c.call('createSession', { body: { title: 'private', private: true } })
    await h.store.upsertSegment({
      id: 'seg_h1',
      sessionId: s.id,
      track: 'system',
      speaker: 'Ana',
      startMs: 0,
      endMs: 900,
      text: 'the retry budget is three',
      quality: 'final',
      confidence: 0.9,
    })
    // notes arrive by sync (the hosted server never writes them itself)
    await h.store.ingest('laptop', [
      {
        seq: 1,
        data: {
          type: 'note.version',
          version: {
            sessionId: s.id,
            version: 1,
            kind: 'user',
            markdown: '# Standup\n\n- [ ] Ana: ship the retry budget by Thursday\n',
            baseVersion: 0,
            createdAt: '2026-09-01T10:00:00.000Z',
            enhancement: null,
            merge: null,
            restoredFrom: null,
          },
        },
      },
    ])
    const params = { id: s.id }
    const pcm = new Uint8Array(3200)
    const sha = await sha256hex(pcm)
    const calls: Record<RouteName, () => Promise<unknown>> = {
      health: async () => {
        const r = await c.call('health')
        expect(r.capture.backend).toBe('hosted')
        return r
      },
      listDevices: async () => expect(await c.call('listDevices')).toEqual({ devices: [] }),
      listSessions: async () => {
        expect((await c.call('listSessions')).sessions.map((x) => x.id)).toEqual([s.id])
        return c.call('listSessions', { query: { includePrivate: true } })
      },
      createSession: () => c.call('createSession', { body: {} }),
      getSession: () => c.call('getSession', { params: { id: priv.id }, query: { includePrivate: true } }),
      updateSession: () => c.call('updateSession', { params, body: { title: 'renamed' } }),
      startSession: () => notHere(c.call('startSession', { params })),
      pauseSession: () => notHere(c.call('pauseSession', { params })),
      resumeSession: () => notHere(c.call('resumeSession', { params })),
      stopSession: () => notHere(c.call('stopSession', { params })),
      getTranscript: async () => {
        const t = await c.call('getTranscript', { params })
        expect(t.segments.map((g) => g.text)).toEqual(['the retry budget is three'])
        return t
      },
      getQaHistory: () => c.call('getQaHistory', { params }),
      search: async () => {
        const r = await c.call('search', { query: { q: 'budget' } })
        expect(r.hits[0]?.snippet).toContain('[budget]')
        return r
      },
      ask: () => notHere(c.ask({ question: 'what?' }).next()),
      events: async () => {
        const got: AnyEvent[] = []
        const ac = new AbortController()
        for await (const m of c.stream('events', { query: { since: 0 }, signal: ac.signal })) {
          if (!m.data) continue
          got.push(AnyEvent.parse(JSON.parse(m.data)))
          if (got.some((e) => e.data.type === 'heartbeat')) break
        }
        ac.abort()
        expect(got[0]?.seq).toBe(1)
        return got
      },
      listModels: async () => expect(await c.call('listModels')).toEqual({ models: [] }),
      downloadModel: () => notHere(c.call('downloadModel', { params: { id: 'x' } })),
      getSettings: () => notHere(c.call('getSettings')),
      updateSettings: () => notHere(c.call('updateSettings', { body: {} })),
      setApiKey: () => notHere(c.call('setApiKey', { body: { key: null } })),
      diagnostics: () => c.call('diagnostics'),
      deleteSession: () => c.call('deleteSession', { params: { id: priv.id } }),
      syncPush: () => c.call('syncPush', { body: { deviceId: 'laptop', items: [] } }),
      syncCursor: async () =>
        expect(await c.call('syncCursor', { query: { deviceId: 'laptop' } })).toEqual({
          deviceId: 'laptop',
          cursor: 1,
        }),
      pairStart: () => c.call('pairStart', { body: { name: 'phone' } }),
      pairApprove: async () => {
        const start = await c.call('pairStart', { body: { name: 'tablet' } })
        return c.call('pairApprove', { body: { userCode: start.userCode } })
      },
      pairToken: async () => {
        const start = await c.call('pairStart', { body: { name: 'watch' } })
        return c.call('pairToken', { body: { deviceCode: start.deviceCode } })
      },
      pairRevoke: async () =>
        expect(await c.call('pairRevoke', { body: { deviceId: 'dev_never_paired' } })).toEqual({
          revoked: false,
        }),
      putAudioChunk: () =>
        c.call('putAudioChunk', {
          params: { id: s.id, chunkSeq: '0' },
          body: {
            track: 'mic',
            sampleRate: 16000,
            format: 's16le',
            data: Buffer.from(pcm).toString('base64'),
            sha256: sha,
          },
        }),
      getAudioStatus: () => c.call('getAudioStatus', { params }),
      finalizeAudio: () =>
        c.call('finalizeAudio', { params, body: { chunks: { mic: 1, system: 0 }, durationMs: 100 } }),

      listSpeakers: async () => {
        const r = await c.call('listSpeakers', { params })
        expect(r.speakers.map((x) => x.id)).toEqual(['me', 'them'])
        return r
      },
      renameSpeaker: () =>
        notHere(
          c.call('renameSpeaker', { params: { id: s.id, speakerId: 'spk_x' }, body: { label: 'Ana' } }),
        ),
      mergeSpeaker: () =>
        notHere(
          c.call('mergeSpeaker', { params: { id: s.id, speakerId: 'spk_x' }, body: { into: 'spk_y' } }),
        ),
      splitSpeaker: () =>
        notHere(
          c.call('splitSpeaker', {
            params: { id: s.id, speakerId: 'them' },
            body: { segmentIds: ['seg_h1'] },
          }),
        ),
      listVoiceprints: () => notHere(c.call('listVoiceprints')),
      deleteVoiceprint: () => notHere(c.call('deleteVoiceprint', { params: { id: 'vp_x' } })),
      calendarStatus: async () =>
        expect(await c.call('calendarStatus')).toMatchObject({
          state: 'off',
          provider: 'hosted',
          calendars: [],
        }),
      listMeetings: () => notHere(c.call('listMeetings', { query: {} })),
      nextMeeting: () => notHere(c.call('nextMeeting')),
      joinMeeting: () => notHere(c.call('joinMeeting', { params: { id: 'm' }, body: {} })),

      getNotes: async () => {
        const n = await c.call('getNotes', { params })
        expect(n.note).toMatchObject({ version: 1, pendingEnhancement: null })
        expect(n.note.markdown).toContain('retry budget')
        return n
      },
      listNoteVersions: async () =>
        expect((await c.call('listNoteVersions', { params })).versions).toHaveLength(1),
      getActionItems: async () => {
        const r = await c.call('getActionItems', { params })
        expect(r.items[0]).toMatchObject({ owner: 'Ana', done: false })
        return r
      },
      putNotes: () => notHere(c.call('putNotes', { params, body: { markdown: 'x', baseVersion: 1 } })),
      enhanceNotes: () => notHere(c.stream('enhanceNotes', { params, body: {} }).next()),
      mergeNotes: () =>
        notHere(c.call('mergeNotes', { params, body: { enhancedVersion: 2, baseVersion: 1, choices: [] } })),
      restoreNoteVersion: () =>
        notHere(
          c.call('restoreNoteVersion', { params: { id: s.id, version: '1' }, body: { baseVersion: 1 } }),
        ),
      listTemplates: () => notHere(c.call('listTemplates')),
      putTemplate: () =>
        notHere(
          c.call('putTemplate', { params: { id: 'mine' }, body: { name: 'x', keywords: [], body: 'y' } }),
        ),
      deleteTemplate: () => notHere(c.call('deleteTemplate', { params: { id: 'mine' } })),
    }
    const seen: RouteName[] = []
    for (const [name, call] of Object.entries(calls) as [RouteName, () => Promise<unknown>][]) {
      await expect(call(), name).resolves.not.toThrow()
      seen.push(name)
    }
    expect(seen.sort()).toEqual(Object.keys(routes).sort())
  })

  it('hides private sessions from every read path unless asked, exactly like the daemon', async () => {
    const h = await hosted()
    const priv = await h.store.createSession({ title: 'salary', private: true })
    for (const p of [
      h.client.call('getSession', { params: { id: priv.id } }),
      h.client.call('getTranscript', { params: { id: priv.id } }),
      h.client.call('getQaHistory', { params: { id: priv.id } }),
    ])
      await expect(p).rejects.toMatchObject({ status: 404 })
    expect((await h.client.call('listSessions')).sessions).toEqual([])
  })

  it('refuses cross-origin browser requests, unknown routes and wrong methods with typed errors', async () => {
    const h = await hosted()
    const cross = await fetch(`${h.url}/sessions`, { headers: { origin: 'https://evil.example' } })
    expect(cross.status).toBe(403)
    const same = await fetch(`${h.url}/sessions`, { headers: { origin: h.url } })
    expect(same.status).toBe(200)
    expect((await fetch(`${h.url}/nope`)).status).toBe(404)
    const wrong = await fetch(`${h.url}/health`, { method: 'POST' })
    expect(wrong.status).toBe(405)
    expect(wrong.headers.get('allow')).toBe('GET')
    const bad = await fetch(`${h.url}/sessions`, {
      method: 'POST',
      body: '{nope',
      headers: { 'content-type': 'application/json' },
    })
    expect(bad.status).toBe(400)
    const big = await fetch(`${h.url}/sessions`, { method: 'POST', body: 'x'.repeat(3 * 1024 * 1024) })
    expect(big.status).toBe(413)
  })

  it('deletes a session with its audio blobs', async () => {
    const h = await hosted()
    const s: Session = await h.client.call('createSession', { body: {} })
    const pcm = new Uint8Array(320)
    await h.client.call('putAudioChunk', {
      params: { id: s.id, chunkSeq: '0' },
      body: {
        track: 'mic',
        sampleRate: 16000,
        format: 's16le',
        data: Buffer.from(pcm).toString('base64'),
        sha256: await sha256hex(pcm),
      },
    })
    expect(await h.blobs.list(`audio/${s.id}/`)).toHaveLength(1)
    // audio arrived, so the session is recording; the server refuses to delete it until finalized
    await expect(h.client.call('deleteSession', { params: { id: s.id } })).rejects.toMatchObject({
      status: 409,
    })
    await h.client.call('finalizeAudio', {
      params: { id: s.id },
      body: { chunks: { mic: 1, system: 0 }, durationMs: 10 },
    })
    expect((await h.blobs.list(`audio/${s.id}/`)).map((b) => b.key.split('/')[2])).toContain('mic.wav')
    await h.client.call('deleteSession', { params: { id: s.id } })
    expect(await h.blobs.list(`audio/${s.id}/`)).toEqual([])
  })
})

describe('client token option', () => {
  it('sends the bearer token on JSON calls and streams', async () => {
    const h = await hosted({ auth: { secret: SECRET, adminToken: ADMIN }, trustLoopback: false })
    await expect(h.client.call('health')).rejects.toMatchObject({ status: 401 })
    const c = createClient({ baseUrl: h.url, token: ADMIN })
    expect((await c.call('health')).ok).toBe(true)
    await c.call('createSession', { body: {} })
    const it = c.stream('events', { query: { since: 0 } })
    expect((await it.next()).done).toBe(false)
    await it.return(undefined)
  })
})

async function sha256hex(b: Uint8Array): Promise<string> {
  const { createHash } = await import('node:crypto')
  return createHash('sha256').update(b).digest('hex')
}
