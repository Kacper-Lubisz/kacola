import { execFile, execFileSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DAEMON_EXIT } from '@kacola/protocol'
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
