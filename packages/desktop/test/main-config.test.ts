import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { daemonEntry, readDesktopConfig, tokenFor } from '../src/main/config.ts'
import {
  initialUiState,
  loadCatalogue,
  preferredLanguages,
  readUiState,
  sanitizeUiState,
  writeUiState,
} from '../src/main/resources.ts'
import { parseAccent, parseSettingChanged, parseUint, themeFrom } from '../src/main/theme.ts'

const tmp = () => mkdtempSync(join(tmpdir(), 'gnomeola-desktop-'))

describe('config', () => {
  it('a packaged build spawns resources/runtime/daemon.mjs (scripts/build-desktop.ts puts it there)', () => {
    const res = tmp()
    mkdirSync(join(res, 'runtime'))
    writeFileSync(join(res, 'runtime', 'daemon.mjs'), '')
    expect(daemonEntry({}, { resourcesPath: res, appDir: '/nowhere' })).toBe(
      join(res, 'runtime', 'daemon.mjs'),
    )
    expect(daemonEntry({ GNOMEOLA_DAEMON_ENTRY: '/x.mjs' }, { resourcesPath: res, appDir: '/nowhere' })).toBe(
      '/x.mjs',
    )
  })

  it('defaults to the loopback daemon, and knows loopback from remote', () => {
    const c = readDesktopConfig({ HOME: tmp() }, ['electron', '.'], { appDir: '/nowhere' })
    expect(c).toMatchObject({ baseUrl: 'http://127.0.0.1:8787', loopback: true, background: false })
    expect(c.token).toBeUndefined()
    expect(readDesktopConfig({ GNOMEOLA_URL: 'https://g.example.com/' }, [], { appDir: '/x' })).toMatchObject(
      {
        baseUrl: 'https://g.example.com',
        loopback: false,
      },
    )
    expect(() => readDesktopConfig({ GNOMEOLA_URL: 'nope' }, [], { appDir: '/x' })).toThrow(/not a URL/)
  })

  it('--background, the daemon entry override and extra daemon args', () => {
    const c = readDesktopConfig(
      { GNOMEOLA_DAEMON_ENTRY: '/d/daemon.mjs', GNOMEOLA_DAEMON_ARGS: '["--data-dir","/x"]' },
      ['electron', '.', '--background'],
      { appDir: '/x' },
    )
    expect(c).toMatchObject({
      background: true,
      daemonEntry: '/d/daemon.mjs',
      daemonArgs: ['--data-dir', '/x'],
    })
    expect(() => readDesktopConfig({ GNOMEOLA_DAEMON_ARGS: '"x"' }, [], { appDir: '/x' })).toThrow()
  })

  it('finds the M8 token in env, else hosts.json for that URL', () => {
    const home = tmp()
    mkdirSync(join(home, '.config', 'gnomeola'), { recursive: true })
    writeFileSync(
      join(home, '.config', 'gnomeola', 'hosts.json'),
      JSON.stringify({ 'https://g.example.com': { token: 'tok-from-pair' } }),
    )
    expect(tokenFor({ HOME: home }, 'https://g.example.com/')).toBe('tok-from-pair')
    expect(tokenFor({ HOME: home }, 'https://other.example.com')).toBeUndefined()
    expect(tokenFor({ HOME: home, GNOMEOLA_TOKEN: 'env' }, 'https://g.example.com')).toBe('env')
  })
})

describe('ui-state', () => {
  it('round-trips atomically and reduces untrusted input to the schema', () => {
    const p = join(tmp(), 'nested', 'ui-state.json')
    expect(readUiState(p)).toEqual(initialUiState)
    writeUiState(p, { version: 1, onboardingDone: true, skippedMissing: ['m1'] })
    expect(readUiState(p)).toEqual({ version: 1, onboardingDone: true, skippedMissing: ['m1'] })
    expect(sanitizeUiState({ onboardingDone: 'yes', skippedMissing: [1, 'a'], evil: true })).toEqual({
      version: 1,
      onboardingDone: false,
      skippedMissing: ['a'],
    })
    writeFileSync(p, '{corrupt')
    expect(readUiState(p)).toEqual(initialUiState)
    expect(readFileSync(p, 'utf8')).toBe('{corrupt')
  })
})

describe('catalogues', () => {
  it('picks the first preferred language with a catalogue, English otherwise', () => {
    const dir = tmp()
    writeFileSync(join(dir, 'de.json'), JSON.stringify({ Sessions: 'Sitzungen' }))
    expect(loadCatalogue(dir, ['fr_FR', 'de_DE'])).toEqual({
      locale: 'de',
      messages: { Sessions: 'Sitzungen' },
    })
    expect(loadCatalogue(dir, ['fr'])).toEqual({ locale: 'en', messages: {} })
    expect(loadCatalogue(dir, ['../../etc/passwd'])).toEqual({ locale: 'en', messages: {} })
  })
  it('orders LANGUAGE, then the POSIX locale, then the system list', () => {
    expect(preferredLanguages({ LANGUAGE: 'de:fr', LANG: 'es_ES.UTF-8' }, ['en-US'])).toEqual([
      'de',
      'fr',
      'es_ES',
      'en-US',
    ])
    expect(preferredLanguages({ LANG: 'C.UTF-8' }, ['en-US'])).toEqual(['en-US'])
  })
})

describe('portal theme', () => {
  it('parses gdbus output', () => {
    expect(parseUint('(<uint32 1>,)\n')).toBe(1)
    expect(parseUint('garbage')).toBeNull()
    expect(parseAccent('(<(0.20784313725490197, 0.51764705882352946, 0.89411764705882357)>,)')).toBe(
      '#3584e4',
    )
    expect(parseAccent('(<(-1.0, -1.0, -1.0)>,)')).toBeNull()
    expect(
      parseSettingChanged(
        "/org/freedesktop/portal/desktop: org.freedesktop.portal.Settings.SettingChanged ('org.freedesktop.appearance', 'color-scheme', <uint32 1>)",
      ),
    ).toEqual({ key: 'color-scheme', value: '<uint32 1>' })
    expect(
      parseSettingChanged("SettingChanged ('org.gnome.desktop.interface', 'gtk-theme', <'x'>)"),
    ).toBeNull()
  })
  it('maps portal values, falls back to the system, and honours test overrides', () => {
    const none = { colorScheme: null, contrast: null, accent: null }
    expect(themeFrom({ colorScheme: 1, contrast: 0, accent: '#3584e4' }, false, {})).toEqual({
      scheme: 'dark',
      contrast: 'normal',
      accent: '#3584e4',
    })
    expect(themeFrom({ ...none, colorScheme: 2 }, true, {}).scheme).toBe('light')
    expect(themeFrom({ ...none, colorScheme: 0 }, true, {}).scheme).toBe('dark') // no preference → system
    expect(themeFrom({ ...none, contrast: 1 }, false, {}).contrast).toBe('high')
    expect(
      themeFrom(none, false, {
        GNOMEOLA_COLOR_SCHEME: 'dark',
        GNOMEOLA_CONTRAST: 'high',
        GNOMEOLA_ACCENT: '#e01b24',
      }),
    ).toEqual({
      scheme: 'dark',
      contrast: 'high',
      accent: '#e01b24',
    })
    expect(themeFrom(none, false, { GNOMEOLA_ACCENT: 'red; x' }).accent).toBeNull()
  })
})
