import { mkdtempSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { type DaemonHandle, startDaemon } from '@kacola/testkit/daemon'
import { buildDesktop, type DesktopApp, launchDesktop } from '@kacola/testkit/desktop'
import { type HeadlessDisplay, markedPids, startHeadlessDisplay } from '@kacola/testkit/ui'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { poll } from '../src/desktop-ui.ts'
import { markOnboarded } from '../src/ui.ts'

// The calendar in the Electron window, against the real daemon and its calendar service fed by a
// calendar file (KACOLA_CALENDAR=file:…, the RawOccurrence shape cal-agent emits from EDS; the same
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
    dir = mkdtempSync(join(tmpdir(), 'kacola-desktop-calendar-'))
    calFile = join(dir, 'calendar.json')
    writeCalendar([])
    daemon = await startDaemon({
      dataDir: join(dir, 'data'),
      env: { KACOLA_CALENDAR: `file:${calFile}`, KACOLA_FAKE_PIPELINE: JSON.stringify(PIPELINE) },
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
    const rule = prefs().getByRole('switch', { name: 'When a calendar meeting starts' })
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
      .getByText('Interview template, suggested by the calendar event (“interview”)', { exact: true })
      .waitFor({ timeout: 10_000 })
    // the daemon agrees, and Enhance defaults to it
    const { suggested } = await daemon.client.call('listTemplates', { query: { sessionId } })
    expect(suggested).toEqual({
      templateId: 'interview',
      reason: 'keyword',
      matched: { keyword: 'interview', source: 'calendar' },
    })
    await w().getByRole('button', { name: 'Choose a template' }).click()
    await w()
      .getByRole('menuitem', { name: /Enhance as Interview \(suggested\)/ })
      .waitFor({ timeout: 5000 })
    expect(await app.axe()).toEqual([])
    await w().keyboard.press('Escape')
  })

  it('Refresh calendar: F5 and the button by the date re-read the calendar; calendars not up to date show quietly', async () => {
    await w().evaluate(`location.hash = '#/'`)
    await w().getByRole('searchbox', { name: 'Search or ask' }).waitFor()
    const later = Date.now() + 2 * 3_600_000
    const event = (summary: string) => ({
      uid: `${summary}@x`,
      sourceUid: 'cal-work',
      calendarName: 'Work',
      recurrenceId: null,
      summary,
      description: '',
      location: '',
      url: '',
      start: new Date(later).toISOString(),
      end: new Date(later + 30 * 60_000).toISOString(),
      allDay: false,
      startDate: null,
      endDate: null,
      timezone: null,
      status: 'CONFIRMED',
      myPartstat: 'ACCEPTED',
      organizer: null,
      attendees: 2,
      recurring: false,
      xprops: {},
    })
    const updatedAt = async () => (await daemon.client.call('calendarStatus')).updatedAt
    const today = w().getByRole('list', { name: 'Today’s meetings' })
    writeCalendar([event('Budget sync')])
    await today.getByText('Budget sync').waitFor({ timeout: 10_000 })
    // nothing changed on disk since: no new snapshot until asked for one
    const before = await updatedAt()
    await new Promise((r) => setTimeout(r, 800))
    expect(await updatedAt()).toBe(before)
    // F5: the daemon re-reads the calendar (a fresh snapshot)
    await w().keyboard.press('F5')
    const afterF5 = await poll(
      async () => {
        const u = await updatedAt()
        return u && u !== before ? u : undefined
      },
      10_000,
      'the re-read after F5',
    )

    // the button by the date does the same; a calendar reported as not up to date shows quietly
    writeFileSync(
      `${calFile}.tmp`,
      JSON.stringify({
        calendars: [{ id: 'cal-work', name: 'Work' }],
        occurrences: [event('Budget sync'), event('Vendor call')],
        offline: [{ id: 'cal-team', name: 'Team', reason: 'sign-in' }],
      }),
    )
    renameSync(`${calFile}.tmp`, calFile)
    await today.getByText('Vendor call').waitFor({ timeout: 10_000 })
    const settled = await updatedAt()
    expect(settled).not.toBe(afterF5)
    await w().getByRole('button', { name: 'Refresh calendar' }).click()
    await poll(
      async () => ((await updatedAt()) !== settled ? true : undefined),
      10_000,
      'the re-read after the button',
    )
    await w().getByText('Team needs signing in again (GNOME Online Accounts)').waitFor()
    expect(await app.axe()).toEqual([])
    // the shortcut is listed
    await w().keyboard.press('Control+?')
    const help = w().getByRole('dialog', { name: 'Keyboard shortcuts' })
    await help.getByText('Refresh calendar').waitFor()
    await w().keyboard.press('Escape')
  })
})
