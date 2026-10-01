import type {
  Agenda,
  AgendaItem,
  AgendaView,
  CalendarStatus,
  QaMessage,
  Settings,
  StatusChange,
} from '@gnomeola/protocol'
import { fromHistory, type QaState } from '@gnomeola/ui-core/qa'
import type { SessionsState } from '@gnomeola/ui-core/sessions'
import { fromSummaries, type SpeakersState } from '@gnomeola/ui-core/speakers'
import { fromSegments, type TranscriptState } from '@gnomeola/ui-core/transcript'
import { onlineManager, QueryClient } from '@tanstack/react-query'
import { afterEach, describe, expect, it } from 'vitest'
import { createEphemeralStore } from '../src/renderer/data/ephemeral.ts'
import { EventBridge } from '../src/renderer/data/event-bridge.ts'
import { keys } from '../src/renderer/data/keys.ts'
import { durable, ephemeral, fakeDaemon, flush, segment, session, until, upserted } from './helpers.ts'

const bridges: EventBridge[] = []
afterEach(() => {
  for (const b of bridges.splice(0)) b.stop()
  onlineManager.setOnline(true)
})

function setup(
  init: Parameters<typeof fakeDaemon>[0] = {},
  opts: ConstructorParameters<typeof EventBridge>[3] = {},
) {
  const daemon = fakeDaemon(init)
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const store = createEphemeralStore()
  const bridge = new EventBridge(daemon.client, qc, store, { retryMs: 10, ...opts })
  bridges.push(bridge)
  const titles = () => qc.getQueryData<SessionsState>(keys.sessions())?.ordered.map((s) => s.title)
  return { daemon, qc, store, bridge, titles }
}

describe('snapshot then subscribe', () => {
  it('puts the snapshot in the cache and subscribes from its cursor', async () => {
    const { daemon, bridge, titles, store } = setup({ sessions: [session('a'), session('b')], lastSeq: 7 })
    bridge.start()
    await bridge.ready
    expect(titles()).toEqual(['b', 'a'])
    expect(daemon.calls.slice(0, 2)).toEqual(['health', 'listSessions']) // cursor before list
    expect(daemon.current().since).toBe(7)
    expect(store.getState().connection).toEqual({ kind: 'live' })
    expect(onlineManager.isOnline()).toBe(true)
  })

  it('folds session upserts and deletes into the list and the per-session query', async () => {
    const { daemon, bridge, titles, qc } = setup({ sessions: [session('a')], lastSeq: 1 })
    bridge.start()
    await bridge.ready
    qc.setQueryData(keys.session('a'), session('a'))
    daemon.emit(upserted(2, session('a', { title: 'renamed' })))
    daemon.emit(upserted(3, session('c', { createdAt: '2026-09-29T00:00:00.000Z' })))
    expect(titles()).toEqual(['c', 'renamed'])
    expect(qc.getQueryData(keys.session('a'))).toMatchObject({ title: 'renamed' })
    // a session with no detail query cached gets none created
    expect(qc.getQueryData(keys.session('c'))).toBeUndefined()
  })

  it('ignores duplicates and replays at or below its cursor', async () => {
    const { daemon, bridge, titles } = setup({ sessions: [session('a')], lastSeq: 5 })
    bridge.start()
    await bridge.ready
    daemon.emit(upserted(5, session('a', { title: 'stale replay' })))
    daemon.emit(upserted(6, session('a', { title: 'new' })))
    daemon.emit(upserted(6, session('a', { title: 'duplicate' })))
    expect(titles()).toEqual(['new'])
    expect(bridge.stats).toMatchObject({ applied: 1, duplicates: 2 })
    expect(bridge.cursor).toBe(6)
  })

  it('session.deleted drops every query of that session and nothing else', async () => {
    const { daemon, bridge, qc, titles } = setup({ sessions: [session('a'), session('b')], lastSeq: 1 })
    bridge.start()
    await bridge.ready
    for (const k of [
      keys.session('a'),
      keys.transcript('a'),
      keys.qa('a'),
      keys.notes('a'),
      keys.speakers('a'),
    ])
      qc.setQueryData(k, {})
    qc.setQueryData(keys.transcript('b'), fromSegments([]))
    qc.setQueryData(keys.settings(), {})
    daemon.emit(durable(2, { type: 'session.deleted', sessionId: 'a' }, 'a'))
    expect(titles()).toEqual(['b'])
    const left = qc
      .getQueryCache()
      .getAll()
      .map((q) => q.queryKey)
    expect(left).toEqual(
      expect.arrayContaining([keys.sessions(), keys.health(), keys.transcript('b'), keys.settings()]),
    )
    expect(left.some((k) => k[1] === 'a')).toBe(false)
  })
})

describe('per-session folds', () => {
  it('folds segments into a cached transcript, revision-checked', async () => {
    const { daemon, bridge, qc } = setup({ sessions: [session('a')], lastSeq: 1 })
    bridge.start()
    await bridge.ready
    qc.setQueryData(keys.transcript('a'), fromSegments([]))
    daemon.emit(
      durable(
        2,
        { type: 'segment.upserted', segment: segment('s1', 'a', { text: 'hello', revision: 2 }) },
        'a',
      ),
    )
    daemon.emit(
      durable(
        3,
        { type: 'segment.upserted', segment: segment('s1', 'a', { text: 'older', revision: 1 }) },
        'a',
      ),
    )
    daemon.emit(durable(4, { type: 'segment.upserted', segment: segment('s9', 'b') }, 'b'))
    const t = qc.getQueryData<TranscriptState>(keys.transcript('a'))!
    expect(t.ordered.map((s) => s.text)).toEqual(['hello'])
    // no transcript query for b → nothing was created for it
    expect(qc.getQueryData(keys.transcript('b'))).toBeUndefined()
  })

  it('re-folds events a transcript fetch finished too late to include', async () => {
    const { daemon, bridge, qc } = setup({ sessions: [session('a')], lastSeq: 1 })
    bridge.start()
    await bridge.ready
    let release: (v: TranscriptState) => void = () => {}
    const fetching = qc.fetchQuery({
      queryKey: keys.transcript('a'),
      queryFn: () => new Promise<TranscriptState>((r) => (release = r)),
      structuralSharing: false,
    })
    // arrives while the fetch is in flight: there is no data to fold into yet
    daemon.emit(
      durable(2, { type: 'segment.upserted', segment: segment('late', 'a', { startMs: 5000 }) }, 'a'),
    )
    release(fromSegments([segment('early', 'a')])) // the server's answer predates `late`
    await fetching
    await until(() => (qc.getQueryData<TranscriptState>(keys.transcript('a'))?.ordered.length ?? 0) === 2)
    expect(qc.getQueryData<TranscriptState>(keys.transcript('a'))!.ordered.map((s) => s.id)).toEqual([
      'early',
      'late',
    ])
  })

  it('folds qa messages, speaker renames (and invalidates stale talk time), settings and notes', async () => {
    const { daemon, bridge, qc } = setup({ sessions: [session('a')], lastSeq: 1 })
    bridge.start()
    await bridge.ready
    qc.setQueryData(keys.qa('a'), fromHistory([]))
    qc.setQueryData(
      keys.speakers('a'),
      fromSummaries([
        {
          id: 'spk1',
          label: 'Speaker 1',
          track: 'system',
          named: false,
          colour: 0,
          voiceprintId: null,
          segments: 3,
          talkMs: 9000,
        },
      ]),
    )
    qc.setQueryData(keys.settings(), {
      stt: { finalPass: 'off' },
      llm: { apiKeyConfigured: true },
    } as unknown as Settings)
    qc.setQueryData(keys.notes('a'), {
      note: { sessionId: 'a', version: 1, markdown: 'a', updatedAt: null, pendingEnhancement: null },
      enhanced: null,
    })
    qc.setQueryData(keys.noteVersions('a'), [])
    const q: QaMessage = {
      id: 'qa_1',
      sessionId: 'a',
      requestId: 'req_1',
      role: 'user',
      text: 'what did we decide?',
      citations: [],
      createdAt: '2026-09-28T12:00:00.000Z',
    } as unknown as QaMessage
    daemon.emit(durable(2, { type: 'qa.message', message: q }, 'a'))
    daemon.emit(
      durable(
        3,
        {
          type: 'speaker.upserted',
          speaker: {
            id: 'spk1',
            sessionId: 'a',
            label: 'Ana',
            named: true,
            colour: 0,
            voiceprintId: null,
            mergedInto: null,
          },
        } as never,
        'a',
      ),
    )
    daemon.emit(
      durable(
        4,
        { type: 'segment.upserted', segment: segment('s1', 'a', { track: 'system', speakerId: 'spk1' }) },
        'a',
      ),
    )
    daemon.emit(
      durable(5, { type: 'settings.updated', settings: { stt: { finalPass: 'whisper' }, llm: {} } } as never),
    )
    const v2 = {
      sessionId: 'a',
      version: 2,
      kind: 'user',
      markdown: 'ab',
      baseVersion: 1,
      createdAt: '2026-09-28T12:00:00.000Z',
      enhancement: null,
      merge: null,
      restoredFrom: null,
    } as const
    const heard: number[] = []
    const off = bridge.listen((e) => heard.push(e.seq ?? -1))
    daemon.emit(durable(6, { type: 'note.version', version: v2 }, 'a'))
    daemon.emit(durable(6, { type: 'note.version', version: v2 }, 'a')) // duplicate: not heard again
    off()
    daemon.emit(durable(7, { type: 'note.version', version: { ...v2, version: 3, markdown: 'abc' } }, 'a'))
    expect(qc.getQueryData<QaState>(keys.qa('a'))!.turns.map((t) => t.question)).toEqual([
      'what did we decide?',
    ])
    expect(qc.getQueryData<SpeakersState>(keys.speakers('a'))!.list[0]!.label).toBe('Ana')
    expect(qc.getQueryState(keys.speakers('a'))!.isInvalidated).toBe(true) // a new segment: talk time is stale
    expect(qc.getQueryData<Settings>(keys.settings())!.stt.finalPass).toBe('whisper')
    // notes are folded, not refetched: the head moved, the history grew, once per version
    expect(qc.getQueryData(keys.notes('a'))).toMatchObject({ note: { version: 3, markdown: 'abc' } })
    expect(qc.getQueryState(keys.notes('a'))!.isInvalidated).toBe(false)
    expect(qc.getQueryData<{ version: number }[]>(keys.noteVersions('a'))!.map((v) => v.version)).toEqual([
      2, 3,
    ])
    expect(heard).toEqual([6])
  })
})

describe('ephemeral events', () => {
  it('go to the Zustand store, never the query cache', async () => {
    const { daemon, bridge, qc, store } = setup({
      sessions: [session('a', { status: 'recording' })],
      lastSeq: 1,
    })
    bridge.start()
    await bridge.ready
    const before = qc.getQueryCache().getAll().length
    daemon.emit(ephemeral({ type: 'audio.level', track: 'mic', rms: 0.3, peak: 0.6, elapsedMs: 1200 }, 'a'))
    daemon.emit(
      ephemeral(
        { type: 'transcript.partial', track: 'mic', speaker: 'me', startMs: 1000, text: 'so the' },
        'a',
      ),
    )
    expect(store.getState().levels.a?.mic).toMatchObject({ rms: 0.3, peak: 0.6 })
    expect(store.getState().partials.a?.mic?.text).toBe('so the')
    expect(qc.getQueryCache().getAll().length).toBe(before)
    // the final for that line supersedes the partial
    daemon.emit(durable(2, { type: 'segment.upserted', segment: segment('s1', 'a', { startMs: 1000 }) }, 'a'))
    expect(store.getState().partials.a?.mic).toBeUndefined()
    // stopping clears what was live
    daemon.emit(upserted(3, session('a', { status: 'stopped' })))
    expect(store.getState().levels.a).toBeUndefined()
  })
})

describe('connection, gaps and reconnects', () => {
  it('reports reconnecting and pauses queries while the stream is down', async () => {
    const { daemon, bridge, store } = setup({ sessions: [], lastSeq: 1 })
    bridge.start()
    await bridge.ready
    daemon.drop()
    expect(store.getState().connection).toEqual({ kind: 'reconnecting', error: 'socket hang up' })
    expect(onlineManager.isOnline()).toBe(false)
    daemon.connect()
    await until(() => store.getState().connection.kind === 'live')
    expect(onlineManager.isOnline()).toBe(true)
    expect(bridge.stats.resnapshots).toBe(0) // same log: the client resumes from its cursor
  })

  it('resnapshots and invalidates everything on a reported gap', async () => {
    const { daemon, bridge, qc, titles } = setup({ sessions: [session('a')], lastSeq: 3 })
    bridge.start()
    await bridge.ready
    qc.setQueryData(keys.transcript('a'), fromSegments([]))
    daemon.state.sessions = [session('a'), session('b', { createdAt: '2026-09-29T00:00:00.000Z' })]
    daemon.state.lastSeq = 9
    daemon.drop(new Error('event gap: expected seq 4, got 6'))
    await until(() => bridge.stats.snapshots === 2)
    expect(titles()).toEqual(['b', 'a'])
    expect(qc.getQueryState(keys.transcript('a'))!.isInvalidated).toBe(true)
    expect(daemon.subs).toHaveLength(2)
    expect(daemon.subs[0]!.signal!.aborted).toBe(true) // the old subscription is gone
    expect(daemon.current().since).toBe(9)
  })

  it('resnapshots when the daemon comes back with a cursor behind ours (a different log)', async () => {
    const { daemon, bridge, titles } = setup({ sessions: [session('old')], lastSeq: 50 })
    bridge.start()
    await bridge.ready
    daemon.drop()
    daemon.state.sessions = [session('fresh')]
    daemon.state.lastSeq = 2
    daemon.connect()
    await until(() => bridge.stats.snapshots === 2)
    expect(titles()).toEqual(['fresh'])
    expect(bridge.cursor).toBe(2)
  })

  it('is unreachable (and offline) until a snapshot succeeds, retrying on its own', async () => {
    const { daemon, bridge, store, titles } = setup({ sessions: [session('a')], lastSeq: 1 })
    daemon.state.fail = new Error('connect ECONNREFUSED')
    bridge.start()
    await until(() => store.getState().connection.kind === 'unreachable')
    expect(onlineManager.isOnline()).toBe(false)
    daemon.state.fail = null
    await bridge.ready
    expect(titles()).toEqual(['a'])
    expect(store.getState().connection.kind).toBe('live')
  })

  it('stop() ends the subscription', async () => {
    const { daemon, bridge } = setup()
    bridge.start()
    await bridge.ready
    await flush()
    bridge.stop()
    expect(daemon.current().signal!.aborted).toBe(true)
  })
})

describe('status reports into queries (models, calendar)', () => {
  it('model.progress updates the cached model list; calendar.updated replaces the calendar status', async () => {
    const { daemon, bridge, qc, store } = setup({ lastSeq: 1 })
    bridge.start()
    await bridge.ready
    const m = { id: 'w', role: 'final', title: 'w', sizeBytes: 1, state: 'missing', progress: null } as const
    // nothing cached: nothing created
    daemon.emit(ephemeral({ type: 'model.progress', model: { ...m, state: 'downloading', progress: 0.2 } }))
    expect(qc.getQueryData(keys.models())).toBeUndefined()
    qc.setQueryData(keys.models(), [m, { ...m, id: 'v' }])
    daemon.emit(ephemeral({ type: 'model.progress', model: { ...m, state: 'downloading', progress: 0.4 } }))
    expect(
      qc.getQueryData<{ id: string; progress: number | null }[]>(keys.models())!.map((x) => x.progress),
    ).toEqual([0.4, null])
    expect(store.getState().modelProgress.w!.progress).toBe(0.4)
    const cal: CalendarStatus = {
      state: 'ok',
      provider: 'file',
      detail: null,
      calendars: [{ id: 'w', name: 'Work' }],
      updatedAt: null,
    }
    daemon.emit(ephemeral({ type: 'calendar.updated', calendar: cal }))
    expect(qc.getQueryData(keys.calendar())).toEqual(cal)
  })
})

describe('agendas (kacola wave 2)', () => {
  const T = '2026-09-30T10:00:00.000Z'
  const agenda = (over: Partial<Agenda> = {}): Agenda => ({
    id: 'agd_1',
    title: 'Plan',
    meeting: null,
    sessionId: 's1',
    owner: 'me',
    goals: [],
    private: false,
    carriedFrom: null,
    version: 3,
    createdAt: T,
    updatedAt: T,
    ...over,
  })
  const item = (id: string, over: Partial<AgendaItem> = {}): AgendaItem => ({
    id,
    agendaId: 'agd_1',
    text: id,
    kind: 'topic',
    owner: null,
    timeboxMin: null,
    order: 0,
    status: 'open',
    evidence: [],
    outcome: null,
    changedBy: 'user',
    createdBy: 'user',
    carriedFrom: null,
    createdAt: T,
    updatedAt: T,
    ...over,
  })
  const change: StatusChange = {
    itemId: 'a',
    from: 'open',
    to: 'covered',
    by: 'tracker',
    at: T,
    note: null,
    evidence: [],
    override: false,
    auto: true,
    confidence: 0.9,
  }

  it('folds agenda events into the view and history (duplicates dropped), links the session, drops a deleted agenda', async () => {
    const { daemon, bridge, qc } = setup({ lastSeq: 1 })
    bridge.start()
    await bridge.ready
    const view: AgendaView = { agenda: agenda(), items: [item('a')], context: [], suggestions: [] }
    qc.setQueryData(keys.agenda('agd_1'), view)
    qc.setQueryData(keys.agendaHistory('agd_1'), [])
    const status = durable(
      2,
      {
        type: 'agenda.item.status',
        agendaId: 'agd_1',
        version: 4,
        at: T,
        item: item('a', { status: 'covered' }),
        change,
      },
      's1',
    )
    daemon.emit(status)
    daemon.emit(status) // duplicate
    daemon.emit(
      durable(3, {
        type: 'agenda.item.upserted',
        agendaId: 'agd_1',
        version: 5,
        at: T,
        item: item('b', { order: 1 }),
      }),
    )
    daemon.emit(durable(4, { type: 'agenda.upserted', agenda: agenda({ version: 6, sessionId: 's2' }) }))
    const v = qc.getQueryData<AgendaView>(keys.agenda('agd_1'))!
    expect(v.agenda.version).toBe(6)
    expect(v.items.map((i) => [i.id, i.status])).toEqual([
      ['a', 'covered'],
      ['b', 'open'],
    ])
    expect(qc.getQueryData(keys.agendaHistory('agd_1'))).toEqual([change])
    expect(qc.getQueryData(keys.sessionAgenda('s2'))).toBe('agd_1')
    daemon.emit(durable(5, { type: 'agenda.deleted', agendaId: 'agd_1' }))
    expect(qc.getQueryData(keys.agenda('agd_1'))).toBeUndefined()
    expect(qc.getQueryData(keys.agendaHistory('agd_1'))).toBeUndefined()
  })

  it('an add’s echo arriving before its response replaces the optimistic tmp_ row at once', async () => {
    const { daemon, bridge, qc } = setup({ lastSeq: 1 })
    bridge.start()
    await bridge.ready
    qc.setQueryData(keys.agenda('agd_1'), {
      agenda: agenda(),
      items: [item('a'), item('tmp_x_0', { text: 'New one', order: 1 })],
      context: [],
      suggestions: [],
    } satisfies AgendaView)
    daemon.emit(
      durable(2, {
        type: 'agenda.item.upserted',
        agendaId: 'agd_1',
        version: 4,
        at: T,
        item: item('itm_real', { text: 'New one', order: 1 }),
      }),
    )
    expect(qc.getQueryData<AgendaView>(keys.agenda('agd_1'))!.items.map((i) => i.id)).toEqual([
      'a',
      'itm_real',
    ])
  })

  it('re-folds agenda events a late fetch missed; presence goes to the store and refetches the leases', async () => {
    const { daemon, bridge, qc, store } = setup({
      lastSeq: 1,
      handlers: {
        getAgenda: () => ({ agenda: agenda(), items: [item('a')], context: [], suggestions: [] }),
        listAgentLeases: () => ({ leases: [] }),
      },
    })
    bridge.start()
    await bridge.ready
    daemon.emit(
      durable(2, {
        type: 'agenda.item.status',
        agendaId: 'agd_1',
        version: 4,
        at: T,
        item: item('a', { status: 'covered' }),
        change,
      }),
    )
    // fetched after the event, with the pre-event state (version 3): the bridge re-folds it
    await qc.fetchQuery({
      queryKey: keys.agenda('agd_1'),
      queryFn: () => daemon.client.call('getAgenda', { params: { id: 'agd_1' } } as never),
    })
    await until(() => qc.getQueryData<AgendaView>(keys.agenda('agd_1'))?.items[0]?.status === 'covered')

    qc.setQueryData(keys.leases('s1'), [])
    daemon.emit(
      ephemeral(
        { type: 'agent.presence', leaseId: 'lse_1', name: 'claude', mode: 'act', state: 'reading' },
        's1',
      ),
    )
    expect(store.getState().presence.s1?.lse_1).toMatchObject({
      name: 'claude',
      state: 'reading',
      mode: 'act',
    })
    await flush()
    expect(qc.getQueryState(keys.leases('s1'))?.isInvalidated).toBe(true)
  })
})
