// A separate Node process that records with the production PipeWireCaptureSource, for chaos tests that
// must kill or starve the *recording process itself* (SIGKILL, disk full). Run with plain `node`.
//
//   node record-child.ts '<json: { session, mic, system, flushIntervalMs }>'
//
// Prints `STARTED`, then `STATUS <json>` every 250 ms; on a fatal error prints `RESULT <json>` after the
// source has stopped and exits 0 (a clean, surfaced stop is the success condition for disk-full).
import { PipeWireCaptureSource } from '../../src/index.ts'

const cfg = JSON.parse(process.argv[2]!) as {
  session: string
  mic: string
  system: string
  flushIntervalMs?: number
}
const src = new PipeWireCaptureSource({ flushIntervalMs: cfg.flushIntervalMs ?? 1000, defaultsWatcher: null })
const errors: unknown[] = []
src.on('error', (e) => {
  errors.push(e)
  if (e.fatal) {
    src.stop().then((result) => {
      process.stdout.write(`RESULT ${JSON.stringify({ result, errors, state: src.state })}\n`)
      process.exit(0)
    })
  }
})
await src.start(cfg.session, [
  { kind: 'mic', device: cfg.mic },
  { kind: 'system', device: cfg.system },
])
process.stdout.write('STARTED\n')
setInterval(() => {
  process.stdout.write(
    `STATUS ${JSON.stringify({ elapsedMs: Math.round(src.elapsedMs()), tracks: src.status() })}\n`,
  )
}, 250)
