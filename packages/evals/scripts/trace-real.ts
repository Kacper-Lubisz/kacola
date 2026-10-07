// Where the live tracker's tick lag comes from, on a private real-meeting fixture:
//
//   node packages/evals/scripts/trace-real.ts [fixtureDir] [--provider=jev|local] [--tracker='<json>']
//                                             [--live-publish[=ms]]
//
// Replays the fixture through the live tracker's own path (the daemon's trackerStatusRunner, the same as
// run-evals) with every decision call timed and classified (relevance gate, injection guard, status round,
// interview, next point), then prints per item: when the topic came up and was answered, P(covered) on
// each round after that, when it was ticked or suggested, and the lag split into
//
//   conservative  waiting for more speech: the answer's end → the end of the segment whose round ticked
//   pipeline      that segment's decision calls (gate → status → interview, serial) …
//   queue         … plus waiting behind earlier segments' calls, with one serial worker as live
//
// and, per decision kind, how many calls and their latency. It prints ids, times, speakers and numbers
// only, never transcript text (the fixture is private).
import { resolve } from 'node:path'
import type { DecisionProvider, DecisionRequest } from '@kacola/decisions'
import type { TrackerOptions } from '../../daemon/src/agendas/tracker.ts'
import { trackerStatusRunner } from '../../daemon/src/agendas/tracker-eval.ts'
import {
  listRealFixtures,
  liveProviders,
  livePublications,
  loadRealFixture,
  offlineProviders,
  privateEvalsDir,
  quantile,
  replayOrder,
} from '../src/index.ts'

const args = process.argv.slice(2)
const flag = (n: string) => args.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3)
const dir = args.find((a) => !a.startsWith('--')) ?? listRealFixtures(privateEvalsDir())[0]
if (!dir) {
  console.error('no private real-meeting fixture')
  process.exit(2)
}
const fx = loadRealFixture(resolve(dir))
const which = flag('provider') ?? 'jev'
const setups = which === 'jev' ? liveProviders() : await offlineProviders()
const setup = setups.find((s) => s.label === which || s.label.startsWith(which))
if (!setup?.provider) {
  console.error(`provider ${which} not available: ${setup?.skip ?? 'unknown'}`)
  process.exit(2)
}
const options = JSON.parse(flag('tracker') ?? '{}') as TrackerOptions & { heartbeatMs?: number }

type Call = { seg: number; kind: string; ms: number }
const calls: Call[] = []
let seg = -1
const kindOf = (r: DecisionRequest) => {
  const ids = r.questions.map((q) => q.id)
  if (ids.includes('relevant')) return 'gate'
  if (ids.includes('injection')) return 'guard'
  if (ids.some((i) => i.startsWith('status.'))) return 'status'
  if (ids.some((i) => /^(answered|value|interview)/.test(i))) return 'interview'
  return ids[0]?.split('.')[0] ?? '?'
}
const inner = setup.provider
const timed: DecisionProvider = {
  id: inner.id,
  model: inner.model,
  confidence: inner.confidence,
  maxQuestionsPerCall: inner.maxQuestionsPerCall,
  async decide(req, opts) {
    const t0 = performance.now()
    try {
      return await inner.decide(req, opts)
    } finally {
      calls.push({ seg, kind: kindOf(req), ms: performance.now() - t0 })
    }
  },
}

const runner = trackerStatusRunner(timed, {
  mode: setup.mode,
  ...(options.heartbeatMs !== undefined ? { heartbeatMs: options.heartbeatMs } : {}),
  options,
})
const session = runner.start({
  id: fx.name,
  agenda: fx.labels.items.map((it) => ({ id: it.id, text: it.text, kind: it.kind })),
  durationMs: fx.transcript.durationMs,
  scheduledEndMs: fx.labels.scheduledEndMs ?? fx.transcript.durationMs,
})

type Step = { seg: number; speaker: string; endMs: number; wall: number; startAt: number; doneAt: number }
const steps: Step[] = []
const trace = new Map<
  string,
  { seg: number; step: number; at: number; p: number; action: string; ev: number | null }[]
>()
let free = 0
const history = []
const chunk = args.find((a) => a.startsWith('--live-publish'))
const order = chunk
  ? livePublications(fx.transcript, Number(chunk.split('=')[1] ?? 3000))
  : replayOrder(fx.transcript)
for (const u of order) {
  seg = u.index
  history.push(u)
  const t0 = performance.now()
  const { reports } = await session.onSegment(u, history)
  const wall = performance.now() - t0
  const startAt = Math.max(u.endMs, free)
  free = startAt + wall
  steps.push({ seg: u.index, speaker: u.speaker, endMs: u.endMs, wall, startAt, doneAt: free })
  for (const r of reports) {
    const t = trace.get(r.itemId) ?? []
    t.push({
      seg: u.index,
      step: steps.length - 1,
      at: u.endMs,
      p: r.pCovered,
      action: r.action,
      ev: r.evidenceIndex,
    })
    trace.set(r.itemId, t)
  }
}

const segs = fx.transcript.segments
const pos = new Map(segs.map((s, i) => [s.id, i]))
const s1 = (ms: number) => (ms / 1000).toFixed(1)
const who = (i: number | null) => (i === null ? '-' : segs[i]!.speaker === 'me' ? 'me' : 'far')
console.log(`fixture ${fx.name}: ${segs.length} segments, ${s1(fx.transcript.durationMs)} s`)
console.log(`options ${JSON.stringify(options)}\n`)
const lags: { item: string; total: number; conservative: number; pipeline: number; queue: number }[] = []
for (const it of fx.labels.items) {
  const t = trace.get(it.id) ?? []
  const startI = it.startedAt ? pos.get(it.startedAt)! : null
  const ansI = it.answeredAt ? pos.get(it.answeredAt)! : null
  const ansEnd = ansI !== null ? segs[ansI]!.endMs : null
  const tick = t.find((x) => x.action === 'auto-covered')
  const sug = t.find((x) => x.action === 'suggest-covered')
  const maxP = Math.max(0, ...t.map((x) => x.p))
  console.log(
    `${it.id} [${it.kind}, ${it.coverage}] came up ${startI === null ? '-' : s1(segs[startI]!.startMs)} s (${who(startI)}), answered ${ansEnd === null ? '-' : s1(ansEnd)} s (${who(ansI)}) · maxP ${maxP.toFixed(2)}`,
  )
  const after = t.filter((x) => startI === null || x.seg >= startI).slice(0, 14)
  // negatives: the strongest rounds (they never came up, so there is no "after")
  const shown =
    it.coverage === 'none'
      ? [...t]
          .sort((a, b) => b.p - a.p)
          .slice(0, 6)
          .sort((a, b) => a.at - b.at)
      : after
  if (shown.length)
    console.log(
      `   rounds: ${shown.map((x) => `${s1(x.at)}${who(x.seg) === 'me' ? 'm' : ''}:${x.p.toFixed(2)}${x.action === 'auto-covered' ? 'T' : x.action === 'suggest-covered' ? 'S' : ''}${x.ev !== null && who(x.ev) === 'me' ? '(ev me)' : ''}`).join(' ')}`,
    )
  if (tick) {
    const st = steps[tick.step]!
    const done = st.endMs + st.wall
    const line = {
      item: it.id,
      total: ansEnd === null ? Number.NaN : (st.doneAt - ansEnd) / 1000,
      conservative: ansEnd === null ? Number.NaN : (st.endMs - ansEnd) / 1000,
      pipeline: st.wall / 1000,
      queue: (st.doneAt - done) / 1000,
    }
    lags.push(line)
    console.log(
      `   TICK at ${s1(st.doneAt)} s on seg ${tick.seg} (${who(tick.seg)}), evidence ${who(tick.ev)} · lag ${line.total.toFixed(1)} s = conservative ${line.conservative.toFixed(1)} + pipeline ${line.pipeline.toFixed(1)} + queue ${line.queue.toFixed(1)}`,
    )
  } else if (sug) console.log(`   suggested at ${s1(sug.at)} s (${who(sug.seg)}), never ticked`)
}
console.log('\nper decision kind:')
const kinds = [...new Set(calls.map((c) => c.kind))]
for (const k of kinds) {
  const ms = calls.filter((c) => c.kind === k).map((c) => c.ms)
  console.log(
    `   ${k.padEnd(10)} ${String(ms.length).padStart(4)} calls · p50 ${Math.round(quantile(ms, 0.5)!)} ms · p90 ${Math.round(quantile(ms, 0.9)!)} ms`,
  )
}
const walls = steps.map((s) => s.wall)
const queue = steps.map((s) => s.startAt - s.endMs)
console.log(
  `per segment: wall p50 ${Math.round(quantile(walls, 0.5)!)} ms p90 ${Math.round(quantile(walls, 0.9)!)} ms · queue wait p50 ${Math.round(quantile(queue, 0.5)!)} ms p90 ${Math.round(quantile(queue, 0.9)!)} ms max ${Math.round(Math.max(...queue))} ms`,
)
const bySpeaker = (sp: 'me' | 'far') => steps.filter((s) => (s.speaker === 'me') === (sp === 'me'))
console.log(
  `segments: me ${bySpeaker('me').length}, far end ${bySpeaker('far').length}; calls on me segments ${calls.filter((c) => c.seg >= 0 && segs[c.seg]!.speaker === 'me').length}, on far-end ${calls.filter((c) => c.seg >= 0 && segs[c.seg]!.speaker !== 'me').length}`,
)
if (lags.length)
  console.log(
    `lag (hits incl. partial): total p50 ${quantile(
      lags.map((l) => l.total),
      0.5,
    )?.toFixed(
      1,
    )} s · conservative sum ${lags.reduce((a, l) => a + l.conservative, 0).toFixed(1)} s · pipeline sum ${lags.reduce((a, l) => a + l.pipeline, 0).toFixed(1)} s · queue sum ${lags.reduce((a, l) => a + l.queue, 0).toFixed(1)} s`,
  )
