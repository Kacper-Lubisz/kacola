import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { INTERFACE_XML } from '../../../extensions/gnomeola@gnomeola.org/dbus.js'
import {
  buildView,
  elapsedMs,
  formatClock,
  formatElapsed,
  formatRange,
  meetingNotification,
  providerLabel,
  startsIn,
  structureKey,
} from '../../../extensions/gnomeola@gnomeola.org/model.js'
import { DBUS_JS_PATH, renderDbusJs, XML_PATH } from '../../../scripts/extension-dbus.ts'

// C-5 … C-7, unit tier: the extension's whole decision logic (model.js has no gi:// imports) and the
// embedded copy of the D-Bus contract. The nested-Shell e2e proves the rendering; this proves the rules.

type Item = {
  key: string
  kind: string
  text?: string
  verb?: string
  detail?: string
  action?: unknown
  inProgress?: boolean
}
type View = {
  panel: { icon: string; label: string; styleClass: string; accessibleName: string }
  items: Item[]
}
const build = (props: object, o: object) => buildView(props, o as never) as unknown as View

const ROOT = join(import.meta.dirname, '..', '..', '..')
const prefs = { showElapsed: true, showLastLine: true }
const local = (h: number, m = 0, dayOffset = 0) => {
  const d = new Date(2026, 8, 29 + dayOffset, h, m, 0, 0)
  return d.getTime()
}
const NOW = local(10, 0)
const meeting = (o: Record<string, unknown> = {}) => ({
  id: 'mtg_1',
  title: 'Standup',
  start: local(10, 30),
  end: local(10, 45),
  allDay: false,
  joinUrl: 'https://meet.google.com/abc-defg-hij',
  provider: 'meet',
  calendar: 'Work',
  location: '',
  response: 'accepted',
  ...o,
})

describe('the embedded D-Bus contract', () => {
  it('is byte-identical to packages/daemon/dbus/org.gnome.Gnomeola.xml', () => {
    expect(INTERFACE_XML).toBe(readFileSync(XML_PATH, 'utf8'))
    expect(readFileSync(DBUS_JS_PATH, 'utf8')).toBe(renderDbusJs(readFileSync(XML_PATH, 'utf8')))
  })
  it('the --check mode of the generator agrees', () => {
    execFileSync(process.execPath, [join(ROOT, 'scripts', 'extension-dbus.ts'), '--check'])
  })
})

describe('time formatting', () => {
  it('elapsed = accumulated + running stretch, only while recording', () => {
    expect(elapsedMs({ State: 'recording', ElapsedMs: 5000, RunningSince: NOW - 60_000 }, NOW)).toBe(65_000)
    expect(elapsedMs({ State: 'paused', ElapsedMs: 5000, RunningSince: NOW - 60_000 }, NOW)).toBe(5000)
    expect(elapsedMs({ State: 'recording', ElapsedMs: 0, RunningSince: 0 }, NOW)).toBe(0)
    // a clock skew never shows negative time
    expect(elapsedMs({ State: 'recording', ElapsedMs: 0, RunningSince: NOW + 5000 }, NOW)).toBe(0)
  })
  it('m:ss and h:mm:ss', () => {
    expect(formatElapsed(0)).toBe('0:00')
    expect(formatElapsed(65_999)).toBe('1:05')
    expect(formatElapsed(3_600_000 + 61_000)).toBe('1:01:01')
  })
  it('24 h and 12 h clocks in local time', () => {
    expect(formatClock(local(9, 5))).toBe('09:05')
    expect(formatClock(local(9, 5), false)).toBe('9:05 AM')
    expect(formatClock(local(0, 7), false)).toBe('12:07 AM')
    expect(formatClock(local(13, 0), false)).toBe('1:00 PM')
  })
  it('ranges say Tomorrow for the next local day', () => {
    expect(formatRange(meeting(), NOW)).toBe('10:30–10:45')
    expect(formatRange(meeting({ start: local(9, 0, 1), end: local(9, 30, 1) }), NOW)).toBe(
      'Tomorrow 09:00–09:30',
    )
  })
  it('startsIn', () => {
    expect(startsIn(meeting({ start: NOW - 1 }), NOW)).toBe('now')
    expect(startsIn(meeting({ start: NOW + 30_001 }), NOW)).toBe('in 1 min')
    expect(startsIn(meeting({ start: NOW + 80 * 60_000 }), NOW)).toBe('in 1 h 20 min')
    expect(startsIn(meeting({ start: NOW + 120 * 60_000 }), NOW)).toBe('in 2 h')
  })
  it('provider labels', () => {
    expect(providerLabel('teams')).toBe('Microsoft Teams')
    expect(providerLabel('other')).toBe('Video call')
    expect(providerLabel('')).toBe('')
  })
})

describe('buildView', () => {
  it('daemon absent: only the offline line and the app entries', () => {
    const v = build({ State: 'recording' }, { daemon: false, now: NOW, prefs })
    expect(v.panel).toMatchObject({ icon: 'microphone-disabled-symbolic', label: '' })
    expect(v.items.map((i: { key: string }) => i.key)).toEqual(['offline', 'separator-app', 'open', 'prefs'])
  })

  it('idle: Record now, meetings with Join/Record, calendar ok', () => {
    const v = build(
      {
        State: 'idle',
        CalendarState: 'ok',
        UpcomingMeetings: [meeting(), meeting({ id: 'mtg_2', title: 'Offsite', joinUrl: '', provider: '' })],
      },
      { daemon: true, now: NOW, prefs },
    )
    expect(v.panel.icon).toBe('audio-input-microphone-symbolic')
    expect(v.panel.accessibleName).toBe('kacola: not recording')
    const m = v.items.filter((i: { kind: string }) => i.kind === 'meeting')
    expect(m.map((i) => i.verb)).toEqual(['Join', 'Record'])
    expect(m[0]!.action).toEqual({
      type: 'join',
      meetingId: 'mtg_1',
      joinUrl: 'https://meet.google.com/abc-defg-hij',
    })
    expect(m[1]!.action).toEqual({ type: 'join', meetingId: 'mtg_2', joinUrl: '' })
    expect(m[0]!.text).toBe('Standup')
    expect(m[0]!.detail).toBe('10:30–10:45 · Google Meet')
    expect(m[1]!.detail).not.toMatch(/·\s*$/) // no app: no dangling separator
  })

  it('an in-progress current meeting leads even if the list does not carry it', () => {
    const cur = meeting({ id: 'mtg_now', title: 'Now thing', start: NOW - 60_000, end: NOW + 60_000 })
    const v = build(
      { State: 'idle', CalendarState: 'ok', CurrentMeeting: cur, UpcomingMeetings: [meeting()] },
      { daemon: true, now: NOW, prefs },
    )
    const m = v.items.filter((i: { kind: string }) => i.kind === 'meeting')
    expect(m.map((i: { key: string }) => i.key)).toEqual(['meeting:mtg_now', 'meeting:mtg_1'])
    expect(m[0]!.text).toBe('Now thing')
    expect(m[0]!.detail).toMatch(/^Now · /)
    expect(m[0]!.inProgress).toBe(true)
  })

  it('empty dicts are "no meeting"', () => {
    const v = build(
      { State: 'idle', CalendarState: 'ok', CurrentMeeting: {}, UpcomingMeetings: [{}] },
      { daemon: true, now: NOW, prefs },
    )
    expect(v.items.some((i: { key: string }) => i.key === 'no-meetings')).toBe(true)
  })

  it('recording: elapsed in the panel, last line, Pause and Stop; prefs hide them', () => {
    const props = {
      State: 'recording',
      SessionTitle: 'Standup',
      SessionMeetingId: 'mtg_1',
      ElapsedMs: 0,
      RunningSince: NOW - 61_000,
      LastLine: 'hello',
      LastSpeaker: 'me',
      CalendarState: 'ok',
      UpcomingMeetings: [meeting()],
    }
    const v = build(props, { daemon: true, now: NOW, prefs })
    expect(v.panel).toMatchObject({
      icon: 'media-record-symbolic',
      label: '1:01',
      styleClass: 'gnomeola-recording',
    })
    expect(v.items.slice(0, 4).map((i: { key: string }) => i.key)).toEqual([
      'session',
      'last-line',
      'pause',
      'stop',
    ])
    expect(v.items[1]!.text).toBe('me: hello')
    // the meeting being recorded does not offer Join
    expect(v.items.find((i: { key: string }) => i.key === 'meeting:mtg_1')!.verb).toBe('')
    // …decided by the meeting id, never by a title that merely matches
    const other = build(
      { ...props, SessionMeetingId: 'mtg_other' },
      { daemon: true, now: NOW, prefs },
    ).items.find((i) => i.key === 'meeting:mtg_1')
    expect(other!.verb).toBe('Join')
    const hidden = build(props, {
      daemon: true,
      now: NOW,
      prefs: { showElapsed: false, showLastLine: false },
    })
    expect(hidden.panel.label).toBe('')
    expect(hidden.items.some((i: { key: string }) => i.key === 'last-line')).toBe(false)
  })

  it('paused: Resume instead of Pause, frozen elapsed', () => {
    const v = build(
      { State: 'paused', SessionTitle: '', ElapsedMs: 125_000, RunningSince: 0 },
      { daemon: true, now: NOW, prefs },
    )
    expect(v.panel.label).toBe('2:05')
    expect(v.panel.accessibleName).toBe('kacola: paused Untitled meeting, 2:05')
    expect(v.items.map((i: { key: string }) => i.key)).toContain('resume')
    expect(v.items.map((i: { key: string }) => i.key)).not.toContain('pause')
  })

  it('calendar states', () => {
    const text = (props: Record<string, unknown>) =>
      build({ State: 'idle', ...props }, { daemon: true, now: NOW, prefs }).items.find(
        (i: { key: string }) => i.key === 'calendar-state',
      )?.text
    expect(text({ CalendarState: 'off' })).toBe('Calendar access is off')
    // the daemon's detail is for logs: the menu says it plainly either way
    expect(text({ CalendarState: 'unavailable', CalendarDetail: 'no EDS' })).toBe(
      'Can’t read your calendar right now',
    )
    expect(text({ CalendarState: 'unavailable' })).toBe('Can’t read your calendar right now')
    expect(text({ CalendarState: 'starting' })).toBe('Reading calendars…')
    expect(text({ CalendarState: 'ok' })).toBeUndefined()
  })

  it('the structure key ignores the ticking clock but not the menu shape', () => {
    const props = { State: 'recording', SessionTitle: 'x', RunningSince: NOW - 1000, CalendarState: 'ok' }
    const a = build(props, { daemon: true, now: NOW, prefs })
    const b = build(props, { daemon: true, now: NOW + 5000, prefs })
    expect(structureKey(a)).toBe(structureKey(b))
    const c = build({ ...props, State: 'paused' }, { daemon: true, now: NOW, prefs })
    expect(structureKey(a)).not.toBe(structureKey(c))
  })

  it('translates through the gettext it is given', () => {
    const v = build(
      { State: 'idle', CalendarState: 'ok' },
      { daemon: true, now: NOW, prefs, _: (s: string) => `«${s}»` },
    )
    expect(v.items[0]!.text).toBe('«Record now»')
  })
})

describe('meetingNotification', () => {
  it('offers Join and record for a linked meeting, Record otherwise, nothing for an empty dict', () => {
    expect(meetingNotification(meeting({ start: NOW + 60_000 }), NOW)).toEqual({
      title: 'Standup',
      body: '10:01–10:45 (in 1 min) · Google Meet',
      actionLabel: 'Join and record',
      meetingId: 'mtg_1',
      joinUrl: 'https://meet.google.com/abc-defg-hij',
    })
    expect(meetingNotification(meeting({ joinUrl: '', provider: '' }), NOW)?.actionLabel).toBe('Record')
    expect(meetingNotification({}, NOW)).toBeNull()
  })
})
