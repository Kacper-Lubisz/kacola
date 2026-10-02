import { mkdtempSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { type DaemonHandle, startDaemon } from '@gnomeola/testkit/daemon'
import { buildDesktop, type DesktopApp, launchDesktop } from '@gnomeola/testkit/desktop'
import { type HeadlessDisplay, markedPids, startHeadlessDisplay } from '@gnomeola/testkit/ui'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { poll } from '../src/desktop-ui.ts'
import { markOnboarded } from '../src/ui.ts'

// The calendar in the Electron window, against the real daemon and its calendar service fed by a
// calendar file (GNOMEOLA_CALENDAR=file:…, the RawOccurrence shape cal-agent emits from EDS; the same
// fixture style as cli-meetings.int.test.ts): the auto-record rule switched on in Preferences records a
// meeting when it begins, linked to its calendar event; the recorded meeting's notes (its outcome page) suggest a template
// from the calendar event's title — even after the session was renamed to something that matches
// nothing — and Enhance defaults to it.

const PIPELINE = { speed: 4, segmentEveryMs: 1500, partialEveryMs: 250, finalizeAfterMs: 200, tickMs: 20 }
const MEETING = 'Candidate interview: Sam'

describe('desktop: calendar meetings and the calendar-based template suggestion', () => {
  let display: HeadlessDisplay
  let daemon: DaemonHandle
  let app: DesktopApp
  let dir: string
  let calFile: string
  let markerId = ''
  let sessionId = ''

  const w = () => app.window
  const prefs = () => w().getByRole('dialog', { name: 'Preferences' })
  /** Replace the calendar atomically, as a real writer would. */
  const writeCalendar = (occurrences: Record<string, unknown>[]) => {
    writeFileSync(
      `${calFile}.tmp`,
      JSON.stringify({ calendars: [{ id: 'cal-work', name: 'Work' }], occurrences }),
    )
    renameSync(`${calFile}.tmp`, calFile)
  }

  beforeAll(async () => {
    buildDesktop()
    dir = mkdtempSync(join(tmpdir(), 'gnomeola-desktop-calendar-'))
    calFile = join(dir, 'calendar.json')
    writeCalendar([])
    daemon = await startDaemon({
      dataDir: join(dir, 'data'),
      env: { GNOMEOLA_CALENDAR: `file:${calFile}`, GNOMEOLA_FAKE_PIPELINE: JSON.stringify(PIPELINE) },
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
    await w().getByRole('button', { name: 'Record now' }).waitFor({ timeout: 20_000 })
  }, 240_000)

  afterEach(() => {
    expect(app.problems()).toEqual([])
  })

  afterAll(async () => {
    await app?.close()
    await display?.close()
    await daemon?.stop()
    if (dir) rmSync(dir, { recursive: true, force: true })
    if (markerId) expect(markedPids(markerId)).toEqual([])
  })

  it('records a calendar meeting when it begins, once the rule is switched on in Preferences', async () => {
    await w().keyboard.press('Control+,')
    const rule = prefs().getByRole('switch', { name: 'When a Calendar Meeting Starts' })
    await rule.waitFor({ timeout: 5000 })
    expect(await rule.isChecked()).toBe(false)
    await rule.focus()
    await w().keyboard.press('Space')
    await poll(
      async () => (await daemon.client.call('getSettings')).autoRecord.calendar,
      5000,
      'the calendar rule on in the daemon',
    )
    await w().keyboard.press('Escape')
    await prefs().waitFor({ state: 'detached', timeout: 5000 })

    // a meeting that begins in three seconds
    const start = Date.now() + 3000
    writeCalendar([
      {
        uid: 'interview-sam@x',
        sourceUid: 'cal-work',
        calendarName: 'Work',
        recurrenceId: null,
        summary: MEETING,
        description: '',
        location: 'Room 2',
        url: '',
        start: new Date(start).toISOString(),
        end: new Date(start + 45 * 60_000).toISOString(),
        allDay: false,
        startDate: null,
        endDate: null,
        timezone: 'Europe/Warsaw',
        status: 'CONFIRMED',
        myPartstat: 'ACCEPTED',
        organizer: 'mailto:ana@example.com',
        attendees: 3,
        recurring: false,
        xprops: {},
      },
    ])
    await poll(
      async () => (await daemon.client.call('nextMeeting')).next?.title === MEETING,
      10_000,
      'the daemon to read the calendar file',
    )
    // it begins: the daemon records it (linked, titled after it) and the window shows it live
    const live = await poll(
      async () =>
        (await daemon.client.call('listSessions', { query: {} })).sessions.find(
          (s) => s.status === 'recording',
        ),
      15_000,
      'the auto-recorded session',
    )
    sessionId = live.id
    expect(live.title).toBe(MEETING)
    expect(live.meeting?.title).toBe(MEETING)
    // home pins the recording under way
    const pinned = w().getByRole('region', { name: 'Recording now' })
    await pinned.getByRole('timer', { name: /^Recording/ }).waitFor({ timeout: 10_000 })
    await pinned.getByText(MEETING).waitFor()
    // stopped from the window (its live page)
    await pinned.getByRole('button', { name: `Open ${MEETING}` }).click()
    await w().getByRole('heading', { level: 1, name: MEETING }).waitFor({ timeout: 10_000 })
    await w().getByRole('button', { name: 'Stop', exact: true }).click()
    await poll(
      async () =>
        (await daemon.client.call('getSession', { params: { id: sessionId } })).status === 'stopped',
      10_000,
      'stopped',
    )
  })

  it('suggests the template from the calendar event, even when the session title matches nothing', async () => {
    // renamed to something no template knows: only the linked calendar event can suggest one
    await daemon.client.call('updateSession', { params: { id: sessionId }, body: { title: 'Chat with Sam' } })
    await w().getByRole('heading', { level: 1, name: 'Chat with Sam' }).waitFor({ timeout: 10_000 })
    // the outcome page carries the notes (no tabs)
    await w()
      .getByText('Interview template, suggested by the calendar event ("interview")', { exact: true })
      .waitFor({ timeout: 10_000 })
    // the daemon agrees, and Enhance defaults to it
    const { suggested } = await daemon.client.call('listTemplates', { query: { sessionId } })
    expect(suggested).toEqual({
      templateId: 'interview',
      reason: 'keyword',
      matched: { keyword: 'interview', source: 'calendar' },
    })
    await w().getByRole('button', { name: 'Choose a Template' }).click()
    await w()
      .getByRole('menuitem', { name: /Enhance as Interview \(suggested\)/ })
      .waitFor({ timeout: 5000 })
    expect(await app.axe()).toEqual([])
    await w().keyboard.press('Escape')
  })
})
