#!/usr/bin/env node
// The real daemon (createDaemon from @gnomeola/daemon) composed like main.ts with fakes, except that the
// fake model provider downloads slowly: GNOMEOLA_E2E_MODEL_STEP_MS per 20% step (default 600 ms).
// main.ts's FakeModels finishes in 100 ms, too fast for a UI test to watch a progress bar move.
// Started through startDaemon({ entry }) by the onboarding e2e test; speaks the same --port 0
// "listening" protocol as main.ts.
import {
  createDaemon,
  FakeDevices,
  FakeModels,
  FakePipeline,
  MemoryKeyring,
  parseConfig,
} from '@gnomeola/daemon'

const cfg = parseConfig(process.argv.slice(2))
const stepMs = Number(process.env.GNOMEOLA_E2E_MODEL_STEP_MS ?? 600)

const daemon = await createDaemon({
  dataDir: cfg.dataDir,
  host: cfg.host,
  port: cfg.port,
  heartbeatMs: cfg.heartbeatMs,
  replayPageSize: cfg.replayPageSize,
  keyring: new MemoryKeyring(),
  echoLogs: false,
  pipeline: new FakePipeline(cfg.fakePipeline),
  devices: new FakeDevices(),
  models: new FakeModels({ stepMs }),
})
process.stdout.write(
  `${JSON.stringify({ event: 'listening', url: daemon.url, port: daemon.port, pid: process.pid })}\n`,
)
const stop = () => {
  daemon.close().then(
    () => process.exit(0),
    () => process.exit(1),
  )
}
process.on('SIGTERM', stop)
process.on('SIGINT', stop)
