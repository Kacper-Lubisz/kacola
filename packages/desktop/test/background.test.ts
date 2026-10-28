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
import { type TrayModelInput, trayMenuModel, trayTitle, trayTooltip } from '../src/main/tray.ts'

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
  const labels = (i: Pick<TrayModelInput, 'daemon' | 'active' | 'calendarMissing'>) =>
    trayMenuModel({ meetings: null, now: 0, ...i }).map((x) =>
      x.type === 'separator'
        ? '—'
        : x.type === 'status'
          ? `[${x.label}]`
          : `${x.label}${x.enabled ? '' : ' (disabled)'}`,
    )

  it('idle: Record, Open, Quit', () => {
    expect(labels({ daemon: up, active: null })).toEqual([
      '[Not recording]',
      '—',
      'Record',
      '—',
      'Open kacola',
      'Quit kacola',
    ])
  })
  it('recording: Pause and Stop, the title in the status line; a private meeting stays private', () => {
    expect(labels({ daemon: up, active: { status: 'recording', title: 'Standup', private: false } })).toEqual(
      ['[Recording: Standup]', '—', 'Pause Recording', 'Stop Recording', '—', 'Open kacola', 'Quit kacola'],
    )
    expect(
      trayTooltip({
        daemon: up,
        active: { status: 'recording', title: 'Secret', private: true },
        meetings: null,
        now: 0,
      }),
    ).toBe('kacola — Recording: Private meeting')
  })
  it('paused: Resume and Stop', () => {
    expect(
      labels({ daemon: up, active: { status: 'paused', title: '', private: false } }).slice(0, 4),
    ).toEqual(['[Paused: Untitled meeting]', '—', 'Resume Recording', 'Stop Recording'])
  })
  it('without a daemon the recording actions are disabled; Open and Quit never are', () => {
    expect(labels({ daemon: { kind: 'starting' }, active: null })).toEqual([
      '[Starting…]',
      '—',
      'Record (disabled)',
      '—',
      'Open kacola',
      'Quit kacola',
    ])
    expect(labels({ daemon: { kind: 'unreachable', error: 'x' }, active: null })[0]).toBe(
      '[kacola is not reachable]',
    )
  })
  it('calendar access missing: offers setup’s Calendar step, recording or not', () => {
    expect(labels({ daemon: up, active: null, calendarMissing: true })).toEqual([
      '[Not recording]',
      '—',
      'Record',
      '—',
      'Allow Calendar Access…',
      '—',
      'Open kacola',
      'Quit kacola',
    ])
    expect(
      labels({
        daemon: up,
        active: { status: 'recording', title: 'Standup', private: false },
        calendarMissing: true,
      }),
    ).toContain('Allow Calendar Access…')
    expect(labels({ daemon: up, active: null, calendarMissing: false })).not.toContain(
      'Allow Calendar Access…',
    )
  })
})

describe('the macOS menu-bar title: the next meeting', () => {
  const up = { kind: 'spawned' as const, pid: 1 }
  // local wall-clock times, so the expectations hold in any time zone
  const at = (h: number, m = 0, day = 23) => new Date(2026, 9, day, h, m).getTime()
  const iso = (ms: number) => new Date(ms).toISOString()
  const meeting = (title: string, start: number, minutes = 30) => ({
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
  const statusLines = (i: TrayModelInput) =>
    trayMenuModel(i).flatMap((x) => (x.type === 'status' ? [x.label] : []))

  it('nothing when no meeting is left, or before the daemon answered', () => {
    expect(trayTitle(input(at(9), {}))).toBe('')
    expect(statusLines(input(at(9), {}))).toEqual(['Not recording'])
    expect(trayTitle(input(at(9), {}, { meetings: null }))).toBe('')
  })

  it('later today: the local start time and the title', () => {
    const i = input(at(9), { next: meeting('Standup', at(10, 30)) })
    expect(trayTitle(i)).toBe('10:30 Standup')
    expect(statusLines(i)).toEqual(['Not recording', 'Next: Standup at 10:30'])
  })

  it('within the hour: counts down in minutes (rounded up, so never "in 0 min")', () => {
    const next = meeting('Standup', at(10, 30))
    expect(trayTitle(input(at(10, 18), { next }))).toBe('Standup in 12 min')
    expect(statusLines(input(at(10, 18), { next }))[1]).toBe('Next: Standup in 12 min')
    expect(trayTitle(input(at(10, 29) + 30_000, { next }))).toBe('Standup in 1 min')
    expect(trayTitle(input(at(9, 31), { next }))).toBe('Standup in 59 min')
    expect(trayTitle(input(at(9, 30), { next }))).toBe('10:30 Standup')
  })

  it('in progress: "now:", also when the daemon still called it next', () => {
    const current = meeting('Standup', at(10, 30))
    expect(trayTitle(input(at(10, 40), { current, next: meeting('Planning', at(11)) }))).toBe('now: Standup')
    expect(statusLines(input(at(10, 40), { current }))[1]).toBe('Now: Standup (until 11:00)')
    expect(trayTitle(input(at(10, 31), { next: current }))).toBe('now: Standup')
    // it ended since the daemon answered: the next one, not a stale "now"
    expect(trayTitle(input(at(11, 5), { current, next: meeting('Planning', at(11, 30)) }))).toBe(
      'Planning in 25 min',
    )
  })

  it('a long title is cut with an ellipsis so the whole title stays within 22 characters', () => {
    const long = 'Quarterly business review with the leadership team'
    const later = trayTitle(input(at(9), { next: meeting(long, at(14)) }))
    expect(later).toBe('14:00 Quarterly busin…')
    const soon = trayTitle(input(at(13, 55), { next: meeting(long, at(14)) }))
    expect(soon).toBe('Quarterly bu… in 5 min')
    const now = trayTitle(input(at(14, 5), { current: meeting(long, at(14)) }))
    expect(now).toBe('now: Quarterly busine…')
    for (const t of [later, soon, now]) expect(t.length).toBeLessThanOrEqual(22)
    // an emoji is never split in half
    expect(trayTitle(input(at(9), { next: meeting('🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉', at(14)) }))).toBe(
      `14:00 ${'🎉'.repeat(15)}…`,
    )
    expect(trayTitle(input(at(9), { next: meeting('  ', at(10, 30)) }))).toBe('10:30 Untitled meeting')
  })

  it('a recording keeps the menu bar; the menu still says what is next', () => {
    const i = input(
      at(10, 18),
      { next: meeting('Standup', at(10, 30)) },
      { active: { status: 'recording', title: 'Prep', private: false } },
    )
    expect(trayTitle(i)).toBe('')
    expect(statusLines(i)).toEqual(['Recording: Prep', 'Next: Standup in 12 min'])
    expect(trayTitle({ ...i, active: { status: 'paused', title: 'Prep', private: false } })).toBe('')
  })

  it("tomorrow's meeting: nothing, unless it starts within the hour (just after midnight)", () => {
    const tomorrow = meeting('Standup', at(9, 0, 24))
    expect(trayTitle(input(at(16), { next: tomorrow }))).toBe('')
    expect(statusLines(input(at(16), { next: tomorrow }))).toEqual(['Not recording'])
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
