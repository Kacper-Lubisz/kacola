import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  autostartEntry,
  autostartPath,
  autostartStatus,
  backgroundRequestOptions,
  execArg,
  migrateLegacyAutostart,
  setAutostart,
} from '../src/main/autostart.ts'
import {
  type TrayMeeting,
  type TrayModelInput,
  trayMenuModel,
  trayTitle,
  trayTooltip,
} from '../src/main/tray.ts'

// Background mode (autostart / Background portal, the macOS Tray menu). The packaged app runs them for
// real in desktop-packaged.e2e and flatpak.e2e. (The top-bar extension: packages/e2e/test/extension-setup.)

const tmp = () => mkdtempSync(join(tmpdir(), 'kacola-bg-'))

describe('autostart', () => {
  it('writes an XDG autostart entry that starts this binary in the background, and removes only ours', async () => {
    const cfg = tmp()
    const d = { env: { XDG_CONFIG_HOME: cfg }, exec: ['/opt/kacola app/kacola', '--background'] }
    expect(autostartStatus(d)).toEqual({ enabled: false })
    expect(await setAutostart(d, true)).toEqual({ enabled: true })
    const text = readFileSync(join(cfg, 'autostart', 'com.kacperlubisz.Kacola.desktop'), 'utf8')
    expect(text).toContain('Exec="/opt/kacola app/kacola" --background')
    expect(text).toContain('X-GNOME-Autostart-enabled=true')
    expect(await setAutostart(d, false)).toEqual({ enabled: false })
    expect(existsSync(autostartPath(d.env))).toBe(false)
    // somebody else's entry of the same name is never removed
    mkdirSync(join(cfg, 'autostart'), { recursive: true })
    writeFileSync(autostartPath(d.env), '[Desktop Entry]\nExec=something-else\n')
    expect(await setAutostart(d, false)).toEqual({ enabled: false })
    expect(existsSync(autostartPath(d.env))).toBe(true)
  })

  it('replaces the entry a gnomeola window wrote (its binary is gone after the upgrade), and only that', () => {
    const cfg = tmp()
    const d = { env: { XDG_CONFIG_HOME: cfg }, exec: ['/opt/kacola/kacola', '--background'] }
    const legacy = join(cfg, 'autostart', 'org.gnome.Gnomeola.desktop')
    mkdirSync(join(cfg, 'autostart'), { recursive: true })
    writeFileSync(legacy, '[Desktop Entry]\nExec=/old/gnomeola --background\nX-Gnomeola-Autostart=1\n')
    expect(migrateLegacyAutostart(d)).toBe(true)
    expect(existsSync(legacy)).toBe(false)
    expect(autostartStatus(d)).toEqual({ enabled: true })
    expect(readFileSync(autostartPath(d.env), 'utf8')).toContain('Exec=/opt/kacola/kacola --background')
    expect(migrateLegacyAutostart(d)).toBe(false)
    // an entry of that name the old window did not write stays
    writeFileSync(legacy, '[Desktop Entry]\nExec=something-else\n')
    expect(migrateLegacyAutostart(d)).toBe(false)
    expect(existsSync(legacy)).toBe(true)
  })

  it('quotes Exec arguments per the Desktop Entry spec', () => {
    expect(execArg('/usr/bin/kacola')).toBe('/usr/bin/kacola')
    expect(execArg('/a b/"c"$')).toBe('"/a b/\\"c\\"\\$"')
    expect(autostartEntry(['/x', '--background'])).toMatch(/^Exec=\/x --background$/m)
  })

  it('in the Flatpak asks the Background portal (autostart + commandline) and remembers the choice', async () => {
    const cfg = tmp()
    const calls: string[][] = []
    const d = {
      env: { FLATPAK_ID: 'com.kacperlubisz.Kacola', XDG_CONFIG_HOME: cfg },
      exec: [],
      gdbus: async (a: string[]) => {
        calls.push(a)
        return "(objectpath '/org/freedesktop/portal/desktop/request/1_2/t',)"
      },
    }
    expect(await setAutostart(d, true)).toEqual({ enabled: true })
    expect(calls[0]!.slice(0, 9)).toEqual([
      'call',
      '--session',
      '--dest',
      'org.freedesktop.portal.Desktop',
      '--object-path',
      '/org/freedesktop/portal/desktop',
      '--method',
      'org.freedesktop.portal.Background.RequestBackground',
      '',
    ])
    expect(calls[0]![9]).toContain("'autostart': <true>")
    expect(calls[0]![9]).toContain("'commandline': <['kacola-app', '--background']>")
    expect(autostartStatus(d)).toEqual({ enabled: true })
    // nothing written to the (sandboxed) autostart dir: the portal owns the host entry
    expect(existsSync(autostartPath(d.env))).toBe(false)
  })

  it('escapes the portal options as GVariant text', () => {
    const o = backgroundRequestOptions({ autostart: false, reason: "it's", token: 't1' })
    expect(o).toContain("'reason': <'it\\'s'>")
    expect(o).toContain("'autostart': <false>")
  })
})

describe('the macOS Tray menu', () => {
  const up = { kind: 'spawned' as const, pid: 1 }
  // local wall-clock times, so the expectations hold in any time zone
  const at = (h: number, m = 0, day = 23) => new Date(2026, 9, day, h, m).getTime()
  const iso = (ms: number) => new Date(ms).toISOString()
  const meeting = (
    title: string,
    start: number,
    minutes = 30,
    o: Partial<TrayMeeting> = {},
  ): TrayMeeting => ({
    id: `mtg_${title}`,
    title,
    start: iso(start),
    end: iso(start + minutes * 60_000),
    join: null,
    response: 'accepted',
    ...o,
  })
  const zoom = { url: 'https://zoom.us/j/1', provider: 'zoom' as const }
  const recording = (o: Partial<NonNullable<TrayModelInput['active']>> = {}) => ({
    status: 'recording' as const,
    title: 'Standup',
    private: false,
    startedAt: iso(at(10, 3)),
    ...o,
  })
  const input = (o: Partial<TrayModelInput> = {}): TrayModelInput => ({
    daemon: up,
    active: null,
    meetings: null,
    now: at(10, 40),
    ...o,
  })
  /** A day: the calendar answered, with these meetings today and /meetings/next worked out from them. */
  const day = (now: number, list: TrayMeeting[], o: Partial<TrayModelInput> = {}) =>
    input({
      now,
      today: list,
      meetings: {
        current: list.find((m) => Date.parse(m.start) <= now && now < Date.parse(m.end)) ?? null,
        next: list.find((m) => Date.parse(m.start) > now) ?? null,
        calendar: { state: 'ok' },
      },
      ...o,
    })
  // `## Header`, `[status | sublabel]`, `Item (sublabel)`, `Meeting › (sublabel)`, ` (disabled)`
  const labels = (i: TrayModelInput) =>
    trayMenuModel(i).map((x) => {
      if (x.type === 'separator') return '—'
      if (x.type === 'header') return `## ${x.label}`
      if (x.type === 'status') return `[${x.label}${x.sublabel ? ` | ${x.sublabel}` : ''}]`
      const sub = x.sublabel ? ` (${x.sublabel})` : ''
      if (x.type === 'submenu') return `${x.label} ›${sub}`
      return `${x.label}${sub}${x.enabled ? '' : ' (disabled)'}`
    })
  const submenu = (i: TrayModelInput, title: string) => {
    const m = trayMenuModel(i).find((x) => x.type === 'submenu' && x.label === title)
    if (m?.type !== 'submenu') throw new Error(`no submenu ${title}`)
    return m.items.map((x) => (x.type === 'item' ? `${x.label} [${x.id} ${x.meetingId ?? '-'}]` : x.type))
  }

  it('before the calendar answered: Record, Open, Quit', () => {
    expect(labels(input())).toEqual(['Record', '—', 'Open kacola', 'Quit kacola'])
  })

  it('today: what is left of the day, with times, the link and how soon', () => {
    const i = day(at(10, 40), [
      meeting('Early', at(9), 30),
      meeting('Standup', at(10, 30), 30, { join: zoom }),
      meeting('Planning', at(11), 30, { join: { url: 'https://meet.google.com/x', provider: 'meet' } }),
      meeting('1:1', at(15), 45),
    ])
    expect(labels(i)).toEqual([
      '## Today',
      'Standup › (10:30–11:00 · Zoom · now · 20 min left)',
      'Planning › (11:00–11:30 · Google Meet · in 20 min)',
      '1:1 › (15:00–15:45)',
      '—',
      'Record',
      '—',
      'Open kacola',
      'Quit kacola',
    ])
  })

  it('a meeting with a link: Join & Record, Join Without Recording, Record Without Joining', () => {
    const i = day(at(10, 40), [meeting('Standup', at(10, 30), 30, { join: zoom })])
    expect(submenu(i, 'Standup')).toEqual([
      'Join & Record [join-record mtg_Standup]',
      'Join Without Recording [join mtg_Standup]',
      'Record Without Joining [record-meeting mtg_Standup]',
    ])
    expect(submenu(day(at(10, 40), [meeting('1:1', at(15))]), '1:1')).toEqual([
      'Record [record-meeting mtg_1:1]',
    ])
  })

  it('one line per occurrence: a meeting on two calendars shows once, the copy with a link', () => {
    const i = day(at(9), [
      meeting('All hands', at(9, 25), 15, { id: 'a', response: 'needs-action' }),
      meeting('All hands', at(9, 25), 15, { id: 'b', join: zoom }),
      meeting('Skipped', at(11), 30, { response: 'declined' }),
    ])
    expect(labels(i).filter((l) => l.includes('›'))).toEqual(['All hands › (09:25–09:40 · Zoom · in 25 min)'])
    expect(submenu(i, 'All hands')[0]).toBe('Join & Record [join-record b]')
  })

  it('nothing left today: says so', () => {
    expect(labels(day(at(17), [meeting('Standup', at(10, 30))])).slice(0, 2)).toEqual([
      '## Today',
      '[Nothing else today]',
    ])
  })

  it('auto-recording the meeting on now: says so, offers Discard; its agenda line says recording', () => {
    const standup = meeting('Standup', at(10, 30), 30, { join: zoom })
    const i = day(at(10, 40), [standup, meeting('Planning', at(11))], {
      active: recording({ meeting: { id: standup.id } }),
      activeAuto: true,
    })
    expect(labels(i)).toEqual([
      '## Recording',
      'Standup (Started automatically · until 11:00)',
      'Pause Recording',
      'Stop Recording',
      'Discard Recording…',
      '—',
      '## Today',
      'Standup › (10:30–11:00 · Zoom · recording)',
      'Planning › (11:00–11:30 · in 20 min)',
      '—',
      'Open kacola',
      'Quit kacola',
    ])
    expect(submenu(i, 'Standup')).toEqual([
      'Join Meeting [join mtg_Standup]',
      'Open Recording [open-recording -]',
    ])
    expect(trayMenuModel(i).find((x) => x.type === 'item' && x.id === 'discard')).toMatchObject({
      symbol: 'discard',
      enabled: true,
    })
  })

  it('recording by hand: since when', () => {
    expect(labels(input({ active: recording({ title: 'Prep' }) })).slice(0, 2)).toEqual([
      '## Recording',
      'Prep (Since 10:03)',
    ])
  })

  it('paused: Resume and Stop; a private meeting stays private', () => {
    expect(labels(input({ active: recording({ status: 'paused', title: '' }) })).slice(0, 4)).toEqual([
      '## Paused',
      'Untitled meeting (Since 10:03)',
      'Resume Recording',
      'Stop Recording',
    ])
    expect(trayTooltip(input({ active: recording({ title: 'Secret', private: true }) }))).toBe(
      'kacola — Recording: Private meeting',
    )
    expect(labels(input({ active: recording({ title: 'Secret', private: true }) }))[1]).toBe(
      'Private meeting (Since 10:03)',
    )
  })

  it('without a daemon the recording actions are disabled; Open and Quit never are', () => {
    expect(labels(input({ daemon: { kind: 'starting' } }))).toEqual([
      '[Starting…]',
      '—',
      'Record (disabled)',
      '—',
      'Open kacola',
      'Quit kacola',
    ])
    expect(labels(input({ daemon: { kind: 'unreachable', error: 'x' }, active: recording() }))).toContain(
      'Discard Recording… (disabled)',
    )
  })

  it('calendar access missing: offers setup’s Calendar step, recording or not', () => {
    expect(labels(input({ calendarMissing: true }))).toEqual([
      'Record',
      'Allow Calendar Access…',
      '—',
      'Open kacola',
      'Quit kacola',
    ])
    expect(labels(input({ active: recording(), calendarMissing: true }))).toContain('Allow Calendar Access…')
    expect(labels(input({ calendarMissing: false }))).not.toContain('Allow Calendar Access…')
  })
})

describe('the macOS menu-bar title: the meeting worth a glance', () => {
  const up = { kind: 'spawned' as const, pid: 1 }
  const at = (h: number, m = 0, day = 23) => new Date(2026, 9, day, h, m).getTime()
  const iso = (ms: number) => new Date(ms).toISOString()
  const meeting = (title: string, start: number, minutes = 30) => ({
    id: `mtg_${title}`,
    title,
    start: iso(start),
    end: iso(start + minutes * 60_000),
  })
  const input = (
    now: number,
    m: { current?: ReturnType<typeof meeting>; next?: ReturnType<typeof meeting> },
    o: Partial<TrayModelInput> = {},
  ): TrayModelInput => ({
    daemon: up,
    active: null,
    meetings: { current: m.current ?? null, next: m.next ?? null, calendar: { state: 'ok' } },
    now,
    ...o,
  })

  it('nothing when no meeting is left, or before the daemon answered', () => {
    expect(trayTitle(input(at(9), {}))).toBe('')
    expect(trayTitle(input(at(9), {}, { meetings: null }))).toBe('')
  })

  it('later today: the local start time and the title', () => {
    expect(trayTitle(input(at(9), { next: meeting('Standup', at(10, 30)) }))).toBe('10:30 Standup')
  })

  it('within the hour: counts down in minutes (rounded up, so never "in 0 min")', () => {
    const next = meeting('Standup', at(10, 30))
    expect(trayTitle(input(at(10, 18), { next }))).toBe('Standup in 12 min')
    expect(trayTitle(input(at(10, 29) + 30_000, { next }))).toBe('Standup in 1 min')
    expect(trayTitle(input(at(9, 31), { next }))).toBe('Standup in 59 min')
    expect(trayTitle(input(at(9, 30), { next }))).toBe('10:30 Standup')
  })

  it('in progress: "now:" and when it ends — minutes left, or the end time an hour or more out', () => {
    const current = meeting('Standup', at(10, 30))
    expect(trayTitle(input(at(10, 42), { current, next: meeting('Planning', at(11)) }))).toBe(
      'now: Standup · 18 min left',
    )
    expect(trayTitle(input(at(10, 31), { next: current }))).toBe('now: Standup · 29 min left')
    expect(trayTitle(input(at(13, 45), { current: meeting('Eng weekly', at(13, 45), 75) }))).toBe(
      'now: Eng weekly · until 15:00',
    )
    // it ended since the daemon answered: the next one, not a stale "now"
    expect(trayTitle(input(at(11, 5), { current, next: meeting('Planning', at(11, 30)) }))).toBe(
      'Planning in 25 min',
    )
  })

  it('a long title is cut to 24 characters with an ellipsis; the times always fit', () => {
    const long = 'Quarterly business review with the leadership team'
    expect(trayTitle(input(at(9), { next: meeting(long, at(14)) }))).toBe('14:00 Quarterly business revi…')
    expect(trayTitle(input(at(13, 55), { next: meeting(long, at(14)) }))).toBe(
      'Quarterly business revi… in 5 min',
    )
    expect(trayTitle(input(at(14, 5), { current: meeting(long, at(14)) }))).toBe(
      'now: Quarterly business revi… · 25 min left',
    )
    // an emoji is never split in half
    expect(trayTitle(input(at(9), { next: meeting('🎉'.repeat(30), at(14)) }))).toBe(
      `14:00 ${'🎉'.repeat(23)}…`,
    )
    expect(trayTitle(input(at(9), { next: meeting('  ', at(10, 30)) }))).toBe('10:30 Untitled meeting')
  })

  it('recording the meeting on now: "● now: … left", "‖" paused', () => {
    const current = meeting('Standup', at(10, 30))
    const active = {
      status: 'recording' as const,
      title: 'Standup',
      private: false,
      meeting: { id: current.id },
    }
    expect(trayTitle(input(at(10, 40), { current }, { active }))).toBe('● now: Standup · 20 min left')
    expect(trayTitle(input(at(10, 40), { current }, { active: { ...active, status: 'paused' } }))).toBe(
      '‖ now: Standup · 20 min left',
    )
    // it ran over: the meeting has ended, the recording goes on under its own title
    expect(trayTitle(input(at(11, 10), { current }, { active }))).toBe('● Standup')
  })

  it('any other recording: "●" and its own title, whatever is next', () => {
    const active = { status: 'recording' as const, title: 'Prep', private: false }
    expect(trayTitle(input(at(10, 18), { next: meeting('Standup', at(10, 30)) }, { active }))).toBe('● Prep')
    expect(trayTitle(input(at(10, 40), { current: meeting('Standup', at(10, 30)) }, { active }))).toBe(
      '● Prep',
    )
    expect(trayTitle(input(at(9), {}, { active: { ...active, private: true } }))).toBe('● Private meeting')
  })

  it("tomorrow's meeting: nothing, unless it starts within the hour (just after midnight)", () => {
    expect(trayTitle(input(at(16), { next: meeting('Standup', at(9, 0, 24)) }))).toBe('')
    expect(trayTitle(input(at(23, 50), { next: meeting('Late call', at(0, 15, 24)) }))).toBe(
      'Late call in 25 min',
    )
  })

  it('nothing while the calendar or the daemon is unavailable', () => {
    const next = meeting('Standup', at(10, 30))
    const i = input(at(9), { next })
    for (const state of ['off', 'starting', 'unavailable'] as const)
      expect(trayTitle({ ...i, meetings: { current: null, next, calendar: { state } } })).toBe('')
    expect(trayTitle({ ...i, daemon: { kind: 'unreachable', error: 'x' } })).toBe('')
    expect(trayTitle({ ...i, daemon: { kind: 'starting' } })).toBe('')
  })
})
