import { FuseV1Options, FuseVersion } from '@electron/fuses'
import { describe, expect, it } from 'vitest'
import { FUSES } from '../fuses.config.ts'
import {
  CSP,
  devCsp,
  isAllowedNavigation,
  isExternalUrl,
  permissionAllowed,
  resolveAppPath,
  windowOptions,
} from '../src/main/security.ts'

// The security baseline, held item by item (docs/desktop-app.md, "Security baseline").

describe('BrowserWindow options', () => {
  for (const platform of ['linux', 'darwin'] as const) {
    it(`locks the renderer down on ${platform}`, () => {
      const o = windowOptions({ preload: '/p/index.cjs', platform, dark: false })
      expect(o.webPreferences).toMatchObject({
        preload: '/p/index.cjs',
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
        nodeIntegrationInWorker: false,
        nodeIntegrationInSubFrames: false,
        webSecurity: true,
        allowRunningInsecureContent: false,
        experimentalFeatures: false,
        webviewTag: false,
        navigateOnDragDrop: false,
      })
      expect(o.show).toBe(false) // shown on ready-to-show: no blank flash
    })
  }

  it('is frameless (our header bar) on Linux, native traffic lights on macOS', () => {
    expect(windowOptions({ preload: '', platform: 'linux', dark: false })).toMatchObject({ frame: false })
    const mac = windowOptions({ preload: '', platform: 'darwin', dark: false })
    expect(mac.titleBarStyle).toBe('hiddenInset')
    expect(mac.frame).toBeUndefined()
  })

  it('paints the dark background before the first frame in dark mode', () => {
    expect(windowOptions({ preload: '', platform: 'linux', dark: true }).backgroundColor).toBe('#171411')
    expect(windowOptions({ preload: '', platform: 'linux', dark: false }).backgroundColor).toBe('#f6f1e7')
  })

  it('gives the Linux window the brand icon; macOS takes the bundle icon', () => {
    expect(windowOptions({ preload: '', platform: 'linux', dark: false, icon: '/i.png' }).icon).toBe('/i.png')
    expect(
      windowOptions({ preload: '', platform: 'darwin', dark: false, icon: '/i.png' }).icon,
    ).toBeUndefined()
  })
})

describe('CSP', () => {
  const directives = Object.fromEntries(
    CSP.split(';').map((d) => {
      const [k, ...v] = d.trim().split(/\s+/)
      return [k!, v]
    }),
  )
  it('allows no eval and no inline script anywhere', () => {
    expect(CSP).not.toMatch(/unsafe-eval|unsafe-inline|wasm-unsafe-eval|\*/)
    expect(directives['script-src']).toEqual(["'self'"])
  })
  it('gives the renderer no network: daemon traffic goes through the tunnel', () => {
    expect(directives['connect-src']).toEqual(["'none'"])
    expect(directives['default-src']).toEqual(["'none'"])
  })
  it('forbids framing, plugins, base-uri and form posts', () => {
    for (const d of ['object-src', 'frame-src', 'frame-ancestors', 'base-uri', 'form-action'])
      expect(directives[d]).toEqual(["'none'"])
  })
  it('dev CSP (HMR) still has no eval and reaches only the dev server', () => {
    const dev = devCsp('http://localhost:5173')
    expect(dev).not.toMatch(/unsafe-eval/)
    expect(dev).toContain('connect-src http://localhost:5173 ws://localhost:5173')
  })
})

describe('navigation and new windows', () => {
  it('lets the window navigate only within app:// (or the dev server in dev)', () => {
    expect(isAllowedNavigation('app://gnomeola/index.html#/sessions/x')).toBe(true)
    expect(isAllowedNavigation('app://evil/index.html')).toBe(false)
    expect(isAllowedNavigation('https://example.com/')).toBe(false)
    expect(isAllowedNavigation('file:///etc/passwd')).toBe(false)
    expect(isAllowedNavigation('http://localhost:5173/', 'http://localhost:5173')).toBe(true)
    expect(isAllowedNavigation('http://localhost:5174/', 'http://localhost:5173')).toBe(false)
    expect(isAllowedNavigation('not a url')).toBe(false)
  })
  it('opens only http(s) links externally', () => {
    expect(isExternalUrl('https://meet.google.com/abc')).toBe(true)
    expect(isExternalUrl('http://example.com')).toBe(true)
    for (const bad of [
      'file:///etc/passwd',
      'javascript:alert(1)',
      'smb://host/share',
      'app://gnomeola/',
      'https://',
      '',
    ])
      expect(isExternalUrl(bad)).toBe(false)
  })
})

describe('permissions', () => {
  it('denies everything to the main window, microphone included', () => {
    for (const p of ['media', 'geolocation', 'notifications', 'clipboard-read', 'display-capture', 'midi'])
      expect(permissionAllowed(p, { mediaTypes: ['audio'] }, false)).toBe(false)
  })
  it('allows only audio capture to a registered capture window', () => {
    expect(permissionAllowed('media', { mediaTypes: ['audio'] }, true)).toBe(true)
    expect(permissionAllowed('media', { mediaTypes: ['video'] }, true)).toBe(false)
    expect(permissionAllowed('media', { mediaTypes: ['audio', 'video'] }, true)).toBe(false)
    expect(permissionAllowed('media', {}, true)).toBe(false)
    expect(permissionAllowed('geolocation', {}, true)).toBe(false)
  })
})

describe('app:// protocol', () => {
  it('maps paths under the renderer dir, index.html for the root', () => {
    expect(resolveAppPath('app://gnomeola/', '/r')).toBe('/r/index.html')
    expect(resolveAppPath('app://gnomeola/assets/index-1.js', '/r')).toBe('/r/assets/index-1.js')
    expect(resolveAppPath('app://gnomeola/index.html?x=1#/y', '/r/')).toBe('/r/index.html')
  })
  it('refuses traversal, other hosts and schemes', () => {
    // the URL parser resolves encoded dot segments itself, so the result stays under the root
    expect(resolveAppPath('app://gnomeola/%2e%2e/%2e%2e/etc/passwd', '/r')).toBe('/r/etc/passwd')
    expect(resolveAppPath('app://gnomeola/a/..%2F..%2Fsecret', '/r')).toBeNull()
    expect(resolveAppPath('app://gnomeola/a%00b', '/r')).toBeNull()
    expect(resolveAppPath('app://other/index.html', '/r')).toBeNull()
    expect(resolveAppPath('file:///r/index.html', '/r')).toBeNull()
  })
})

describe('fuses', () => {
  it('keeps RunAsNode (one runtime runs daemon + CLI) and closes the debugging doors', () => {
    expect(FUSES.version).toBe(FuseVersion.V1)
    expect(FUSES.strictlyRequireAllFuses).toBe(true)
    expect(FUSES[FuseV1Options.RunAsNode]).toBe(true)
    expect(FUSES[FuseV1Options.EnableNodeCliInspectArguments]).toBe(false)
    expect(FUSES[FuseV1Options.EnableNodeOptionsEnvironmentVariable]).toBe(false)
    expect(FUSES[FuseV1Options.EnableEmbeddedAsarIntegrityValidation]).toBe(true)
    expect(FUSES[FuseV1Options.OnlyLoadAppFromAsar]).toBe(true)
    expect(FUSES[FuseV1Options.GrantFileProtocolExtraPrivileges]).toBe(false)
    expect(FUSES[FuseV1Options.EnableCookieEncryption]).toBe(true)
  })
  it('sets every fuse this @electron/fuses knows (a new one must be decided, not defaulted)', () => {
    const known = Object.values(FuseV1Options).filter((v) => typeof v === 'number')
    for (const f of known) expect(typeof FUSES[f as FuseV1Options]).toBe('boolean')
  })
})
