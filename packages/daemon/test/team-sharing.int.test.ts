import { mkdtempSync, rmSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { type AgendaView, createClient, type KacolaClient, type SharedChange } from '@kacola/protocol'
import { createHostedApp, MemoryMailer, type Served, serve } from '@kacola/server'
import type { StoreApi } from '@kacola/store/core'
import { openPglite, openPostgres } from '@kacola/store/pg'
import { waitFor } from '@kacola/testkit/daemon'
import { assertNoViolations, checkAgendaLog, checkEventLog } from '@kacola/testkit/invariants'
import { type PostgresContainer, podmanPostgresAvailable, startPostgres } from '@kacola/testkit/postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ManualCalendarProvider } from '../src/calendar/providers.ts'
import { createDaemon, type Daemon } from '../src/daemon.ts'
import { FakePipeline } from '../src/fakes/pipeline.ts'
import { MemoryKeyring } from '../src/keyring.ts'
import { at, occ } from './calendar-helpers.ts'

// Team sharing end to end (L-18…L-22): two real daemons — the organiser's and an attendee's — and the
// hosted server (PGlite, and a real Postgres 17 when podman has it), all three following ONE agenda of a
// recurring team meeting. Every byte between the daemons and the server goes through a recording proxy,
// so the privacy claim is checked on the wire: no transcript text, segment or session id, evidence
// quote, private card or private goal ever reaches the server.
//
//   share       the organiser shares (members: the attendee); the invite block carries the web link
//   follow      the attendee's daemon follows with the link + a magic-link code (fake mailer)
//   invitee     someone without kacola adds an item and a comment through the link
//   merge       statuses from both devices — people, trackers — merge per item: forward-only for
//               automated changers, the organiser's override wins, a member's override beats trackers,
//               duplicates agree; everything attributed; every submitted change in the history
//   recap       outcomes reach the server only once the organiser shares the recap
//   carry-over  the recording stops; the next occurrence joins the same link with the unresolved items
//               (the invitee's included, still theirs) and the attendee's daemon follows it
//   unshare     the link answers 410; the attendee's copy is detached; the server keeps nothing

const ADMIN = 'team-sharing-admin-token-0123456789'
const SECRETS = {
  transcript: 'TRANSCRIPT-SECRET we talked about the roadmap numbers',
  card: 'PRIVATE-CARD-SECRET salary bands',
  goal: 'SECRET-GOAL get the promo',
  note: 'NOTE-SECRET heard on the call',
}

type Wire = { method: string; url: string; request: string; response: string }

/** Forwards to `target`, recording every request and response body. */
async function recordingProxy(target: string): Promise<{ url: string; log: Wire[]; close(): Promise<void> }> {
  const log: Wire[] = []
  const server: Server = createServer(async (req, res) => {
    const chunks: Buffer[] = []
    for await (const c of req) chunks.push(c as Buffer)
    const body = Buffer.concat(chunks)
    const headers: Record<string, string> = {}
    for (const [k, v] of Object.entries(req.headers))
      if (typeof v === 'string' && !['host', 'connection', 'content-length'].includes(k)) headers[k] = v
    const r = await fetch(`${target}${req.url}`, {
      method: req.method,
      headers,
      ...(body.length ? { body } : {}),
    })
    const text = await r.text()
    log.push({ method: req.method ?? '', url: req.url ?? '', request: body.toString(), response: text })
    res.writeHead(r.status, { 'content-type': r.headers.get('content-type') ?? 'application/json' })
    res.end(text)
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  return {
    url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    log,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  }
}

const unavailable = await podmanPostgresAvailable()
if (unavailable) console.warn(`[skip] team sharing on real Postgres: ${unavailable}`)

const dialects: {
  name: string
  skip: boolean
  open: (pg: { server?: PostgresContainer }) => Promise<StoreApi>
}[] = [
  { name: 'pglite', skip: false, open: async () => openPglite(new PGlite()) },
  {
    name: 'postgres',
    skip: unavailable !== null,
    open: async ({ server }) => openPostgres(server!.urlFor('postgres')),
  },
]

for (const dialect of dialects) {
  describe.skipIf(dialect.skip)(`team sharing: two daemons + the hosted server [${dialect.name}]`, () => {
    const now = Date.now()
    const weekly = (week: number) =>
      occ({
        uid: 'team-sync@x',
        summary: 'Team sync',
        recurring: true,
        recurrenceId: at(now, -10 + week * 7 * 24 * 60),
        start: at(now, -10 + week * 7 * 24 * 60),
        end: at(now, 50 + week * 7 * 24 * 60),
        organizer: 'mailto:kacper@example.com',
      })
    const dirs: string[] = []
    const mailer = new MemoryMailer()
    let pgServer: PostgresContainer | undefined
    let hostedStore: StoreApi
    let hosted: Served
    let proxy: Awaited<ReturnType<typeof recordingProxy>>
    let A: Daemon // the organiser
    let B: Daemon // an attendee who runs kacola
    let a: KacolaClient
    let b: KacolaClient
    const s = { agenda: '', link: '', bAgenda: '', next: '', bNext: '', session: '' }
    /** `agenda.share` states the organiser's window was told about (ephemeral events). */
    const shareEvents: string[] = []

    const daemon = async (o: { share?: boolean }) => {
      const dir = mkdtempSync(join(tmpdir(), 'kacola-share-'))
      dirs.push(dir)
      const cal = new ManualCalendarProvider()
      const d = await createDaemon({
        dataDir: dir,
        port: 0,
        pipeline: new FakePipeline({
          segmentEveryMs: 40,
          finalizeAfterMs: 20,
          partialEveryMs: 20,
          levelEveryMs: 50,
        }),
        keyring: new MemoryKeyring(),
        env: {},
        calendar: cal,
        tracker: false, // the tracker's writes are made below through the same store API it uses
        share: {
          ...(o.share
            ? { url: proxy.url, token: ADMIN, ownerName: 'Kacper', ownerLabel: 'kacper@example.com' }
            : {}),
          pollMs: 0,
          debounceMs: 20,
        },
      })
      cal.push({ calendars: [{ id: 'cal-work', name: 'Work' }], occurrences: [weekly(0), weekly(1)] })
      cal.state('ok')
      return d
    }

    beforeAll(async () => {
      if (dialect.name === 'postgres') pgServer = await startPostgres()
      hostedStore = await dialect.open({ server: pgServer })
      hosted = await serve(
        createHostedApp({
          store: hostedStore,
          blobs: new (await import('@kacola/store/blob')).MemoryBlobStore(),
          auth: { secret: 's'.repeat(40), adminToken: ADMIN },
          trustLoopback: false,
          mailer,
        }),
      )
      proxy = await recordingProxy(hosted.url)
      A = await daemon({ share: true })
      B = await daemon({})
      A.bus.subscribe((e) => {
        if (e.seq === null && e.data.type === 'agenda.share') shareEvents.push(e.data.status.state)
      })
      a = createClient({ baseUrl: A.url, timeoutMs: 20_000 })
      b = createClient({ baseUrl: B.url, timeoutMs: 20_000 })
    }, 180_000)
    afterAll(async () => {
      await A?.close()
      await B?.close()
      await proxy?.close()
      await hosted?.close()
      await hostedStore?.close()
      await pgServer?.stop()
      for (const d of dirs) rmSync(d, { recursive: true, force: true })
    })

    const view = (c: KacolaClient, id: string): Promise<AgendaView> =>
      c.call('getAgenda', { params: { id }, query: { includePrivate: true } })
    const itemOf = async (c: KacolaClient, id: string, text: string) =>
      (await view(c, id)).items.find((i) => i.text === text)!
    const sync = async () => {
      await a.call('syncAgendaShare', { params: { id: s.agenda } })
      await b.call('syncAgendaShare', { params: { id: s.bAgenda } })
      await a.call('syncAgendaShare', { params: { id: s.agenda } })
    }

    it('shares an agenda: only the projection leaves; the invitation carries the web link', async () => {
      const v = await a.call('createAgenda', {
        body: {
          eventUid: 'team-sync@x',
          goals: [SECRETS.goal],
          items: [{ text: 'Roadmap', kind: 'must-cover' }, { text: 'Hiring' }, { text: 'Budget' }],
        },
      })
      s.agenda = v.agenda.id
      await a.call('addContextCard', {
        params: { id: s.agenda },
        body: { title: 'Salaries', body: SECRETS.card },
      })
      await a.call('addContextCard', {
        params: { id: s.agenda },
        body: {
          title: 'Q3 numbers',
          body: 'Revenue up 12%.',
          visibility: 'shared',
          source: { kind: 'url', ref: 'https://wiki.example/q3' },
        },
      })
      const before = await a.call('agendaInviteBlock', { params: { id: s.agenda }, body: {} })
      expect(before.webLink).toBeNull()
      const st = await a.call('shareAgenda', {
        params: { id: s.agenda },
        body: { members: ['ben@example.com'] },
      })
      expect(st).toMatchObject({ shared: true, role: 'owner', state: 'ok', pending: 0, recapShared: false })
      s.link = st.link!
      expect(s.link).toMatch(new RegExp(`^${proxy.url}/a/[A-Za-z0-9_-]{32}$`))
      const block = await a.call('agendaInviteBlock', { params: { id: s.agenda }, body: {} })
      expect(block.webLink).toBe(s.link)
      expect(block.block).toContain(`Agenda: ${s.link}\nOpen in kacola: kacola://`)
      // what the page shows: items, the shared card only, no goals
      const page = await createClient({ baseUrl: hosted.url }).call('getSharedPage', {
        params: { token: s.link.split('/a/')[1]! },
      })
      expect(page.items.map((i) => i.text)).toEqual(['Roadmap', 'Hiring', 'Budget'])
      expect(page.cards.map((c) => [c.title, c.sourceUrl])).toEqual([
        ['Q3 numbers', 'https://wiki.example/q3'],
      ])
      expect(page.occurrence.goals).toEqual([])
    })

    it("follows from the attendee's daemon with a magic-link code: a local copy, same items, linked to the meeting", async () => {
      await b.call('followAgenda', { body: { link: s.link, email: 'ben@example.com', name: 'Ben' } })
      const code = /code is ([A-Z]{4}-[A-Z]{4})/.exec(mailer.last('ben@example.com')!.text)![1]!
      await expect(
        b.call('confirmFollowAgenda', {
          body: { link: s.link, email: 'ben@example.com', code: 'BBBB-CCCC' },
        }),
      ).rejects.toMatchObject({ status: 403 })
      const st = await b.call('confirmFollowAgenda', {
        body: { link: s.link, email: 'ben@example.com', code },
      })
      expect(st).toMatchObject({ shared: true, role: 'member', state: 'ok' })
      s.bAgenda = st.agendaId
      const bv = await view(b, s.bAgenda)
      const av = await view(a, s.agenda)
      expect(bv.items.map((i) => [i.id, i.text])).toEqual(av.items.map((i) => [i.id, i.text]))
      expect(bv.agenda.meeting).toMatchObject({ eventUid: 'team-sync@x', recurring: true })
      expect(bv.agenda.goals).toEqual([])
      // the organiser's shared card, read-only on the copy; the private one never left
      expect(bv.context.map((c) => [c.title, c.visibility, c.createdBy])).toEqual([
        ['Q3 numbers', 'shared', 'peer:kacper@example.com'],
      ])
      // an attendee the organiser did not list may view the page, but not follow
      await b.call('followAgenda', { body: { link: s.link, email: 'eve@example.com' } })
      const eve = /code is ([A-Z]{4}-[A-Z]{4})/.exec(mailer.last('eve@example.com')!.text)![1]!
      await expect(
        b.call('confirmFollowAgenda', { body: { link: s.link, email: 'eve@example.com', code: eve } }),
      ).rejects.toMatchObject({ status: 403 })
    })

    it('an invitee adds an item and a comment through the link: both daemons see them, attributed', async () => {
      const token = s.link.split('/a/')[1]!
      const web = createClient({ baseUrl: proxy.url })
      await web.call('shareVerify', { params: { token }, body: { email: 'ivy@example.com', name: 'Ivy' } })
      const code = /code is ([A-Z]{4}-[A-Z]{4})/.exec(mailer.last('ivy@example.com')!.text)![1]!
      const conf = await web.call('shareConfirm', {
        params: { token },
        body: { email: 'ivy@example.com', code },
      })
      const ivy = createClient({ baseUrl: proxy.url, headers: { 'x-kacola-participant': conf.token } })
      const item = await ivy.call('shareAddItem', { params: { token }, body: { text: 'Offsite dates' } })
      await ivy.call('shareAddComment', {
        params: { token },
        body: { itemId: item.id, text: 'Friday works for me' },
      })
      await sync()
      for (const [c, id] of [
        [a, s.agenda],
        [b, s.bAgenda],
      ] as const) {
        const off = await itemOf(c, id, 'Offsite dates')
        expect(off).toMatchObject({ id: item.id, createdBy: 'invitee:ivy@example.com', status: 'open' })
      }
      const st = await a.call('getAgendaShare', { params: { id: s.agenda } })
      expect(st.comments.map((c) => [c.text, c.author.label, c.itemId])).toEqual([
        ['Friday works for me', 'ivy@example.com', item.id],
      ])
      expect(st.participants.map((p) => [p.email, p.role]).sort()).toEqual([
        ['ben@example.com', 'member'],
        ['eve@example.com', 'invitee'],
        ['ivy@example.com', 'invitee'],
      ])
    })

    it('records on the organiser’s device: the session, its transcript and evidence quotes stay there', async () => {
      const { meetings } = await a.call('listMeetings', { query: { from: at(now, -60), to: at(now, 60) } })
      const { session } = await a.call('joinMeeting', { params: { id: meetings[0]!.id }, body: {} })
      s.session = session.id
      await waitFor(
        async () => (await view(a, s.agenda)).agenda.sessionId === session.id,
        5_000,
        'agenda linked',
      )
      await waitFor(
        async () => (await a.call('getTranscript', { params: { id: session.id } })).segments.length >= 3,
        10_000,
        'some speech',
      )
      // the tracker's check-off, with evidence quoted from the transcript (as the real tracker writes it)
      const seg = (await a.call('getTranscript', { params: { id: session.id } })).segments[0]!
      const roadmap = await itemOf(a, s.agenda, 'Roadmap')
      A.agendas.agendas.setStatus(s.agenda, roadmap.id, {
        status: 'in-progress',
        by: 'tracker',
        evidence: [{ segmentId: seg.id, quote: SECRETS.transcript, confidence: 0.9 }],
        note: SECRETS.note,
        confidence: 0.7,
      })
      await sync()
      expect((await itemOf(b, s.bAgenda, 'Roadmap')).status).toBe('in-progress')
      expect((await itemOf(b, s.bAgenda, 'Roadmap')).changedBy).toBe('peer:kacper@example.com/tracker')
      expect((await itemOf(b, s.bAgenda, 'Roadmap')).evidence).toEqual([])
    })

    it('merges statuses from both devices per item: attributed, by the rules, nothing lost', async () => {
      const ids = Object.fromEntries((await view(a, s.agenda)).items.map((i) => [i.text, i.id]))
      // Ben, in person, covers the roadmap (forward): applied everywhere
      await b.call('setAgendaItemStatus', {
        params: { id: s.bAgenda, itemId: ids.Roadmap! },
        body: { status: 'covered' },
      })
      await sync()
      expect(await itemOf(a, s.agenda, 'Roadmap')).toMatchObject({
        status: 'covered',
        changedBy: 'peer:ben@example.com',
      })
      // the organiser overrides it back by hand: the owner's override wins, and locks it on Ben's device too
      await a.call('setAgendaItemStatus', {
        params: { id: s.agenda, itemId: ids.Roadmap! },
        body: { status: 'in-progress' },
      })
      await sync()
      expect(await itemOf(b, s.bAgenda, 'Roadmap')).toMatchObject({
        status: 'in-progress',
        changedBy: 'peer:kacper@example.com',
      })
      expect(() =>
        B.agendas.agendas.setStatus(s.bAgenda, ids.Roadmap!, {
          status: 'covered',
          by: 'tracker',
          auto: true,
          confidence: 0.95,
        }),
      ).toThrow(/manual wins/)
      // a race the lock could not prevent locally: the organiser parks hiring then reopens it by hand,
      // while Ben's agent — not yet synced — moves it forward. The server refuses the agent; Ben's copy follows.
      await a.call('setAgendaItemStatus', {
        params: { id: s.agenda, itemId: ids.Hiring! },
        body: { status: 'parked' },
      })
      await a.call('setAgendaItemStatus', {
        params: { id: s.agenda, itemId: ids.Hiring! },
        body: { status: 'open' },
      })
      await a.call('syncAgendaShare', { params: { id: s.agenda } })
      B.agendas.agendas.setStatus(s.bAgenda, ids.Hiring!, { status: 'in-progress', by: 'agent:claude' })
      await sync()
      expect(await itemOf(b, s.bAgenda, 'Hiring')).toMatchObject({
        status: 'open',
        changedBy: 'peer:kacper@example.com',
      })
      expect((await itemOf(a, s.agenda, 'Hiring')).status).toBe('open')
      // both trackers cover the budget: one applied, one agreed
      A.agendas.agendas.setStatus(s.agenda, ids.Budget!, {
        status: 'covered',
        by: 'tracker',
        auto: true,
        confidence: 0.9,
      })
      B.agendas.agendas.setStatus(s.bAgenda, ids.Budget!, {
        status: 'covered',
        by: 'tracker',
        auto: true,
        confidence: 0.85,
      })
      await sync()
      // Ben reopens the budget by hand (a member's override): it beats every tracker, the organiser's included
      await b.call('setAgendaItemStatus', {
        params: { id: s.bAgenda, itemId: ids.Budget! },
        body: { status: 'open' },
      })
      await sync()
      expect(await itemOf(a, s.agenda, 'Budget')).toMatchObject({
        status: 'open',
        changedBy: 'peer:ben@example.com',
      })
      expect(() =>
        A.agendas.agendas.setStatus(s.agenda, ids.Budget!, { status: 'in-progress', by: 'tracker' }),
      ).toThrow(/manual wins/)

      const changes: SharedChange[] = (await a.call('getAgendaShareHistory', { params: { id: s.agenda } }))
        .changes
      const name = (id: string) => Object.entries(ids).find(([, v]) => v === id)![0]
      expect(changes.map((c) => [name(c.itemId), c.actor.label, c.actor.by, c.to, c.outcome])).toEqual([
        ['Roadmap', 'kacper@example.com', 'tracker', 'in-progress', 'applied'],
        ['Roadmap', 'ben@example.com', 'user', 'covered', 'applied'],
        ['Roadmap', 'kacper@example.com', 'user', 'in-progress', 'applied'],
        ['Hiring', 'kacper@example.com', 'user', 'parked', 'applied'],
        ['Hiring', 'kacper@example.com', 'user', 'open', 'applied'],
        ['Hiring', 'ben@example.com', 'agent:claude', 'in-progress', 'refused'],
        ['Budget', 'kacper@example.com', 'tracker', 'covered', 'applied'],
        ['Budget', 'ben@example.com', 'tracker', 'covered', 'agreed'],
        ['Budget', 'ben@example.com', 'user', 'open', 'applied'],
      ])
      expect(changes.find((c) => c.outcome === 'refused')?.reason).toMatch(/owner set it to open by hand/)
      // nothing silently lost: every change either device made itself is in the shared history
      const own = (d: Daemon, id: string) =>
        d.agendas.agendas
          .history(id)
          .filter((c) => c.by === 'user' || c.by === 'tracker' || c.by.startsWith('agent:'))
      expect(own(A, s.agenda).length + own(B, s.bAgenda).length).toBe(changes.length)
      const bst = await b.call('getAgendaShare', { params: { id: s.bAgenda } })
      expect(bst).toMatchObject({ pending: 0, refused: 1 })
      // both local logs still satisfy the agenda invariants (peer changes are the server's verdicts)
      for (const d of [A, B]) {
        const log = d.store.eventsAfter(0)
        assertNoViolations(checkEventLog(log), 'event log')
        assertNoViolations(checkAgendaLog(log), 'agenda log')
      }
    })

    it('the recap reaches the server only when the organiser shares it', async () => {
      const ids = Object.fromEntries((await view(a, s.agenda)).items.map((i) => [i.text, i.id]))
      await a.call('updateAgendaItem', {
        params: { id: s.agenda, itemId: ids.Roadmap! },
        body: { outcome: 'RECAP-OUTCOME agreed the Q4 roadmap' },
      })
      await sync()
      expect(JSON.stringify(proxy.log)).not.toContain('RECAP-OUTCOME')
      const token = s.link.split('/a/')[1]!
      const page0 = await createClient({ baseUrl: hosted.url }).call('getSharedPage', { params: { token } })
      expect(page0.items.every((i) => i.outcome === null)).toBe(true)
      const st = await a.call('shareAgendaRecap', { params: { id: s.agenda }, body: { shared: true } })
      expect(st.recapShared).toBe(true)
      await sync()
      const page = await createClient({ baseUrl: hosted.url }).call('getSharedPage', { params: { token } })
      expect(page.items.find((i) => i.text === 'Roadmap')?.outcome).toBe(
        'RECAP-OUTCOME agreed the Q4 roadmap',
      )
      expect((await itemOf(b, s.bAgenda, 'Roadmap')).outcome).toBe('RECAP-OUTCOME agreed the Q4 roadmap')
      expect((await b.call('getAgendaShare', { params: { id: s.bAgenda } })).recapShared).toBe(true)
    })

    it('carries over: the next occurrence joins the same link with the unresolved items, and the attendee follows it', async () => {
      await a.call('stopSession', { params: { id: s.session } })
      // the organiser's daemon rolls the series over when the recording stops
      await waitFor(
        async () => {
          const r = await a.call('resolveAgendaLink', {
            body: { eventUid: 'team-sync@x', start: weekly(1).start, includePrivate: true },
          })
          if (r.agenda) s.next = r.agenda.agenda.id
          return r.agenda !== null
        },
        10_000,
        'the next occurrence',
      )
      const next = await view(a, s.next)
      expect(next.agenda.carriedFrom).toBe(s.agenda)
      expect(next.items.map((i) => [i.text, i.status]).sort()).toEqual([
        ['Budget', 'open'],
        ['Hiring', 'open'],
        ['Offsite dates', 'open'],
        ['Roadmap', 'open'],
      ])
      const st = await a.call('syncAgendaShare', { params: { id: s.next } })
      expect(st.link).toBe(s.link) // the same link for the series
      await b.call('syncAgendaShare', { params: { id: s.bAgenda } })
      await waitFor(
        async () =>
          (await b.call('listAgendas', { query: { eventUid: 'team-sync@x' } })).agendas.length === 2,
        5_000,
        'the copy of the next occurrence',
      )
      const bNext = (await b.call('listAgendas', { query: { eventUid: 'team-sync@x' } })).agendas.find(
        (x) => x.id !== s.bAgenda,
      )!
      s.bNext = bNext.id
      const bn = await view(b, s.bNext)
      expect(bn.agenda.meeting?.start).toBe(next.agenda.meeting?.start)
      expect(bn.items.map((i) => i.id).sort()).toEqual(next.items.map((i) => i.id).sort())
      // the invitee's carried item is still theirs, on the server and on the attendee's copy
      expect(bn.items.find((i) => i.text === 'Offsite dates')?.createdBy).toBe('invitee:ivy@example.com')
      const token = s.link.split('/a/')[1]!
      const page = await createClient({ baseUrl: hosted.url }).call('getSharedPage', { params: { token } })
      expect(page.current).toBe(s.next)
      expect(page.items.find((i) => i.text === 'Offsite dates')).toMatchObject({
        carriedOver: true,
        contributed: true,
      })
      expect(page.occurrences.map((o) => [o.agendaId, o.recapShared])).toEqual([
        [s.agenda, true],
        [s.next, false],
      ])
      // the attendee's daemon did not roll its own copy over (no duplicate items from a local carry-over)
      expect(bn.items).toHaveLength(4)
    })

    it('never put transcript text, segment or session ids, evidence, notes, private cards or goals on the wire', async () => {
      const transcript = (await a.call('getTranscript', { params: { id: s.session } })).segments
      expect(transcript.length).toBeGreaterThan(2)
      const wire = proxy.log.map((w) => `${w.method} ${w.url}\n${w.request}\n${w.response}`).join('\n')
      expect(proxy.log.length).toBeGreaterThan(10)
      for (const secret of Object.values(SECRETS)) expect(wire, secret).not.toContain(secret)
      expect(wire).not.toContain(s.session)
      for (const g of transcript) {
        expect(wire, g.id).not.toContain(g.id)
        if (g.text.length > 12) expect(wire, g.text).not.toContain(g.text)
      }
      for (const word of ['"evidence"', '"quote"', '"segmentId"', '"note"', '"sessionId"', 'Salaries'])
        expect(wire, word).not.toContain(word)
      // and the server's own log has none of it either
      const serverLog = JSON.stringify(await hostedStore.eventsAfter(0))
      for (const secret of Object.values(SECRETS)) expect(serverLog, secret).not.toContain(secret)
      expect(serverLog).not.toContain(s.session)
    })

    it('privacy follows the agenda: made private, it is unshared on the next sync (the link answers 410)', async () => {
      const v = await a.call('createAgenda', {
        body: { title: 'Side project', items: [{ text: 'Pricing' }] },
      })
      const st = await a.call('shareAgenda', { params: { id: v.agenda.id }, body: {} })
      const token = st.link!.split('/a/')[1]!
      const web = createClient({ baseUrl: hosted.url })
      expect((await web.call('getSharedPage', { params: { token } })).items.map((i) => i.text)).toEqual([
        'Pricing',
      ])
      await a.call('updateAgenda', { params: { id: v.agenda.id }, body: { private: true } })
      await waitFor(
        async () =>
          (await web.call('getSharedPage', { params: { token } }).then(
            () => 200,
            (e) => e.status,
          )) === 410,
        5_000,
        'the private agenda to be unshared',
      )
      expect(await a.call('getAgendaShare', { params: { id: v.agenda.id } })).toMatchObject({
        shared: false,
        state: 'off',
      })
      // and a private agenda cannot be shared at all
      await expect(a.call('shareAgenda', { params: { id: v.agenda.id }, body: {} })).rejects.toMatchObject({
        status: 409,
      })
      // the window heard about every change of sharing state
      expect(shareEvents).toContain('ok')
      expect(shareEvents).toContain('off')
    })

    it('unsharing: 410 for the link, the attendee’s copy detached, nothing left on the server', async () => {
      const st = await a.call('unshareAgenda', { params: { id: s.agenda } })
      expect(st).toMatchObject({ shared: false, link: null })
      const token = s.link.split('/a/')[1]!
      await expect(
        createClient({ baseUrl: hosted.url }).call('getSharedPage', { params: { token } }),
      ).rejects.toMatchObject({ status: 410 })
      await b.call('syncAgendaShare', { params: { id: s.bAgenda } })
      const bst = await b.call('getAgendaShare', { params: { id: s.bAgenda } })
      expect(bst).toMatchObject({ state: 'revoked', shared: false, link: null })
      // the attendee keeps their local copy
      expect((await view(b, s.bAgenda)).items.length).toBeGreaterThan(0)
      const snap = await hostedStore.snapshot()
      expect([
        snap.shareItems,
        snap.shareChanges,
        snap.shareCards,
        snap.shareComments,
        snap.shareParticipants,
      ]).toEqual([[], [], [], [], []])
      expect((await a.call('agendaInviteBlock', { params: { id: s.agenda }, body: {} })).webLink).toBeNull()
    })
  })
}
