import { execFile, execFileSync, spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { createClient, DAEMON_EXIT } from '@kacola/protocol'
import { type DaemonHandle, startDaemon } from '@kacola/testkit/daemon'
import { afterAll, describe, expect, it } from 'vitest'

// scripts/install.sh never interrupts a meeting (2026-10-01: an install-and-restart cut one short). Into a
// throwaway prefix and home, never the user's, against test daemons (never the user's) at KACOLA_URL:
//
//   - the running daemon is recording → install refuses (exit 3) and replaces nothing;
//   - an OLDER daemon (no /daemon route) that is recording → refused the same way (asked via its sessions);
//   - --force → installs, then asks the daemon for a restart that waits for the recording: the daemon keeps
//     recording, and exits 76 (for systemd to start the new version) only when the meeting ends;
//   - idle → installs and the daemon restarts at once.
//
// The window build is a stand-in (KACOLA_DESKTOP_APP_DIR) and systemctl is never called
// (KACOLA_INSTALL_NO_SYSTEMCTL=1): only the recording guard and the deferred restart are under test here;
// install.e2e.test.ts covers the real artifact.

const ROOT = join(import.meta.dirname, '..', '..', '..')
const INSTALL = join(ROOT, 'scripts', 'install.sh')
const PIPE = JSON.stringify({
  segmentEveryMs: 200,
  finalizeAfterMs: 100,
  partialEveryMs: 50,
  levelEveryMs: 50,
})

const box = mkdtempSync(join(tmpdir(), 'kacola-install-rec-'))
const HOME = join(box, 'home')
mkdirSync(HOME, { recursive: true })
// the stand-in window build: just an executable where install.sh expects one
const FAKE_APP = join(box, 'linux-unpacked')
mkdirSync(join(FAKE_APP, 'resources'), { recursive: true })
writeFileSync(join(FAKE_APP, 'kacola'), '#!/bin/sh\nexit 0\n')
chmodSync(join(FAKE_APP, 'kacola'), 0o755)

const daemons: DaemonHandle[] = []
const servers: Server[] = []
afterAll(async () => {
  for (const d of daemons) await d.stop().catch(() => {})
  for (const s of servers) s.close()
  rmSync(box, { recursive: true, force: true })
})

type Run = { code: number; stdout: string; stderr: string }
function install(prefix: string, url: string, ...args: string[]): Promise<Run> {
  return new Promise((resolve) => {
    execFile(
      'bash',
      [INSTALL, '--prefix', prefix, '--node', process.execPath, '--no-extension', '--no-skill', ...args],
      {
        env: {
          ...process.env,
          HOME,
          XDG_CONFIG_HOME: join(HOME, '.config'),
          XDG_DATA_HOME: join(HOME, '.local', 'share'),
          KACOLA_URL: url,
          KACOLA_INSTALL_NO_SYSTEMCTL: '1',
          KACOLA_DESKTOP_APP_DIR: FAKE_APP,
        },
        maxBuffer: 16 * 1024 * 1024,
        timeout: 280_000,
      },
      (err, stdout, stderr) =>
        resolve({ code: err ? ((err as { code?: number }).code ?? 1) : 0, stdout, stderr }),
    )
  })
}

async function recording(env: Record<string, string> = {}) {
  // KACOLA_SUPERVISED=1: as under systemd, which starts the daemon again after a restart exit
  const d = await startDaemon({ env: { KACOLA_FAKE_PIPELINE: PIPE, KACOLA_SUPERVISED: '1', ...env } })
  daemons.push(d)
  const s = await d.client.call('createSession', { body: { title: 'Board meeting' } })
  await d.client.call('startSession', { params: { id: s.id } })
  return { d, s }
}

describe('install.sh and a meeting being recorded', () => {
  it('refuses while the daemon is recording, and replaces nothing', async () => {
    const { d, s } = await recording()
    const prefix = join(box, 'p-refused')
    const r = await install(prefix, d.baseUrl)
    expect(r.code, r.stderr).toBe(3)
    expect(r.stderr).toMatch(
      new RegExp(
        `refusing to install: the kacola daemon at .* is recording "Board meeting" \\(${s.id}, recording\\)`,
      ),
    )
    expect(r.stderr).toMatch(/--force/)
    expect(existsSync(join(prefix, 'share', 'kacola'))).toBe(false)
    expect(existsSync(join(prefix, 'bin'))).toBe(false)
    expect((await d.client.call('getSession', { params: { id: s.id } })).status).toBe('recording')
    expect((await d.client.call('daemonInfo')).restart).toBeNull()
  }, 60_000)

  it('refuses for an older daemon too (no /daemon route: asked through its sessions)', async () => {
    const old = createServer((req, res) => {
      const path = (req.url ?? '').split('?')[0]
      res.setHeader('content-type', 'application/json')
      if (path === '/sessions') {
        res.end(
          JSON.stringify({
            sessions: [
              {
                id: 'ses_old',
                title: 'Old daemon call',
                createdAt: '2026-10-01T16:02:34.000Z',
                startedAt: '2026-10-01T16:02:34.000Z',
                endedAt: null,
                status: 'recording',
                private: false,
                durationMs: 0,
                tracks: [],
                error: null,
              },
            ],
          }),
        )
        return
      }
      res.statusCode = 404
      res.end(JSON.stringify({ error: { code: 'not_found', message: `no route ${path}` } }))
    })
    servers.push(old)
    await new Promise<void>((r) => old.listen(0, '127.0.0.1', r))
    const url = `http://127.0.0.1:${(old.address() as AddressInfo).port}`
    const r = await install(join(box, 'p-old'), url)
    expect(r.code, r.stderr).toBe(3)
    expect(r.stderr).toMatch(/is recording "Old daemon call" \(ses_old, recording\)/)
  }, 60_000)

  it('--force installs, and the daemon restarts on the new version only once the meeting ends', async () => {
    const { d, s } = await recording()
    const prefix = join(box, 'p-forced')
    const r = await install(prefix, d.baseUrl, '--force')
    expect(r.code, r.stderr).toBe(0)
    expect(r.stdout).toMatch(/installing anyway \(--force\)/)
    expect(existsSync(join(prefix, 'share', 'kacola', 'app', 'packages', 'cli', 'src', 'main.ts'))).toBe(true)
    expect(r.stderr).toMatch(/waiting for "Board meeting" .* to finish before restarting/)
    // the unit reloads into that same deferred restart, and a restart exit is not a failure
    const unit = readFileSync(join(HOME, '.config', 'systemd', 'user', 'kacolad.service'), 'utf8')
    expect(unit).toContain('ExecReload=/bin/kill -HUP $MAINPID')
    expect(unit).toMatch(/^RestartForceExitStatus=76$/m)
    expect(unit).toMatch(/^KillMode=mixed$/m)
    // systemd's own validator accepts it (non-zero on errors; needs ExecStart to exist)
    execFileSync(
      'systemd-analyze',
      ['verify', '--user', join(HOME, '.config', 'systemd', 'user', 'kacolad.service')],
      {
        env: { ...process.env, HOME },
        stdio: 'pipe',
      },
    )
    // the meeting carries on; the daemon goes when it ends
    expect((await d.client.call('daemonInfo')).restart).toMatchObject({ mode: 'when-idle' })
    await new Promise((res) => setTimeout(res, 1000))
    expect((await d.client.call('getSession', { params: { id: s.id } })).status).toBe('recording')
    await d.client.call('stopSession', { params: { id: s.id } })
    expect(await d.exited(15_000)).toEqual({ code: DAEMON_EXIT.RESTART, signal: null })
  }, 300_000)

  it('idle: installs and the daemon restarts at once', async () => {
    const d = await startDaemon({ env: { KACOLA_SUPERVISED: '1' } })
    daemons.push(d)
    const r = await install(join(box, 'p-forced'), d.baseUrl) // over the previous install
    expect(r.code, r.stderr).toBe(0)
    expect(r.stderr).toMatch(/restarting \(pid \d+\)/)
    expect(await d.exited(15_000)).toEqual({ code: DAEMON_EXIT.RESTART, signal: null })
  }, 300_000)
})

// Upgrading a gnomeola install (before the rename) to kacola: the app in ~/.local/share/<name> beside the
// data, as install.sh lays it out with the default prefix, so the data dir also holds the installed app.
describe('install.sh upgrading from a gnomeola install', () => {
  /** A gnomeola install and its data, under a throwaway home, as the old install.sh left them. */
  async function gnomeolaInstall(name: string) {
    const home = join(box, name)
    const prefix = join(home, '.local')
    const data = join(home, '.local', 'share', 'gnomeola') // = ${prefix}/share/gnomeola
    const units = join(home, '.config', 'systemd', 'user')
    const put = (p: string, text: string, mode = 0o644) => {
      mkdirSync(dirname(p), { recursive: true })
      writeFileSync(p, text)
      chmodSync(p, mode)
    }
    put(join(data, 'app', 'packages', 'cli', 'src', 'main.ts'), '// the old runtime\n')
    put(join(data, 'desktop', 'gnomeola'), '#!/bin/sh\nexit 0\n', 0o755)
    put(
      join(prefix, 'bin', 'gnomeola'),
      `#!/bin/sh\nexec node "${data}/app/packages/cli/src/main.ts" "$@"\n`,
      0o755,
    )
    put(
      join(prefix, 'bin', 'gnomeolad'),
      `#!/bin/sh\nexec node "${data}/app/packages/daemon/src/main.ts"\n`,
      0o755,
    )
    put(join(prefix, 'bin', 'gnomeola-ui'), `#!/bin/sh\nexec "${data}/desktop/gnomeola" "$@"\n`, 0o755)
    put(join(prefix, 'share', 'applications', 'org.gnome.Gnomeola.desktop'), '[Desktop Entry]\nName=kacola\n')
    put(join(prefix, 'share', 'icons', 'hicolor', '48x48', 'apps', 'org.gnome.Gnomeola.png'), 'png')
    put(join(units, 'gnomeolad.service'), `[Service]\nExecStart=${prefix}/bin/gnomeolad\n`)
    put(join(units, 'gnomeolad.service.d', 'override.conf'), '[Service]\nEnvironment=GNOMEOLA_TRACKER=off\n')
    put(
      join(home, '.config', 'autostart', 'org.gnome.Gnomeola.desktop'),
      `[Desktop Entry]\nExec=${data}/desktop/gnomeola --background\nX-Gnomeola-Autostart=1\n`,
    )
    const oldSkill = '---\nname: meeting-context\nallowed-tools: Bash(gnomeola:*)\n---\n'
    put(join(home, '.claude', 'skills', 'meeting-context', 'SKILL.md'), oldSkill)
    put(
      join(home, '.claude', 'skills', 'meeting-context', '.gnomeola-installed'),
      `${createHash('sha256').update(oldSkill).digest('hex').slice(0, 12)}\n`,
    )
    const oldExt = join(home, '.local', 'share', 'gnome-shell', 'extensions', 'gnomeola@gnomeola.org')
    put(join(oldExt, 'metadata.json'), '{"uuid":"gnomeola@gnomeola.org"}')
    // the old daemon, idle, on the old data dir, with a recorded meeting
    const old = await startDaemon({ dataDir: data, env: { KACOLA_FAKE_PIPELINE: PIPE } })
    daemons.push(old)
    const s = await old.client.call('createSession', { body: { title: 'Before the rename' } })
    await old.client.call('startSession', { params: { id: s.id } })
    await new Promise((r) => setTimeout(r, 600))
    await old.client.call('stopSession', { params: { id: s.id } })
    return { home, prefix, data, units, oldExt, old, session: s }
  }

  const envFor = (home: string, url: string): NodeJS.ProcessEnv => ({
    ...process.env,
    HOME: home,
    XDG_CONFIG_HOME: join(home, '.config'),
    XDG_DATA_HOME: join(home, '.local', 'share'),
    XDG_STATE_HOME: join(home, '.local', 'state'),
    KACOLA_URL: url,
    KACOLA_INSTALL_NO_SYSTEMCTL: '1',
    KACOLA_DESKTOP_APP_DIR: FAKE_APP,
  })
  const installAt = (home: string, url: string, ...args: string[]) =>
    new Promise<Run>((resolve) =>
      execFile(
        'bash',
        [INSTALL, '--node', process.execPath, ...args],
        { env: envFor(home, url), maxBuffer: 16 * 1024 * 1024, timeout: 280_000 },
        (err, stdout, stderr) =>
          resolve({ code: err ? ((err as { code?: number }).code ?? 1) : 0, stdout, stderr }),
      ),
    )

  it('refuses while the gnomeola daemon records, even with --force, and touches nothing', async () => {
    const g = await gnomeolaInstall('home-upgrade-busy')
    const s = await g.old.client.call('createSession', { body: { title: 'Live call' } })
    await g.old.client.call('startSession', { params: { id: s.id } })
    const r = await installAt(g.home, g.old.baseUrl, '--force', '--no-extension', '--no-skill')
    expect(r.code, r.stderr).toBe(3)
    expect(r.stderr).toMatch(/switches over from gnomeola/)
    expect(r.stderr).toMatch(/--force does not apply/)
    expect(existsSync(join(g.prefix, 'share', 'kacola'))).toBe(false)
    expect(existsSync(join(g.prefix, 'bin', 'kacola'))).toBe(false)
    expect(existsSync(join(g.units, 'gnomeolad.service'))).toBe(true)
    expect(existsSync(join(g.data, 'desktop', 'gnomeola'))).toBe(true)
    expect((await g.old.client.call('getSession', { params: { id: s.id } })).status).toBe('recording')
    await g.old.client.call('stopSession', { params: { id: s.id } })
  }, 120_000)

  it('switches over: new names installed, the old ones gone, then kacolad moves the data on its first start', async () => {
    const g = await gnomeolaInstall('home-upgrade')
    const r = await installAt(g.home, g.old.baseUrl)
    expect(r.code, r.stderr).toBe(0)
    expect(r.stdout).toMatch(/found a gnomeola install/)
    expect(r.stdout).toMatch(/switched over from gnomeola/)
    const bin = (n: string) => join(g.prefix, 'bin', n)
    // the new names
    for (const b of ['kacola', 'kacolad', 'kacola-ui']) expect(existsSync(bin(b)), b).toBe(true)
    expect(readFileSync(join(g.units, 'kacolad.service'), 'utf8')).toMatch(/^RestartPreventExitStatus=78$/m)
    expect(readFileSync(join(g.units, 'kacolad.service.d', 'override.conf'), 'utf8')).toContain(
      'GNOMEOLA_TRACKER',
    )
    expect(existsSync(join(g.prefix, 'share', 'applications', 'com.kacperlubisz.Kacola.desktop'))).toBe(true)
    // the old ones gone: unit, launchers, window, runtime, desktop entry, icons
    expect(existsSync(join(g.units, 'gnomeolad.service'))).toBe(false)
    for (const b of ['gnomeolad', 'gnomeola-ui']) expect(existsSync(bin(b)), b).toBe(false)
    expect(existsSync(join(g.data, 'app'))).toBe(false)
    expect(existsSync(join(g.data, 'desktop'))).toBe(false)
    expect(existsSync(join(g.prefix, 'share', 'applications', 'org.gnome.Gnomeola.desktop'))).toBe(false)
    expect(
      existsSync(join(g.prefix, 'share', 'icons', 'hicolor', '48x48', 'apps', 'org.gnome.Gnomeola.png')),
    ).toBe(false)
    // the data is not the installer's to move: the daemon does that
    expect(existsSync(join(g.data, 'kacola.db'))).toBe(true)
    // `gnomeola` forwards to kacola with a one-line note
    const alias = spawnSync(bin('gnomeola'), ['--version'], {
      env: envFor(g.home, g.old.baseUrl),
      encoding: 'utf8',
    })
    expect(alias.status).toBe(0)
    expect(alias.stderr.trim()).toBe(
      "gnomeola is now kacola: run 'kacola' instead (this alias goes in a later release)",
    )
    expect(alias.stdout).toBe(spawnSync(bin('kacola'), ['--version'], { encoding: 'utf8' }).stdout)
    // the autostart entry points at the new window
    const auto = join(g.home, '.config', 'autostart')
    expect(existsSync(join(auto, 'org.gnome.Gnomeola.desktop'))).toBe(false)
    expect(readFileSync(join(auto, 'com.kacperlubisz.Kacola.desktop'), 'utf8')).toContain(
      `Exec=${join(g.prefix, 'share', 'kacola', 'desktop', 'kacola')} --background`,
    )
    // the skill an old install wrote is updated (its old stamp recognised), with the new permission hint
    const skill = join(g.home, '.claude', 'skills', 'meeting-context')
    expect(readFileSync(join(skill, 'SKILL.md'), 'utf8')).toContain('Bash(kacola:*)')
    expect(existsSync(join(skill, '.gnomeola-installed'))).toBe(false)
    expect(r.stdout).toContain('"Bash(kacola:*)"')
    // the new top-bar extension is installed; the old one stays until the new one is switched on
    const extensions = join(g.home, '.local', 'share', 'gnome-shell', 'extensions')
    expect(existsSync(join(extensions, 'kacola@kacperlubisz.com', 'metadata.json'))).toBe(true)
    expect(existsSync(g.oldExt)).toBe(true)
    expect(r.stdout).toMatch(/old top-bar extension \(gnomeola@gnomeola\.org\) keeps working/)

    // systemd stops the old daemon at this point (`systemctl --user disable --now gnomeolad`); here the
    // test does, and names the database as a gnomeola daemon did
    await g.old.stop()
    for (const f of ['', '-wal', '-shm'])
      if (existsSync(join(g.data, `kacola.db${f}`)))
        renameSync(join(g.data, `kacola.db${f}`), join(g.data, `gnomeola.db${f}`))

    // the installed kacolad as the unit starts it (no --data-dir), with an old GNOMEOLA_* variable
    const env: NodeJS.ProcessEnv = {
      ...envFor(g.home, ''),
      KACOLA_MODELS_DIR: join(g.home, 'models'),
      KACOLA_FAKES: '1',
      KACOLA_KEYRING: 'memory',
      KACOLA_CALENDAR: 'off',
      KACOLA_DBUS: 'off',
      KACOLA_MIC_ACTIVITY: 'off',
      GNOMEOLA_HEARTBEAT_MS: '15000',
    }
    delete env.KACOLA_URL
    delete env.KACOLA_DATA_DIR
    delete env.KACOLA_HEARTBEAT_MS
    // its HOME is the throwaway one, which the test guard would take for the user's real data dir
    delete env.VITEST
    const kacolad = spawn(bin('kacolad'), ['--port', '0', '--host', '127.0.0.1'], {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let err = ''
    kacolad.stderr!.on('data', (b: Buffer) => {
      err += b.toString()
    })
    try {
      const url = await new Promise<string>((resolveUrl, reject) => {
        let out = ''
        kacolad.stdout!.on('data', (b: Buffer) => {
          out += b.toString()
          const m = /"event":"listening","url":"([^"]+)"/.exec(out)
          if (m) resolveUrl(m[1]!)
        })
        kacolad.once('exit', (code) => reject(new Error(`kacolad exited ${code}: ${err}`)))
      })
      const moved = join(g.home, '.local', 'share', 'kacola')
      const client = createClient({ baseUrl: url })
      const { sessions } = await client.call('listSessions', { query: {} })
      expect(sessions.map((x) => x.title)).toContain('Before the rename')
      expect(existsSync(join(moved, 'kacola.db'))).toBe(true)
      expect(existsSync(join(moved, 'gnomeola.db'))).toBe(false)
      expect(existsSync(join(moved, 'app', 'packages', 'daemon', 'src', 'main.ts'))).toBe(true)
      expect(lstatSync(g.data).isSymbolicLink()).toBe(true)
      expect(readlinkSync(g.data)).toBe(moved)
      expect(err).toContain('GNOMEOLA_HEARTBEAT_MS is deprecated: rename to KACOLA_HEARTBEAT_MS')
      expect(err).toMatch(/moved \d+ entries of .*gnomeola to .*kacola/)
      // the alias reaches the new daemon
      const st = spawnSync(bin('gnomeola'), ['status', '--url', url, '--json'], { encoding: 'utf8' })
      expect(st.status, st.stderr).toBe(0)
    } finally {
      kacolad.kill('SIGTERM')
      if (kacolad.exitCode === null) await new Promise((r) => kacolad.once('exit', r))
    }

    // --uninstall knows both names, and keeps the recordings
    const u = await installAt(g.home, 'http://127.0.0.1:9', '--uninstall')
    expect(u.code, u.stderr).toBe(0)
    for (const b of ['kacola', 'kacolad', 'kacola-ui', 'gnomeola']) expect(existsSync(bin(b)), b).toBe(false)
    expect(existsSync(join(g.home, '.local', 'share', 'kacola', 'kacola.db'))).toBe(true)
    expect(existsSync(join(g.home, '.local', 'share', 'kacola', 'app'))).toBe(false)
    expect(existsSync(g.oldExt)).toBe(false)
  }, 300_000)
})
