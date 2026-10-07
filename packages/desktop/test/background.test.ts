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
import { trayMenuModel, trayTooltip } from '../src/main/tray.ts'

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
  const labels = (i: Parameters<typeof trayMenuModel>[0]) =>
    trayMenuModel(i).map((x) =>
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
    expect(trayTooltip({ daemon: up, active: { status: 'recording', title: 'Secret', private: true } })).toBe(
      'kacola — Recording: Private meeting',
    )
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
})
