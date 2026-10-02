import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { Atlas, SHOTS, type Theme, writeCropped } from '@gnomeola/testkit/atlas'
import {
  extensionState,
  type FakeGnomeola,
  GNOMEOLA_EXTENSION,
  GNOMEOLA_UUID,
  shellEval,
  startFakeGnomeola,
  UNSAFE_MODE_EXTENSION,
} from '@gnomeola/testkit/shell'
import { type HeadlessDisplay, startHeadlessDisplay } from '@gnomeola/testkit/ui'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// The screen atlas, top-bar part: the REAL extension in a throwaway nested GNOME Shell 50 (the
// shell-extension e2e's harness: private buses and HOME, a test companion that unlocks Eval in that
// Shell only), fed by the scriptable org.gnome.Gnomeola service. Each state is asserted from the
// indicator's actual actors (icon, accessible name, menu item keys) before the Shell screenshots the
// screen; the shot is cropped to the indicator and its open menu (or the notification banner), in the
// Shell's light and dark styles. Times are pinned so the pictures do not move: meetings are tomorrow
// (the menu shows "Tomorrow 09:30–09:45"), the recording's elapsed time is a fixed ElapsedMs with no
// running stretch, and the starting-soon notification is for a meeting already under way ("now").

const UNSAFE_UUID = 'unsafe-mode@gnomeola.test'

type Indicator = { accessibleName: string; icon: string; label: string; keys: string[] }
const DESCRIBE = `(() => {
  const b = Main.panel.statusArea['${GNOMEOLA_UUID}']
  if (!b) return null
  return {
    accessibleName: b.accessible_name,
    icon: b._icon.icon_name,
    label: b._label.visible ? b._label.text : '',
    keys: b.menu._getMenuItems().map((i) => i._gnomeolaKey ?? ''),
  }
})()`
/** The union of the indicator button and its menu (when open), in screen pixels. */
const BOUNDS = `(() => {
  const b = Main.panel.statusArea['${GNOMEOLA_UUID}']
  const box = (a) => { const [x, y] = a.get_transformed_position(); const [w, h] = a.get_transformed_size(); return [x, y, x + w, y + h] }
  const r = [box(b)]
  if (b.menu.isOpen) r.push(box(b.menu.actor))
  return [Math.min(...r.map((q) => q[0])), Math.min(...r.map((q) => q[1])), Math.max(...r.map((q) => q[2])), Math.max(...r.map((q) => q[3]))].map(Math.round)
})()`
const BANNER_BOUNDS = `(() => {
  const a = Main.messageTray._bannerBin
  const [x, y] = a.get_transformed_position(); const [w, h] = a.get_transformed_size()
  return [x, y, x + w, y + h].map(Math.round)
})()`
const setScheme = (scheme: Theme) =>
  `(() => { const s = new imports.gi.Gio.Settings({ schema_id: 'org.gnome.desktop.interface' }); s.set_string('color-scheme', ${JSON.stringify(scheme === 'dark' ? 'prefer-dark' : 'prefer-light')}); return true })()`

const tomorrowAt = (h: number, m = 0) => {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  d.setHours(h, m, 0, 0)
  return d.getTime()
}
const todayAt = (h: number, m = 0) => {
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return d.getTime()
}
const MEETINGS = [
  {
    id: 'mtg_standup',
    title: 'Platform standup',
    start: tomorrowAt(9, 30),
    end: tomorrowAt(9, 45),
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
    start: tomorrowAt(14),
    end: tomorrowAt(14, 45),
    allDay: false,
    joinUrl: 'https://zoom.us/j/123456789',
    provider: 'zoom',
    calendar: 'Work',
    location: '',
    response: 'accepted',
  },
  {
    id: 'mtg_1on1',
    title: '1:1 with Ana',
    start: tomorrowAt(16),
    end: tomorrowAt(16, 30),
    allDay: false,
    joinUrl: '',
    provider: '',
    calendar: 'Work',
    location: 'Room 4',
    response: '',
  },
]

describe('atlas: the top-bar extension in a nested GNOME Shell', () => {
  let d: HeadlessDisplay
  let fake: FakeGnomeola | null = null
  let atlas: Atlas
  const indicator = () => shellEval<Indicator | null>(d.env, DESCRIBE)
  const until = <T>(probe: () => Promise<T | null | undefined | false>, what: string, ms = 10_000) =>
    d.waitFor(probe, ms, what)
  const menu = (open: boolean) =>
    shellEval(d.env, `Main.panel.statusArea['${GNOMEOLA_UUID}'].menu.${open ? 'open' : 'close'}(false); true`)

  /** Screenshot the screen in each Shell style and crop to `bounds` (+ padding). */
  async function shoot(id: string, bounds: string, pad = 16): Promise<void> {
    const files: { file: string; theme: Theme; width: number }[] = []
    for (const theme of ['light', 'dark'] as const) {
      await shellEval(d.env, setScheme(theme))
      await new Promise((r) => setTimeout(r, 700)) // the Shell restyles on the next frames
      const [x0, y0, x1, y1] = await shellEval<number[]>(d.env, bounds)
      const x = Math.max(0, x0! - pad)
      const y = Math.max(0, y0! - (y0 === 0 ? 0 : pad))
      const w = Math.min(1280, x1! + pad) - x
      const h = Math.min(800, y1! + pad) - y
      const raw = join(SHOTS, `${id}__${theme}__raw.png`)
      await d.screenshot(raw)
      const file = `${id}__${theme}__1280.png`
      writeCropped(raw, file, [x, y, w, h])
      files.push({ file, theme, width: 1280 })
    }
    atlas.record(id, files)
  }

  beforeAll(async () => {
    atlas = new Atlas('shell', async () => {})
    mkdirSync(SHOTS, { recursive: true })
    d = await startHeadlessDisplay({
      size: '1280x800',
      extensions: [UNSAFE_MODE_EXTENSION, GNOMEOLA_EXTENSION],
    })
    await until(async () => (await extensionState(d.env, UNSAFE_UUID))?.state === 1, 'unsafe mode')
    await until(async () => (await extensionState(d.env, GNOMEOLA_UUID))?.stateName === 'active', 'extension')
    // the throwaway Shell starts with notification banners off ("do not disturb"); the atlas wants to see one
    await shellEval(
      d.env,
      `(() => { new imports.gi.Gio.Settings({ schema_id: 'org.gnome.desktop.notifications' }).set_boolean('show-banners', true); return true })()`,
    )
  }, 120_000)

  afterAll(async () => {
    await fake?.stop()
    await d?.close()
  })

  it('not running', async () => {
    await until(async () => (await indicator())?.icon === 'microphone-disabled-symbolic', 'offline')
    await menu(true)
    expect((await indicator())!.keys).toEqual(['offline', 'separator-app', 'open', 'prefs'])
    await shoot('daemon-down__topbar__not-running', BOUNDS)
    await menu(false)
  })

  it('idle: Record now and the upcoming meetings with Join; no meetings', async () => {
    fake = await startFakeGnomeola(d.env)
    fake.setProps({ State: 'idle', CalendarState: 'ok', UpcomingMeetings: MEETINGS })
    const ind = await until(async () => {
      const i = await indicator()
      return i?.keys.includes('meeting:mtg_1on1') && i
    }, 'meetings in the menu')
    expect(ind.accessibleName).toBe('kacola: not recording')
    await menu(true)
    await shoot('topbar-join__idle__upcoming-meetings', BOUNDS)
    await menu(false)
    fake.setProps({ UpcomingMeetings: [] })
    await until(async () => (await indicator())?.keys.includes('no-meetings'), 'no meetings')
    await menu(true)
    await shoot('topbar-join__idle__no-meetings', BOUNDS)
    await menu(false)
  })

  it('calendar unavailable, calendar off', async () => {
    fake!.setProps({ CalendarState: 'unavailable', CalendarDetail: 'evolution-data-server is not running' })
    await until(async () => (await indicator())?.keys.includes('calendar-state'), 'calendar state')
    await menu(true)
    await shoot('calendar-offline__topbar__unavailable', BOUNDS)
    await menu(false)
    fake!.setProps({ CalendarState: 'off' })
    await new Promise((r) => setTimeout(r, 500))
    expect((await indicator())!.keys).toContain('calendar-state')
    await menu(true)
    await shoot('calendar-offline__topbar__off', BOUNDS)
    await menu(false)
    fake!.setProps({ CalendarState: 'ok', CalendarDetail: '', UpcomingMeetings: MEETINGS })
  })

  it('a meeting is starting: the Join and record notification', async () => {
    fake!.signal('MeetingStarting', [
      {
        ...MEETINGS[1],
        id: 'mtg_now',
        title: 'Design review',
        // under way since the start of the day: the body reads "00:05–23:55 (now)" whenever this runs
        start: todayAt(0, 5),
        end: todayAt(23, 55),
      },
    ])
    const n = await until(
      () =>
        shellEval<{ title: string; actions: string[] } | null>(
          d.env,
          `(() => { const s = Main.messageTray.getSources().find((x) => x.title === 'kacola'); const n = s?.notifications.at(-1); return n ? { title: n.title, actions: n.actions.map((a) => a.label) } : null })()`,
        ),
      'a notification',
    )
    expect(n.actions).toEqual(['Join and record'])
    await until(
      () =>
        shellEval<boolean>(
          d.env,
          'Main.messageTray._bannerBin.get_n_children() > 0 && Main.messageTray._bannerBin.visible',
        ),
      'the banner on screen',
    )
    // expanded, as on hover: the "Join and record" action shows
    await shellEval(d.env, 'Main.messageTray._banner?.expand?.(false); true')
    await new Promise((r) => setTimeout(r, 800))
    await shoot('topbar-join__starting__notification', BANNER_BOUNDS, 8)
    await shellEval(
      d.env,
      `Main.messageTray.getSources().filter((x) => x.title === 'kacola').forEach((s) => s.destroy()); true`,
    )
  })

  it('recording and paused (joined from the top bar), and a private meeting', async () => {
    fake!.setProps({
      State: 'recording',
      SessionId: 'ses_joined',
      SessionTitle: 'Platform standup',
      SessionMeetingId: 'mtg_standup',
      ElapsedMs: 754_000,
      RunningSince: 0,
      LastLine: 'The retry budget is three attempts, then dead-letter.',
      LastSpeaker: 'Ana',
    })
    const rec = await until(async () => {
      const i = await indicator()
      return i?.icon === 'media-record-symbolic' && i
    }, 'recording')
    expect(rec.label).toBe('12:34')
    expect(rec.keys.slice(0, 4)).toEqual(['session', 'last-line', 'pause', 'stop'])
    await menu(true)
    await shoot('topbar-join__recording__indicator', BOUNDS)
    await menu(false)
    fake!.setProps({ State: 'paused' })
    const paused = await until(async () => {
      const i = await indicator()
      return i?.icon === 'media-playback-pause-symbolic' && i
    }, 'paused')
    expect(paused.keys).toContain('resume')
    await menu(true)
    await shoot('topbar-join__paused__indicator', BOUNDS)
    await menu(false)
    // what the bridge publishes for a private session: recording, but no title, line or meeting
    fake!.setProps({
      State: 'recording',
      SessionTitle: 'Private meeting',
      SessionMeetingId: '',
      LastLine: '',
      LastSpeaker: '',
      ElapsedMs: 312_000,
    })
    await until(
      async () => (await indicator())?.accessibleName === 'kacola: recording Private meeting, 5:12',
      'private',
    )
    await menu(true)
    await shoot('private-session__topbar__private-meeting', BOUNDS)
    await menu(false)
  })

  it('captured every built top-bar state', () => {
    expect(atlas.finish()).toEqual([])
    const unstable = atlas.unstable()
    if (unstable.length) console.warn(`atlas: differs from the previous run:\n  ${unstable.join('\n  ')}`)
    if (process.env.GNOMEOLA_ATLAS_STRICT === '1') expect(unstable).toEqual([])
  })
})
