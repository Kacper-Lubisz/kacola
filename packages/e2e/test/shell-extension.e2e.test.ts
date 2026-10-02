import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  extensionState,
  type FakeGnomeola,
  fakeUrlHandler,
  GNOMEOLA_EXTENSION,
  GNOMEOLA_UUID,
  shellEval,
  startFakeGnomeola,
  UNSAFE_MODE_EXTENSION,
} from '@gnomeola/testkit/shell'
import { type HeadlessDisplay, startHeadlessDisplay } from '@gnomeola/testkit/ui'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// V-4b (states): the REAL extension, installed and enabled in a throwaway nested GNOME Shell 50
// (`gnome-shell --headless --virtual-monitor`, private buses, private HOME), driven against a scriptable
// org.gnome.Gnomeola service. Every state the indicator must render is set over D-Bus and read back from
// the Shell's actual actors (Eval, unlocked in the nested instance only by a test companion extension),
// and from the accessibility tree the way a screen reader sees it. Menu items are activated through
// their `activate` signal — the same path a click or Enter takes.

const ARTIFACTS = join(import.meta.dirname, '__artifacts__')

type Item = { key: string; text: string; name: string; reactive: boolean }
type Indicator = { accessibleName: string; icon: string; label: string; styles: string; items: Item[] }

const DESCRIBE = `(() => {
  const b = Main.panel.statusArea['${GNOMEOLA_UUID}']
  if (!b) return null
  return {
    accessibleName: b.accessible_name,
    icon: b._icon.icon_name,
    label: b._label.visible ? b._label.text : '',
    styles: b.get_style_class_name() ?? '',
    items: b.menu._getMenuItems().map((i) => ({
      key: i._gnomeolaKey ?? '',
      text: i.label?.text ?? i._title?.text ?? '',
      name: i.accessible_name ?? '',
      reactive: i.reactive,
    })),
  }
})()`

const activate = (key: string) => `(() => {
  const b = Main.panel.statusArea['${GNOMEOLA_UUID}']
  const item = b.menu._getMenuItems().find((i) => i._gnomeolaKey === ${JSON.stringify(key)})
  if (!item) throw new Error('no menu item ' + ${JSON.stringify(key)})
  item.activate(null)
  return true
})()`

const HOUR = 3_600_000
const at = (h: number, m = 0) => {
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return d.getTime()
}

let d: HeadlessDisplay
let fake: FakeGnomeola | null = null
let urlLog = ''

const indicator = () => shellEval<Indicator | null>(d.env, DESCRIBE)
const until = <T>(probe: () => Promise<T | null | undefined | false>, what: string, ms = 10_000) =>
  d.waitFor(probe, ms, what)

beforeAll(async () => {
  d = await startHeadlessDisplay({
    size: '1280x800',
    extensions: [UNSAFE_MODE_EXTENSION, GNOMEOLA_EXTENSION],
    prepare: (dirs) => {
      urlLog = join(dirs.home, 'opened-urls.log')
      fakeUrlHandler(dirs.data, dirs.config, urlLog)
    },
  })
  await until(
    async () => (await extensionState(d.env, UNSAFE_MODE_EXTENSION_UUID))?.state === 1,
    'unsafe mode',
  )
}, 120_000)

afterAll(async () => {
  await fake?.stop()
  await d?.close()
})

const UNSAFE_MODE_EXTENSION_UUID = 'unsafe-mode@gnomeola.test'

describe('the extension in a nested GNOME Shell 50', () => {
  it('loads without errors and adds its indicator to the panel', async () => {
    const st = await until(() => extensionState(d.env, GNOMEOLA_UUID), 'extension info')
    expect(st, JSON.stringify(st)).toMatchObject({ stateName: 'active', error: null })
    const ind = await until(indicator, 'indicator')
    expect(ind.icon).toBeTruthy()
  })

  it('shows "not running" while nothing owns org.gnome.Gnomeola', async () => {
    const ind = await until(async () => {
      const i = await indicator()
      return i?.icon === 'microphone-disabled-symbolic' && i
    }, 'offline indicator')
    expect(ind.accessibleName).toBe('kacola: not running')
    expect(ind.styles).toContain('gnomeola-offline')
    expect(ind.items.map((i) => i.key)).toEqual(['offline', 'separator-app', 'open', 'prefs'])
    expect(ind.items[0]!.text).toBe('kacola is not running')
  })

  it('recovers when the daemon appears, and renders idle with upcoming meetings', async () => {
    fake = await startFakeGnomeola(d.env)
    const now = Date.now()
    fake.setProps({
      State: 'idle',
      CalendarState: 'ok',
      UpcomingMeetings: [
        {
          id: 'mtg_standup',
          title: 'Platform standup',
          start: now + 10 * 60_000,
          end: now + 25 * 60_000,
          allDay: false,
          joinUrl: 'https://meet.google.com/abc-defg-hij',
          provider: 'meet',
          calendar: 'Work',
          location: '',
          response: 'accepted',
        },
        {
          id: 'mtg_review',
          title: 'Design review',
          start: now + 2 * HOUR,
          end: now + 3 * HOUR,
          allDay: false,
          joinUrl: '',
          provider: '',
          calendar: 'Work',
          location: 'Room 4',
          response: '',
        },
      ],
    })
    const ind = await until(async () => {
      const i = await indicator()
      return i?.items.some((x) => x.key === 'meeting:mtg_review') && i
    }, 'meetings in the menu')
    expect(ind.icon).toBe('audio-input-microphone-symbolic')
    expect(ind.accessibleName).toBe('kacola: not recording')
    expect(ind.label).toBe('')
    const keys = ind.items.map((i) => i.key)
    expect(keys).toEqual([
      'record',
      'separator-meetings',
      'meetings-header',
      'meeting:mtg_standup',
      'meeting:mtg_review',
      'separator-app',
      'open',
      'prefs',
    ])
    const standup = ind.items.find((i) => i.key === 'meeting:mtg_standup')!
    expect(standup.text).toBe('Platform standup')
    expect(standup.name).toMatch(/^Platform standup, \d\d:\d\d–\d\d:\d\d, Google Meet, Join$/)
    expect(ind.items.find((i) => i.key === 'meeting:mtg_review')!.name).toMatch(/Design review, Record$/)
  })

  it('Join starts the session over D-Bus and opens the meeting link', async () => {
    fake!.onCall = (c) =>
      c.method === 'Join'
        ? { result: ['ses_joined', 'https://meet.google.com/abc-defg-hij'] }
        : { result: [] }
    await shellEval(d.env, activate('meeting:mtg_standup'))
    const call = await fake!.waitForCall('Join')
    expect(call.args).toEqual(['mtg_standup'])
    const opened = await until(
      async () => existsSync(urlLog) && readFileSync(urlLog, 'utf8').trim(),
      'the URL handler to be called',
    )
    expect(opened.split('\n')).toEqual(['https://meet.google.com/abc-defg-hij'])
  })

  it('still opens the link when recording cannot start (already recording)', async () => {
    fake!.onCall = (c) =>
      c.method === 'Join'
        ? { error: { name: 'org.gnome.Gnomeola.Error.Conflict', message: 'already recording "X"' } }
        : { result: [] }
    const before = fake!.calls.length
    await shellEval(d.env, activate('meeting:mtg_standup'))
    await until(async () => fake!.calls.length > before, 'a second Join')
    const opened = await until(async () => {
      const lines = readFileSync(urlLog, 'utf8').trim().split('\n')
      return lines.length === 2 && lines
    }, 'the link opened again')
    expect(opened[1]).toBe('https://meet.google.com/abc-defg-hij')
  })

  it('renders recording: red state, ticking elapsed time, title and the last line; Stop calls Stop', async () => {
    fake!.onCall = () => ({ result: ['ses_joined'] })
    const since = Date.now() - 65_000
    fake!.setProps({
      State: 'recording',
      SessionId: 'ses_joined',
      SessionTitle: 'Platform standup',
      SessionMeetingId: 'mtg_standup',
      ElapsedMs: 0,
      RunningSince: since,
      LastLine: 'The retry budget is three attempts.',
      LastSpeaker: 'them',
    })
    const ind = await until(async () => {
      const i = await indicator()
      return i?.icon === 'media-record-symbolic' && i
    }, 'recording indicator')
    expect(ind.styles).toContain('gnomeola-recording')
    expect(ind.label).toMatch(/^1:0\d$/)
    expect(ind.accessibleName).toMatch(/^kacola: recording Platform standup, 1:0\d$/)
    const keys = ind.items.map((i) => i.key)
    expect(keys.slice(0, 4)).toEqual(['session', 'last-line', 'pause', 'stop'])
    expect(ind.items[0]!.text).toMatch(/^Recording · Platform standup · 1:0\d$/)
    expect(ind.items[1]!.text).toBe('them: The retry budget is three attempts.')
    // the meeting being recorded no longer offers Join
    expect(ind.items.find((i) => i.key === 'meeting:mtg_standup')!.name).not.toMatch(/Join$/)
    // the clock ticks without any D-Bus traffic
    const first = ind.label
    const later = await until(
      async () => {
        const i = await indicator()
        return i && i.label !== first && i.label
      },
      'the elapsed time to tick',
      4000,
    )
    expect(later).toMatch(/^1:\d\d$/)
    await shellEval(d.env, `Main.panel.statusArea['${GNOMEOLA_UUID}'].menu.open(); true`)
    await d.screenshot(join(ARTIFACTS, 'shell-extension-recording.png'))
    await shellEval(d.env, `Main.panel.statusArea['${GNOMEOLA_UUID}'].menu.close(); true`)

    await shellEval(d.env, activate('pause'))
    await fake!.waitForCall('Pause')
    await shellEval(d.env, activate('stop'))
    expect((await fake!.waitForCall('Stop')).args).toEqual([])
  })

  it('renders paused with Resume, and Pause/Resume/Record now call the daemon', async () => {
    fake!.setProps({ State: 'paused', ElapsedMs: 125_000, RunningSince: 0 })
    const ind = await until(async () => {
      const i = await indicator()
      return i?.icon === 'media-playback-pause-symbolic' && i
    }, 'paused indicator')
    expect(ind.label).toBe('2:05')
    expect(ind.items.map((i) => i.key)).toContain('resume')
    await shellEval(d.env, activate('resume'))
    await fake!.waitForCall('Resume')

    fake!.setProps({ State: 'idle', SessionId: '', SessionTitle: '', LastLine: '', ElapsedMs: 0 })
    await until(async () => (await indicator())?.items[0]?.key === 'record', 'idle again')
    await shellEval(d.env, activate('record'))
    expect((await fake!.waitForCall('Start')).args).toEqual([''])
  })

  it('says why there are no meetings when the calendar is unavailable or off', async () => {
    fake!.setProps({
      CalendarState: 'unavailable',
      CalendarDetail: 'evolution-data-server is not running',
      UpcomingMeetings: [],
    })
    let ind = await until(async () => {
      const i = await indicator()
      return i?.items.some((x) => x.key === 'calendar-state') && i
    }, 'calendar state line')
    expect(ind.items.find((i) => i.key === 'calendar-state')!.text).toBe('Can’t read your calendar right now')
    fake!.setProps({ CalendarState: 'off' })
    ind = await until(async () => {
      const i = await indicator()
      return i?.items.find((x) => x.key === 'calendar-state')?.text === 'Calendar access is off' && i
    }, 'calendar off')
    fake!.setProps({ CalendarState: 'ok' })
    ind = await until(async () => {
      const i = await indicator()
      return i?.items.some((x) => x.key === 'no-meetings') && i
    }, 'no meetings')
    expect(ind.items.find((i) => i.key === 'no-meetings')!.text).toBe('No upcoming meetings')
  })

  it('is visible to assistive technology: the panel button and menu items by name', async () => {
    fake!.setProps({
      UpcomingMeetings: [
        {
          id: 'mtg_a11y',
          title: 'Accessibility sync',
          start: at(23, 58),
          end: at(23, 59),
          allDay: false,
          joinUrl: 'https://zoom.us/j/123',
          provider: 'zoom',
          calendar: 'Work',
          location: '',
          response: '',
        },
      ],
    })
    await shellEval(d.env, `Main.panel.statusArea['${GNOMEOLA_UUID}'].menu.open(); true`)
    const button = await d.findOne({ app: 'gnome-shell', name: 'kacola: not recording' }, 10_000)
    expect(button.role).toBe('menu')
    const item = await d.findOne({ app: 'gnome-shell', nameContains: 'Accessibility sync' }, 10_000)
    expect(item.role).toBe('menu item')
    expect(item.name).toMatch(/Zoom, Join$/)
    await d.findOne({ app: 'gnome-shell', role: 'menu item', name: 'Record now' })
    await d.screenshot(join(ARTIFACTS, 'shell-extension-menu.png'))
    await shellEval(d.env, `Main.panel.statusArea['${GNOMEOLA_UUID}'].menu.close(); true`)
  })

  it('shows a Join notification when a meeting is about to start', async () => {
    const now = Date.now()
    fake!.signal('MeetingStarting', [
      {
        id: 'mtg_soon',
        title: 'Starting soon',
        start: now + 60_000,
        end: now + 30 * 60_000,
        allDay: false,
        joinUrl: 'https://teams.microsoft.com/l/meetup-join/abc',
        provider: 'teams',
        calendar: 'Work',
        location: '',
        response: 'accepted',
      },
    ])
    const n = await until(
      () =>
        shellEval<{ title: string; body: string; actions: string[] } | null>(
          d.env,
          `(() => {
            const src = Main.messageTray.getSources().find((s) => s.title === 'kacola')
            const n = src?.notifications.at(-1)
            return n ? { title: n.title, body: n.body, actions: n.actions.map((a) => a.label) } : null
          })()`,
        ),
      'a notification',
    )
    expect(n.title).toBe('Starting soon')
    expect(n.body).toMatch(/\(in 1 min\) · Microsoft Teams$/)
    expect(n.actions).toEqual(['Join and record'])
  })

  it('goes back to "not running" when the daemon disappears', async () => {
    await fake!.stop()
    fake = null
    await until(async () => (await indicator())?.icon === 'microphone-disabled-symbolic', 'offline again')
  })

  it('disables cleanly: indicator gone, no errors', async () => {
    await shellEval(d.env, `Main.extensionManager.disableExtension('${GNOMEOLA_UUID}')`)
    await until(async () => (await indicator()) === null, 'indicator removed')
    const st = await extensionState(d.env, GNOMEOLA_UUID)
    expect(st?.error ?? null).toBeNull()
    await shellEval(d.env, `Main.extensionManager.enableExtension('${GNOMEOLA_UUID}')`)
    await until(indicator, 'indicator back after re-enable')
  })

  it('logged no JavaScript errors or warnings from the extension in the whole run', () => {
    const log = d.logs()['gnome-shell'] ?? ''
    expect(log.length, 'the Shell log was captured').toBeGreaterThan(0)
    const ours = log.split('\n').filter((l) => /gnomeola@gnomeola\.org|gnomeola:/.test(l))
    expect(ours.filter((l) => /error|warn|critical|exception/i.test(l))).toEqual([])
    expect(log).not.toMatch(/JS ERROR[^\n]*gnomeola/)
  })
})
