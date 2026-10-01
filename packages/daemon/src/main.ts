#!/usr/bin/env node
// gnomeolad entry point: `node packages/daemon/src/main.ts --port 8787 --data-dir …`
//
// This file is the composition root: it picks the implementation behind every injectable interface.
// Real capture/STT, the model manager, device listing and the LLM engine are wired here (by the lead)
// as those packages land; until then the daemon runs with "unavailable" stubs, or with fakes under
// --fake / GNOMEOLA_FAKES=1.
//
// Once listening it prints one JSON line to stdout — {"event":"listening","url":…,"port":…,"pid":…} —
// which the test harness (and anything else that started it with --port 0) reads to find it.
//
// Exit codes: 0 stopped · 1 failed · 2 usage · 75 another daemon owns the data dir (DAEMON_EXIT.LOCKED;
// nothing was touched) · 76 a requested restart (DAEMON_EXIT.RESTART: the supervisor starts it again).
// SIGTERM/SIGINT suspend a live recording for the next daemon to resume; SIGHUP is a restart that
// waits for the recording to finish (the systemd unit's ExecReload).
import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ExternalCaptureHub } from '@gnomeola/capture'
import { SyncAgent } from '@gnomeola/capture-agent/sync'
import { createClient, DAEMON_EXIT } from '@gnomeola/protocol'
import { DEFAULT_MODELS, defaultModelsDir, ModelManager } from '@gnomeola/stt'
import { heuristicGuard, passThroughGuard } from './agents/guard.ts'
import { IcsCalendarProvider } from './calendar/ics.ts'
import { EdsCalendarProvider, FileCalendarProvider, NoCalendar } from './calendar/providers.ts'
import { parseConfig, UsageError } from './config.ts'
import { createDaemon, type DaemonOptions } from './daemon.ts'
import { acquireDataDirLock, type DataDirLock, DataDirLockedError } from './data-lock.ts'
import { LlmNotesEngine } from './engines/enhance.ts'
import { LlmQaEngine } from './engines/llm.ts'
import { ExternalDevices, PipeWireDevices, RecordingPipeline, SttModels } from './engines/recording.ts'
import { FakeNotesEngine } from './fakes/notes.ts'
import { FakePipeline } from './fakes/pipeline.ts'
import { FakeDevices, FakeModels, FakeQaEngine } from './fakes/providers.ts'
import type { Keyring } from './interfaces.ts'
import { KeychainKeyring, keychainAvailable } from './keychain.ts'
import { MemoryKeyring, NoKeyring, SecretToolKeyring } from './keyring.ts'
import { Logger } from './logger.ts'
import { PwDumpMicActivity } from './mic-activity.ts'

/** The daemon's own token-signing key, generated once and kept beside the database (0600). */
function loadOrCreateSecret(dataDir: string): string {
  const path = join(dataDir, 'auth-secret')
  if (existsSync(path)) return readFileSync(path, 'utf8').trim()
  mkdirSync(dataDir, { recursive: true, mode: 0o700 })
  const secret = randomBytes(32).toString('hex')
  writeFileSync(path, `${secret}\n`, { mode: 0o600, flag: 'wx' })
  return secret
}

function keyringFor(kind: string, service: string): Keyring {
  if (kind === 'memory') return new MemoryKeyring()
  if (kind === 'none') return new NoKeyring()
  // macOS: the login keychain through /usr/bin/security (GNOMEOLA_SECURITY_BIN: tests' fake)
  if (kind === 'keychain') {
    const bin = process.env.GNOMEOLA_SECURITY_BIN
    return keychainAvailable(bin)
      ? new KeychainKeyring({ service, ...(bin ? { bin } : {}) })
      : new NoKeyring()
  }
  const probe = spawnSync('secret-tool', ['--version'], { stdio: 'ignore' })
  return probe.error ? new NoKeyring() : new SecretToolKeyring({ service })
}

async function main(): Promise<void> {
  let cfg: ReturnType<typeof parseConfig>
  try {
    // GNOMEOLA_PLATFORM: resolve the config as another platform would (tests run the macOS setup here)
    cfg = parseConfig(process.argv.slice(2), process.env, process.env.GNOMEOLA_PLATFORM || process.platform)
  } catch (err) {
    if (err instanceof UsageError) {
      process.stderr.write(`${err.message}\n`)
      process.exit(2)
    }
    throw err
  }

  // One owner per data dir, before anything touches it — not even the log (opening it can rotate it).
  let lock: DataDirLock
  try {
    lock = acquireDataDirLock(cfg.dataDir)
  } catch (err) {
    if (err instanceof DataDirLockedError) {
      process.stderr.write(
        `gnomeolad: ${err.message}; not starting (stop that one first, or use another --data-dir)\n`,
      )
      process.exit(DAEMON_EXIT.LOCKED)
    }
    throw err
  }
  // a restart (POST /daemon/restart, SIGHUP): close — suspending a live recording when forced — then
  // exit 76 for the supervisor to start us again
  const supervised = cfg.supervised

  const opts: DaemonOptions = {
    auth: cfg.remote
      ? {
          secret: cfg.authSecret ?? loadOrCreateSecret(cfg.dataDir),
          ...(cfg.adminToken ? { adminToken: cfg.adminToken } : {}),
        }
      : null,
    dataDir: cfg.dataDir,
    host: cfg.host,
    port: cfg.port,
    heartbeatMs: cfg.heartbeatMs,
    replayPageSize: cfg.replayPageSize,
    keyring: keyringFor(cfg.keyring, cfg.keyringService),
    echoLogs: cfg.echoLogs,
    lock,
    supervised,
    onRestart: (o) => {
      shutdown(`restart (${o.by})`, o.suspend ? 'suspend' : 'stop', DAEMON_EXIT.RESTART)
    },
  }
  // M4: the logger is created here (not by createDaemon) because the calendar provider needs it too
  mkdirSync(cfg.dataDir, { recursive: true, mode: 0o700 })
  opts.logger = new Logger({ file: join(cfg.dataDir, 'logs', 'gnomeolad.log'), echo: cfg.echoLogs })
  opts.calendar =
    cfg.calendar.kind === 'eds'
      ? new EdsCalendarProvider({ logger: opts.logger, gjs: cfg.gjs })
      : cfg.calendar.kind === 'file'
        ? new FileCalendarProvider(cfg.calendar.path)
        : cfg.calendar.kind === 'ics'
          ? new IcsCalendarProvider({ source: cfg.calendar.source, me: cfg.calendar.me, logger: opts.logger })
          : new NoCalendar()
  opts.dbus = cfg.dbus ? { gjs: cfg.gjs } : null
  if (cfg.micActivity.kind === 'pipewire')
    opts.micActivity = new PwDumpMicActivity({ onlyTarget: cfg.micActivity.target })
  opts.micIdleStopMs = cfg.micIdleStopMs
  if (cfg.fakes) {
    opts.pipeline = new FakePipeline(cfg.fakePipeline)
    opts.devices = new FakeDevices()
    opts.models = new FakeModels()
  } else if (cfg.capture === 'external') {
    // P-3 (macOS): the app captures and streams each track to the ingest route
    const hub = new ExternalCaptureHub()
    const models = new ModelManager({ dir: defaultModelsDir(process.env, cfg.platform) })
    opts.externalCapture = hub
    opts.pipeline = new RecordingPipeline({
      models,
      backend: 'external',
      captureFactory: (o) => hub.create(o.sessionId),
    })
    opts.devices = new ExternalDevices()
    opts.models = new SttModels(models)
    opts.decisionEmbedderDir = () => models.require(DEFAULT_MODELS.textEmbedding).catch(() => null)
  } else {
    const models = new ModelManager({ dir: defaultModelsDir(process.env, cfg.platform) })
    opts.pipeline = new RecordingPipeline({ models })
    opts.devices = new PipeWireDevices()
    opts.models = new SttModels(models)
    opts.decisionEmbedderDir = () => models.require(DEFAULT_MODELS.textEmbedding).catch(() => null)
  }
  opts.agentLimits = cfg.agentLimits
  opts.livePartialEveryMs = cfg.livePartialEveryMs
  // decisions (default): leave unset so the daemon uses the tracker's decision-based guard
  if (cfg.speechGuard === 'heuristic') opts.speechGuard = heuristicGuard
  if (cfg.speechGuard === 'none') opts.speechGuard = passThroughGuard
  if (!cfg.tracker) opts.tracker = false
  opts.qaEngine = cfg.fakeQa ? new FakeQaEngine() : new LlmQaEngine()
  opts.notesEngine = cfg.fakeQa ? new FakeNotesEngine() : new LlmNotesEngine()

  let daemon: Awaited<ReturnType<typeof createDaemon>>
  try {
    daemon = await createDaemon(opts)
  } catch (err) {
    lock.release()
    throw err
  }
  process.stdout.write(
    `${JSON.stringify({ event: 'listening', url: daemon.url, port: daemon.port, pid: process.pid })}\n`,
  )

  // H-7 hybrid sync: push this machine's transcripts and notes to a hosted server, as a protocol client
  // of both ends (the agent reads this daemon's own /events over loopback).
  const sync = new AbortController()
  if (cfg.syncUrl) {
    const agent = new SyncAgent({
      local: createClient({ baseUrl: daemon.url }),
      remote: createClient({
        baseUrl: cfg.syncUrl,
        timeoutMs: 60_000,
        ...(cfg.syncToken ? { token: cfg.syncToken } : {}),
      }),
      log: (level, msg, fields) => daemon.logger[level](`sync: ${msg}`, fields),
    })
    daemon.logger.info('hybrid sync on', { to: cfg.syncUrl })
    void agent
      .run(sync.signal)
      .catch((err) => daemon.logger.error('sync stopped', { err: (err as Error).message }))
  }

  let stopping = false
  // The suspend path writes its markers first and bounds the audio flush (6 s), so this stays well inside
  // systemd's stop timeout and a logout is never held up; past 10 s we exit anyway.
  /**
   * Under systemd, a SIGTERM while the user manager itself is stopping is a logout or a shutdown, not a
   * restart: the recording is finalised the same way, but the next daemon will not turn the microphone
   * back on by itself (a login a minute later is not a request to keep recording).
   */
  const sessionEnding = (): boolean => {
    if (!process.env.INVOCATION_ID) return false
    const r = spawnSync('systemctl', ['--user', 'is-system-running'], { encoding: 'utf8', timeout: 1000 })
    return (r.stdout ?? '').trim() === 'stopping'
  }
  function shutdown(why: string, recordings: 'suspend' | 'stop', code = 0, resume = true) {
    if (stopping) return
    stopping = true
    sync.abort()
    daemon.logger.info(code === DAEMON_EXIT.RESTART ? 'restart' : 'signal received', { why, recordings })
    const force = setTimeout(() => process.exit(code || 1), 10_000)
    force.unref()
    daemon.close({ suspend: recordings === 'suspend', resume, reason: why }).then(
      () => process.exit(code),
      (err) => {
        process.stderr.write(`shutdown failed: ${(err as Error).message}\n`)
        process.exit(1)
      },
    )
  }
  // SIGTERM (systemctl stop/restart, logout, shutdown) and Ctrl-C: a live recording is suspended, not
  // stopped, so the next daemon resumes it if it comes back within the resume window
  process.on('SIGTERM', () => {
    const ending = sessionEnding()
    shutdown(ending ? 'SIGTERM (session ending)' : 'SIGTERM', 'suspend', 0, !ending)
  })
  process.on('SIGINT', () => shutdown('SIGINT', 'suspend'))
  // SIGHUP (systemctl reload): restart once nothing is recording
  process.on('SIGHUP', () => {
    try {
      const r = daemon.restart.request({ mode: 'when-idle', force: false, by: 'SIGHUP' })
      daemon.logger.info('reload requested', { state: r.state, waitingOn: r.waitingOn.map((s) => s.id) })
    } catch (err) {
      daemon.logger.error('reload failed', { err: (err as Error).message })
    }
  })

  // a supervisor that went away (the window quit while we were recording) leaves our stdout/stderr pipes
  // without a reader: a write must not take the daemon down with it
  process.stdout.on('error', () => {})
  process.stderr.on('error', () => {})
  process.on('uncaughtException', (err) => {
    daemon.logger.error('uncaught exception', { err: `${err.name}: ${err.message}` })
  })
  process.on('unhandledRejection', (err) => {
    daemon.logger.error('unhandled rejection', { err: err instanceof Error ? err.message : String(err) })
  })
}

main().catch((err: unknown) => {
  process.stderr.write(`gnomeolad failed to start: ${err instanceof Error ? err.message : String(err)}\n`)
  process.exit(1)
})
