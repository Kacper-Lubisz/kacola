import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { type DaemonHandle, startDaemon, waitFor } from '@kacola/testkit/daemon'
import { buildDesktop, type DesktopApp, launchDesktop } from '@kacola/testkit/desktop'
import { loadAgendaFixture } from '@kacola/testkit/fixtures'
import { type HeadlessDisplay, markedPids, startHeadlessDisplay } from '@kacola/testkit/ui'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { markOnboarded } from '../src/ui.ts'

// The window following the REAL live tracker: the daemon replays the manager-1on1 agenda fixture
// (src/tracker-daemon.ts: ScriptedPipeline, on-device decisions, a scripted text LLM for bridge lines and
// the recap). Join and record from the prep page; the live page's checklist shows items the tracker
// checks off itself ("ticked by kacola", with Undo; evidence from this recording), its next point in the
// one suggestion slot, and no time pressure; after Stop, the outcome with the recap per item. What the
// tracker decides depends on timing, so this suite asserts behaviour, not pixels.

describe('desktop: the live tracker', () => {
  let display: HeadlessDisplay
  let daemon: DaemonHandle
  let app: DesktopApp
  let dir = ''
  let markerId = ''
  const w = () => app.window

  beforeAll(async () => {
    buildDesktop()
    dir = mkdtempSync(join(tmpdir(), 'kacola-desktop-tracker-'))
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
      env: { KACOLA_CALENDAR: `file:${calFile}` },
    })
    display = await startHeadlessDisplay({ size: '1280x800' })
    markerId = display.env.KACOLA_HEADLESS_ID!
    markOnboarded(
      display,
      (await daemon.client.call('listModels')).models.map((m) => m.id),
    )
    app = await launchDesktop({
      display,
      env: { KACOLA_URL: daemon.baseUrl, KACOLA_COLOR_SCHEME: 'light' },
    })
    await w().getByRole('button', { name: 'New recording', exact: true }).waitFor({ timeout: 20_000 })
    await w().emulateMedia({ reducedMotion: 'reduce' })
  }, 300_000)

  afterAll(async () => {
    await app?.close()
    await display?.close()
    await daemon?.stop()
    if (dir) rmSync(dir, { recursive: true, force: true })
    if (markerId) expect(markedPids(markerId)).toEqual([])
  })

  it('auto check-offs with evidence, the next point in the one slot, no time pressure, then the recap', async () => {
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
    await w().getByRole('button', { name: 'Join and record' }).click()
    // the prep page moves on by itself: live, with the recording pill
    await w()
      .getByRole('timer', { name: /^Recording/ })
      .waitFor({ timeout: 15_000 })
    const view = () =>
      daemon.client.call('getAgenda', { params: { id: agenda.agenda.id }, query: { includePrivate: true } })
    let sessionId = ''
    await waitFor(
      async () => {
        sessionId = (await view()).agenda.sessionId ?? ''
        return sessionId !== ''
      },
      15_000,
      'the agenda to link',
    )

    // the tracker follows the meeting (GET /agendas/:id/tracker) — an internal: the live screen never
    // names the decisions provider, and shows no time pressure ("Not covered yet" is gone)
    await waitFor(
      async () =>
        (await daemon.client.call('getAgendaTracker', { params: { id: agenda.agenda.id } })).tracker
          ?.state === 'running',
      20_000,
      'the tracker to run',
    )
    expect(
      await w()
        .getByText(/Following the meeting|decisions on this computer/)
        .count(),
    ).toBe(0)
    expect(await w().getByText('Not covered yet').count()).toBe(0)

    // the tracker checks something off by itself: ticked, quietly attributed, with Undo; its evidence
    // is from this recording
    const checklist = w().getByRole('list', { name: 'Agenda items' })
    const auto = checklist.getByRole('listitem').filter({ hasText: 'ticked by kacola' })
    await auto.first().waitFor({ timeout: 60_000 })
    await auto
      .first()
      .getByRole('button', { name: /^Undo the tick on / })
      .waitFor()
    const known = new Set(
      (
        await daemon.client.call('getTranscript', {
          params: { id: sessionId },
          query: { includePrivate: true },
        })
      ).segments.map((x) => x.id),
    )
    const ticked = (await view()).items.filter((i) => i.status === 'covered' && i.evidence.length > 0)
    expect(ticked.some((i) => i.evidence.some((e) => e.segmentId !== null && known.has(e.segmentId)))).toBe(
      true,
    )

    // ONE suggestion slot: the tracker's next point (its bridge line from the text LLM), never two cards
    const slot = w().getByRole('region', { name: /^Suggestion: / })
    await w()
      .getByRole('region', { name: 'Suggestion: Shall we move on to the next point?' })
      .waitFor({ timeout: 30_000 })
    expect(await slot.count()).toBe(1)
    expect(await app.axe()).toEqual([])

    // the replay runs out; Stop; the recap (scripted LLM) lands on every item
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
    expect(await slot.count()).toBeLessThanOrEqual(1)
    await daemon.client.call('stopSession', { params: { id: sessionId } })
    // the outcome: the recap per item on the left, the outcome block (actions with their owner) first
    const recap = w().getByRole('list', { name: 'Recap per item' })
    await recap.waitFor({ timeout: 20_000 })
    await recap.getByText('settled', { exact: true }).first().waitFor({ timeout: 30_000 })
    await w()
      .getByRole('region', { name: 'Outcome' })
      .getByRole('list', { name: 'Action items' })
      .getByText('Sam', { exact: true })
      .first()
      .waitFor({ timeout: 30_000 })
    const tracker = await daemon.client.call('getAgendaTracker', { params: { id: agenda.agenda.id } })
    expect(tracker.tracker).toMatchObject({ state: 'stopped', recap: { state: 'done' } })
    expect(await app.axe()).toEqual([])
    expect(app.problems()).toEqual([])
  })
})
