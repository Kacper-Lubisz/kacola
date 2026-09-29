import { type ChildProcess, execFileSync, spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { createClient } from '@gnomeola/protocol'
import { loadFixture } from '@gnomeola/testkit/fixtures'
import { assertDefaultsUnchanged, PipeWireRig, readDefaults } from '@gnomeola/testkit/rig'
import { extensionState, GNOMEOLA_UUID } from '@gnomeola/testkit/shell'
import { startHeadlessDisplay } from '@gnomeola/testkit/ui'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { APP, markOnboarded, waitForWindow } from '../src/ui.ts'

// S-2 / V-9b — "the packaged artifact installed and launched from clean". Install into a throwaway prefix
// and home (never the user's), validate what was installed with the system's own validators, then record
// a real meeting through the INSTALLED daemon and CLI — not the repo's.

const ROOT = join(import.meta.dirname, '..', '..', '..')
const INSTALL = join(ROOT, 'scripts', 'install.sh')
const REAL_MODELS =
  process.env.GNOMEOLA_MODELS_DIR ??
  join(process.env.XDG_DATA_HOME ?? join(homedir(), '.local', 'share'), 'gnomeola', 'models')

const box = mkdtempSync(join(tmpdir(), 'gnomeola-install-'))
const PREFIX = join(box, 'prefix')
const HOME = join(box, 'home')
mkdirSync(HOME, { recursive: true })
const ENV: NodeJS.ProcessEnv = {
  ...process.env,
  HOME,
  XDG_CONFIG_HOME: join(HOME, '.config'),
  XDG_DATA_HOME: join(HOME, '.local', 'share'),
  GNOMEOLA_INSTALL_NO_SYSTEMCTL: '1',
  GNOMEOLA_MODELS_DIR: REAL_MODELS,
  // the installed daemon runs with the caller's session env: keep it off the real session bus and EDS
  GNOMEOLA_CALENDAR: 'off',
  GNOMEOLA_DBUS: 'off',
  GNOMEOLA_MIC_ACTIVITY: 'off',
}
const bin = (n: string) => join(PREFIX, 'bin', n)
const EXT_DIR = join(HOME, '.local', 'share', 'gnome-shell', 'extensions', GNOMEOLA_UUID)
const run = (cmd: string, args: string[], env: NodeJS.ProcessEnv = ENV) =>
  execFileSync(cmd, args, { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })

let daemon: ChildProcess | null = null
let url = ''
let rig: PipeWireRig
let defaults: Awaited<ReturnType<typeof readDefaults>>

beforeAll(async () => {
  defaults = await readDefaults()
  rig = await PipeWireRig.create()
  run('bash', [INSTALL, '--prefix', PREFIX, '--node', process.execPath])
}, 600_000)

afterAll(async () => {
  daemon?.kill('SIGTERM')
  await rig?.teardown()
  if (defaults) await assertDefaultsUnchanged(defaults)
}, 120_000)

describe('install', () => {
  it('lays out the runtime without dev-only files', () => {
    const app = join(PREFIX, 'share', 'gnomeola', 'app')
    for (const p of [
      'packages/daemon/src/main.ts',
      'packages/cli/src/main.ts',
      'packages/ui/dist/bundle.mjs',
      'node_modules',
      'LICENSE',
      'THIRD_PARTY_NOTICES.md',
    ])
      expect(existsSync(join(app, p)), p).toBe(true)
    for (const p of ['.git', '.claude', 'notes', 'packages/cli/test', 'packages/e2e'])
      expect(existsSync(join(app, p)), p).toBe(false)
    for (const b of ['gnomeola', 'gnomeolad', 'gnomeola-ui'])
      expect(statSync(bin(b)).mode & 0o111, b).toBeTruthy()
  })

  it('writes a desktop entry and a systemd unit that the system validators accept', () => {
    const desktop = join(PREFIX, 'share', 'applications', 'org.gnome.Gnomeola.desktop')
    run('desktop-file-validate', [desktop])
    expect(readFileSync(desktop, 'utf8')).toContain(`Exec=${bin('gnomeola-ui')}`)
    const unit = join(HOME, '.config', 'systemd', 'user', 'gnomeolad.service')
    expect(readFileSync(unit, 'utf8')).toContain(`ExecStart=${bin('gnomeolad')}`)
    // systemd-analyze exits non-zero on errors; it also requires ExecStart to exist and be executable.
    run('systemd-analyze', ['verify', '--user', unit])
  })

  it('installs the Claude skill into the (sandboxed) home', () => {
    expect(readFileSync(join(HOME, '.claude', 'skills', 'meeting-context', 'SKILL.md'), 'utf8')).toMatch(
      /^---\nname: meeting-context/,
    )
  })
})

describe('the top-bar extension (C-9)', () => {
  it('is unpacked from the gnome-extensions pack zip into the sandboxed home, schemas compiled', () => {
    const meta = JSON.parse(readFileSync(join(EXT_DIR, 'metadata.json'), 'utf8'))
    expect(meta).toMatchObject({
      uuid: GNOMEOLA_UUID,
      'shell-version': ['50'],
      'settings-schema': 'org.gnome.shell.extensions.gnomeola',
    })
    for (const f of ['extension.js', 'prefs.js', 'model.js', 'dbus.js', 'stylesheet.css'])
      expect(existsSync(join(EXT_DIR, f)), f).toBe(true)
    expect(existsSync(join(EXT_DIR, 'schemas', 'gschemas.compiled'))).toBe(true)
  })

  it('is never enabled by the installer: nothing was written to settings in the sandboxed home', () => {
    expect(existsSync(join(HOME, '.config', 'dconf'))).toBe(false)
    expect(existsSync(join(HOME, '.config', 'glib-2.0', 'settings', 'keyfile'))).toBe(false)
  })

  it('the INSTALLED copy loads in a nested GNOME Shell 50 without errors', async () => {
    const display = await startHeadlessDisplay({ extensions: [EXT_DIR] })
    try {
      const st = await display.waitFor(
        async () => {
          const s = await extensionState(display.env, GNOMEOLA_UUID)
          return s && s.stateName !== 'initialized' && s.stateName !== 'activating' && s
        },
        20_000,
        'the extension to settle',
      )
      expect(st).toMatchObject({ stateName: 'active', error: null })
    } finally {
      await display.close()
    }
  }, 120_000)
})

describe('launched from the install', () => {
  it('the installed daemon starts and the installed CLI reaches it', async () => {
    daemon = spawn(bin('gnomeolad'), ['--port', '0', '--data-dir', join(box, 'data')], {
      env: ENV,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    url = await new Promise<string>((resolve, reject) => {
      let buf = ''
      daemon!.stdout!.on('data', (b) => {
        buf += b
        const line = buf.split('\n').find((l) => l.includes('"listening"'))
        if (line) resolve(JSON.parse(line).url)
      })
      daemon!.on('exit', (c) => reject(new Error(`daemon exited ${c}`)))
    })
    const status = JSON.parse(run(bin('gnomeola'), ['status'], { ...ENV, GNOMEOLA_URL: url }))
    expect(status).toMatchObject({
      ok: true,
      capture: { available: true, backend: 'pipewire', detail: null },
    })
  }, 60_000)

  it('records a real meeting through the installed binaries: record start → audio → record stop → search', async () => {
    const client = createClient({ baseUrl: url })
    await client.call('updateSettings', {
      body: { capture: { micDevice: rig.mic.captureTarget, systemDevice: rig.system.captureTarget } },
    })
    // the first ~27 s of the fixture contain the retry-budget decision
    const f = loadFixture('standup-2p')
    const clip = (t: 'mic' | 'system') => {
      const out = join(box, `${t}.wav`)
      run('ffmpeg', ['-v', 'error', '-y', '-i', f.wavPath(t), '-t', '27', out])
      return out
    }
    const env = { ...ENV, GNOMEOLA_URL: url }
    const started = JSON.parse(
      run(bin('gnomeola'), ['record', 'start', '--title', 'Installed recording'], env),
    )
    expect(started.status).toBe('recording')
    await rig.playTogether(
      [
        [rig.mic, clip('mic')],
        [rig.system, clip('system')],
      ],
      { timeoutMs: 60_000 },
    )
    const stopped = JSON.parse(run(bin('gnomeola'), ['record', 'stop'], env))
    expect(stopped).toMatchObject({ id: started.id, status: 'stopped' })
    const hits = JSON.parse(run(bin('gnomeola'), ['search', 'retry budget'], env)).hits
    expect(hits.map((h: { sessionId: string }) => h.sessionId)).toContain(started.id)
    const shown = JSON.parse(run(bin('gnomeola'), ['sessions', 'show', started.id], env))
    expect(shown.segments).toBeGreaterThan(3)
  }, 180_000)
})

describe('the installed UI', () => {
  it('launches from the installed launcher and shows the session recorded through the installed CLI', async () => {
    const display = await startHeadlessDisplay({ size: '1280x800' })
    try {
      markOnboarded(display, [])
      const app = display.launchApp({ command: bin('gnomeola-ui'), env: { GNOMEOLA_URL: url } })
      await waitForWindow(display, app, 60_000)
      const row = await display.findOne(
        { app: APP, role: 'list item', nameContains: 'Installed recording' },
        30_000,
      )
      expect(row.name).toMatch(/Installed recording/)
      await display.screenshot(join(ROOT, 'packages', 'e2e', 'test', '__artifacts__', 'installed-ui.png'), {
        kind: 'window',
      })
      await app.stop()
    } finally {
      await display.close()
    }
  }, 180_000)
})

describe('uninstall', () => {
  it('removes the install but keeps recordings; --purge removes them too', async () => {
    daemon?.kill('SIGTERM')
    await new Promise((r) => daemon?.once('exit', r))
    daemon = null
    const data = join(HOME, '.local', 'share', 'gnomeola')
    mkdirSync(data, { recursive: true })
    run('bash', [INSTALL, '--uninstall', '--prefix', PREFIX])
    expect(existsSync(bin('gnomeola'))).toBe(false)
    expect(existsSync(join(PREFIX, 'share', 'gnomeola'))).toBe(false)
    expect(existsSync(join(HOME, '.config', 'systemd', 'user', 'gnomeolad.service'))).toBe(false)
    expect(existsSync(join(HOME, '.claude', 'skills', 'meeting-context'))).toBe(false)
    expect(existsSync(EXT_DIR)).toBe(false)
    expect(existsSync(data), 'recordings kept').toBe(true)
    run('bash', [INSTALL, '--uninstall', '--purge', '--prefix', PREFIX])
    expect(existsSync(data)).toBe(false)
    expect(readdirSync(join(PREFIX, 'bin'))).toEqual([])
  }, 60_000)
})
