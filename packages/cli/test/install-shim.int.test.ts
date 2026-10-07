import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { installCli, shimSpec, shq } from '../src/install.ts'

// P-4, for real: the shim install-cli writes is executed by /bin/sh. With the daemon down it starts "the
// app" (here: the real daemon from source, with fakes, on a free port, as the pluggable launch command),
// waits for /health and runs the command; the second call finds the daemon up and goes straight through.

const MAIN = join(import.meta.dirname, '..', 'src', 'main.ts')
const DAEMON = join(import.meta.dirname, '..', '..', 'daemon', 'src', 'main.ts')
const pids: string[] = []

afterAll(() => {
  for (const f of pids)
    if (existsSync(f)) {
      try {
        process.kill(Number(readFileSync(f, 'utf8').trim()), 'SIGTERM')
      } catch {}
    }
})

function freePort(): Promise<number> {
  return new Promise((resolve) => {
    const s = createServer()
    s.listen(0, '127.0.0.1', () => {
      const port = (s.address() as { port: number }).port
      s.close(() => resolve(port))
    })
  })
}

function sh(
  file: string,
  args: string[],
  env: Record<string, string>,
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const clean: Record<string, string | undefined> = { ...process.env, ...env }
    for (const k of ['KACOLA_URL', 'KACOLA_NO_AUTOSTART', 'KACOLA_APP_LAUNCH'])
      if (!(k in env)) delete clean[k]
    const c = spawn('/bin/sh', [file, ...args], { env: clean as NodeJS.ProcessEnv })
    let stdout = ''
    let stderr = ''
    c.stdout.on('data', (b) => (stdout += b))
    c.stderr.on('data', (b) => (stderr += b))
    c.on('error', reject)
    c.on('close', (code) => resolve({ code, stdout, stderr }))
  })
}

/**
 * A loopback daemon URL nothing can answer: an unprivileged process cannot bind port 1. A port from
 * freePort() is only free until another test file running in parallel binds it, which once made the
 * "unreachable" daemon answer (exit 0 instead of 3) in the full release gate.
 */
const DEAD = 'http://127.0.0.1:1'

async function setup(launch: (port: number, dir: string) => string | null) {
  const home = mkdtempSync(join(tmpdir(), 'kacola-shim-'))
  const port = await freePort()
  const data = join(home, 'data')
  const r = installCli({
    spec: shimSpec('dev', { node: process.execPath, entry: MAIN, launch: launch(port, data) }),
    home,
    path: '',
    skill: null,
  })
  return { home, port, shim: r.shim.path, url: `http://127.0.0.1:${port}`, data }
}

describe('the install-cli shim', () => {
  it('daemon down → starts the app in the background, waits for it, runs the command; then direct', async () => {
    const pidFile = join(mkdtempSync(join(tmpdir(), 'kacola-pid-')), 'pid')
    pids.push(pidFile)
    const s = await setup(
      (port, data) =>
        `sh -c ${shq(`echo $$ > ${pidFile}; KACOLA_FAKES=1 KACOLA_KEYRING=memory KACOLA_CALENDAR=off KACOLA_DBUS=off exec ${process.execPath} ${DAEMON} --port ${port} --data-dir ${data}`)}`,
    )
    const t0 = Date.now()
    const first = await sh(s.shim, ['sessions', 'list'], {
      KACOLA_URL: s.url,
      KACOLA_START_TIMEOUT: '20',
    })
    expect(first.code, first.stderr).toBe(0)
    expect(JSON.parse(first.stdout)).toEqual({ sessions: [] })
    expect(first.stderr).toMatch(/daemon is not running/)
    expect(first.stderr).toMatch(/starting the kacola app in the background/)
    expect(first.stderr).not.toMatch(/systemctl/) // the shim owns the recovery, not the user
    expect(Date.now() - t0).toBeLessThan(20_000)
    expect(existsSync(pidFile)).toBe(true)

    const second = await sh(s.shim, ['status'], { KACOLA_URL: s.url })
    expect(second.code).toBe(0)
    expect(second.stderr).toBe('')
    expect(JSON.parse(second.stdout)).toMatchObject({ ok: true })
    rmSync(s.home, { recursive: true, force: true })
  }, 40_000)

  it('does not autostart when told not to, for a remote daemon, or without a launch command', async () => {
    const s = await setup(() => 'touch /nonexistent/should-not-run')
    const off = await sh(s.shim, ['status'], { KACOLA_URL: DEAD, KACOLA_NO_AUTOSTART: '1' })
    expect(off.code).toBe(3)
    expect(off.stderr).not.toMatch(/starting/)
    const remote = await sh(s.shim, ['status'], {
      KACOLA_URL: 'http://192.0.2.1:9',
      KACOLA_NO_AUTOSTART: '',
    })
    expect(remote.code).toBe(3)
    expect(remote.stderr).not.toMatch(/starting/)
    const none = await setup(() => null)
    const r = await sh(none.shim, ['status'], { KACOLA_URL: DEAD })
    expect(r.code).toBe(3)
    expect(r.stderr).not.toMatch(/starting/)
  }, 30_000)

  it('gives up after KACOLA_START_TIMEOUT when the app never brings the daemon up', async () => {
    const s = await setup(() => 'true')
    const r = await sh(s.shim, ['status'], { KACOLA_URL: DEAD, KACOLA_START_TIMEOUT: '2' })
    expect(r.code).toBe(3)
    expect(r.stderr).toMatch(/did not start its daemon within 2s/)
  }, 30_000)

  it('passes arguments through verbatim and keeps the CLI exit code', async () => {
    const s = await setup(() => null)
    const r = await sh(s.shim, ['transcript', 'it\'s a "quoted" arg'], { KACOLA_URL: s.url })
    expect(r.code).toBe(3) // unreachable, not a usage error: the argument arrived intact
    const u = await sh(s.shim, ['no-such-command'], {})
    expect(u.code).toBe(2)
  }, 30_000)
})
