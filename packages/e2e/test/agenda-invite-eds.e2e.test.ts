import { extractInviteBlock, INVITE_BLOCK_START, type Meeting } from '@kacola/protocol'
import { type DaemonHandle, startDaemon, waitFor } from '@kacola/testkit/daemon'
import { CALENDARS, type EdsHandle, type LiveFixture, liveFixture, startEds } from '@kacola/testkit/eds'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// The invitation block through the whole stack: the REAL daemon, its REAL cal-agent, a REAL (isolated,
// seeded) Evolution Data Server. POST /agendas/:id/invite {write:true} must append the marked block to
// the event's description — the organiser's text kept byte for byte, one block, idempotent — and refuse
// an event someone else organises without touching it. Descriptions are read back independently of
// cal-agent, through ECal (EdsHandle.getEvent).

let eds: EdsHandle
let daemon: DaemonHandle
let live: LiveFixture

const ORGANISER_TEXT = 'Quarterly plan review.\nPlease read the doc first.'
const ics = (d: Date) => `${d.toISOString().slice(0, 19).replace(/[-:]/g, '')}Z`

async function addEvent(uid: string, summary: string, organizer: string, startInMin: number) {
  const start = new Date(Math.ceil(Date.now() / 60_000) * 60_000 + startInMin * 60_000)
  await eds.createEvent(
    'kacola-live',
    [
      'BEGIN:VEVENT',
      `UID:${uid}`,
      'DTSTAMP:20260901T000000Z',
      `SUMMARY:${summary}`,
      `DTSTART:${ics(start)}`,
      `DTEND:${ics(new Date(start.getTime() + 30 * 60_000))}`,
      `ORGANIZER:mailto:${organizer}`,
      'ATTENDEE;PARTSTAT=ACCEPTED:mailto:me@example.com',
      `DESCRIPTION:${ORGANISER_TEXT.replace(/\n/g, '\\n')}`,
      'END:VEVENT',
    ].join('\n'),
  )
  return start
}

async function meetingFor(uid: string): Promise<Meeting> {
  return waitFor(
    async () =>
      (
        await daemon.client.call('listMeetings', {
          query: { to: new Date(Date.now() + 6 * 3_600_000).toISOString() },
        })
      ).meetings.find((m) => m.uid === uid),
    20_000,
    `meeting ${uid}`,
  )
}

const description = async (uid: string) => {
  const comps = await eds.getEvent('kacola-live', uid)
  const master = comps.find((c) => c.recurrenceId === null) ?? comps[0]!
  expect(master.descriptions).toBeLessThanOrEqual(1)
  return master.description
}

describe('agenda invitation block into EDS through the real daemon', () => {
  beforeAll(async () => {
    live = liveFixture(new Date())
    eds = await startEds({ calendars: [...CALENDARS, live.calendar] })
    daemon = await startDaemon({ env: { ...eds.env, KACOLA_CALENDAR: 'eds', KACOLA_DBUS: 'off' } })
    await waitFor(
      async () => (await daemon.client.call('calendarStatus')).state === 'ok',
      30_000,
      'the calendar to be ready',
    )
    await addEvent('agenda-mine@test', 'Plan review', 'me@example.com', 120)
    await addEvent('agenda-theirs@test', 'Boss sync', 'boss@example.com', 180)
  }, 120_000)

  afterAll(async () => {
    await daemon?.stop()
    await eds?.close()
  })

  it('writes the block after the organiser text, once, and a second write changes nothing', async () => {
    const m = await meetingFor('agenda-mine@test')
    const v = await daemon.client.call('createAgenda', { body: { meetingId: m.id } })
    expect(v.agenda.meeting).toMatchObject({ eventUid: 'agenda-mine@test', recurring: false })
    const r = await daemon.client.call('agendaInviteBlock', {
      params: { id: v.agenda.id },
      body: { write: true },
    })
    expect(r).toMatchObject({ written: true, reason: null, appLink: `kacola://agenda/${v.agenda.id}` })
    const d1 = await description('agenda-mine@test')
    expect(d1.startsWith(ORGANISER_TEXT)).toBe(true)
    expect(d1.split(INVITE_BLOCK_START)).toHaveLength(2)
    expect(extractInviteBlock(d1)).toBe(r.block)
    expect(r.block).toContain(`kacola://agenda/${v.agenda.id}`)

    const again = await daemon.client.call('agendaInviteBlock', {
      params: { id: v.agenda.id },
      body: { write: true },
    })
    expect(again.written).toBe(true)
    expect(await description('agenda-mine@test')).toBe(d1)

    // removing takes out exactly our block
    await daemon.client.call('agendaInviteBlock', { params: { id: v.agenda.id }, body: { remove: true } })
    expect((await description('agenda-mine@test')).trimEnd()).toBe(ORGANISER_TEXT)
  })

  it('refuses an event someone else organises and leaves it untouched', async () => {
    const m = await meetingFor('agenda-theirs@test')
    const before = await description('agenda-theirs@test')
    const v = await daemon.client.call('createAgenda', { body: { meetingId: m.id } })
    const r = await daemon.client.call('agendaInviteBlock', {
      params: { id: v.agenda.id },
      body: { write: true },
    })
    expect(r.written).toBe(false)
    expect(r.reason).toMatch(/not the organiser/)
    expect(r.block).toContain(INVITE_BLOCK_START)
    expect(await description('agenda-theirs@test')).toBe(before)
    expect(before).toBe(ORGANISER_TEXT)
  })
})
