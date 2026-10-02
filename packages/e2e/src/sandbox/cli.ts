import { spawn, spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { connect } from 'node:net'
import { homedir } from 'node:os'
import { join, relative as relPath, resolve } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { parseArgs } from 'node:util'
import { createClient, DEFAULT_PORT, type GnomeolaClient, platformPaths } from '@gnomeola/protocol'
import {
  meetingId,
  parseDuration,
  readMeetings,
  relative,
  type SandboxMeeting,
  seedMeetings,
  writeMeetings,
} from './calendar.ts'
import { SCENARIOS, type Scenario, scenario, scriptCard, scriptFor, scriptSeconds } from './scenarios.ts'

// `pnpm sandbox …` — a complete, isolated kacola to try every feature alone: its own daemon (own data dir,
// own port, an in-memory keyring), a mock calendar file, a local hosted sharing server, and a separate
// window profile ("kacola · sandbox"). Nothing here reads or writes the everyday kacola's data dir,
// daemon, keyring, calendar or window. See docs/testing-kacola.md for the missions.

const REPO = resolve(import.meta.dirname, '..', '..', '..', '..')
const DAEMON_MAIN = join(REPO, 'packages', 'daemon', 'src', 'main.ts')
const CLI_MAIN = join(REPO, 'packages', 'cli', 'src', 'main.ts')
const HOST_MAIN = join(REPO, 'packages', 'e2e', 'src', 'sandbox', 'host.ts')
const DESKTOP = join(REPO, 'packages', 'desktop')
const MARKER = '.kacola-sandbox'
const DEFAULT_SANDBOX_PORT = 8790

export const USAGE = `pnpm sandbox <command>  — an isolated kacola with a mock calendar, to try everything alone

  start [--scenario NAME] [--audio scripted|mic] [--llm auto|anthropic|openai|ollama|fake|none]
        [--decisions auto|jev|openai|local] [--port 8790] [--share-port 8791] [--fresh] [--no-window]
                       start the sandbox daemon, the sharing server and a "kacola · sandbox" window
  status               what is running, where, and with which providers
  stop                 stop everything the sandbox started (your everyday kacola is never touched)
  reset [--yes]        delete the sandbox directory (asks first; only the sandbox's own files)

  meeting add "<title>" --in 5m [--for 30m] [--with "Ana Ruiz"]   add a meeting to the mock calendar
  meeting list                                                   the mock day
  meeting clear [--all]        remove the meetings you added (--all: every meeting)

  scenarios            the scripted meetings and what each exercises
  agenda <scenario> [--print]  load a scenario's suggested agenda into its meeting (--print: just show it)
  play <scenario> [--speed N] [--detach] [--no-agenda]
                       record the scenario's meeting and speak its script live (scripted audio)
  card <scenario>      the script card to read aloud yourself (--audio mic)
  mail                 the sign-in codes the sharing server "emailed" (to open a link as Ana)
  providers [--llm …] [--decisions …]   switch the sandbox's providers live
  cli -- <args>        run the gnomeola CLI against the sandbox
  env                  print the GNOMEOLA_URL export for Claude Code / your shell

options for every command:
  --dir DIR            the sandbox directory (default \${XDG_DATA_HOME:-~/.local/share}/kacola-sandbox,
                       or KACOLA_SANDBOX_DIR)
`

// --------------------------------------------------------------------------- paths, state, safety

export type Paths = ReturnType<typeof pathsFor>
const pathsFor = (dir: string) => ({
  dir,
  marker: join(dir, MARKER),
  state: join(dir, 'state.json'),
  data: join(dir, 'data'),
  host: join(dir, 'host'),
  meetings: join(dir, 'meetings.json'),
  calendar: join(dir, 'calendar.json'),
  play: join(dir, 'play.json'),
  electron: join(dir, 'electron'),
  uiState: join(dir, 'ui-state.json'),
  models: join(dir, 'models'),
  logs: join(dir, 'logs'),
})

export type Providers = {
  llm: 'anthropic' | 'openai' | 'ollama' | 'fake' | 'none'
  decisions: 'jev' | 'openai' | 'local'
}

export type SandboxState = {
  version: 1
  dir: string
  url: string
  port: number
  shareUrl: string
  sharePort: number
  audio: 'scripted' | 'mic'
  providers: Providers
  pids: { daemon: number; host: number; window?: number }
  startedAt: string
}

type Env = Record<string, string | undefined>

/** The everyday kacola's data dir, as the daemon would resolve it without GNOMEOLA_DATA_DIR. */
function realDataDir(env: Env): string {
  return platformPaths({
    platform: process.platform,
    env: { ...env, GNOMEOLA_DATA_DIR: '' },
    home: home(env),
  }).dataDir
}
const home = (env: Env) => env.HOME || homedir()

export function sandboxDir(flag: string | undefined, env: Env): string {
  const dir = resolve(
    flag ||
      env.KACOLA_SANDBOX_DIR ||
      join(env.XDG_DATA_HOME || join(home(env), '.local', 'share'), 'kacola-sandbox'),
  )
  const inside = (a: string, b: string) => a === b || !relPath(b, a).startsWith('..')
  // the default data dir, and the one this shell points a daemon at (if any)
  for (const real of [realDataDir(env), env.GNOMEOLA_DATA_DIR].filter(Boolean).map((d) => resolve(d!)))
    if (inside(dir, real) || inside(real, dir))
      throw new SandboxError(`refusing to use ${dir}: it overlaps your real kacola data (${real})`)
  if (dir === resolve(home(env)) || dir === '/')
    throw new SandboxError(`refusing to use ${dir} as the sandbox`)
  return dir
}

export class SandboxError extends Error {
  override name = 'SandboxError'
}

function readState(p: Paths): SandboxState | null {
  if (!existsSync(p.state)) return null
  try {
    return JSON.parse(readFileSync(p.state, 'utf8')) as SandboxState
  } catch {
    return null
  }
}

const atomicWrite = (file: string, text: string) => {
  writeFileSync(`${file}.tmp`, text)
  renameSync(`${file}.tmp`, file)
}

function alive(pid: number | undefined): boolean {
  if (!pid) return false
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

/** Only ever signal a process the sandbox started: its command line names the sandbox directory. */
function ours(pid: number | undefined, dir: string): boolean {
  if (!alive(pid)) return false
  try {
    return readFileSync(`/proc/${pid}/cmdline`, 'utf8').includes(dir)
  } catch {
    return process.platform !== 'linux' // no /proc: trust the state file
  }
}

function portAnswers(port: number): Promise<boolean> {
  return new Promise((res) => {
    const s = connect({ port, host: '127.0.0.1' })
    s.once('connect', () => {
      s.destroy()
      res(true)
    })
    s.once('error', () => res(false))
  })
}

async function waitFor(what: string, probe: () => Promise<boolean>, ms: number, log?: string): Promise<void> {
  const end = Date.now() + ms
  while (Date.now() < end) {
    if (await probe().catch(() => false)) return
    await new Promise((r) => setTimeout(r, 200))
  }
  const tail =
    log && existsSync(log)
      ? `\n--- ${log} (last lines)\n${readFileSync(log, 'utf8').split('\n').slice(-15).join('\n')}`
      : ''
  throw new SandboxError(`timed out waiting for ${what}${tail}`)
}

function spawnDetached(cmd: string, args: string[], env: Env, log: string, cwd = REPO): number {
  const fd = openSync(log, 'a')
  const child = spawn(cmd, args, {
    cwd,
    env: env as NodeJS.ProcessEnv,
    detached: true,
    stdio: ['ignore', fd, fd],
  })
  child.unref()
  if (!child.pid) throw new SandboxError(`could not start ${cmd}`)
  return child.pid
}

// --------------------------------------------------------------------------- providers

const has = (env: Env, k: string) => Boolean(env[k]?.trim())

export function chooseProviders(env: Env, want: { llm?: string; decisions?: string }): Providers {
  const llm = (want.llm ?? 'auto') as Providers['llm'] | 'auto'
  const decisions = (want.decisions ?? 'auto') as Providers['decisions'] | 'auto'
  if (!['auto', 'anthropic', 'openai', 'ollama', 'fake', 'none'].includes(llm))
    throw new SandboxError(`--llm must be auto, anthropic, openai, ollama, fake or none (got ${llm})`)
  if (!['auto', 'jev', 'openai', 'local'].includes(decisions))
    throw new SandboxError(`--decisions must be auto, jev, openai or local (got ${decisions})`)
  return {
    llm:
      llm !== 'auto'
        ? llm
        : has(env, 'ANTHROPIC_API_KEY')
          ? 'anthropic'
          : has(env, 'OPENAI_API_KEY')
            ? 'openai'
            : 'fake',
    decisions:
      decisions !== 'auto'
        ? decisions
        : has(env, 'TYPESAFE_API_KEY') || has(env, 'TYPESAFE_AI_API_KEY')
          ? 'jev'
          : has(env, 'OPENAI_API_KEY')
            ? 'openai'
            : 'local',
  }
}

function describeProviders(p: Providers, env: Env): string[] {
  const key = (k: string) => (has(env, k) ? 'key from your environment' : `no ${k}: expect a provider error`)
  const llm = {
    anthropic: `Anthropic (${key('ANTHROPIC_API_KEY')})`,
    openai: `OpenAI (${key('OPENAI_API_KEY')})`,
    ollama: 'Ollama on this computer (http://127.0.0.1:11434)',
    fake: 'canned answers (no API key found; it follows the cloud privacy rules). Set ANTHROPIC_API_KEY or OPENAI_API_KEY for real answers',
    none: 'none (Ask, Enhance and recaps will say no provider is set up)',
  }[p.llm]
  const typesafe = has(env, 'TYPESAFE_API_KEY') || has(env, 'TYPESAFE_AI_API_KEY')
  const decisions = {
    jev: `jev from TypeSafe AI (${typesafe ? 'key from your environment' : 'no TYPESAFE_API_KEY: expect a provider error'})`,
    openai: `OpenAI structured decisions (${key('OPENAI_API_KEY')})`,
    local:
      'on-device (no key needed; uses the hashing embedder unless the text-embedding model is installed)',
  }[p.decisions]
  return [`  Ask / Enhance / recaps: ${llm}`, `  Live check-offs:        ${decisions}`]
}

/** The settings PATCH that selects them (the fake LLM is chosen at daemon start: GNOMEOLA_FAKE_QA). */
function settingsFor(p: Providers) {
  return {
    llm: { provider: p.llm === 'fake' ? ('anthropic' as const) : p.llm },
    decisions: { provider: p.decisions },
  }
}

// --------------------------------------------------------------------------- the daemon's environment

function daemonEnv(
  p: Paths,
  o: { port: number; shareUrl: string; adminToken: string; audio: string; providers: Providers },
  env: Env,
): Env {
  const out: Env = { ...env }
  // nothing of the everyday daemon's set-up leaks in, and nothing here reaches the desktop session
  for (const k of Object.keys(out))
    if (k.startsWith('GNOMEOLA_') || k === 'INVOCATION_ID' || k === 'ELECTRON_RUN_AS_NODE') delete out[k]
  if (env.TYPESAFE_AI_API_KEY && !env.TYPESAFE_API_KEY) out.TYPESAFE_API_KEY = env.TYPESAFE_AI_API_KEY
  Object.assign(out, {
    GNOMEOLA_DATA_DIR: p.data,
    GNOMEOLA_KEYRING: 'memory',
    GNOMEOLA_CALENDAR: `file:${p.calendar}`,
    GNOMEOLA_DBUS: 'off',
    GNOMEOLA_MIC_ACTIVITY: 'off',
    GNOMEOLA_SHARE_URL: o.shareUrl,
    GNOMEOLA_SHARE_TOKEN: o.adminToken,
    GNOMEOLA_OWNER_NAME: 'You (sandbox)',
    GNOMEOLA_OWNER_EMAIL: 'you@sandbox.test',
    GNOMEOLA_SHARE_POLL_MS: '3000',
    GNOMEOLA_RESUME_WINDOW_MS: '0',
  })
  if (o.audio === 'scripted') {
    out.GNOMEOLA_FAKES = '1'
    out.GNOMEOLA_FAKE_PIPELINE = JSON.stringify({
      scriptFile: p.play,
      scriptLive: true,
      speed: 1,
      partialEveryMs: 300,
      finalizeAfterMs: 600,
    })
  } else {
    out.GNOMEOLA_MODELS_DIR = p.models
  }
  if (o.providers.llm === 'fake') out.GNOMEOLA_FAKE_QA = '1'
  return out
}

/**
 * --audio mic uses the speech models you already installed, read-only: the sandbox's models dir links to
 * each installed model, so a model downloaded from the sandbox lands in the sandbox, not in your kacola.
 */
function linkModels(p: Paths, env: Env): number {
  const installed = platformPaths({
    platform: process.platform,
    env: { ...env, GNOMEOLA_DATA_DIR: '' },
    home: home(env),
  }).modelsDir
  mkdirSync(p.models, { recursive: true })
  if (!existsSync(installed)) return 0
  let n = 0
  for (const name of readdirSync(installed)) {
    const from = join(installed, name)
    const to = join(p.models, name)
    if (existsSync(to) || !statSync(from).isDirectory()) continue
    symlinkSync(from, to)
    n++
  }
  return n
}

// --------------------------------------------------------------------------- the window

/** On top of the daemon's environment: the window's separate profile, pointed at the sandbox daemon. */
export function windowEnv(p: Paths, url: string): Env {
  return {
    GNOMEOLA_URL: url,
    GNOMEOLA_PROFILE: 'sandbox',
    GNOMEOLA_USER_DATA_DIR: p.electron,
    GNOMEOLA_UI_STATE_FILE: p.uiState,
    GNOMEOLA_REGISTER_SCHEME: '0',
    // if the window ever has to start a daemon itself, it is this sandbox's
    GNOMEOLA_DAEMON_ARGS: JSON.stringify(['--data-dir', p.data]),
    ELECTRON_RUN_AS_NODE: undefined,
  }
}

function electronBinary(): string | null {
  const bin = join(
    DESKTOP,
    'node_modules',
    'electron',
    'dist',
    process.platform === 'darwin' ? 'Electron.app/Contents/MacOS/Electron' : 'electron',
  )
  return existsSync(bin) ? bin : null
}

function newest(dir: string): number {
  let t = 0
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const f = join(dir, e.name)
    t = Math.max(t, e.isDirectory() ? newest(f) : statSync(f).mtimeMs)
  }
  return t
}

function ensureDesktopBuilt(out: (s: string) => void): string {
  const entry = join(DESKTOP, 'out', 'main', 'index.js')
  if (existsSync(entry) && statSync(entry).mtimeMs >= newest(join(DESKTOP, 'src'))) return entry
  out('  building the desktop app (electron-vite) …')
  const r = spawnSync('pnpm', ['--dir', DESKTOP, 'run', 'build'], { stdio: ['ignore', 'ignore', 'inherit'] })
  if (r.status !== 0)
    throw new SandboxError('the desktop build failed (pnpm --dir packages/desktop run build)')
  return entry
}

// --------------------------------------------------------------------------- commands

type Out = { log: (s: string) => void; err: (s: string) => void }
type Ctx = { p: Paths; env: Env; out: Out }

const client = (st: SandboxState): GnomeolaClient => createClient({ baseUrl: st.url, timeoutMs: 15_000 })

function running(c: Ctx): SandboxState {
  const st = readState(c.p)
  if (!st || !ours(st.pids.daemon, c.p.dir))
    throw new SandboxError(`the sandbox is not running (start it: pnpm sandbox start)`)
  return st
}

async function start(c: Ctx, o: Record<string, string | boolean | undefined>): Promise<void> {
  const { p, env, out } = c
  const audio = (o.audio as string | undefined) ?? 'scripted'
  if (audio !== 'scripted' && audio !== 'mic') throw new SandboxError('--audio must be scripted or mic')
  const pick = o.scenario as string | undefined
  if (pick && !scenario(pick)) throw new SandboxError(`no scenario ${pick} (pnpm sandbox scenarios)`)
  const port = Number(o.port ?? DEFAULT_SANDBOX_PORT)
  const sharePort = Number(o['share-port'] ?? port + 1)
  if (port === DEFAULT_PORT || sharePort === DEFAULT_PORT)
    throw new SandboxError(`port ${DEFAULT_PORT} is your everyday kacola's; pick another --port`)

  const prev = readState(p)
  if (prev && ours(prev.pids.daemon, p.dir)) {
    out.log(`The sandbox is already running at ${prev.url} (pnpm sandbox status; pnpm sandbox stop).`)
    return
  }
  if (existsSync(p.dir) && readdirSync(p.dir).length > 0 && !existsSync(p.marker))
    throw new SandboxError(`${p.dir} exists and is not a kacola sandbox; pick another --dir`)
  for (const [name, n] of [
    ['--port', port],
    ['--share-port', sharePort],
  ] as const)
    if (await portAnswers(n))
      throw new SandboxError(`something already listens on ${n}; pick another ${name}`)

  for (const d of [p.dir, p.data, p.host, p.logs, p.electron]) mkdirSync(d, { recursive: true, mode: 0o700 })
  writeFileSync(
    p.marker,
    'This directory is a kacola sandbox (pnpm sandbox). `pnpm sandbox reset` deletes it.\n',
  )

  // the mock day: kept across restarts while its meetings are still ahead (agendas stay linked to them)
  const now = Date.now()
  let meetings = readMeetings(p.meetings)
  const stale = !meetings.some((m) => m.origin === 'seed' && Date.parse(m.end) > now)
  if (o.fresh || stale)
    meetings = [
      ...seedMeetings(now),
      ...meetings.filter((m) => m.origin === 'user' && Date.parse(m.end) > now),
    ]
  writeMeetings(p, meetings)
  const firstRun = !existsSync(join(p.data, 'gnomeola.db'))
  if (firstRun) {
    const { seedPast } = await import('./seed.ts')
    seedPast(p.data, meetings)
  }
  if (!existsSync(p.uiState))
    writeFileSync(
      p.uiState,
      JSON.stringify({ version: 1, onboardingDone: true, skippedMissing: [], extensionCardDismissed: true }),
    )
  const tokenFile = join(p.host, 'admin-token')
  if (!existsSync(tokenFile)) writeFileSync(tokenFile, randomBytes(24).toString('hex'), { mode: 0o600 })
  const adminToken = readFileSync(tokenFile, 'utf8').trim()

  // the sharing server
  const hostLog = join(p.logs, 'host.log')
  const hostPid = spawnDetached(
    process.execPath,
    [HOST_MAIN, '--dir', p.host, '--port', String(sharePort), '--admin-token', adminToken],
    { ...env, ELECTRON_RUN_AS_NODE: undefined },
    hostLog,
  )
  const shareUrl = `http://127.0.0.1:${sharePort}`
  await waitFor('the sharing server', () => fetch(`${shareUrl}/health`).then(() => true), 60_000, hostLog)

  // the daemon
  const providers = chooseProviders(env, { llm: o.llm as string, decisions: o.decisions as string })
  if (audio === 'mic') linkModels(p, env)
  const denv = daemonEnv(p, { port, shareUrl, adminToken, audio, providers }, env)
  const daemonLog = join(p.logs, 'daemon.log')
  const daemonPid = spawnDetached(
    process.execPath,
    [DAEMON_MAIN, '--port', String(port), '--data-dir', p.data],
    denv,
    daemonLog,
  )
  const url = `http://127.0.0.1:${port}`
  const st: SandboxState = {
    version: 1,
    dir: p.dir,
    url,
    port,
    shareUrl,
    sharePort,
    audio,
    providers,
    pids: { daemon: daemonPid, host: hostPid },
    startedAt: new Date().toISOString(),
  }
  atomicWrite(p.state, `${JSON.stringify(st, null, 2)}\n`)
  try {
    await waitFor(
      'the sandbox daemon',
      async () => {
        if (!alive(daemonPid)) throw new SandboxError(`the sandbox daemon exited; see ${daemonLog}`)
        const r = await fetch(`${url}/daemon`)
        return r.ok && ((await r.json()) as { dataDir: string }).dataDir === p.data
      },
      60_000,
      daemonLog,
    )
  } catch (err) {
    out.err(`${(err as Error).message}`)
    await stop(c, { quiet: true })
    throw new SandboxError('the sandbox did not start')
  }
  await client(st).call('updateSettings', { body: settingsFor(providers) })
  if (audio === 'scripted') {
    // the scripted sandbox's speech models are the fake pipeline's stand-ins: "download" them (instant),
    // so the window does not ask for models the scripted meetings never use
    const api = client(st)
    for (const m of (await api.call('listModels')).models)
      if (m.state === 'missing') await api.call('downloadModel', { params: { id: m.id } })
    await waitFor(
      'the stand-in models',
      async () => (await api.call('listModels')).models.every((m) => m.state === 'ready'),
      10_000,
    )
  }

  // the window
  if (!o['no-window']) {
    const bin = electronBinary()
    if (!bin)
      out.err(
        '  (no window: Electron is not installed here; run pnpm install, then pnpm sandbox start again)',
      )
    else {
      const entry = ensureDesktopBuilt(out.log)
      st.pids.window = spawnDetached(
        bin,
        [entry, `--kacola-sandbox=${p.dir}`],
        { ...denv, ...windowEnv(p, url) },
        join(p.logs, 'window.log'),
        DESKTOP,
      )
      atomicWrite(p.state, `${JSON.stringify(st, null, 2)}\n`)
    }
  }

  out.log('')
  out.log(`kacola sandbox is running  (${p.dir})`)
  out.log(`  daemon        ${url}   (data: ${p.data}, keyring: in memory)`)
  out.log(`  sharing       ${shareUrl}   (links open in any browser; sign-in codes: pnpm sandbox mail)`)
  out.log(`  calendar      ${p.calendar}`)
  out.log(
    `  audio         ${audio === 'scripted' ? 'scripted meetings (pnpm sandbox play <scenario>)' : 'your microphone, installed speech models'}`,
  )
  out.log(
    `  window        ${st.pids.window ? '"kacola · sandbox" (a separate window; your everyday one is untouched)' : 'not started'}`,
  )
  out.log('Providers:')
  for (const l of describeProviders(providers, env)) out.log(l)
  out.log('')
  printDay(c, readMeetings(p.meetings))
  out.log('')
  out.log('For Claude Code or another shell:')
  out.log(`  export GNOMEOLA_URL=${url}`)
  out.log('')
  const s = pick ? scenario(pick)! : SCENARIOS[0]!
  if (audio === 'scripted') {
    out.log(`Next: pnpm sandbox agenda ${s.id}   then   pnpm sandbox play ${s.id}`)
  } else {
    out.log(`Next: open "${s.title}" in the sandbox window, press Record, and read this card aloud:`)
    out.log('')
    out.log(scriptCard(s))
  }
  out.log('Stop with: pnpm sandbox stop')
}

async function stop(c: Ctx, o: { quiet?: boolean } = {}): Promise<void> {
  const { p, out } = c
  const st = readState(p)
  const pids = st ? [st.pids.window, st.pids.daemon, st.pids.host] : []
  let stopped = 0
  for (const pid of pids) {
    if (!pid || !ours(pid, p.dir)) continue
    try {
      process.kill(-pid, 'SIGTERM') // its process group: the window's helpers, the daemon's capture children
    } catch {
      try {
        process.kill(pid, 'SIGTERM')
      } catch {}
    }
    const end = Date.now() + 12_000
    while (alive(pid) && Date.now() < end) await new Promise((r) => setTimeout(r, 100))
    if (alive(pid))
      try {
        process.kill(-pid, 'SIGKILL')
      } catch {
        try {
          process.kill(pid, 'SIGKILL')
        } catch {}
      }
    stopped++
  }
  // a daemon the sandbox window started by itself (it answers for the sandbox data dir only)
  if (st) {
    const info = await fetch(`${st.url}/daemon`, { signal: AbortSignal.timeout(2000) })
      .then((r) => (r.ok ? (r.json() as Promise<{ pid: number; dataDir: string }>) : null))
      .catch(() => null)
    if (info && info.dataDir === p.data && ours(info.pid, p.dir)) {
      process.kill(info.pid, 'SIGTERM')
      const end = Date.now() + 12_000
      while (alive(info.pid) && Date.now() < end) await new Promise((r) => setTimeout(r, 100))
      stopped++
    }
  }
  if (existsSync(p.state)) rmSync(p.state)
  if (!o.quiet)
    out.log(
      stopped
        ? `Stopped the sandbox (${p.dir} kept; pnpm sandbox reset deletes it).`
        : 'The sandbox was not running.',
    )
}

async function reset(c: Ctx, o: { yes?: boolean }): Promise<void> {
  const { p, out } = c
  if (!existsSync(p.dir)) {
    out.log(`Nothing to reset: ${p.dir} does not exist.`)
    return
  }
  if (!existsSync(p.marker))
    throw new SandboxError(`${p.dir} is not a kacola sandbox (no ${MARKER}); not deleting it`)
  const st = readState(p)
  if (st && ours(st.pids.daemon, p.dir))
    throw new SandboxError('the sandbox is running; pnpm sandbox stop first')
  out.log(`This deletes the sandbox directory and everything in it:`)
  out.log(`  ${p.dir}`)
  out.log(`  (its meetings, agendas, recordings, shares and window profile; your real kacola data in`)
  out.log(`   ${realDataDir(c.env)} is not touched)`)
  if (!o.yes) {
    if (!process.stdin.isTTY) throw new SandboxError('not deleting without confirmation: pass --yes')
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    const a = await rl.question('Delete it? [y/N] ')
    rl.close()
    if (!/^y(es)?$/i.test(a.trim())) {
      out.log('Kept.')
      return
    }
  }
  rmSync(p.dir, { recursive: true, force: true })
  out.log(`Deleted ${p.dir}.`)
}

function printDay(c: Ctx, meetings: SandboxMeeting[]): void {
  const now = Date.now()
  c.out.log('The mock calendar:')
  for (const m of meetings) {
    const time = new Date(m.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    const ago = relative(m.start, now)
    const tag = m.origin === 'user' ? '  (added by you)' : ''
    c.out.log(
      `  ${time}  ${ago.padEnd(14)} ${m.title}${m.with.length ? ` — ${m.with.map((w) => w.replace(/ <.*>/, '')).join(', ')}` : ''}${tag}`,
    )
  }
}

function meetingCmd(c: Ctx, args: string[], o: Record<string, string | boolean | undefined>): void {
  const { p, out } = c
  const sub = args[0]
  if (!existsSync(p.meetings)) throw new SandboxError('no sandbox calendar yet: pnpm sandbox start')
  const meetings = readMeetings(p.meetings)
  if (sub === 'list' || sub === undefined) {
    printDay(c, meetings)
    return
  }
  if (sub === 'clear') {
    const keep = o.all ? [] : meetings.filter((m) => m.origin !== 'user')
    writeMeetings(p, keep)
    out.log(`Removed ${meetings.length - keep.length} meeting(s) from the mock calendar.`)
    return
  }
  if (sub === 'add') {
    const title = args[1]
    if (!title)
      throw new SandboxError(
        'usage: pnpm sandbox meeting add "<title>" --in 5m [--for 30m] [--with "Ana Ruiz"]',
      )
    const start = Date.now() + parseDuration((o.in as string | undefined) ?? '5m')
    const len = parseDuration((o.for as string | undefined) ?? '30m')
    if (len <= 0) throw new SandboxError('--for must be positive')
    const who = ((o.with as string | undefined) ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((n) => (n.includes('<') ? n : `${n} <${n.toLowerCase().replace(/[^a-z]+/g, '.')}@sandbox.test>`))
    const iso = (t: number) => new Date(Math.floor(t / 1000) * 1000).toISOString()
    const m: SandboxMeeting = {
      uid: `sandbox-${randomBytes(6).toString('hex')}@kacola.test`,
      recurrenceId: null,
      title,
      start: iso(start),
      end: iso(start + len),
      with: who,
      url: `https://meet.google.com/kac-${randomBytes(2).toString('hex')}-${randomBytes(2).toString('hex')}`,
      origin: 'user',
    }
    writeMeetings(p, [...meetings, m])
    out.log(`Added "${title}" ${relative(m.start)} (${m.uid}); the sandbox picks it up within a second.`)
    return
  }
  throw new SandboxError(`unknown: meeting ${sub} (add, list, clear)`)
}

function needScenario(id: string | undefined): Scenario {
  const s = id ? scenario(id) : undefined
  if (!s)
    throw new SandboxError(
      `which scenario? ${SCENARIOS.map((x) => x.id).join(', ')} (pnpm sandbox scenarios)`,
    )
  return s
}

async function findMeeting(st: SandboxState, s: Scenario) {
  const now = Date.now()
  const list = await client(st).call('listMeetings', {
    query: {
      from: new Date(now - 6 * 3_600_000).toISOString(),
      to: new Date(now + 24 * 3_600_000).toISOString(),
    },
  })
  const ms = list.meetings.filter((m) => m.uid === s.meetingUid)
  // the occurrence closest to now (the 1:1's series also has last week's)
  ms.sort((a, b) => Math.abs(Date.parse(a.start) - now) - Math.abs(Date.parse(b.start) - now))
  if (!ms[0])
    throw new SandboxError(
      `"${s.title}" is not on the mock calendar any more (pnpm sandbox start --fresh brings the day back)`,
    )
  return ms[0]
}

async function loadAgenda(
  c: Ctx,
  st: SandboxState,
  s: Scenario,
): Promise<{ id: string; suggested: boolean }> {
  const m = await findMeeting(st, s)
  const api = client(st)
  const existing = (
    await api.call('listAgendas', { query: { eventUid: s.meetingUid, limit: 50, includePrivate: true } })
  ).agendas.find((a) => a.meeting?.start === m.start)
  if (existing) {
    c.out.log(`"${s.title}" already has an agenda (${existing.counts.items} items): using yours.`)
    return { id: existing.id, suggested: false }
  }
  const v = await api.call('createAgenda', {
    body: { meetingId: m.id, markdown: s.agenda, carryOver: false, ifExists: 'reuse' },
  })
  c.out.log(`Loaded the suggested agenda into "${s.title}" (${v.items.length} items).`)
  return { id: v.agenda.id, suggested: true }
}

async function play(
  c: Ctx,
  id: string | undefined,
  o: Record<string, string | boolean | undefined>,
): Promise<void> {
  const { p, out } = c
  const s = needScenario(id)
  const st = running(c)
  if (st.audio !== 'scripted') {
    out.log('This sandbox listens to your microphone (--audio mic): read the card aloud instead.')
    out.log('')
    out.log(scriptCard(s))
    return
  }
  const speed = Number(o.speed ?? 1)
  if (!(speed > 0)) throw new SandboxError('--speed must be a positive number')
  const api = client(st)
  const meeting = await findMeeting(st, s)
  const agenda = o['no-agenda'] ? null : await loadAgenda(c, st, s)

  const live = (await api.call('listSessions', { query: {} })).sessions.find(
    (x) => x.status === 'recording' || x.status === 'paused',
  )
  let sessionId: string
  if (live) {
    sessionId = live.id
    if (live.meeting?.uid !== s.meetingUid)
      out.log(`Note: "${live.title}" is recording, not "${s.title}"; the script plays into it anyway.`)
    else out.log(`"${s.title}" is already recording: the script plays into it.`)
  } else {
    const j = await api.call('joinMeeting', { params: { id: meeting.id }, body: {} })
    sessionId = j.session.id
    out.log(`Recording "${s.title}" (as if you pressed Record on it).`)
  }
  await waitFor(
    'the recording to start',
    async () =>
      (await api.call('getSession', { params: { id: sessionId }, query: { includePrivate: true } }))
        .status === 'recording',
    20_000,
  )
  atomicWrite(
    p.play,
    JSON.stringify({ scenario: s.id, at: new Date().toISOString(), ...scriptFor(s, speed) }),
  )
  const secs = Math.ceil(scriptSeconds(s) / speed)
  out.log(`Playing "${s.id}" (${secs} s at ${speed}×). ${s.summary}`)
  if (o.detach) {
    out.log('Watch it in the sandbox window. The recording keeps going after the script ends: stop it there.')
    return
  }
  await follow(c, st, sessionId, agenda?.id ?? null, secs)
}

/** Print the transcript and the agenda's changes as they happen, until the script has been spoken. */
async function follow(c: Ctx, st: SandboxState, sessionId: string, agendaId: string | null, secs: number) {
  const api = client(st)
  const seen = new Set<string>()
  const status = new Map<string, string>()
  const sugg = new Set<string>()
  const end = Date.now() + (secs + 8) * 1000
  const mmss = (ms: number) =>
    `${String(Math.floor(ms / 60000)).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`
  while (Date.now() < end) {
    await new Promise((r) => setTimeout(r, 1000))
    const t = await api
      .call('getTranscript', { params: { id: sessionId }, query: { includePrivate: true } })
      .catch(() => null)
    for (const seg of t?.segments ?? [])
      if (!seen.has(seg.id)) {
        seen.add(seg.id)
        c.out.log(`  [${mmss(seg.startMs)}] ${seg.speaker}: ${seg.text}`)
      }
    if (!agendaId) continue
    const v = await api
      .call('getAgenda', { params: { id: agendaId }, query: { includePrivate: true } })
      .catch(() => null)
    for (const it of v?.items ?? []) {
      if (status.get(it.id) !== it.status && (status.has(it.id) || it.status !== 'open'))
        c.out.log(
          `      ${it.status === 'covered' ? '✓ ticked' : `→ ${it.status}`}: ${it.text}${it.status === 'covered' ? ` (by ${v?.actors?.[it.changedBy]?.label ?? it.changedBy})` : ''}`,
        )
      status.set(it.id, it.status)
    }
    for (const sg of v?.suggestions ?? [])
      if (!sugg.has(sg.id) && sg.state === 'open') {
        sugg.add(sg.id)
        c.out.log(`      ? suggestion (${sg.kind}): ${sg.text}`)
      }
    const sess = await api
      .call('getSession', { params: { id: sessionId }, query: { includePrivate: true } })
      .catch(() => null)
    if (sess && sess.status !== 'recording' && sess.status !== 'paused') {
      c.out.log('  (the recording stopped)')
      return
    }
  }
  c.out.log('')
  c.out.log('The script is done; the recording keeps going until you stop it (in the window, or:')
  c.out.log('  pnpm sandbox cli -- record stop)')
}

async function agendaCmd(c: Ctx, id: string | undefined, o: Record<string, string | boolean | undefined>) {
  const s = needScenario(id)
  if (o.print) {
    c.out.log(s.agenda)
    return
  }
  const st = running(c)
  const a = await loadAgenda(c, st, s)
  c.out.log(`Open "${s.title}" in the sandbox window to see it (agenda ${a.id}).`)
}

function scenariosCmd(c: Ctx) {
  for (const s of SCENARIOS) {
    c.out.log(`${s.id.padEnd(12)} ${s.title}  (${Math.round(scriptSeconds(s) / 6) / 10} min)`)
    c.out.log(`             ${s.summary}`)
    for (const e of s.expect) c.out.log(`               • ${e}`)
    c.out.log('')
  }
}

function mailCmd(c: Ctx) {
  const log = join(c.p.host, 'mail.log')
  if (!existsSync(log)) {
    c.out.log(
      'No mail yet. On a shared agenda page, "Add an item" asks for an email and sends a code: it lands here.',
    )
    return
  }
  const lines = readFileSync(log, 'utf8').trim().split('\n').slice(-10)
  for (const l of lines) {
    const m = JSON.parse(l) as { at: string; to: string; subject: string; text: string }
    const code = /code is ([A-Z]{4}-[A-Z]{4})/.exec(m.text)?.[1]
    c.out.log(`${m.at.slice(11, 19)}  to ${m.to}: ${code ? `code ${code}` : m.subject}`)
  }
}

async function providersCmd(c: Ctx, o: Record<string, string | boolean | undefined>) {
  const st = running(c)
  if (o.llm === 'fake' && st.providers.llm !== 'fake')
    throw new SandboxError(
      'the canned LLM is chosen at start: pnpm sandbox stop && pnpm sandbox start --llm fake',
    )
  const next = chooseProviders(c.env, {
    llm: (o.llm as string | undefined) ?? st.providers.llm,
    decisions: (o.decisions as string | undefined) ?? st.providers.decisions,
  })
  if (st.providers.llm === 'fake' && next.llm !== 'fake')
    c.out.log('Note: this sandbox started with the canned LLM, which keeps answering until a restart.')
  await client(st).call('updateSettings', { body: settingsFor(next) })
  st.providers = next
  atomicWrite(c.p.state, `${JSON.stringify(st, null, 2)}\n`)
  c.out.log('Providers now:')
  for (const l of describeProviders(next, c.env)) c.out.log(l)
}

async function statusCmd(c: Ctx) {
  const st = readState(c.p)
  if (!st || !ours(st.pids.daemon, c.p.dir)) {
    c.out.log(`The sandbox is not running (${c.p.dir}).`)
    return
  }
  const h = await client(st)
    .call('health')
    .catch(() => null)
  c.out.log(`kacola sandbox (${c.p.dir}), started ${relative(st.startedAt)}`)
  c.out.log(`  daemon   ${st.url}  ${h ? 'answering' : 'NOT answering'}  (pid ${st.pids.daemon})`)
  c.out.log(`  sharing  ${st.shareUrl}  ${ours(st.pids.host, c.p.dir) ? 'running' : 'NOT running'}`)
  c.out.log(`  window   ${st.pids.window && ours(st.pids.window, c.p.dir) ? 'open' : 'not running'}`)
  c.out.log(`  audio    ${st.audio}`)
  c.out.log('Providers:')
  for (const l of describeProviders(st.providers, c.env)) c.out.log(l)
  if (h?.decisions)
    c.out.log(
      `  (daemon: decisions ${h.decisions.provider}${h.decisions.ready ? ' ready' : ` not ready: ${h.decisions.detail}`})`,
    )
  c.out.log(`export GNOMEOLA_URL=${st.url}`)
}

function cliCmd(c: Ctx, args: string[]): number {
  const st = running(c)
  const r = spawnSync(process.execPath, [CLI_MAIN, ...args], {
    stdio: 'inherit',
    env: { ...(c.env as NodeJS.ProcessEnv), GNOMEOLA_URL: st.url, GNOMEOLA_TOKEN: '' },
  })
  return r.status ?? 1
}

// --------------------------------------------------------------------------- entry

const OPTIONS = {
  dir: { type: 'string' },
  scenario: { type: 'string' },
  audio: { type: 'string' },
  llm: { type: 'string' },
  decisions: { type: 'string' },
  port: { type: 'string' },
  'share-port': { type: 'string' },
  fresh: { type: 'boolean' },
  'no-window': { type: 'boolean' },
  in: { type: 'string' },
  for: { type: 'string' },
  with: { type: 'string' },
  all: { type: 'boolean' },
  speed: { type: 'string' },
  detach: { type: 'boolean' },
  'no-agenda': { type: 'boolean' },
  print: { type: 'boolean' },
  yes: { type: 'boolean', short: 'y' },
  help: { type: 'boolean', short: 'h' },
} as const

export async function main(argv: string[], env: Env = process.env, out: Out = defaultOut): Promise<number> {
  // `cli -- <args>`: everything after `--` goes to gnomeola untouched
  const dash = argv.indexOf('--')
  const passthrough = dash >= 0 ? argv.slice(dash + 1) : []
  const own = dash >= 0 ? argv.slice(0, dash) : argv
  let values: Record<string, string | boolean | undefined>
  let positionals: string[]
  try {
    ;({ values, positionals } = parseArgs({
      args: own,
      options: OPTIONS,
      allowPositionals: true,
      strict: true,
    }))
  } catch (err) {
    out.err(`${(err as Error).message}\n\n${USAGE}`)
    return 2
  }
  const [cmd, ...rest] = positionals
  if (values.help || !cmd) {
    out.log(USAGE)
    return cmd || values.help ? 0 : 2
  }
  try {
    const c: Ctx = { p: pathsFor(sandboxDir(values.dir as string | undefined, env)), env, out }
    switch (cmd) {
      case 'start':
        await start(c, values)
        return 0
      case 'stop':
        await stop(c)
        return 0
      case 'reset':
        await reset(c, { yes: values.yes === true })
        return 0
      case 'status':
        await statusCmd(c)
        return 0
      case 'meeting':
      case 'meetings':
        meetingCmd(c, rest, values)
        return 0
      case 'scenarios':
        scenariosCmd(c)
        return 0
      case 'agenda':
        await agendaCmd(c, rest[0], values)
        return 0
      case 'play':
        await play(c, rest[0], values)
        return 0
      case 'card':
        out.log(scriptCard(needScenario(rest[0])))
        return 0
      case 'mail':
        mailCmd(c)
        return 0
      case 'providers':
        await providersCmd(c, values)
        return 0
      case 'cli':
        return cliCmd(c, [...rest, ...passthrough])
      case 'env':
        out.log(`export GNOMEOLA_URL=${running(c).url}`)
        return 0
      default:
        out.err(`unknown command ${cmd}\n\n${USAGE}`)
        return 2
    }
  } catch (err) {
    if (err instanceof SandboxError) {
      out.err(`sandbox: ${err.message}`)
      return 1
    }
    throw err
  }
}

const defaultOut: Out = {
  log: (s) => process.stdout.write(`${s}\n`),
  err: (s) => process.stderr.write(`${s}\n`),
}

/** For tests: where the sandbox keeps things. */
export { meetingId, pathsFor }
