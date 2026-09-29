import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { type DaemonHandle, startDaemon } from '@gnomeola/testkit/daemon'
import {
  extensionState,
  fakeUrlHandler,
  GNOMEOLA_EXTENSION,
  GNOMEOLA_UUID,
  shellEval,
  UNSAFE_MODE_EXTENSION,
} from '@gnomeola/testkit/shell'
import { type HeadlessDisplay, startHeadlessDisplay } from '@gnomeola/testkit/ui'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// V-4b (end to end): the real extension in a throwaway nested GNOME Shell 50, talking over the nested
// session bus to the REAL daemon (its GJS D-Bus bridge, its calendar service reading a file calendar, its
// fake capture pipeline). The user clicks Join in the top-bar menu (activated through the item's
// `activate` signal, as a click does) and we check both halves of the one action: the meeting link reached
// the desktop's URL handler (a fake one that records it) AND the daemon is recording a session linked to
// that meeting. Then live state in the panel, Stop from the menu, and "Open gnomeola".

const ARTIFACTS = join(import.meta.dirname, '__artifacts__')
const MEET = 'https://meet.google.com/abc-defg-hij'

type Item = { key: string; text: string; name: string }
type Indicator = { accessibleName: string; icon: string; label: string; items: Item[] }

const DESCRIBE = `(() => {
  const b = Main.panel.statusArea['${GNOMEOLA_UUID}']
  if (!b) return null
  return {
    accessibleName: b.accessible_name,
    icon: b._icon.icon_name,
    label: b._label.visible ? b._label.text : '',
    items: b.menu._getMenuItems().map((i) => ({
      key: i._gnomeolaKey ?? '',
      text: i.label?.text ?? i._title?.text ?? '',
      name: i.accessible_name ?? '',
    })),
  }
})()`
const activate = (key: string) => `(() => {
  const item = Main.panel.statusArea['${GNOMEOLA_UUID}'].menu._getMenuItems()
    .find((i) => i._gnomeolaKey === ${JSON.stringify(key)})
  if (!item) throw new Error('no menu item ' + ${JSON.stringify(key)})
  item.activate(null)
  return true
})()`

let display: HeadlessDisplay
let daemon: DaemonHandle
let urlLog = ''
let launchLog = ''
const start = Date.now() + 10 * 60_000
const iso = (t: number) => new Date(t).toISOString()
const pad = (n: number) => String(n).padStart(2, '0')
const clock = (t: number) => `${pad(new Date(t).getHours())}:${pad(new Date(t).getMinutes())}`

const indicator = () => shellEval<Indicator | null>(display.env, DESCRIBE)
const until = <T>(probe: () => Promise<T | null | undefined | false>, what: string, ms = 15_000) =>
  display.waitFor(probe, ms, what)

beforeAll(async () => {
  display = await startHeadlessDisplay({
    extensions: [UNSAFE_MODE_EXTENSION, GNOMEOLA_EXTENSION],
    prepare: (dirs) => {
      urlLog = join(dirs.home, 'opened-urls.log')
      launchLog = join(dirs.home, 'launched.log')
      fakeUrlHandler(dirs.data, dirs.config, urlLog)
      // a stand-in for the installed app, so "Open gnomeola" has something to launch
      const script = join(dirs.data, 'applications', 'fake-gnomeola-ui.sh')
      writeFileSync(script, `#!/bin/sh\necho launched >> '${launchLog}'\n`, { mode: 0o755 })
      writeFileSync(
        join(dirs.data, 'applications', 'org.gnome.Gnomeola.desktop'),
        `[Desktop Entry]\nType=Application\nName=gnomeola\nExec=${script}\n`,
      )
    },
  })
  const calendar = join(display.tempDir, 'calendar.json')
  writeFileSync(
    calendar,
    JSON.stringify({
      calendars: [{ id: 'cal-work', name: 'Work' }],
      occurrences: [
        occ('Platform standup', start, start + 15 * 60_000, { location: MEET }),
        occ('Design review', start + 2 * 3_600_000, start + 3 * 3_600_000, {
          description: 'Join Zoom: https://acme.zoom.us/j/123456789?pwd=abc&amp;from=addon',
        }),
      ],
    }),
  )
  daemon = await startDaemon({
    env: {
      GNOMEOLA_DBUS: 'session',
      DBUS_SESSION_BUS_ADDRESS: display.env.DBUS_SESSION_BUS_ADDRESS,
      GNOMEOLA_CALENDAR: `file:${calendar}`,
      GNOMEOLA_FAKE_PIPELINE: JSON.stringify({ partialEveryMs: 100, segmentEveryMs: 400 }),
    },
  })
  await until(
    async () => (await extensionState(display.env, GNOMEOLA_UUID))?.stateName === 'active',
    'extension',
  )
}, 180_000)

afterAll(async () => {
  await daemon?.stop()
  await display?.close()
})

function occ(summary: string, s: number, e: number, o: Record<string, unknown> = {}) {
  return {
    sourceUid: 'cal-work',
    calendarName: 'Work',
    uid: `${summary}@example.com`,
    recurrenceId: null,
    summary,
    description: '',
    location: '',
    url: '',
    start: iso(s),
    end: iso(e),
    allDay: false,
    startDate: null,
    endDate: null,
    timezone: null,
    status: 'CONFIRMED',
    myPartstat: null,
    organizer: null,
    attendees: 3,
    recurring: false,
    xprops: {},
    ...o,
  }
}

describe('the extension against the real daemon', () => {
  let meetingId = ''

  it('renders the next meetings from the daemon’s calendar', async () => {
    const { next } = await daemon.client.call('nextMeeting')
    expect(next?.title).toBe('Platform standup')
    meetingId = next!.id
    const ind = await until(async () => {
      const i = await indicator()
      return i?.items.some((x) => x.key === `meeting:${meetingId}`) && i
    }, 'meetings from the daemon')
    expect(ind.accessibleName).toBe('gnomeola: not recording')
    const standup = ind.items.find((i) => i.key === `meeting:${meetingId}`)!
    expect(standup.text).toBe(`${clock(start)}–${clock(start + 15 * 60_000)}  Platform standup`)
    expect(standup.name).toMatch(/Platform standup, Google Meet, Join$/)
    const review = ind.items.find((i) => i.text.endsWith('Design review'))!
    expect(review.name).toMatch(/Design review, Zoom, Join$/)
  })

  it('Join opens the meeting link AND starts a session on the daemon linked to the meeting', async () => {
    await shellEval(display.env, activate(`meeting:${meetingId}`))
    const opened = await until(
      async () => existsSync(urlLog) && readFileSync(urlLog, 'utf8').trim(),
      'the URL handler to be called',
    )
    expect(opened.split('\n')).toEqual([MEET])
    const { sessions } = await daemon.client.call('listSessions', { query: { limit: 10 } })
    expect(sessions).toHaveLength(1)
    expect(sessions[0]).toMatchObject({ title: 'Platform standup', status: 'recording' })
    expect(sessions[0]!.meeting?.id).toBe(meetingId)
    expect(sessions[0]!.meeting?.join?.url).toBe(MEET)
  })

  it('shows the live recording: red state, elapsed time, the newest transcript line; no Join for it', async () => {
    const ind = await until(async () => {
      const i = await indicator()
      return i?.icon === 'media-record-symbolic' && i.items.some((x) => x.key === 'last-line') && i
    }, 'recording with a transcript line')
    expect(ind.label).toMatch(/^0:\d\d$/)
    expect(ind.accessibleName).toMatch(/^gnomeola: recording Platform standup, 0:\d\d$/)
    expect(ind.items[0]!.text).toMatch(/^Recording · Platform standup · 0:\d\d$/)
    expect(ind.items.find((i) => i.key === 'last-line')!.text).toMatch(/^(me|them): \S/)
    expect(ind.items.find((i) => i.key === `meeting:${meetingId}`)!.name).not.toMatch(/Join$/)
    await shellEval(display.env, `Main.panel.statusArea['${GNOMEOLA_UUID}'].menu.open(); true`)
    await display.screenshot(join(ARTIFACTS, 'shell-extension-real-daemon.png'))
    await shellEval(display.env, `Main.panel.statusArea['${GNOMEOLA_UUID}'].menu.close(); true`)
  })

  it('Stop in the menu stops the session on the daemon, and the panel goes idle', async () => {
    await shellEval(display.env, activate('stop'))
    await until(async () => {
      const { sessions } = await daemon.client.call('listSessions', { query: { limit: 10 } })
      return sessions[0]?.status === 'stopped'
    }, 'the daemon session to stop')
    await until(async () => (await indicator())?.icon === 'audio-input-microphone-symbolic', 'idle panel')
  })

  it('Record now starts an ad-hoc session, stopped again from the menu', async () => {
    await shellEval(display.env, activate('record'))
    const s = await until(async () => {
      const { sessions } = await daemon.client.call('listSessions', { query: { limit: 10 } })
      return sessions.find((x) => x.status === 'recording')
    }, 'an ad-hoc recording')
    expect(s.meeting).toBeUndefined()
    await until(async () => (await indicator())?.items[0]?.key === 'session', 'recording menu')
    await shellEval(display.env, activate('stop'))
    await until(async () => {
      const r = await daemon.client.call('getSession', { params: { id: s.id } })
      return r.status === 'stopped'
    }, 'stopped')
  })

  it('"Open gnomeola" launches the app', async () => {
    await shellEval(display.env, activate('open'))
    await until(
      async () => existsSync(launchLog) && readFileSync(launchLog, 'utf8').includes('launched'),
      'launch',
    )
  })

  it('shows "not running" when the daemon stops', async () => {
    await daemon.stop()
    await until(async () => (await indicator())?.icon === 'microphone-disabled-symbolic', 'offline')
  })
})
