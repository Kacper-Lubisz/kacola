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
import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ExternalCaptureHub } from '@gnomeola/capture'
import { SyncAgent } from '@gnomeola/capture-agent/sync'
import { createClient } from '@gnomeola/protocol'
import { defaultModelsDir, ModelManager } from '@gnomeola/stt'
import { heuristicGuard } from './agents/guard.ts'
import { IcsCalendarProvider } from './calendar/ics.ts'
import { EdsCalendarProvider, FileCalendarProvider, NoCalendar } from './calendar/providers.ts'
import { parseConfig, UsageError } from './config.ts'
import { createDaemon, type DaemonOptions } from './daemon.ts'
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
  } else {
    const models = new ModelManager({ dir: defaultModelsDir(process.env, cfg.platform) })
    opts.pipeline = new RecordingPipeline({ models })
    opts.devices = new PipeWireDevices()
    opts.models = new SttModels(models)
  }
  opts.agentLimits = cfg.agentLimits
  opts.livePartialEveryMs = cfg.livePartialEveryMs
  if (cfg.speechGuard === 'heuristic') opts.speechGuard = heuristicGuard
  opts.qaEngine = cfg.fakeQa ? new FakeQaEngine() : new LlmQaEngine()
  opts.notesEngine = cfg.fakeQa ? new FakeNotesEngine() : new LlmNotesEngine()

  const daemon = await createDaemon(opts)
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
  const shutdown = (signal: string) => {
    if (stopping) return
    stopping = true
    sync.abort()
    daemon.logger.info('signal received', { signal })
    const force = setTimeout(() => process.exit(1), 10_000)
    force.unref()
    daemon.close().then(
      () => process.exit(0),
      (err) => {
        process.stderr.write(`shutdown failed: ${(err as Error).message}\n`)
        process.exit(1)
      },
    )
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
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
