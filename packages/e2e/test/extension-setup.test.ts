import { execFile } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  compareVersions,
  EXTENSION_UUID,
  ExtensionManager,
  extensionSource,
  extensionsDir,
  infoFromCli,
  type RunResult,
} from '../../desktop/src/main/extension.ts'
import { formatStrv, parseGVariant } from '../../desktop/src/main/gvariant.ts'
import { type FakeShellState, fakeShellRunner, initialFakeShell } from '../src/fake-shell-extensions.ts'

// The top-bar extension's state machine (packages/desktop/src/main/extension.ts), unit tier: every state
// and every press of the one button against a faked Shell (fake-shell-extensions.ts — the commands the
// app runs, answered in the real tools' output format) and a temp extensions directory. The real Shell
// answers in desktop-extension.e2e; the outputs parsed here were captured from GNOME Shell 50.

const REPO_EXT = join(import.meta.dirname, '..', '..', '..', 'extensions', EXTENSION_UUID)
const BUNDLED = JSON.parse(readFileSync(join(REPO_EXT, 'metadata.json'), 'utf8'))['version-name'] as string

const realRun = (argv: string[]) =>
  new Promise<RunResult>((resolve) =>
    execFile(argv[0]!, argv.slice(1), (err, stdout, stderr) =>
      resolve({ code: err ? 1 : 0, stdout: String(stdout), stderr: String(stderr) }),
    ),
  )

function world(
  o: { shell?: Partial<FakeShellState>; env?: Record<string, string>; source?: string | null } = {},
) {
  const data = mkdtempSync(join(tmpdir(), 'kacola-ext-'))
  const env = {
    HOME: data,
    XDG_DATA_HOME: data,
    XDG_CURRENT_DESKTOP: 'GNOME',
    XDG_SESSION_TYPE: 'wayland',
    ...o.env,
  }
  const dir = extensionsDir(env)
  const shell = initialFakeShell({ extensionsDir: dir, ...o.shell })
  const m = new ExtensionManager({
    platform: 'linux',
    env,
    source: o.source === undefined ? REPO_EXT : o.source,
    run: fakeShellRunner(shell, realRun),
  })
  const dest = join(dir, EXTENSION_UUID)
  /** A new login: the Shell loads what is on disk now, under a new bus name. */
  const relogin = () => {
    shell.loaded = {}
    const meta = existsSync(dest) ? JSON.parse(readFileSync(join(dest, 'metadata.json'), 'utf8')) : null
    if (meta) shell.loaded[EXTENSION_UUID] = { version: meta['version-name'], type: 2 }
    shell.owner = `:1.${Number(shell.owner.slice(3)) + 100}`
  }
  const original = readFileSync(join(REPO_EXT, 'metadata.json'), 'utf8')
  const setVersion = (v: string) =>
    writeFileSync(
      join(dest, 'metadata.json'),
      original.replace(`"version-name": "${BUNDLED}"`, `"version-name": "${v}"`),
    )
  return { m, shell, dest, env, relogin, setVersion }
}

describe('reading what gdbus and gsettings print', () => {
  it('parses GetExtensionInfo, an unknown UUID, booleans and string arrays', () => {
    const known = parseGVariant(
      "({'uuid': <'kacola@kacperlubisz.com'>, 'shell-version': <[<'50'>]>, 'version-name': <'0.1.0'>, 'type': <2.0>, 'state': <1.0>, 'enabled': <true>, 'error': <''>, 'sessionModes': <[<'user'>]>},)",
    )
    expect(known).toEqual([
      {
        uuid: 'kacola@kacperlubisz.com',
        'shell-version': ['50'],
        'version-name': '0.1.0',
        type: 2,
        state: 1,
        enabled: true,
        error: '',
        sessionModes: ['user'],
      },
    ])
    expect(parseGVariant('(@a{sv} {},)')).toEqual([{}])
    expect(parseGVariant('(false,)')).toEqual([false])
    expect(parseGVariant('(<true>,)')).toEqual([true])
    expect(parseGVariant('()')).toEqual([])
    expect(parseGVariant("['background-logo@fedorahosted.org', 'it\\'s@x']")).toEqual([
      'background-logo@fedorahosted.org',
      "it's@x",
    ])
    expect(parseGVariant('@as []')).toEqual([])
    expect(parseGVariant("(':1.42',)")).toEqual([':1.42'])
    expect(parseGVariant('(uint32 5, "dq\\u2019")')).toEqual([5, 'dq’'])
    expect(() => parseGVariant('({)')).toThrow()
    expect(formatStrv([])).toBe('@as []')
    expect(parseGVariant(formatStrv(["a'b", 'c@d']))).toEqual(["a'b", 'c@d'])
  })

  it('reads `gnome-extensions info` (the fallback without gdbus)', () => {
    expect(
      infoFromCli({
        code: 0,
        stdout:
          'background-logo@fedorahosted.org\n  Name: Background Logo\n  Path: /usr/share/gnome-shell/extensions/background-logo@fedorahosted.org\n  Version: 50.1\n  Enabled: No\n  State: INITIALIZED\n',
        stderr: '',
      }),
    ).toEqual({ known: true, enabled: false, state: 6, version: '50.1', error: '', type: 1 })
    expect(infoFromCli({ code: 2, stdout: '', stderr: 'Extension “nope@x.org” doesn’t exist' })).toEqual({
      known: false,
    })
    expect(infoFromCli({ code: 2, stdout: '', stderr: 'Failed to connect to GNOME Shell' })).toBeNull()
  })

  it('compares version names numerically', () => {
    expect(compareVersions('0.10.0', '0.9.1')).toBe(1)
    expect(compareVersions('0.1.0', '0.1.0')).toBe(0)
    expect(compareVersions('0.1', '0.1.0')).toBe(0)
    expect(compareVersions('0.0.1', '0.1.0')).toBe(-1)
  })
})

describe('where the extension comes from and goes', () => {
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
    const res = mkdtempSync(join(tmpdir(), 'kacola-ext-res-'))
    const pkg = join(res, 'extension', EXTENSION_UUID)
    mkdirSync(pkg, { recursive: true })
    writeFileSync(join(pkg, 'metadata.json'), '{}')
    expect(extensionSource({ resourcesPath: res, appDir: '/nowhere' })).toBe(pkg)
    expect(
      extensionSource({ appDir: join(REPO_EXT, '..', '..', 'packages', 'desktop', 'out', 'main') }),
    ).toBe(REPO_EXT)
  })
})

describe('the top-bar extension’s states and its one button', () => {
  it('is unsupported off Linux and off GNOME, unavailable when the build has no copy', async () => {
    const mac = new ExtensionManager({
      platform: 'darwin',
      env: {},
      source: REPO_EXT,
      run: fakeShellRunner(initialFakeShell()),
    })
    expect(await mac.status()).toEqual({ state: 'unsupported' })
    const kde = world({ env: { XDG_CURRENT_DESKTOP: 'KDE' }, shell: { reachable: false } })
    expect(await kde.m.status()).toEqual({ state: 'unsupported' })
    expect(await kde.m.turnOn()).toEqual({ state: 'unsupported' })
    // a GNOME Shell on the bus counts, whatever XDG_CURRENT_DESKTOP says
    expect((await world({ env: { XDG_CURRENT_DESKTOP: '' } }).m.status()).state).toBe('not-installed')
    expect(
      (await world({ env: { XDG_CURRENT_DESKTOP: 'ubuntu:GNOME' }, shell: { reachable: false } }).m.status())
        .state,
    ).toBe('not-installed')
    expect(await world({ source: null }).m.status()).toEqual({
      state: 'unavailable',
      detail: 'This build does not include the top-bar extension.',
    })
  })

  it('Install & Enable on Wayland: copied, the Shell does not know it yet, so it is queued for the next login', async () => {
    const w = world()
    expect(await w.m.status()).toEqual({ state: 'not-installed', userExtensionsOff: false })
    const after = await w.m.turnOn()
    expect(after).toEqual({
      state: 'needs-login',
      reason: 'new',
      queued: true,
      session: 'wayland',
      command: null,
      userExtensionsOff: false,
    })
    for (const f of ['metadata.json', 'extension.js', 'schemas/gschemas.compiled'])
      expect(existsSync(join(w.dest, f)), f).toBe(true)
    expect(w.shell.calls).toContain(`gdbus EnableExtension ${EXTENSION_UUID}`)
    expect(w.shell.enabledExtensions).toEqual([EXTENSION_UUID])
    // pressing again changes nothing: still waiting for the login
    expect((await w.m.turnOn()).state).toBe('needs-login')
    expect(w.shell.enabledExtensions).toEqual([EXTENSION_UUID])
    // the next login loads and starts it
    w.relogin()
    expect(await w.m.status()).toEqual({ state: 'enabled' })
  })

  it('says how on X11 (a Shell restart works there too)', async () => {
    const w = world({ env: { XDG_SESSION_TYPE: 'x11' } })
    const s = await w.m.turnOn()
    expect(s).toMatchObject({ state: 'needs-login', session: 'x11', queued: true })
  })

  it('a copy on disk the Shell has not loaded and nobody queued: Enable queues it', async () => {
    const w = world()
    await w.m.turnOn()
    w.shell.enabledExtensions = []
    expect(await w.m.status()).toMatchObject({ state: 'needs-login', queued: false })
    expect(await w.m.turnOn()).toMatchObject({ state: 'needs-login', queued: true })
  })

  it('Enable for a loaded, switched-off extension: EnableExtension, no copy', async () => {
    const w = world()
    await w.m.turnOn()
    w.relogin()
    await w.m.disable()
    expect(await w.m.status()).toEqual({ state: 'disabled', userExtensionsOff: false })
    expect(w.shell.disabledExtensions).toEqual([EXTENSION_UUID])
    const mtime = statSync(join(w.dest, 'metadata.json')).mtimeMs
    expect(await w.m.turnOn()).toEqual({ state: 'enabled' })
    expect(statSync(join(w.dest, 'metadata.json')).mtimeMs).toBe(mtime)
    expect(w.shell.disabledExtensions).toEqual([])
  })

  it('every user extension switched off in GNOME: reported, and the same press turns them back on', async () => {
    const w = world()
    await w.m.turnOn()
    w.relogin()
    w.shell.disableUserExtensions = true
    expect(await w.m.status()).toEqual({ state: 'disabled', userExtensionsOff: true })
    expect(await w.m.turnOn()).toEqual({ state: 'enabled' })
    expect(w.shell.disableUserExtensions).toBe(false)
    expect(w.shell.calls).toContain('gdbus Set org.gnome.Shell.Extensions UserExtensionsEnabled <true>')
    // and on a fresh install
    const n = world({ shell: { disableUserExtensions: true } })
    expect(await n.m.status()).toEqual({ state: 'not-installed', userExtensionsOff: true })
    expect(await n.m.turnOn()).toMatchObject({ state: 'needs-login', queued: true, userExtensionsOff: false })
  })

  it('an older copy is outdated (a lower version, or the same version with different files); a newer one is left alone', async () => {
    const w = world()
    await w.m.turnOn()
    w.relogin()
    w.setVersion('0.0.1')
    expect(await w.m.status()).toEqual({
      state: 'outdated',
      installed: '0.0.1',
      bundled: BUNDLED,
      userExtensionsOff: false,
    })
    w.setVersion(BUNDLED)
    expect(await w.m.status()).toEqual({ state: 'enabled' })
    writeFileSync(join(w.dest, 'extension.js'), '// an older build\n')
    expect((await w.m.status()).state).toBe('outdated')
    w.setVersion('99.0.0')
    expect((await w.m.status()).state).not.toBe('outdated')
  })

  it('Update under a running Shell: copied, but the old code runs until the next login', async () => {
    const w = world()
    await w.m.turnOn()
    w.relogin()
    writeFileSync(join(w.dest, 'extension.js'), '// an older build\n')
    expect(await w.m.turnOn()).toEqual({
      state: 'needs-login',
      reason: 'updated',
      queued: true,
      session: 'wayland',
      command: null,
      userExtensionsOff: false,
    })
    expect(readFileSync(join(w.dest, 'extension.js'), 'utf8')).toBe(
      readFileSync(join(REPO_EXT, 'extension.js'), 'utf8'),
    )
    // re-checked (window focus): still the same Shell, still the old code
    expect((await w.m.status()).state).toBe('needs-login')
    w.relogin()
    expect(await w.m.status()).toEqual({ state: 'enabled' })
    // a loaded version name that differs from the one on disk says the same, even after an app restart
    w.shell.loaded[EXTENSION_UUID]!.version = '0.0.1'
    expect(await w.m.status()).toMatchObject({ state: 'needs-login', reason: 'updated' })
  })

  it('a crashed extension or one for another Shell version is an error; Try again reinstalls it', async () => {
    const w = world()
    await w.m.turnOn()
    w.relogin()
    w.shell.loaded[EXTENSION_UUID] = {
      version: BUNDLED,
      type: 2,
      state: 3,
      error: 'TypeError: x is undefined',
    }
    expect(await w.m.status()).toEqual({
      state: 'error',
      reason: 'crashed',
      detail: 'TypeError: x is undefined',
    })
    w.shell.loaded[EXTENSION_UUID] = { version: BUNDLED, type: 2, state: 4 }
    expect(await w.m.status()).toMatchObject({ state: 'error', reason: 'shell-version' })
    writeFileSync(join(w.dest, 'extension.js'), '// broken\n')
    w.setVersion(BUNDLED)
    await w.m.turnOn()
    expect(readFileSync(join(w.dest, 'extension.js'), 'utf8')).toBe(
      readFileSync(join(REPO_EXT, 'extension.js'), 'utf8'),
    )
  })

  it('an install that cannot write is an error that says why', async () => {
    // a file where the data directory should be
    const blocker = join(mkdtempSync(join(tmpdir(), 'kacola-ext-')), 'file')
    writeFileSync(blocker, '')
    const w = world({ env: { XDG_DATA_HOME: join(blocker, 'data') } })
    expect(await w.m.turnOn()).toMatchObject({
      state: 'error',
      reason: 'failed',
      detail: expect.stringMatching(/^Could not install the top-bar extension: /),
    })
  })

  it('Disable and Remove: switched off, then unloaded, deleted and out of the enabled list', async () => {
    const w = world()
    await w.m.turnOn()
    w.relogin()
    expect(await w.m.disable()).toEqual({ state: 'disabled', userExtensionsOff: false })
    await w.m.turnOn()
    expect(await w.m.remove()).toEqual({ state: 'not-installed', userExtensionsOff: false })
    expect(w.shell.calls).toContain(`gdbus UninstallExtension ${EXTENSION_UUID}`)
    expect(existsSync(w.dest)).toBe(false)
    expect(w.shell.enabledExtensions).toEqual([])
    // removing a copy the Shell never loaded: deleted, unqueued
    await w.m.turnOn()
    expect(w.shell.enabledExtensions).toEqual([EXTENSION_UUID])
    expect((await w.m.remove()).state).toBe('not-installed')
    expect(existsSync(w.dest)).toBe(false)
    expect(w.shell.enabledExtensions).toEqual([])
  })

  it('without gdbus, `gnome-extensions info` and gsettings stand in', async () => {
    const w = world()
    const shell = w.shell
    const m = new ExtensionManager({
      platform: 'linux',
      env: w.env,
      source: REPO_EXT,
      run: async (argv) =>
        argv[0] === 'gdbus'
          ? { code: 127, stdout: '', stderr: 'spawn gdbus ENOENT' }
          : fakeShellRunner(shell, realRun)(argv),
    })
    expect((await m.status()).state).toBe('not-installed')
    expect(await m.turnOn()).toMatchObject({ state: 'needs-login', queued: true })
    w.relogin()
    expect(await m.status()).toEqual({ state: 'enabled' })
    shell.disableUserExtensions = true
    expect(await m.status()).toEqual({ state: 'disabled', userExtensionsOff: true })
    expect(await m.turnOn()).toEqual({ state: 'enabled' })
    expect(shell.calls).toContain('gsettings set org.gnome.shell disable-user-extensions false')
  })

  it('in the Flatpak: copies the files, never writes the sandbox’s gsettings, and gives the command to run', async () => {
    const env = { FLATPAK_ID: 'com.kacperlubisz.Kacola', HOST_XDG_DATA_HOME: '' }
    const w = world({ env, shell: { reachable: false } })
    expect(await w.m.status()).toEqual({ state: 'not-installed', userExtensionsOff: false })
    expect(await w.m.turnOn()).toEqual({
      state: 'manual',
      command: `gnome-extensions enable ${EXTENSION_UUID}`,
    })
    expect(existsSync(join(w.env.HOME, '.local', 'share', 'gnome-shell', 'extensions', EXTENSION_UUID))).toBe(
      true,
    )
    expect(
      w.shell.calls.filter((c) => c.startsWith('gsettings') || c.startsWith('gnome-extensions')),
    ).toEqual([])
    // a Flatpak allowed to reach the Shell: it can switch on a loaded copy, and says what to run otherwise
    const r = world({ env })
    expect(await r.m.turnOn()).toMatchObject({
      state: 'needs-login',
      queued: false,
      command: `gnome-extensions enable ${EXTENSION_UUID}`,
    })
    expect(r.shell.enabledExtensions).toEqual([])
  })
})
