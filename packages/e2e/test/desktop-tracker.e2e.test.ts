import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { type DaemonHandle, startDaemon, waitFor } from '@gnomeola/testkit/daemon'
import { buildDesktop, type DesktopApp, launchDesktop } from '@gnomeola/testkit/desktop'
import { loadAgendaFixture } from '@gnomeola/testkit/fixtures'
import { type HeadlessDisplay, markedPids, startHeadlessDisplay } from '@gnomeola/testkit/ui'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { markOnboarded } from '../src/ui.ts'

// The window following the REAL live tracker: the daemon replays the manager-1on1 agenda fixture
// (src/tracker-daemon.ts: ScriptedPipeline, on-device decisions, a scripted text LLM for bridge lines and
// the recap). Join and Record from the agenda; the live panel shows who follows the meeting, items the
// tracker checks off itself ("auto", with evidence from this recording), its next-point cards (a replaced
// one disappears), "Not covered yet" (the meeting ends in 4 min); after Stop, the recap per item. What
// the tracker decides depends on timing, so this suite asserts behaviour, not pixels.

describe('desktop: the live tracker', () => {
  let display: HeadlessDisplay
  let daemon: DaemonHandle
  let app: DesktopApp
  let dir = ''
  let markerId = ''
  const w = () => app.window

  beforeAll(async () => {
    buildDesktop()
    dir = mkdtempSync(join(tmpdir(), 'gnomeola-desktop-tracker-'))
    const calFile = join(dir, 'calendar.json')
    const now = Date.now()
    const t = (min: number) => new Date(now + min * 60_000).toISOString()
    writeFileSync(
      calFile,
      JSON.stringify({
        calendars: [{ id: 'cal-work', name: 'Work' }],
        occurrences: [
          {
            uid: 'tracker-1on1@x',
            summary: '1:1 Dana / Sam',
            sourceUid: 'cal-work',
            calendarName: 'Work',
            recurrenceId: null,
            start: t(-1),
            end: t(4),
            description: '',
            location: '',
            url: '',
            allDay: false,
            startDate: null,
            endDate: null,
            timezone: 'UTC',
            status: 'CONFIRMED',
            myPartstat: null,
            organizer: 'mailto:me@example.com',
            attendees: 2,
            recurring: false,
            xprops: {},
          },
        ],
      }),
    )
    daemon = await startDaemon({
      dataDir: join(dir, 'data'),
      entry: join(import.meta.dirname, '..', 'src', 'tracker-daemon.ts'),
      env: { GNOMEOLA_CALENDAR: `file:${calFile}` },
    })
    display = await startHeadlessDisplay({ size: '1280x800' })
    markerId = display.env.GNOMEOLA_HEADLESS_ID!
    markOnboarded(
      display,
      (await daemon.client.call('listModels')).models.map((m) => m.id),
    )
    app = await launchDesktop({
      display,
      env: { GNOMEOLA_URL: daemon.baseUrl, GNOMEOLA_COLOR_SCHEME: 'light' },
    })
    await w().getByRole('button', { name: 'Record', exact: true }).waitFor({ timeout: 20_000 })
    await w().emulateMedia({ reducedMotion: 'reduce' })
  }, 300_000)

  afterAll(async () => {
    await app?.close()
    await display?.close()
    await daemon?.stop()
    if (dir) rmSync(dir, { recursive: true, force: true })
    if (markerId) expect(markedPids(markerId)).toEqual([])
  })

  it('auto check-offs with evidence, next points, the T-5 list, the tracker’s status, then the recap', async () => {
    const fx = loadAgendaFixture('manager-1on1')
    let meetings: { id: string }[] = []
    await waitFor(
      async () => {
        meetings = (await daemon.client.call('listMeetings', {})).meetings
        return meetings.length > 0
      },
      15_000,
      'the calendar meeting',
    )
    const agenda = await daemon.client.call('createAgenda', {
      body: {
        meetingId: meetings[0]!.id,
        items: fx.truth.agenda!.items.map((it) => ({ text: it.text, kind: it.kind })),
      },
    })
    await w().evaluate(`location.hash = '#/agendas/${agenda.agenda.id}'`)
    await w().getByRole('button', { name: 'Join and Record' }).click()
    await w().getByRole('tab', { name: 'Agenda', selected: true }).waitFor({ timeout: 15_000 })
    const panel = w().getByRole('tabpanel', { name: 'Agenda' })
    const sniff = async () => {
      const ac = new AbortController()
      const seen: string[] = []
      setTimeout(() => ac.abort(), 4000)
      await daemon.client
        .subscribe({ ephemeral: true, signal: ac.signal, onEvent: (e) => seen.push(e.data.type) })
        .catch(() => {})
      return [...new Set(seen)]
    }

    // who follows the meeting (GET /agendas/:id/tracker, then agenda.tracker events)
    await panel
      .getByText(/Following the meeting · decisions on this computer/)
      .waitFor({ timeout: 20_000 })
      .catch(async (e) => {
        const t = await daemon.client.call('getAgendaTracker', { params: { id: agenda.agenda.id } })
        const a = await daemon.client.call('getAgenda', {
          params: { id: agenda.agenda.id },
          query: { includePrivate: true },
        })
        throw new Error(
          `${e}\ntracker: ${JSON.stringify(t)}\nsession: ${a.agenda.sessionId}\npanel: ${await panel.innerText()}\nproblems: ${JSON.stringify(app.problems())}\nevents: ${JSON.stringify(await sniff())}`,
        )
      })
    // the meeting ends in 4 min: the window's "Not covered yet"
    await panel.getByRole('region', { name: 'Not covered yet' }).waitFor()

    // the tracker checks something off by itself, with evidence from this recording
    const auto = panel
      .getByRole('list', { name: 'Agenda items' })
      .getByRole('listitem')
      .filter({ hasText: 'auto' })
    await auto.first().waitFor({ timeout: 60_000 })
    await auto
      .first()
      .getByRole('button', { name: /^Show in transcript: / })
      .first()
      .waitFor()

    // one next-point card at a time: the tracker's (its bridge line from the text LLM)
    const next = panel.getByRole('region', { name: 'Next talking point' })
    await next.getByText('Shall we move on to the next point?').waitFor({ timeout: 30_000 })
    await next.getByText('from the live tracker').waitFor()
    expect(await panel.getByRole('region', { name: 'Next talking point' }).count()).toBe(1)
    expect(await app.axe()).toEqual([])

    // the replay runs out; Stop; the recap (scripted LLM) lands on every item
    const sessionId = ((await w().evaluate('location.hash')) as string).split('/')[2]!.split('?')[0]!
    await waitFor(
      async () =>
        (
          await daemon.client.call('getTranscript', {
            params: { id: sessionId },
            query: { includePrivate: true },
          })
        ).segments.length >= fx.truth.utterances.length,
      60_000,
      'every utterance',
    )
    // a next-point card the tracker replaced is gone from the window (dismissed by tracker = superseded)
    const v = await daemon.client.call('getAgenda', {
      params: { id: agenda.agenda.id },
      query: { includePrivate: true },
    })
    for (const s of v.suggestions.filter((x) => x.kind === 'next-point' && x.state === 'dismissed'))
      expect(await panel.getByText(s.text, { exact: true }).count(), s.id).toBeLessThanOrEqual(
        v.suggestions.some((o) => o.state === 'open' && o.kind === 'next-point' && o.text === s.text) ? 1 : 0,
      )
    await daemon.client.call('stopSession', { params: { id: sessionId } })
    const recap = w().getByRole('list', { name: 'Recap per item' })
    await recap.waitFor({ timeout: 20_000 })
    await recap
      .getByText(/^Settled: /)
      .first()
      .waitFor({ timeout: 30_000 })
    await recap.getByText(/^Sam:/).first().waitFor()
    const tracker = await daemon.client.call('getAgendaTracker', { params: { id: agenda.agenda.id } })
    expect(tracker.tracker).toMatchObject({ state: 'stopped', recap: { state: 'done' } })
    expect(await app.axe()).toEqual([])
    expect(app.problems()).toEqual([])
  })
})
