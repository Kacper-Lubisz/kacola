import {
  AnyEvent,
  createClient,
  GnomeolaApiError,
  PARTICIPANT_HEADER,
  type RouteName,
  routes,
  type Session,
} from '@gnomeola/protocol'
import { afterEach, describe, expect, it } from 'vitest'
import { MemoryMailer } from '../src/mailer.ts'
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
    const mailer = new MemoryMailer()
    const h = await hosted({ auth: { secret: SECRET, adminToken: ADMIN }, heartbeatMs: 30, mailer })
    const c = h.client
    // team sharing: the owner (admin token here) shares; an invitee works through the link
    let share = { id: '', token: '' }
    let participantToken = ''
    const invitee = () =>
      createClient({ baseUrl: h.url, headers: { [PARTICIPANT_HEADER]: participantToken } })
    const occurrence = { agendaId: 'agd_h', title: 'Shared sync', meeting: null, goals: [] }
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
      externalCaptureStatus: () => notHere(c.call('externalCaptureStatus')),
      ingestExternalCapture: () =>
        notHere(c.call('ingestExternalCapture', { params: { sessionId: s.id, track: 'mic' } })),

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
      // agendas: device-local until the team-sharing phase
      listAgendas: () => notHere(c.call('listAgendas', { query: {} })),
      createAgenda: () => notHere(c.call('createAgenda', { body: { title: 'x' } })),
      resolveAgendaLink: () => notHere(c.call('resolveAgendaLink', { body: { link: 'kacola://agenda/a' } })),
      getAgenda: () => notHere(c.call('getAgenda', { params: { id: 'agd_x' } })),
      updateAgenda: () => notHere(c.call('updateAgenda', { params: { id: 'agd_x' }, body: {} })),
      deleteAgenda: () => notHere(c.call('deleteAgenda', { params: { id: 'agd_x' } })),
      getAgendaHistory: () => notHere(c.call('getAgendaHistory', { params: { id: 'agd_x' } })),
      addAgendaItems: () =>
        notHere(c.call('addAgendaItems', { params: { id: 'agd_x' }, body: { items: [{ text: 'x' }] } })),
      updateAgendaItem: () =>
        notHere(c.call('updateAgendaItem', { params: { id: 'agd_x', itemId: 'itm_x' }, body: {} })),
      deleteAgendaItem: () =>
        notHere(c.call('deleteAgendaItem', { params: { id: 'agd_x', itemId: 'itm_x' } })),
      setAgendaItemStatus: () =>
        notHere(
          c.call('setAgendaItemStatus', {
            params: { id: 'agd_x', itemId: 'itm_x' },
            body: { status: 'covered' },
          }),
        ),
      reorderAgendaItems: () =>
        notHere(c.call('reorderAgendaItems', { params: { id: 'agd_x' }, body: { itemIds: ['itm_x'] } })),
      exportAgendaMarkdown: () => notHere(c.call('exportAgendaMarkdown', { params: { id: 'agd_x' } })),
      importAgendaMarkdown: () =>
        notHere(
          c.call('importAgendaMarkdown', { params: { id: 'agd_x' }, body: { markdown: '', baseVersion: 1 } }),
        ),
      addContextCard: () =>
        notHere(c.call('addContextCard', { params: { id: 'agd_x' }, body: { title: 't', body: 'b' } })),
      updateContextCard: () =>
        notHere(c.call('updateContextCard', { params: { id: 'agd_x', cardId: 'ctx_x' }, body: {} })),
      deleteContextCard: () =>
        notHere(c.call('deleteContextCard', { params: { id: 'agd_x', cardId: 'ctx_x' } })),
      addSuggestion: () =>
        notHere(
          c.call('addSuggestion', {
            params: { id: 'agd_x' },
            body: { kind: 'question', text: 'x', source: 'tracker' },
          }),
        ),
      acceptSuggestion: () =>
        notHere(c.call('acceptSuggestion', { params: { id: 'agd_x', suggestionId: 'sug_x' }, body: {} })),
      dismissSuggestion: () =>
        notHere(c.call('dismissSuggestion', { params: { id: 'agd_x', suggestionId: 'sug_x' }, body: {} })),
      agendaInviteBlock: () => notHere(c.call('agendaInviteBlock', { params: { id: 'agd_x' }, body: {} })),
      createAgentLease: () =>
        notHere(c.call('createAgentLease', { params: { id: s.id }, body: { name: 'claude' } })),
      heartbeatAgentLease: () =>
        notHere(c.call('heartbeatAgentLease', { params: { leaseId: 'lse_x' }, body: {} })),
      releaseAgentLease: () => notHere(c.call('releaseAgentLease', { params: { leaseId: 'lse_x' } })),
      liveAttach: () => notHere(c.stream('liveAttach', { params }).next()),
      listAgentLeases: () => notHere(c.call('listAgentLeases', { params: { id: s.id } })),
      updateAgentLease: () =>
        notHere(c.call('updateAgentLease', { params: { leaseId: 'lse_x' }, body: { mode: 'act' } })),
      listLiveSessions: () => notHere(c.call('listLiveSessions')),
      getAgentAccess: () => notHere(c.call('getAgentAccess', { params: { id: s.id } })),
      setAgentAccess: () =>
        notHere(c.call('setAgentAccess', { params: { id: s.id }, body: { allowAgents: true } })),
      draftAgenda: () => notHere(c.stream('draftAgenda', { params: { id: 'agd_x' }, body: {} }).next()),
      getAgendaTracker: () => notHere(c.call('getAgendaTracker', { params: { id: 'agd_x' } })),
      // ---- team sharing (in this order: each step uses the previous one)
      createShare: async () => {
        const r = await c.call('createShare', {
          body: {
            ownerName: 'Kacper',
            ownerLabel: 'owner',
            options: { allowInvitees: true, members: [] },
            occurrence,
          },
        })
        share = { id: r.share.id, token: r.token }
        return r
      },
      updateShare: () =>
        c.call('updateShare', { params: { shareId: share.id }, body: { ownerName: 'Kacper L' } }),
      pushShare: async () => {
        const r = await c.call('pushShare', {
          params: { shareId: share.id },
          body: {
            ops: [
              {
                op: 'item',
                item: {
                  id: 'itm_h1',
                  occurrence: 'agd_h',
                  text: 'Retry budget',
                  kind: 'topic',
                  owner: null,
                  timeboxMin: null,
                  order: 0,
                  carriedFrom: null,
                },
              },
              {
                op: 'status',
                key: 'k1',
                itemId: 'itm_h1',
                from: 'open',
                to: 'covered',
                by: 'tracker',
                at: '2026-10-01T10:00:00.000Z',
                auto: true,
                confidence: 0.9,
              },
            ],
          },
        })
        expect(r.changes.map((x) => x.outcome)).toEqual(['applied'])
        return r
      },
      getShareState: () => c.call('getShareState', { params: { shareId: share.id } }),
      listShareChanges: () => c.call('listShareChanges', { params: { shareId: share.id } }),
      getSharedPage: async () => {
        const p = await c.call('getSharedPage', { params: { token: share.token } })
        expect(p.items.map((i) => i.text)).toEqual(['Retry budget'])
        return p
      },
      shareVerify: () =>
        c.call('shareVerify', { params: { token: share.token }, body: { email: 'ana@example.com' } }),
      shareConfirm: async () => {
        const code = /code is ([A-Z]{4}-[A-Z]{4})/.exec(mailer.last('ana@example.com')!.text)![1]!
        const r = await c.call('shareConfirm', {
          params: { token: share.token },
          body: { email: 'ana@example.com', code },
        })
        participantToken = r.token
        return r
      },
      shareAddItem: () =>
        invitee().call('shareAddItem', { params: { token: share.token }, body: { text: 'Offsite' } }),
      shareAddComment: () =>
        invitee().call('shareAddComment', {
          params: { token: share.token },
          body: { text: 'Can we do Friday?' },
        }),
      hideShareComment: async () => {
        const st = await c.call('getShareState', { params: { shareId: share.id } })
        return c.call('hideShareComment', { params: { shareId: share.id, commentId: st.comments[0]!.id } })
      },
      revokeShareParticipant: async () => {
        const st = await c.call('getShareState', { params: { shareId: share.id } })
        return c.call('revokeShareParticipant', {
          params: { shareId: share.id, participantId: st.participants[0]!.id },
        })
      },
      revokeShare: () => c.call('revokeShare', { params: { shareId: share.id } }),
      getAgendaShare: () => notHere(c.call('getAgendaShare', { params: { id: 'agd_x' } })),
      shareAgenda: () => notHere(c.call('shareAgenda', { params: { id: 'agd_x' }, body: {} })),
      unshareAgenda: () => notHere(c.call('unshareAgenda', { params: { id: 'agd_x' } })),
      shareAgendaRecap: () =>
        notHere(c.call('shareAgendaRecap', { params: { id: 'agd_x' }, body: { shared: true } })),
      syncAgendaShare: () => notHere(c.call('syncAgendaShare', { params: { id: 'agd_x' } })),
      getAgendaShareHistory: () => notHere(c.call('getAgendaShareHistory', { params: { id: 'agd_x' } })),
      followAgenda: () =>
        notHere(c.call('followAgenda', { body: { link: `${h.url}/a/${'x'.repeat(32)}`, email: 'a@b.co' } })),
      confirmFollowAgenda: () =>
        notHere(
          c.call('confirmFollowAgenda', {
            body: { link: `${h.url}/a/${'x'.repeat(32)}`, email: 'a@b.co', code: 'ABCD-EFGH' },
          }),
        ),
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
