#!/usr/bin/env node
// The real daemon (createDaemon) composed like main.ts with fakes, except that the pipeline REPLAYS an
// agenda fixture meeting (ScriptedPipeline over its ground-truth utterances) and the text LLM is scripted
// (a fixed bridge line, a recap per item in the recap prompt's form) — so the live tracker runs for real
// (on-device decisions) on a meeting it can follow, with no network. Started through
// startDaemon({ entry }) by desktop-tracker.e2e; speaks main.ts's --port 0 "listening" protocol.
//   KACOLA_E2E_FIXTURE   agenda fixture id (default manager-1on1)
//   KACOLA_E2E_SPEED     replay speed (default 10)
//   KACOLA_CALENDAR      file:… (the test's calendar)
import {
  createDaemon,
  FakeDevices,
  FakeModels,
  FileCalendarProvider,
  MemoryKeyring,
  parseConfig,
  ScriptedPipeline,
} from '@kacola/daemon'
import { loadAgendaFixture } from '@kacola/testkit/fixtures'

type AgendaLlm = NonNullable<Parameters<typeof createDaemon>[0]['agendaLlm']>
type Provider = Awaited<ReturnType<AgendaLlm>>

const cfg = parseConfig(process.argv.slice(2))
const fx = loadAgendaFixture(process.env.KACOLA_E2E_FIXTURE ?? 'manager-1on1')
const usage = { inputTokens: 100, outputTokens: 20, cacheReadTokens: 0, cacheWriteTokens: 0 }

/** Bridge lines and recaps from a script (the recap prompt names the item as <item kind="…">text</item>). */
const llm = {
  id: 'scripted',
  model: 'scripted-1',
  minCacheTokens: Number.POSITIVE_INFINITY,
  async *stream(prompt: { system: string; blocks: { text: string }[] }) {
    const tail = prompt.blocks.at(-1)?.text ?? ''
    const item = /<item kind="[^"]*">([^<]*)<\/item>/.exec(tail)?.[1]
    yield {
      type: 'delta',
      text: item
        ? `Status: covered\nOutcome: Settled: ${item}.\nDecisions:\n- go ahead with ${item}\nActions:\n- Sam: follow up on ${item}`
        : 'Shall we move on to the next point?',
    }
    yield { type: 'done', stopReason: 'end_turn', model: 'scripted-1', usage, refusal: null, fallback: null }
  },
} as unknown as Provider

const daemon = await createDaemon({
  dataDir: cfg.dataDir,
  host: cfg.host,
  port: cfg.port,
  heartbeatMs: cfg.heartbeatMs,
  replayPageSize: cfg.replayPageSize,
  keyring: new MemoryKeyring(),
  echoLogs: false,
  pipeline: new ScriptedPipeline(fx.truth.utterances, {
    speed: Number(process.env.KACOLA_E2E_SPEED ?? 10),
  }),
  devices: new FakeDevices(),
  models: new FakeModels(),
  calendar: cfg.calendar.kind === 'file' ? new FileCalendarProvider(cfg.calendar.path) : undefined,
  agendaLlm: async () => llm,
  tracker: { heartbeatMs: 1_000, nextPointEveryMs: 2_000, contextEveryMs: 60_000 },
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
