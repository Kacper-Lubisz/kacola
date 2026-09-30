import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createClient, type GnomeolaClient, INVITE_BLOCK_START } from '@gnomeola/protocol'
import { waitFor } from '@gnomeola/testkit/daemon'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ManualCalendarProvider } from '../src/calendar/providers.ts'
import { createDaemon, type Daemon } from '../src/daemon.ts'
import { FakePipeline } from '../src/fakes/pipeline.ts'
import { MemoryKeyring } from '../src/keyring.ts'
import { at, occ } from './calendar-helpers.ts'

// Agendas in the real daemon, over HTTP: linked to calendar occurrences, attached to the recording when
// it starts, carried over to the next occurrence of a recurring meeting when it stops, the recap hook,
// deep links, privacy, and the invitation block (written where the provider can, refused where not).

describe('agendas in the daemon', () => {
  let dir: string
  let daemon: Daemon
  let c: GnomeolaClient
  const cal = new ManualCalendarProvider()
  const now = Date.now()
  // a weekly 1:1 in progress right now, next week's occurrence, and a one-off tomorrow
  const weekly = (week: number) =>
    occ({
      uid: 'one-on-one@x',
      summary: '1:1 with Ana',
      recurring: true,
      recurrenceId: at(now, -10 + week * 7 * 24 * 60),
      start: at(now, -10 + week * 7 * 24 * 60),
      end: at(now, 20 + week * 7 * 24 * 60),
      organizer: 'mailto:me@example.com',
    })
  const oneOff = occ({
    uid: 'review@x',
    summary: 'Design review',
    start: at(now, 24 * 60),
    end: at(now, 25 * 60),
  })
  const recaps: string[] = []

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'gnomeola-agendas-'))
    daemon = await createDaemon({
      dataDir: dir,
      port: 0,
      pipeline: new FakePipeline({
        segmentEveryMs: 50,
        finalizeAfterMs: 20,
        partialEveryMs: 20,
        levelEveryMs: 50,
      }),
      keyring: new MemoryKeyring(),
      env: {},
      calendar: cal,
      agendaWebBase: 'https://kacola.example',
    })
    daemon.agendas.onRecap(({ agenda, session }) => {
      recaps.push(`${agenda.agenda.id}:${session.id}`)
    })
    c = createClient({ baseUrl: daemon.url, timeoutMs: 5_000 })
    cal.push({ calendars: [{ id: 'cal-work', name: 'Work' }], occurrences: [weekly(0), weekly(1), oneOff] })
    cal.state('ok')
  })
  afterAll(async () => {
    await daemon?.close()
    rmSync(dir, { recursive: true, force: true })
  })

  const meetingId = async (title: string, week = 0) => {
    const { meetings } = await c.call('listMeetings', {
      query: { from: at(now, -60), to: at(now, 9 * 24 * 60) },
    })
    return meetings.filter((m) => m.title === title)[week]!.id
  }

  it('creates from a calendar meeting (by UID: the current occurrence), and refuses a second one', async () => {
    const v = await c.call('createAgenda', {
      body: {
        eventUid: 'one-on-one@x',
        markdown:
          '## Goals\n- promo dates\n\n- [ ] Promo timeline (10m, @ana) [must-cover]\n- [ ] Hiring plan\n- [ ] Offsite\n',
      },
    })
    expect(v.agenda).toMatchObject({
      title: '1:1 with Ana',
      goals: ['promo dates'],
      meeting: { eventUid: 'one-on-one@x', recurring: true, meetingId: await meetingId('1:1 with Ana') },
      sessionId: null,
    })
    expect(v.items.map((i) => i.text)).toEqual(['Promo timeline', 'Hiring plan', 'Offsite'])
    await expect(c.call('createAgenda', { body: { eventUid: 'one-on-one@x' } })).rejects.toMatchObject({
      status: 409,
    })
    const reused = await c.call('createAgenda', { body: { eventUid: 'one-on-one@x', ifExists: 'reuse' } })
    expect(reused.agenda.id).toBe(v.agenda.id)
    await expect(c.call('createAgenda', { body: { meetingId: 'mtg_nope' } })).rejects.toMatchObject({
      status: 404,
    })
    await expect(c.call('createAgenda', { body: {} })).rejects.toMatchObject({ status: 400 })
  })

  it('resolves deep links: agenda, occurrence, series (current occurrence), live', async () => {
    const [a] = (await c.call('listAgendas', { query: { eventUid: 'one-on-one@x' } })).agendas
    const byAgenda = await c.call('resolveAgendaLink', { body: { link: `kacola://agenda/${a!.id}` } })
    expect(byAgenda).toMatchObject({ live: true, created: false, meeting: { title: '1:1 with Ana' } })
    const series = await c.call('resolveAgendaLink', { body: { link: 'kacola://meeting/one-on-one%40x' } })
    expect(series.agenda?.agenda.id).toBe(a!.id)
    const occ0 = await c.call('resolveAgendaLink', {
      body: { eventUid: 'one-on-one@x', start: weekly(0).start },
    })
    expect(occ0.agenda?.agenda.id).toBe(a!.id)
    // next week's occurrence has no agenda yet; asking to create makes one (seeded by carry-over)
    const link1 = `kacola://meeting/one-on-one%40x?start=${encodeURIComponent(weekly(1).start)}`
    const none = await c.call('resolveAgendaLink', { body: { link: link1 } })
    expect(none).toMatchObject({
      agenda: null,
      live: false,
      created: false,
      meeting: { start: weekly(1).start },
    })
    await expect(c.call('resolveAgendaLink', { body: { link: 'https://x' } })).rejects.toMatchObject({
      status: 400,
    })
    await expect(
      c.call('resolveAgendaLink', { body: { link: 'kacola://agenda/agd_nope' } }),
    ).rejects.toMatchObject({
      status: 404,
    })
    const unknownEvent = await c.call('resolveAgendaLink', {
      body: { link: 'kacola://meeting/nope@x', create: true },
    })
    expect(unknownEvent).toMatchObject({ agenda: null, meeting: null, created: false })
  })

  it('attaches the recording when it starts, rolls open items to the next occurrence and calls the recap hook when it stops', async () => {
    const [a] = (await c.call('listAgendas', { query: { eventUid: 'one-on-one@x' } })).agendas
    const view = await c.call('getAgenda', { params: { id: a!.id } })
    const [promo, hiring] = view.items
    await c.call('setAgendaItemStatus', {
      params: { id: a!.id, itemId: promo!.id },
      body: { status: 'covered', by: 'tracker', auto: true, confidence: 0.93 },
    })
    await c.call('setAgendaItemStatus', {
      params: { id: a!.id, itemId: hiring!.id },
      body: { status: 'parked' },
    })

    const { session } = await c.call('joinMeeting', {
      params: { id: await meetingId('1:1 with Ana') },
      body: {},
    })
    await waitFor(
      async () => (await c.call('getAgenda', { params: { id: a!.id } })).agenda.sessionId === session.id,
      5_000,
      'the agenda to be linked to the recording',
    )
    expect(
      (await c.call('listAgendas', { query: { sessionId: session.id } })).agendas.map((x) => x.id),
    ).toEqual([a!.id])
    await c.call('stopSession', { params: { id: session.id } })
    await waitFor(async () => recaps.length === 1, 5_000, 'the recap hook')
    expect(recaps).toEqual([`${a!.id}:${session.id}`])
    // next week: parked + open items carried over, the covered one not
    const next = await c.call('resolveAgendaLink', {
      body: { eventUid: 'one-on-one@x', start: weekly(1).start },
    })
    expect(next.agenda?.agenda.carriedFrom).toBe(a!.id)
    expect(next.agenda?.items.map((i) => [i.text, i.status, i.carriedFrom?.itemId])).toEqual([
      ['Hiring plan', 'open', hiring!.id],
      ['Offsite', 'open', view.items[2]!.id],
    ])
  })

  it('a private recording hides its agenda from the agent surfaces', async () => {
    const v = await c.call('createAgenda', { body: { meetingId: await meetingId('Design review') } })
    expect(v.agenda.meeting?.recurring).toBe(false)
    const s = await c.call('createSession', { body: { title: 'secret', private: true } })
    daemon.agendas.agendas.attachSession(v.agenda.id, s.id)
    await expect(c.call('getAgenda', { params: { id: v.agenda.id } })).rejects.toMatchObject({ status: 404 })
    await expect(c.call('exportAgendaMarkdown', { params: { id: v.agenda.id } })).rejects.toMatchObject({
      status: 404,
    })
    expect((await c.call('listAgendas', { query: {} })).agendas.map((x) => x.id)).not.toContain(v.agenda.id)
    expect(
      (await c.call('getAgenda', { params: { id: v.agenda.id }, query: { includePrivate: true } })).agenda.id,
    ).toBe(v.agenda.id)
    const link = await c.call('resolveAgendaLink', { body: { eventUid: 'review@x' } })
    expect(link.agenda).toBeNull()
    await c.call('deleteSession', { params: { id: s.id } })
    expect((await c.call('getAgenda', { params: { id: v.agenda.id } })).agenda.sessionId).toBeNull()
  })

  it('invite block: returned for copying, written idempotently where the calendar allows, refused where not', async () => {
    const [a] = (await c.call('listAgendas', { query: { eventUid: 'one-on-one@x', limit: 1 } })).agendas
    cal.descriptions.set('one-on-one@x', 'Weekly sync.\nAgenda below.')
    const copy = await c.call('agendaInviteBlock', { params: { id: a!.id }, body: {} })
    // a series gets the series link, so the invitation stays right for every occurrence
    expect(copy).toMatchObject({
      written: false,
      reason: null,
      appLink: 'kacola://meeting/one-on-one%40x',
      webLink: expect.stringMatching(/^https:\/\/kacola\.example\/a\/agd_/),
    })
    expect(cal.descriptions.get('one-on-one@x')).toBe('Weekly sync.\nAgenda below.')
    const w = await c.call('agendaInviteBlock', { params: { id: a!.id }, body: { write: true } })
    expect(w.written).toBe(true)
    const d1 = cal.descriptions.get('one-on-one@x')!
    expect(d1).toBe(`Weekly sync.\nAgenda below.\n\n${w.block}`)
    await c.call('agendaInviteBlock', { params: { id: a!.id }, body: { write: true } })
    expect(cal.descriptions.get('one-on-one@x')).toBe(d1)
    await c.call('agendaInviteBlock', { params: { id: a!.id }, body: { remove: true } })
    expect(cal.descriptions.get('one-on-one@x')).toBe('Weekly sync.\nAgenda below.')
    cal.readOnly.add('one-on-one@x')
    const refused = await c.call('agendaInviteBlock', { params: { id: a!.id }, body: { write: true } })
    expect(refused).toMatchObject({ written: false, reason: 'the calendar is read-only' })
    expect(refused.block).toContain(INVITE_BLOCK_START)
    const unlinked = await c.call('createAgenda', { body: { title: 'no meeting' } })
    const r = await c.call('agendaInviteBlock', { params: { id: unlinked.agenda.id }, body: { write: true } })
    expect(r).toMatchObject({ written: false, reason: 'this agenda is not linked to a calendar event' })
  })
})

describe('agendas with a read-only calendar provider', () => {
  it('ICS / file calendars hand back the block with a reason instead of writing', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'gnomeola-agendas-ro-'))
    const cal = new ManualCalendarProvider()
    ;(cal as { editDescription?: unknown }).editDescription = undefined
    const d = await createDaemon({
      dataDir: dir,
      port: 0,
      keyring: new MemoryKeyring(),
      env: {},
      calendar: cal,
    })
    try {
      const c = createClient({ baseUrl: d.url, timeoutMs: 5_000 })
      const now = Date.now()
      cal.push({
        calendars: [{ id: 'cal-work', name: 'Work' }],
        occurrences: [occ({ uid: 'x@x', summary: 'X', start: at(now, 60), end: at(now, 90) })],
      })
      cal.state('ok')
      const v = await c.call('createAgenda', { body: { eventUid: 'x@x' } })
      const r = await c.call('agendaInviteBlock', { params: { id: v.agenda.id }, body: { write: true } })
      expect(r.written).toBe(false)
      expect(r.reason).toMatch(/manual calendar provider is read-only: paste the block/)
      expect(r.appLink).toBe(`kacola://agenda/${v.agenda.id}`)
    } finally {
      await d.close()
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
