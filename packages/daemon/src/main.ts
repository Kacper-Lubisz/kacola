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
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { ModelManager } from '@gnomeola/stt'
import { EdsCalendarProvider, FileCalendarProvider, NoCalendar } from './calendar/providers.ts'
import { parseConfig, UsageError } from './config.ts'
import { createDaemon, type DaemonOptions } from './daemon.ts'
import { LlmQaEngine } from './engines/llm.ts'
import { PipeWireDevices, RecordingPipeline, SttModels } from './engines/recording.ts'
import { FakePipeline } from './fakes/pipeline.ts'
import { FakeDevices, FakeModels, FakeQaEngine } from './fakes/providers.ts'
import type { Keyring } from './interfaces.ts'
import { MemoryKeyring, NoKeyring, SecretToolKeyring } from './keyring.ts'
import { Logger } from './logger.ts'
import { PwDumpMicActivity } from './mic-activity.ts'

function keyringFor(kind: string, service: string): Keyring {
  if (kind === 'memory') return new MemoryKeyring()
  if (kind === 'none') return new NoKeyring()
  const probe = spawnSync('secret-tool', ['--version'], { stdio: 'ignore' })
  return probe.error ? new NoKeyring() : new SecretToolKeyring({ service })
}

async function main(): Promise<void> {
  let cfg: ReturnType<typeof parseConfig>
  try {
    cfg = parseConfig(process.argv.slice(2))
  } catch (err) {
    if (err instanceof UsageError) {
      process.stderr.write(`${err.message}\n`)
      process.exit(2)
    }
    throw err
  }

  const opts: DaemonOptions = {
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
        : new NoCalendar()
  opts.dbus = cfg.dbus ? { gjs: cfg.gjs } : null
  if (cfg.micActivity.kind === 'pipewire')
    opts.micActivity = new PwDumpMicActivity({ onlyTarget: cfg.micActivity.target })
  opts.micIdleStopMs = cfg.micIdleStopMs
  if (cfg.fakes) {
    opts.pipeline = new FakePipeline(cfg.fakePipeline)
    opts.devices = new FakeDevices()
    opts.models = new FakeModels()
  } else {
    const models = new ModelManager()
    opts.pipeline = new RecordingPipeline({ models })
    opts.devices = new PipeWireDevices()
    opts.models = new SttModels(models)
  }
  opts.qaEngine = cfg.fakeQa ? new FakeQaEngine() : new LlmQaEngine()

  const daemon = await createDaemon(opts)
  process.stdout.write(
    `${JSON.stringify({ event: 'listening', url: daemon.url, port: daemon.port, pid: process.pid })}\n`,
  )

  let stopping = false
  const shutdown = (signal: string) => {
    if (stopping) return
    stopping = true
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
