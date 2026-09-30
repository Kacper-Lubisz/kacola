import { homedir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { defaultDataDir, parseConfig, UsageError } from '../src/config.ts'

// P-2: one daemon config, three places it runs. A darwin daemon must never be configured to reach for
// pw-record, gjs, D-Bus or EDS; everything else stays as on Linux.

describe('platform config', () => {
  it('data dir per platform', () => {
    expect(defaultDataDir({}, 'linux')).toBe(`${homedir()}/.local/share/gnomeola`)
    expect(defaultDataDir({}, 'darwin')).toBe(`${homedir()}/Library/Application Support/gnomeola`)
    // inside the Flatpak sandbox
    expect(
      defaultDataDir(
        { FLATPAK_ID: 'org.gnome.Gnomeola', XDG_DATA_HOME: '/home/ana/.var/app/org.gnome.Gnomeola/data' },
        'linux',
      ),
    ).toBe('/home/ana/.var/app/org.gnome.Gnomeola/data/gnomeola')
    expect(defaultDataDir({ GNOMEOLA_DATA_DIR: '/x' }, 'darwin')).toBe('/x')
    expect(parseConfig([], {}, 'darwin').dataDir).toBe(`${homedir()}/Library/Application Support/gnomeola`)
  })

  it('Linux keeps PipeWire, EDS, D-Bus, the mic rule and libsecret', () => {
    expect(parseConfig([], {}, 'linux')).toMatchObject({
      platform: 'linux',
      capture: 'pipewire',
      calendar: { kind: 'eds' },
      dbus: true,
      micActivity: { kind: 'pipewire' },
      keyring: 'secret-tool',
    })
  })

  it('macOS: external capture, Keychain, and no Linux desktop integrations', () => {
    expect(parseConfig([], {}, 'darwin')).toMatchObject({
      platform: 'darwin',
      capture: 'external',
      calendar: { kind: 'off' },
      dbus: false,
      micActivity: { kind: 'off' },
      keyring: 'keychain',
    })
    for (const env of [
      { GNOMEOLA_CAPTURE: 'pipewire' },
      { GNOMEOLA_CALENDAR: 'eds' },
      { GNOMEOLA_DBUS: 'session' },
      { GNOMEOLA_MIC_ACTIVITY: 'pipewire' },
    ])
      expect(() => parseConfig([], env, 'darwin'), JSON.stringify(env)).toThrow(/not available on macOS/)
    // what does work there: an ICS calendar and the explicit keyrings
    expect(parseConfig([], { GNOMEOLA_CALENDAR: 'ics:/Users/ana/work.ics' }, 'darwin').calendar).toEqual({
      kind: 'ics',
      source: '/Users/ana/work.ics',
      me: [],
    })
    expect(parseConfig([], { GNOMEOLA_KEYRING: 'memory' }, 'darwin').keyring).toBe('memory')
  })

  it('external capture on Linux (how the macOS path is tested here) turns the mic rule off', () => {
    expect(parseConfig([], { GNOMEOLA_CAPTURE: 'external' }, 'linux')).toMatchObject({
      capture: 'external',
      micActivity: { kind: 'off' },
    })
    expect(() => parseConfig([], { GNOMEOLA_CAPTURE: 'coreaudio' }, 'linux')).toThrow(UsageError)
  })

  it('ICS calendars from a path or URL, with your addresses', () => {
    expect(
      parseConfig(
        [],
        {
          GNOMEOLA_CALENDAR: 'ics:https://calendar.example/u/basic.ics',
          GNOMEOLA_CALENDAR_ME: 'ana@x.org, a@y.org',
        },
        'linux',
      ).calendar,
    ).toEqual({ kind: 'ics', source: 'https://calendar.example/u/basic.ics', me: ['ana@x.org', 'a@y.org'] })
    expect(() => parseConfig([], { GNOMEOLA_CALENDAR: 'ics:' }, 'linux')).toThrow(UsageError)
  })

  it('keychain is a known keyring on Linux too (for tests with a fake security binary)', () => {
    expect(parseConfig([], { GNOMEOLA_KEYRING: 'keychain' }, 'linux').keyring).toBe('keychain')
  })
})
