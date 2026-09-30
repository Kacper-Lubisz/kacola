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
  setAutostart,
} from '../src/main/autostart.ts'
import {
  EXTENSION_UUID,
  extensionSource,
  extensionStatus,
  extensionsDir,
  installExtension,
} from '../src/main/extension.ts'
import { trayMenuModel, trayTooltip } from '../src/main/tray.ts'

// Background mode (autostart / Background portal, the macOS Tray menu) and the top-bar extension install.
// The packaged app runs them for real in desktop-packaged.e2e and flatpak.e2e.

const tmp = () => mkdtempSync(join(tmpdir(), 'gnomeola-bg-'))
const REPO_EXT = join(import.meta.dirname, '..', '..', '..', 'extensions', EXTENSION_UUID)

describe('autostart', () => {
  it('writes an XDG autostart entry that starts this binary in the background, and removes only ours', async () => {
    const cfg = tmp()
    const d = { env: { XDG_CONFIG_HOME: cfg }, exec: ['/opt/gnomeola app/gnomeola', '--background'] }
    expect(autostartStatus(d)).toEqual({ enabled: false })
    expect(await setAutostart(d, true)).toEqual({ enabled: true })
    const text = readFileSync(join(cfg, 'autostart', 'org.gnome.Gnomeola.desktop'), 'utf8')
    expect(text).toContain('Exec="/opt/gnomeola app/gnomeola" --background')
    expect(text).toContain('X-GNOME-Autostart-enabled=true')
    expect(await setAutostart(d, false)).toEqual({ enabled: false })
    expect(existsSync(autostartPath(d.env))).toBe(false)
    // somebody else's entry of the same name is never removed
    mkdirSync(join(cfg, 'autostart'), { recursive: true })
    writeFileSync(autostartPath(d.env), '[Desktop Entry]\nExec=something-else\n')
    expect(await setAutostart(d, false)).toEqual({ enabled: false })
    expect(existsSync(autostartPath(d.env))).toBe(true)
  })

  it('quotes Exec arguments per the Desktop Entry spec', () => {
    expect(execArg('/usr/bin/gnomeola')).toBe('/usr/bin/gnomeola')
    expect(execArg('/a b/"c"$')).toBe('"/a b/\\"c\\"\\$"')
    expect(autostartEntry(['/x', '--background'])).toMatch(/^Exec=\/x --background$/m)
  })

  it('in the Flatpak asks the Background portal (autostart + commandline) and remembers the choice', async () => {
    const cfg = tmp()
    const calls: string[][] = []
    const d = {
      env: { FLATPAK_ID: 'org.gnome.Gnomeola', XDG_CONFIG_HOME: cfg },
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
    expect(calls[0]![9]).toContain("'commandline': <['gnomeola-app', '--background']>")
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
      'Open gnomeola',
      'Quit gnomeola',
    ])
  })
  it('recording: Pause and Stop, the title in the status line; a private meeting stays private', () => {
    expect(labels({ daemon: up, active: { status: 'recording', title: 'Standup', private: false } })).toEqual(
      [
        '[Recording: Standup]',
        '—',
        'Pause Recording',
        'Stop Recording',
        '—',
        'Open gnomeola',
        'Quit gnomeola',
      ],
    )
    expect(trayTooltip({ daemon: up, active: { status: 'recording', title: 'Secret', private: true } })).toBe(
      'gnomeola — Recording: Private meeting',
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
      'Open gnomeola',
      'Quit gnomeola',
    ])
    expect(labels({ daemon: { kind: 'unreachable', error: 'x' }, active: null })[0]).toBe(
      '[gnomeola is not reachable]',
    )
  })
})

describe('the top-bar extension install', () => {
  it('goes to the host’s extensions dir: XDG_DATA_HOME, but HOST_XDG_DATA_HOME / ~/.local/share in the Flatpak', () => {
    expect(extensionsDir({ HOME: '/h', XDG_DATA_HOME: '/d' })).toBe('/d/gnome-shell/extensions')
    expect(extensionsDir({ HOME: '/h' })).toBe('/h/.local/share/gnome-shell/extensions')
    expect(extensionsDir({ HOME: '/h', XDG_DATA_HOME: '/h/.var/app/x/data', FLATPAK_ID: 'x' })).toBe(
      '/h/.local/share/gnome-shell/extensions',
    )
    expect(extensionsDir({ HOME: '/h', FLATPAK_ID: 'x', HOST_XDG_DATA_HOME: '/hd' })).toBe(
      '/hd/gnome-shell/extensions',
    )
  })

  it('finds the packaged copy first, else the checkout’s', () => {
    const res = tmp()
    mkdirSync(join(res, 'extension', EXTENSION_UUID), { recursive: true })
    writeFileSync(join(res, 'extension', EXTENSION_UUID, 'metadata.json'), '{}')
    expect(extensionSource({ resourcesPath: res, appDir: '/nowhere' })).toBe(
      join(res, 'extension', EXTENSION_UUID),
    )
    expect(extensionSource({ appDir: join(import.meta.dirname, '..', 'out', 'main') })).toBe(
      join(import.meta.dirname, '..', '..', '..', 'extensions', EXTENSION_UUID),
    )
  })

  it('copies it (schema compiled), reports installed, and never touches the enabled list', () => {
    const data = tmp()
    const d = { platform: 'linux' as const, env: { HOME: data, XDG_DATA_HOME: data }, source: REPO_EXT }
    expect(extensionStatus(d)).toEqual({ state: 'not-installed' })
    expect(installExtension(d)).toEqual({ state: 'installed' })
    const dest = join(data, 'gnome-shell', 'extensions', EXTENSION_UUID)
    for (const f of ['metadata.json', 'extension.js', 'schemas/gschemas.compiled'])
      expect(existsSync(join(dest, f)), f).toBe(true)
    // an older copy is "not installed" (Install updates it)
    const meta = JSON.parse(readFileSync(join(dest, 'metadata.json'), 'utf8'))
    writeFileSync(join(dest, 'metadata.json'), JSON.stringify({ ...meta, 'version-name': '0.0.1' }))
    expect(extensionStatus(d)).toEqual({ state: 'not-installed' })
    expect(installExtension(d)).toEqual({ state: 'installed' })
  })

  it('is unsupported off Linux, unavailable without a copy in the build', () => {
    expect(extensionStatus({ platform: 'darwin', env: {}, source: REPO_EXT })).toEqual({
      state: 'unsupported',
    })
    expect(installExtension({ platform: 'linux', env: {}, source: null }).state).toBe('unavailable')
  })
})
