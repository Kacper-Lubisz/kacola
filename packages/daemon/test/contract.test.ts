import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  AnyEvent,
  AskStreamEvent,
  createClient,
  defaultChoices,
  diffNoteBlocks,
  type EnhanceStreamEvent,
  enhanceEvents,
  GnomeolaApiError,
  type GnomeolaClient,
  LEASE_HEADER,
  type LeaseGrant,
  LiveEvent,
  type RouteName,
  routes,
} from '@gnomeola/protocol'
import { waitFor } from '@gnomeola/testkit/daemon'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ManualCalendarProvider } from '../src/calendar/providers.ts'
import { createDaemon, type Daemon, type Handlers } from '../src/daemon.ts'
import { FakeNotesEngine } from '../src/fakes/notes.ts'
import { FakePipeline } from '../src/fakes/pipeline.ts'
import { FakeDevices, FakeModels, FakeQaEngine } from '../src/fakes/providers.ts'
import { MemoryKeyring } from '../src/keyring.ts'
import { at, occ } from './calendar-helpers.ts'

// T1 contract: the real server, driven through the typed protocol client, for every route in the
// table. The client validates every JSON response against the route's response schema, and every SSE
// message is parsed with the protocol's stream schemas here — so a server that drifts from the
// contract fails this test, not a widget three screens later.

// Compile-time exhaustiveness: a handler table missing a route must not typecheck.
// @ts-expect-error — `health` alone is not a complete handler table
const _incomplete: Handlers = { health: () => ({}) as never }
void _incomplete

/** A route this daemon deliberately does not serve: a typed ApiError with 501, not a crash or a 404. */
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

describe('contract: every route, real server, typed client', () => {
  let dir: string
  let daemon: Daemon
  let c: GnomeolaClient
  const cal = new ManualCalendarProvider()

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'gnomeola-contract-'))
    daemon = await createDaemon({
      dataDir: dir,
      port: 0,
      pipeline: new FakePipeline({
        segmentEveryMs: 60,
        finalizeAfterMs: 30,
        partialEveryMs: 20,
        levelEveryMs: 20,
        diarize: true,
      }),
      devices: new FakeDevices(),
      models: new FakeModels({ stepMs: 5 }),
      qaEngine: new FakeQaEngine({ delayMs: 0 }),
      notesEngine: new FakeNotesEngine({ delayMs: 0 }),
      keyring: new MemoryKeyring(),
      env: {},
      heartbeatMs: 50,
      calendar: cal,
    })
    c = createClient({ baseUrl: daemon.url, timeoutMs: 5_000 })
    const now = Date.now()
    cal.push({
      calendars: [{ id: 'cal-work', name: 'Work' }],
      occurrences: [
        occ({
          summary: 'Sync',
          start: at(now, 30),
          end: at(now, 60),
          location: 'https://meet.google.com/abc-defg-hij',
        }),
      ],
    })
    cal.state('ok')
  })
  afterAll(async () => {
    await daemon?.close()
    rmSync(dir, { recursive: true, force: true })
  })

  it('handles every route with schema-valid responses', async () => {
    const seen = new Set<RouteName>()
    const s = await c.call('createSession', { body: { title: 'contract' } })
    const priv = await c.call('createSession', { body: { title: 'private', private: true } })
    const params = { id: s.id }
    const ag = { id: '', item: '', card: '', suggestion: '', session: '' }
    // the agent channel: one lease on the recording the agenda is linked to
    let grant: LeaseGrant | null = null
    const lease = async () => {
      grant ??= await c.call('createAgentLease', {
        params: { id: ag.session },
        body: { name: 'claude', mode: 'act' },
      })
      return grant
    }
    const agent = async () =>
      createClient({ baseUrl: daemon.url, headers: { [LEASE_HEADER]: (await lease()).token } })

    // One entry per route: adding a route to the table without covering it here fails to compile.
    const calls: Record<RouteName, () => Promise<unknown>> = {
      health: () => c.call('health'),
      listDevices: () => c.call('listDevices'),
      listSessions: () => c.call('listSessions', { query: { limit: 10, includePrivate: true } }),
      createSession: () => c.call('createSession', { body: {} }),
      getSession: () => c.call('getSession', { params: { id: priv.id }, query: { includePrivate: true } }),
      updateSession: () => c.call('updateSession', { params, body: { title: 'renamed' } }),
      startSession: () => c.call('startSession', { params }),
      pauseSession: () => c.call('pauseSession', { params }),
      resumeSession: async () => {
        const r = await c.call('resumeSession', { params })
        await waitFor(async () => (await c.call('getTranscript', { params })).total >= 2, 5_000, 'segments')
        return r
      },
      stopSession: () => c.call('stopSession', { params }),
      getTranscript: () => c.call('getTranscript', { params, query: { fromMs: 0, toMs: 60_000 } }),
      getQaHistory: () => c.call('getQaHistory', { params }),
      search: () => c.call('search', { query: { q: 'retry' } }),
      ask: async () => {
        const events: AskStreamEvent[] = []
        for await (const e of c.ask({ question: 'what was decided?', sessionId: s.id }))
          events.push(AskStreamEvent.parse(e))
        expect(events[0]?.type).toBe('question')
        expect(events.at(-1)?.type).toBe('answer')
        expect(events.filter((e) => e.type === 'delta').length).toBeGreaterThan(0)
        return events
      },
      // ---- M7: notes + enhancement, in the order a user goes through them
      putNotes: () => c.call('putNotes', { params, body: { markdown: '- retry budget?\n', baseVersion: 0 } }),
      getNotes: () => c.call('getNotes', { params }),
      listTemplates: () =>
        c.call('listTemplates', { query: { sessionId: s.id, calendarTitle: 'Daily standup' } }),
      enhanceNotes: async () => {
        const events: EnhanceStreamEvent[] = []
        for await (const e of enhanceEvents(c.stream('enhanceNotes', { params, body: {} }))) events.push(e)
        expect(events.map((e) => e.type).filter((t) => t !== 'delta')).toEqual(['started', 'done'])
        return events
      },
      mergeNotes: async () => {
        const { note, enhanced } = await c.call('getNotes', { params })
        const hunks = diffNoteBlocks(note.markdown, enhanced!.markdown)
        return c.call('mergeNotes', {
          params,
          body: {
            enhancedVersion: enhanced!.version,
            baseVersion: note.version,
            choices: defaultChoices(hunks),
          },
        })
      },
      listNoteVersions: () => c.call('listNoteVersions', { params }),
      restoreNoteVersion: () =>
        c.call('restoreNoteVersion', { params: { id: s.id, version: '1' }, body: { baseVersion: 3 } }),
      getActionItems: () => c.call('getActionItems', { params, query: { version: 2 } }),
      putTemplate: () =>
        c.call('putTemplate', {
          params: { id: 'retro' },
          body: { name: 'Retro', keywords: ['retro'], body: '## Went well\n## To improve' },
        }),
      deleteTemplate: () => c.call('deleteTemplate', { params: { id: 'retro' } }),
      events: async () => {
        const ac = new AbortController()
        const got: AnyEvent[] = []
        for await (const m of c.stream('events', { query: { since: 0 }, signal: ac.signal })) {
          if (!m.data) continue
          got.push(AnyEvent.parse(JSON.parse(m.data)))
          if (got.some((e) => e.data.type === 'heartbeat')) break
        }
        ac.abort()
        expect(got[0]?.seq).toBe(1)
        return got
      },
      listModels: () => c.call('listModels'),
      downloadModel: () => c.call('downloadModel', { params: { id: 'whisper-small.en' } }),
      getSettings: () => c.call('getSettings'),
      updateSettings: () => c.call('updateSettings', { body: { retention: { days: 7 } } }),
      setApiKey: () => c.call('setApiKey', { body: { key: 'sk-ant-contract-test-0000' } }),
      diagnostics: () => c.call('diagnostics'),
      calendarStatus: async () => {
        const st = await c.call('calendarStatus')
        expect(st).toMatchObject({ state: 'ok', provider: 'manual', calendars: [{ id: 'cal-work' }] })
        return st
      },
      listMeetings: async () => {
        const r = await c.call('listMeetings', { query: { to: at(Date.now(), 24 * 60) } })
        expect(r.meetings.map((m) => m.title)).toEqual(['Sync'])
        return r
      },
      nextMeeting: async () => {
        const r = await c.call('nextMeeting')
        expect(r.next?.join).toEqual({ url: 'https://meet.google.com/abc-defg-hij', provider: 'meet' })
        return r
      },
      joinMeeting: async () => {
        const { next } = await c.call('nextMeeting')
        const r = await c.call('joinMeeting', { params: { id: next!.id }, body: {} })
        expect(r.joinUrl).toBe('https://meet.google.com/abc-defg-hij')
        expect(r.session).toMatchObject({ title: 'Sync', status: 'recording', meeting: { id: next!.id } })
        return r
      },
      // ---- M3 (the session above was recorded with a diarizing fake: it has far-end speakers)
      listSpeakers: async () => {
        const r = await c.call('listSpeakers', { params })
        expect(r.speakers[0]).toMatchObject({ id: 'me', track: 'mic' })
        expect(r.speakers.filter((x) => x.id.startsWith('spk_')).length).toBeGreaterThanOrEqual(2)
        return r
      },
      renameSpeaker: async () => {
        const first = (await c.call('listSpeakers', { params })).speakers.find((x) =>
          x.id.startsWith('spk_'),
        )!
        const r = await c.call('renameSpeaker', {
          params: { ...params, speakerId: first.id },
          body: { label: 'Ana' },
        })
        expect(r.label).toBe('Ana')
        return r
      },
      splitSpeaker: async () => {
        const t = await c.call('getTranscript', { params })
        const seg = t.segments.find((x) => x.speaker === 'Ana')!
        return c.call('splitSpeaker', {
          params: { ...params, speakerId: seg.speakerId! },
          body: { segmentIds: [seg.id] },
        })
      },
      mergeSpeaker: async () => {
        const spk = (await c.call('listSpeakers', { params })).speakers.filter((x) => x.id.startsWith('spk_'))
        return c.call('mergeSpeaker', {
          params: { ...params, speakerId: spk.at(-1)!.id },
          body: { into: spk[0]!.id },
        })
      },
      listVoiceprints: () => c.call('listVoiceprints'),
      deleteVoiceprint: async () => {
        // none exist (voiceprints are off by default): the typed 404 is the contract here
        await expect(c.call('deleteVoiceprint', { params: { id: 'vp_nope' } })).rejects.toMatchObject({
          status: 404,
        })
        return true
      },
      deleteSession: () => c.call('deleteSession', { params: { id: priv.id } }),

      // ---- M8: a local daemon is a sync source, not a target; pairing needs auth configured (this
      // daemon has none — see auth.int.test.ts for the paired daemon). All answer a typed 501.
      syncPush: () => notHere(c.call('syncPush', { body: { items: [] } })),
      syncCursor: () => notHere(c.call('syncCursor', { query: {} })),
      pairStart: () => notHere(c.call('pairStart', { body: { name: 'x' } })),
      pairApprove: () => notHere(c.call('pairApprove', { body: { userCode: 'BCDF-GHJK' } })),
      pairToken: () => notHere(c.call('pairToken', { body: { deviceCode: 'x' } })),
      pairRevoke: () => notHere(c.call('pairRevoke', { body: { deviceId: 'dev_x' } })),
      putAudioChunk: () =>
        notHere(
          c.call('putAudioChunk', {
            params: { id: s.id, chunkSeq: '0' },
            body: { track: 'mic', sampleRate: 16000, format: 's16le', data: '', sha256: '0'.repeat(64) },
          }),
        ),
      getAudioStatus: () => notHere(c.call('getAudioStatus', { params })),
      finalizeAudio: () =>
        notHere(c.call('finalizeAudio', { params, body: { chunks: { mic: 0, system: 0 }, durationMs: 0 } })),

      // ---- P: external capture (this daemon records with the default pipeline: nothing waits for audio)
      externalCaptureStatus: async () => {
        expect(await c.call('externalCaptureStatus')).toEqual({ captures: [] })
        return true
      },
      ingestExternalCapture: async () => {
        // the typed client sends no PCM frame stream, so the route refuses the content type
        await expect(
          c.call('ingestExternalCapture', { params: { sessionId: s.id, track: 'mic' } }),
        ).rejects.toMatchObject({ status: 415 })
        return true
      },

      // ---- agendas, in the order a user goes through them (the "Sync" meeting is being recorded)
      createAgenda: async () => {
        const { next } = await c.call('nextMeeting')
        const v = await c.call('createAgenda', {
          body: {
            meetingId: next!.id,
            markdown: '- [ ] Promo timeline (10m, @ana) [must-cover]\n- [ ] Budget\n',
          },
        })
        expect(v.agenda).toMatchObject({ title: 'Sync', meeting: { meetingId: next!.id } })
        expect(v.agenda.sessionId).not.toBeNull()
        ag.session = v.agenda.sessionId!
        ag.id = v.agenda.id
        ag.item = v.items[0]!.id
        return v
      },
      listAgendas: async () => {
        const r = await c.call('listAgendas', { query: {} })
        expect(r.agendas.map((a) => a.id)).toEqual([ag.id])
        return r
      },
      getAgenda: () => c.call('getAgenda', { params: { id: ag.id } }),
      updateAgenda: () => c.call('updateAgenda', { params: { id: ag.id }, body: { goals: ['agree dates'] } }),
      addAgendaItems: () =>
        c.call('addAgendaItems', {
          params: { id: ag.id },
          body: { items: [{ text: 'Offsite', kind: 'question' }] },
        }),
      updateAgendaItem: () =>
        c.call('updateAgendaItem', { params: { id: ag.id, itemId: ag.item }, body: { timeboxMin: 15 } }),
      setAgendaItemStatus: async () => {
        const r = await c.call('setAgendaItemStatus', {
          params: { id: ag.id, itemId: ag.item },
          body: { status: 'covered', evidence: [{ segmentId: null, quote: 'agreed', confidence: null }] },
        })
        expect(r.change).toMatchObject({ from: 'open', to: 'covered', by: 'user' })
        return r
      },
      getAgendaHistory: () => c.call('getAgendaHistory', { params: { id: ag.id } }),
      reorderAgendaItems: async () => {
        const v = await c.call('getAgenda', { params: { id: ag.id } })
        return c.call('reorderAgendaItems', {
          params: { id: ag.id },
          body: { itemIds: v.items.map((i) => i.id).reverse() },
        })
      },
      exportAgendaMarkdown: async () => {
        const r = await c.call('exportAgendaMarkdown', { params: { id: ag.id } })
        expect(r.markdown, r.markdown).toContain('- [x] Promo timeline (15m, @ana) [must-cover]')
        return r
      },
      importAgendaMarkdown: async () => {
        const r = await c.call('exportAgendaMarkdown', { params: { id: ag.id } })
        return c.call('importAgendaMarkdown', {
          params: { id: ag.id },
          body: { markdown: `${r.markdown}- [ ] From markdown\n`, baseVersion: r.version },
        })
      },
      deleteAgendaItem: async () => {
        const v = await c.call('getAgenda', { params: { id: ag.id } })
        const i = v.items.find((x) => x.text === 'From markdown')!
        return c.call('deleteAgendaItem', { params: { id: ag.id, itemId: i.id } })
      },
      addContextCard: async () => {
        const card = await c.call('addContextCard', {
          params: { id: ag.id },
          body: { title: 'Q3', body: '- up 12%' },
        })
        ag.card = card.id
        expect(card.visibility).toBe('private')
        return card
      },
      updateContextCard: () =>
        c.call('updateContextCard', {
          params: { id: ag.id, cardId: ag.card },
          body: { visibility: 'shared' },
        }),
      deleteContextCard: () => c.call('deleteContextCard', { params: { id: ag.id, cardId: ag.card } }),
      addSuggestion: async () => {
        const sug = await (await agent()).call('addSuggestion', {
          params: { id: ag.id },
          body: { kind: 'question', text: 'ask about Q3', source: 'agent:claude' },
        })
        ag.suggestion = sug.id
        return sug
      },
      dismissSuggestion: () =>
        c.call('dismissSuggestion', { params: { id: ag.id, suggestionId: ag.suggestion }, body: {} }),
      acceptSuggestion: async () => {
        const sug = await (await agent()).call('addSuggestion', {
          params: { id: ag.id },
          body: { kind: 'next-point', text: 'budget next', source: 'tracker' },
        })
        return c.call('acceptSuggestion', { params: { id: ag.id, suggestionId: sug.id }, body: {} })
      },
      resolveAgendaLink: async () => {
        const r = await c.call('resolveAgendaLink', { body: { link: `kacola://agenda/${ag.id}` } })
        expect(r.agenda?.agenda.id).toBe(ag.id)
        expect(r.meeting?.title).toBe('Sync')
        return r
      },
      agendaInviteBlock: async () => {
        const r = await c.call('agendaInviteBlock', { params: { id: ag.id }, body: { write: true } })
        expect(r).toMatchObject({ written: true, appLink: `kacola://agenda/${ag.id}`, webLink: null })
        return r
      },
      deleteAgenda: () => c.call('deleteAgenda', { params: { id: ag.id } }),
      // ---- the agent channel
      createAgentLease: async () => {
        const g = await lease()
        expect(g.lease).toMatchObject({ sessionId: ag.session, name: 'claude', mode: 'act' })
        return g
      },
      listAgentLeases: () => c.call('listAgentLeases', { params: { id: ag.session } }),
      heartbeatAgentLease: async () =>
        (await agent()).call('heartbeatAgentLease', {
          params: { leaseId: (await lease()).lease.id },
          body: {},
        }),
      updateAgentLease: async () =>
        c.call('updateAgentLease', {
          params: { leaseId: (await lease()).lease.id },
          body: { mode: 'suggest' },
        }),
      liveAttach: async () => {
        const it = (await agent()).stream('liveAttach', { params: { id: ag.session } })
        const first = await it.next()
        await it.return(undefined)
        return LiveEvent.parse(JSON.parse(first.value!.data))
      },
      listLiveSessions: () => c.call('listLiveSessions', { query: {} }),
      getAgentAccess: () => c.call('getAgentAccess', { params: { id: ag.session } }),
      setAgentAccess: () =>
        c.call('setAgentAccess', { params: { id: ag.session }, body: { allowAgents: true } }),
      releaseAgentLease: async () =>
        c.call('releaseAgentLease', { params: { leaseId: (await lease()).lease.id } }),
    }
    for (const [name, call] of Object.entries(calls) as [RouteName, () => Promise<unknown>][]) {
      await expect(call(), name).resolves.toBeDefined()
      seen.add(name)
    }
    expect([...seen].sort()).toEqual(Object.keys(routes).sort())
  })

  it('serves settings with the documented defaults and never the key', async () => {
    const dir2 = mkdtempSync(join(tmpdir(), 'gnomeola-contract-'))
    const d2 = await createDaemon({ dataDir: dir2, port: 0, keyring: new MemoryKeyring(), env: {} })
    try {
      const c2 = createClient({ baseUrl: d2.url })
      expect(await c2.call('getSettings')).toEqual({
        llm: {
          provider: 'anthropic',
          model: 'claude-opus-5',
          ollamaUrl: 'http://127.0.0.1:11434',
          apiKeyConfigured: false,
        },
        stt: { liveModel: expect.any(String), finalModel: expect.any(String), finalPass: 'during' },
        capture: { micDevice: 'default', systemDevice: 'default' },
        retention: { audio: 'keep', days: 30, archive: false },
        autoRecord: { calendar: false, micActivity: false },
        speakers: { diarize: true, voiceprints: false },
      })
      const patched = await c2.call('updateSettings', {
        body: { llm: { model: 'claude-sonnet-5' }, stt: { finalPass: 'after' } },
      })
      expect(patched.llm).toMatchObject({ provider: 'anthropic', model: 'claude-sonnet-5' })
      expect(patched.stt.finalPass).toBe('after')
      expect(patched.retention.audio).toBe('keep')
      expect(await c2.call('setApiKey', { body: { key: 'sk-ant-abc-123456789' } })).toEqual({
        configured: true,
      })
      expect((await c2.call('getSettings')).llm.apiKeyConfigured).toBe(true)
      expect(await c2.call('setApiKey', { body: { key: null } })).toEqual({ configured: false })
      // the /ask default: no engine → an `error` event with code unavailable
      const s = await c2.call('createSession', {})
      const events: AskStreamEvent[] = []
      for await (const e of c2.ask({ question: 'anything?', sessionId: s.id })) events.push(e)
      expect(events.map((e) => e.type)).toEqual(['question', 'error'])
      expect(events[1]).toMatchObject({ type: 'error', error: { code: 'unavailable' } })
      expect(await c2.call('health')).toMatchObject({ llm: { provider: 'anthropic', ready: false } })
    } finally {
      await d2.close()
      rmSync(dir2, { recursive: true, force: true })
    }
  })

  it('closes SSE subscriptions without leaking bus listeners or connections', async () => {
    const base = daemon.bus.size
    for (let i = 0; i < 25; i++) {
      const ac = new AbortController()
      const it = c.stream('events', { query: { since: 0, ephemeral: i % 2 === 0 }, signal: ac.signal })
      await it.next()
      expect(daemon.sseClients).toBeGreaterThan(0)
      expect(daemon.bus.size).toBeGreaterThan(base)
      ac.abort()
      await it.return(undefined).catch(() => {})
    }
    await waitFor(() => daemon.bus.size === base && daemon.sseClients === 0, 5_000, 'listeners released')
    expect(daemon.bus.size).toBe(base)
  })
})
