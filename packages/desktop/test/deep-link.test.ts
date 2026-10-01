import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  DeepLinkQueue,
  deepLinkFromArgv,
  MAX_DEEP_LINK,
  normalizeDeepLink,
  schemeRegistration,
} from '../src/main/deep-link.ts'

// kacola:// deep links, main's half (docs/desktop-app.md, "Deep links").

describe('deepLinkFromArgv', () => {
  const electron = ['/usr/lib/gnomeola/gnomeola', '--no-sandbox']

  it('finds an agenda or meeting link among the other arguments', () => {
    expect(deepLinkFromArgv([...electron, 'kacola://agenda/agd_1'])).toBe('kacola://agenda/agd_1')
    expect(
      deepLinkFromArgv([...electron, '--background', 'kacola://meeting/evt%401?start=2026-10-01T09:00:00Z']),
    ).toBe('kacola://meeting/evt%401?start=2026-10-01T09%3A00%3A00.000Z')
    expect(deepLinkFromArgv(['kacola://meeting/series-7'])).toBe('kacola://meeting/series-7')
  })

  it('takes the first valid link, skipping invalid ones before it', () => {
    expect(deepLinkFromArgv(['kacola://evil/x', 'kacola://agenda/a', 'kacola://agenda/b'])).toBe(
      'kacola://agenda/a',
    )
  })

  it('accepts any case of the scheme and writes the canonical form', () => {
    expect(deepLinkFromArgv(['KACOLA://Agenda/agd_1'])).toBe('kacola://agenda/agd_1')
    expect(normalizeDeepLink('  kacola://agenda/agd_1/  ')).toBe('kacola://agenda/agd_1')
  })

  it('ignores everything else', () => {
    for (const a of [
      'https://example.com/kacola://agenda/x',
      'kacola://evil/../x',
      'kacola://agenda/../x',
      'kacola://agenda/',
      'kacola://meeting/e?start=not-a-date',
      'kacola:agenda/x',
      'file:///etc/passwd',
      'javascript:alert(1)',
      '--kacola://agenda/x',
      '',
    ])
      expect(deepLinkFromArgv([...electron, a]), a).toBeNull()
    expect(normalizeDeepLink(42)).toBeNull()
    expect(normalizeDeepLink(undefined)).toBeNull()
  })

  it('refuses an overlong argument', () => {
    const id = 'a'.repeat(MAX_DEEP_LINK)
    expect(deepLinkFromArgv([`kacola://agenda/${id}`])).toBeNull()
    expect(deepLinkFromArgv([`kacola://agenda/${'a'.repeat(100)}`])).not.toBeNull()
  })
})

describe('schemeRegistration', () => {
  const base = { execPath: '/opt/electron', argv: ['/opt/electron', 'out/main/index.js'], env: {} }

  it('packaged macOS registers itself; packaged Linux leaves it to the desktop file / Flatpak', () => {
    expect(schemeRegistration({ ...base, packaged: true, platform: 'darwin' })).toEqual({
      scheme: 'kacola',
      path: null,
      args: null,
    })
    expect(schemeRegistration({ ...base, packaged: true, platform: 'linux' })).toBeNull()
    expect(
      schemeRegistration({
        ...base,
        packaged: true,
        platform: 'linux',
        env: { GNOMEOLA_REGISTER_SCHEME: '1' },
      }),
    ).toBeNull()
  })

  it('dev on macOS registers Electron + the main script', () => {
    expect(schemeRegistration({ ...base, packaged: false, platform: 'darwin' })).toEqual({
      scheme: 'kacola',
      path: '/opt/electron',
      args: [resolve('out/main/index.js')],
    })
  })

  it('dev on Linux never touches xdg-settings unless GNOMEOLA_REGISTER_SCHEME=1', () => {
    expect(schemeRegistration({ ...base, packaged: false, platform: 'linux' })).toBeNull()
    expect(
      schemeRegistration({
        ...base,
        packaged: false,
        platform: 'linux',
        env: { GNOMEOLA_REGISTER_SCHEME: 'yes' },
      }),
    ).toBeNull()
    expect(
      schemeRegistration({
        ...base,
        packaged: false,
        platform: 'linux',
        env: { GNOMEOLA_REGISTER_SCHEME: '1' },
      }),
    ).toMatchObject({ scheme: 'kacola', args: [resolve('out/main/index.js')] })
  })

  it('GNOMEOLA_REGISTER_SCHEME=0 turns it off everywhere', () => {
    const env = { GNOMEOLA_REGISTER_SCHEME: '0' }
    for (const packaged of [true, false])
      for (const platform of ['darwin', 'linux'] as const)
        expect(schemeRegistration({ ...base, env, packaged, platform })).toBeNull()
  })

  it('no main script to register (dev, argv without it): nothing', () => {
    expect(
      schemeRegistration({ ...base, argv: ['/opt/electron'], packaged: false, platform: 'darwin' }),
    ).toBeNull()
  })
})

describe('DeepLinkQueue', () => {
  const clock = () => {
    let t = 0
    return { now: () => t, advance: (ms: number) => (t += ms) }
  }

  it('holds a link until the renderer takes it; take marks that window ready', () => {
    const q = new DeepLinkQueue()
    expect(q.push('kacola://agenda/a')).toBe(true)
    expect(q.hasPending).toBe(true)
    // the window has not asked yet: nothing is pushed to it
    expect(q.deliverTo(1)).toBeNull()
    expect(q.take(1)).toBe('kacola://agenda/a')
    expect(q.hasPending).toBe(false)
    expect(q.take(1)).toBeNull()
    // from now on, a new link goes straight to that window
    q.push('kacola://agenda/b')
    expect(q.deliverTo(2)).toBeNull()
    expect(q.deliverTo(1)).toBe('kacola://agenda/b')
    expect(q.deliverTo(1)).toBeNull()
  })

  it('a reload or a new window waits for the next take', () => {
    const q = new DeepLinkQueue()
    q.markReady(1)
    q.reset(1)
    q.push('kacola://agenda/a')
    expect(q.deliverTo(1)).toBeNull()
    expect(q.take(1)).toBe('kacola://agenda/a')
  })

  it('a newer link replaces one not yet taken', () => {
    const q = new DeepLinkQueue()
    q.push('kacola://agenda/a')
    q.push('kacola://agenda/b')
    expect(q.take(1)).toBe('kacola://agenda/b')
  })

  it('the same link within a second counts once; later, or a different link, counts again', () => {
    const c = clock()
    const q = new DeepLinkQueue(c.now)
    expect(q.push('kacola://agenda/a')).toBe(true)
    c.advance(500)
    expect(q.push('kacola://agenda/a')).toBe(false)
    expect(q.push('kacola://agenda/b')).toBe(true)
    expect(q.push('kacola://agenda/a')).toBe(true)
    c.advance(1000)
    expect(q.push('kacola://agenda/a')).toBe(true)
  })
})

describe('packaging declares the scheme', () => {
  const repo = join(import.meta.dirname, '..', '..', '..')
  const read = (...p: string[]) => readFileSync(join(repo, ...p), 'utf8')

  it('the Flatpak desktop file handles x-scheme-handler/kacola and passes the link on (%U)', () => {
    const entry = read('packaging', 'flatpak', 'org.gnome.Gnomeola.desktop')
    const main = entry.split(/^\[Desktop Action/m)[0]!
    expect(main).toMatch(/^MimeType=(.*;)?x-scheme-handler\/kacola;/m)
    expect(main).toMatch(/^Exec=gnomeola-app %U$/m)
    expect(read('packaging', 'flatpak', 'bin', 'gnomeola-app')).toContain('"$@"')
  })

  it('electron-builder writes CFBundleURLTypes (macOS) and the Linux MimeType from `protocols`', () => {
    expect(read('packaging', 'macos', 'electron-builder.yml')).toMatch(
      /^protocols:\n\s+- name: kacola\n\s+schemes:\n\s+- kacola$/m,
    )
    expect(read('scripts', 'build-desktop.ts')).toContain(
      "protocols: [{ name: 'kacola', schemes: ['kacola'] }]",
    )
  })
})
