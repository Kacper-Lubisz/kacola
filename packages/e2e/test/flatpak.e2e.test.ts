import { type ChildProcess, spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createClient, type GnomeolaClient } from '@gnomeola/protocol'
import { waitFor } from '@gnomeola/testkit/daemon'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildFlatpak } from '../../../scripts/build-flatpak.ts'
import { type FakeAnthropic, loadCassette, startFakeAnthropic } from '../src/fake-anthropic.ts'
import { REPO } from '../src/runtime.ts'

// P-5: the Flatpak, installed and driven for real. The bundle (scripts/build-flatpak.ts; placeholder main
// until packages/desktop lands) is installed into a throwaway `--user` installation (FLATPAK_USER_DIR) with
// a throwaway HOME, so nothing touches the user's own Flatpaks, data or ~/.local/bin. Inside the sandbox:
// the natives load on the app's Electron, pw-record reaches PipeWire, the data lands in ~/.var/app; the
// app starts the daemon in the background; the CLI — inside the sandbox, and through the host shim that
// `install-cli` writes — lists, searches and asks; and the shim starts the app when the daemon is down.
//
// GNOMEOLA_FLATPAK_BUNDLE=path skips the build and tests that bundle.

const APP = 'org.gnome.Gnomeola'
const CASSETTES = join(REPO, 'packages', 'llm', 'test', 'fixtures', 'cassettes')

let bundle = ''
let userDir = ''
let home = ''
let port = 0
let url = ''
let api: FakeAnthropic
const children = new Set<ChildProcess>()

function freePort(): Promise<number> {
  return new Promise((resolve) => {
    const s = createServer()
    s.listen(0, '127.0.0.1', () => {
      const p = (s.address() as { port: number }).port
      s.close(() => resolve(p))
    })
  })
}

/** Environment for every flatpak call: the throwaway installation and home, a private daemon config. */
function env(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  return {
    ...process.env,
    FLATPAK_USER_DIR: userDir,
    HOME: home,
    // the daemon inside the sandbox: our port, no session-bus name, no keyring, fake capture for content
    GNOMEOLA_URL: url,
    GNOMEOLA_DBUS: 'off',
    GNOMEOLA_CALENDAR: 'off',
    GNOMEOLA_MIC_ACTIVITY: 'off',
    GNOMEOLA_KEYRING: 'memory',
    GNOMEOLA_FAKES: '1',
    GNOMEOLA_FAKE_PIPELINE: JSON.stringify({
      speed: 20,
      segmentEveryMs: 4000,
      finalizeAfterMs: 30,
      tickMs: 20,
    }),
    ANTHROPIC_API_KEY: 'sk-ant-flatpak-0123456789',
    ANTHROPIC_BASE_URL: api.url,
    ...extra,
  }
}

function run(cmd: string, args: string[], extra: Record<string, string> = {}, timeoutMs = 60_000) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const c = spawn(cmd, args, { env: env(extra), stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    c.stdout.on('data', (d: Buffer) => {
      stdout += d.toString()
    })
    c.stderr.on('data', (d: Buffer) => {
      stderr += d.toString()
    })
    const t = setTimeout(() => {
      c.kill('SIGKILL')
      reject(new Error(`${cmd} ${args.join(' ')} timed out\n${stderr}`))
    }, timeoutMs)
    c.on('error', reject)
    c.on('close', (code) => {
      clearTimeout(t)
      resolve({ code, stdout, stderr })
    })
  })
}

const flatpakCli = (args: string[], extra: Record<string, string> = {}) =>
  run('flatpak', ['run', '--user', `--command=gnomeola`, APP, ...args], extra)

/** The app in the background, headless (no display needed for --background). */
const LAUNCH = `flatpak run --user ${APP} --background --ozone-platform=headless --disable-gpu`

function startApp(): ChildProcess {
  const c = spawn('sh', ['-c', `exec ${LAUNCH}`], { env: env(), stdio: ['ignore', 'ignore', 'pipe'] })
  children.add(c)
  c.once('exit', () => children.delete(c))
  return c
}

async function stopApp(): Promise<void> {
  await run('flatpak', ['kill', APP]).catch(() => {})
  for (const c of children) c.kill('SIGKILL')
  await waitFor(async () => !(await healthy()), 15_000, 'the sandboxed daemon to go away')
}

async function healthy(): Promise<boolean> {
  try {
    return (await fetch(`${url}/health`, { signal: AbortSignal.timeout(1000) })).ok
  } catch {
    return false
  }
}

let client: GnomeolaClient

beforeAll(async () => {
  api = await startFakeAnthropic()
  port = await freePort()
  url = `http://127.0.0.1:${port}`
  client = createClient({ baseUrl: url, timeoutMs: 10_000 })
  bundle = process.env.GNOMEOLA_FLATPAK_BUNDLE ?? ''
  if (!bundle) {
    const r = await buildFlatpak({ outDir: join(REPO, 'dist', 'flatpak') })
    bundle = r.bundle!
    console.log(
      `[flatpak] bundle ${(r.bundleBytes! / 1024 / 1024).toFixed(1)} MiB, /app ${(r.appBytes / 1024 / 1024).toFixed(1)} MiB`,
    )
  }
  userDir = mkdtempSync(join(tmpdir(), 'gnomeola-flatpak-user-'))
  home = mkdtempSync(join(tmpdir(), 'gnomeola-flatpak-home-'))
  const inst = await run(
    'flatpak',
    ['install', '--user', '-y', '--noninteractive', '--bundle', bundle],
    {},
    300_000,
  )
  expect(inst.code, inst.stderr).toBe(0)
}, 1_200_000)

afterAll(async () => {
  await run('flatpak', ['kill', APP]).catch(() => {})
  for (const c of children) c.kill('SIGKILL')
  await api?.close()
  for (const d of [userDir, home]) if (d) rmSync(d, { recursive: true, force: true })
}, 60_000)

describe('the org.gnome.Gnomeola Flatpak', () => {
  it('is installed in the throwaway installation only, with the declared permissions', async () => {
    const info = await run('flatpak', ['info', '--user', '--show-permissions', APP])
    expect(info.code, info.stderr).toBe(0)
    for (const p of [
      'xdg-run/pipewire-0',
      '~/.local/bin:create',
      '~/.claude/skills:create',
      'xdg-data/gnome-shell/extensions:create',
      'org.gnome.evolution.dataserver.*=talk',
      'org.freedesktop.secrets=talk',
      'org.gnome.Gnomeola=own',
      'network',
    ])
      expect(info.stdout, p).toContain(p)
    expect(existsSync(join(userDir, 'app', APP))).toBe(true)
  })

  it('inside the sandbox: natives load on Electron’s Node, PipeWire answers, the data dirs are writable', async () => {
    const r = await run('flatpak', ['run', '--user', '--command=gnomeola-selftest', APP])
    expect(r.code, `${r.stdout}\n${r.stderr}`).toBe(0)
    const t = JSON.parse(r.stdout)
    expect(t.flatpakId).toBe(APP)
    expect(t.node).toBe('24.21.0')
    expect(t.electron).toMatch(/^44\./)
    expect(t.sqlite).toMatchObject({ ok: true, version: expect.stringMatching(/^3\./) })
    expect(t.sherpa).toEqual({ ok: true, exports: ['OnlineRecognizer', 'OfflineRecognizer', 'Vad'] })
    expect(t.pwRecord.ok).toBe(true)
    expect(t.pwDump.ok, JSON.stringify(t.pwDump)).toBe(true)
    expect(t.pwDump.nodes).toBeGreaterThan(0)
    expect(t.ffmpeg.ok).toBe(true)
    expect(t.secretTool.ok).toBe(true)
    expect(t.dirs).toEqual({
      ok: true,
      dataDir: join(home, '.var', 'app', APP, 'data', 'gnomeola'),
      modelsDir: join(home, '.var', 'app', APP, 'data', 'gnomeola', 'models'),
      writable: true,
    })
  })

  it('the app starts the bundled daemon in the background; its data lands in ~/.var/app', async () => {
    startApp()
    await waitFor(healthy, 30_000, 'the sandboxed daemon to answer')
    const h = await client.call('health')
    expect(h.ok).toBe(true)
    expect(existsSync(join(home, '.var', 'app', APP, 'data', 'gnomeola', 'gnomeola.db'))).toBe(true)
  }, 60_000)

  it('the CLI inside the sandbox lists, searches and asks', async () => {
    const s = await client.call('createSession', { body: { title: 'Flatpak standup' } })
    await client.call('startSession', { params: { id: s.id } })
    await waitFor(
      async () => (await client.call('getTranscript', { params: { id: s.id } })).segments.length >= 8,
      20_000,
      'segments',
    )
    await client.call('stopSession', { params: { id: s.id } })
    const ls = await flatpakCli(['sessions', 'list'])
    expect(ls.code, ls.stderr).toBe(0)
    expect(JSON.parse(ls.stdout).sessions.map((x: { id: string }) => x.id)).toContain(s.id)
    const first = (await client.call('getTranscript', { params: { id: s.id } })).segments[0]!
    const word = first.text
      .split(/\s+/)
      .find((w) => w.length > 4)!
      .replace(/\W/g, '')
    const se = await flatpakCli(['search', word])
    expect(se.code, se.stderr).toBe(0)
    expect(JSON.parse(se.stdout).hits.length).toBeGreaterThan(0)
    api.enqueue(...loadCassette(join(CASSETTES, 'cited-answer.json')))
    const a = await flatpakCli(['ask', 'what is the retry budget?', '--session', s.id])
    expect(a.code, a.stderr).toBe(0)
    expect(JSON.parse(a.stdout).answer).toMatch(/three attempts/)
  }, 60_000)

  it('install-cli from inside the sandbox writes the host shim + skill; the shim drives the sandboxed daemon', async () => {
    const r = await flatpakCli(['install-cli'], { PATH: '/usr/bin:/bin' })
    expect(r.code, r.stderr).toBe(0)
    const out = JSON.parse(r.stdout)
    const shim = join(home, '.local', 'bin', 'gnomeola')
    expect(out).toMatchObject({
      mode: 'flatpak',
      shim: { path: shim, action: 'installed' },
      skill: { action: 'installed' },
    })
    expect(readFileSync(shim, 'utf8')).toContain(`'flatpak' 'run' '--command=gnomeola' '${APP}'`)
    expect(existsSync(join(home, '.claude', 'skills', 'meeting-context', 'SKILL.md'))).toBe(true)
    const st = await run('sh', [shim, 'status'])
    expect(st.code, st.stderr).toBe(0)
    expect(JSON.parse(st.stdout)).toMatchObject({ ok: true })
  }, 60_000)

  it('the shim starts the app when the daemon is down, waits for it, and runs the command', async () => {
    await stopApp()
    const shim = join(home, '.local', 'bin', 'gnomeola')
    const r = await run(
      'sh',
      [shim, 'sessions', 'list'],
      { GNOMEOLA_APP_LAUNCH: LAUNCH, GNOMEOLA_START_TIMEOUT: '40' },
      90_000,
    )
    expect(r.code, r.stderr).toBe(0)
    expect(r.stderr).toMatch(/starting the gnomeola app in the background/)
    expect(JSON.parse(r.stdout).sessions.length).toBeGreaterThan(0)
    expect(await healthy()).toBe(true)
  }, 120_000)

  it('uninstall-cli removes the shim and the skill again', async () => {
    const r = await flatpakCli(['uninstall-cli'])
    expect(r.code, r.stderr).toBe(0)
    expect(existsSync(join(home, '.local', 'bin', 'gnomeola'))).toBe(false)
    expect(existsSync(join(home, '.claude', 'skills', 'meeting-context'))).toBe(false)
  })
})
