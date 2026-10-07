import { homedir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { defaultDataDir, parseConfig, UsageError } from '../src/config.ts'

// P-2: one daemon config, three places it runs. A darwin daemon must never be configured to reach for
// pw-record, gjs, D-Bus or EDS; everything else stays as on Linux.

describe('platform config', () => {
  it('data dir per platform', () => {
    expect(defaultDataDir({}, 'linux')).toBe(`${homedir()}/.local/share/kacola`)
    expect(defaultDataDir({}, 'darwin')).toBe(`${homedir()}/Library/Application Support/kacola`)
    // inside the Flatpak sandbox
    expect(
      defaultDataDir(
        {
          FLATPAK_ID: 'com.kacperlubisz.Kacola',
          XDG_DATA_HOME: '/home/ana/.var/app/com.kacperlubisz.Kacola/data',
        },
        'linux',
      ),
    ).toBe('/home/ana/.var/app/com.kacperlubisz.Kacola/data/kacola')
    expect(defaultDataDir({ KACOLA_DATA_DIR: '/x' }, 'darwin')).toBe('/x')
    expect(parseConfig([], {}, 'darwin').dataDir).toBe(`${homedir()}/Library/Application Support/kacola`)
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
      { KACOLA_CAPTURE: 'pipewire' },
      { KACOLA_CALENDAR: 'eds' },
      { KACOLA_DBUS: 'session' },
      { KACOLA_MIC_ACTIVITY: 'pipewire' },
    ])
      expect(() => parseConfig([], env, 'darwin'), JSON.stringify(env)).toThrow(/not available on macOS/)
    // what does work there: an ICS calendar and the explicit keyrings
    expect(parseConfig([], { KACOLA_CALENDAR: 'ics:/Users/ana/work.ics' }, 'darwin').calendar).toEqual({
      kind: 'ics',
      source: '/Users/ana/work.ics',
      me: [],
    })
    expect(parseConfig([], { KACOLA_KEYRING: 'memory' }, 'darwin').keyring).toBe('memory')
  })

  it('external capture on Linux (how the macOS path is tested here) turns the mic rule off', () => {
    expect(parseConfig([], { KACOLA_CAPTURE: 'external' }, 'linux')).toMatchObject({
      capture: 'external',
      micActivity: { kind: 'off' },
    })
    expect(() => parseConfig([], { KACOLA_CAPTURE: 'coreaudio' }, 'linux')).toThrow(UsageError)
  })

  it('ICS calendars from a path or URL, with your addresses', () => {
    expect(
      parseConfig(
        [],
        {
          KACOLA_CALENDAR: 'ics:https://calendar.example/u/basic.ics',
          KACOLA_CALENDAR_ME: 'ana@x.org, a@y.org',
        },
        'linux',
      ).calendar,
    ).toEqual({ kind: 'ics', source: 'https://calendar.example/u/basic.ics', me: ['ana@x.org', 'a@y.org'] })
    expect(() => parseConfig([], { KACOLA_CALENDAR: 'ics:' }, 'linux')).toThrow(UsageError)
  })

  it('keychain is a known keyring on Linux too (for tests with a fake security binary)', () => {
    expect(parseConfig([], { KACOLA_KEYRING: 'keychain' }, 'linux').keyring).toBe('keychain')
  })
})
