import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { listFixtures, loadFixture } from '@gnomeola/testkit/fixtures'
import { assertNoViolations, checkSegmentHistory, checkSegments } from '@gnomeola/testkit/invariants'
import {
  type Baseline,
  compareToBaseline,
  normalizeWords,
  readBaseline,
  updatingBaselines,
  wer,
  writeBaseline,
} from '@gnomeola/testkit/metrics'
import { beforeAll, describe, expect, it } from 'vitest'
import { DEFAULT_MODELS } from '../src/models/catalog.ts'
import type { FinalPass } from '../src/reconciler.ts'
import {
  type Engines,
  FINAL_MODEL,
  LIVE_MODEL,
  loadEngines,
  type RunResult,
  runFixture,
  transcript,
} from './e2e-helpers.ts'

// V-2a + V-2b over real models: every fixture through VAD + tier 1 + tier 2 + reconciler.
//   V-2a  the segment invariants hold on the real event stream (history and final state)
//   V-2b  WER per track stays inside the committed baseline band, and so does the real-time factor
// GNOMEOLA_UPDATE_BASELINES=1 records new baselines instead of comparing (a reviewed change).

let engines: Engines
beforeAll(async () => {
  engines = await loadEngines()
})

const REPORT: Record<string, unknown>[] = []
const ARTIFACTS = join(import.meta.dirname, '__artifacts__')

function configKey(pass: FinalPass): string {
  return `pipeline_live=${LIVE_MODEL}+final=${pass === 'off' ? 'off' : FINAL_MODEL}+pass=${pass}`
}

function checkInvariants(id: string, r: RunResult, pass: FinalPass) {
  const f = loadFixture(id)
  assertNoViolations(checkSegmentHistory(r.upserts), `${id} history`)
  assertNoViolations(
    checkSegments(r.latest, { durationMs: f.truth.durationMs, requireFinal: pass !== 'off' }),
    `${id} final state`,
  )
  // nothing is transcribed out of a recorded gap
  for (const g of f.truth.gaps)
    for (const s of r.latest)
      expect(s.endMs <= g.atMs + 100 || s.startMs >= g.atMs + g.durationMs - 100, `${s.id} inside gap`).toBe(
        true,
      )
  // quality flips exactly once for every segment that went live first
  const firstQuality = new Map<string, string>()
  const finals = new Map<string, number>()
  for (const s of r.upserts) {
    if (!firstQuality.has(s.id)) firstQuality.set(s.id, s.quality)
    if (s.quality === 'final') finals.set(s.id, (finals.get(s.id) ?? 0) + 1)
  }
  if (pass !== 'off') for (const s of r.latest) expect(finals.get(s.id), s.id).toBe(1)
  expect(r.pipeline.errors).toEqual([])
}

function measure(id: string, r: RunResult) {
  const f = loadFixture(id)
  const mic = wer(f.reference('mic'), transcript(r.latest, 'mic'))
  const system = wer(f.reference('system'), transcript(r.latest, 'system'))
  const errors = (w: typeof mic) => w.substitutions + w.deletions + w.insertions
  return {
    wer: (errors(mic) + errors(system)) / (mic.refWords + system.refWords),
    wer_mic: mic.wer,
    wer_system: system.wer,
    rtf: r.wallMs / r.audioMs,
  }
}

function gate(id: string, pass: FinalPass, metrics: Record<string, number>) {
  const config = configKey(pass)
  REPORT.push({ fixture: id, config, ...metrics })
  if (updatingBaselines()) {
    const b: Baseline = {
      fixture: id,
      config,
      metrics,
      bands: {
        wer: { abs: 0.03 },
        wer_mic: { abs: 0.05 },
        wer_system: { abs: 0.05 },
        // RTF depends on the machine: allow 4× the recorded value (plus a small absolute floor)
        rtf: { rel: 3, abs: 0.05 },
      },
      recordedAt: new Date().toISOString(),
      notes:
        `recorded on ${process.env.HOSTNAME ?? 'dev machine'}; sherpa-onnx-node ${process.env.npm_package_version ?? ''}`.trim(),
    }
    writeBaseline(b)
    return
  }
  const base = readBaseline(id, config)
  if (!base)
    throw new Error(`no committed baseline for ${id} × ${config} — run with GNOMEOLA_UPDATE_BASELINES=1`)
  const c = compareToBaseline(base, metrics)
  if (!c.ok) throw new Error(`${id}: regression beyond the baseline band:\n  ${c.failures.join('\n  ')}`)
}

describe(`pipeline e2e (live=${LIVE_MODEL}, final=${FINAL_MODEL}, vad=${DEFAULT_MODELS.vad})`, () => {
  for (const id of listFixtures()) {
    it(`${id}: live+final during the session — invariants and WER within baseline`, async () => {
      const r = await runFixture(loadFixture(id), engines, { finalPass: 'during' })
      checkInvariants(id, r, 'during')
      expect(r.latest.length).toBeGreaterThanOrEqual(5)
      expect(r.partials.length).toBeGreaterThan(r.latest.length) // live partials really flowed
      const m = measure(id, r)
      console.log(
        `${id} during: ${JSON.stringify(m)} (${r.latest.length} segments, ${r.upserts.length} upserts)`,
      )
      gate(id, 'during', m)
    })
  }

  it("finalPass 'after': nothing is final until the session ends, then everything is", async () => {
    const id = 'standup-2p'
    const f = loadFixture(id)
    const r = await runFixture(f, engines, { finalPass: 'after' })
    checkInvariants(id, r, 'after')
    // every final upsert came after every live one: tier 2 ran only at the end
    const lastLive = r.upserts.findLastIndex((s) => s.quality === 'live')
    const firstFinal = r.upserts.findIndex((s) => s.quality === 'final')
    expect(firstFinal).toBeGreaterThan(lastLive)
    const m = measure(id, r)
    console.log(`${id} after: ${JSON.stringify(m)}`)
    gate(id, 'after', m)
  })

  it("finalPass 'off': tier 1 only — segments stay live and WER is tier 1's", async () => {
    for (const id of ['standup-2p', 'librispeech-3p']) {
      const r = await runFixture(loadFixture(id), engines, { finalPass: 'off' })
      checkInvariants(id, r, 'off')
      expect(r.latest.every((s) => s.quality === 'live')).toBe(true)
      const m = measure(id, r)
      console.log(`${id} off: ${JSON.stringify(m)}`)
      gate(id, 'off', m)
    }
  })

  it('pause/resume: nothing is transcribed while paused and offsets stay on the session timeline', async () => {
    const id = 'standup-2p'
    const f = loadFixture(id)
    const pause = { atMs: 20_000, resumeMs: 35_000 }
    const r = await runFixture(f, engines, { finalPass: 'during', pause })
    checkInvariants(id, r, 'during')
    for (const s of r.latest)
      expect(s.endMs <= pause.atMs || s.startMs >= pause.resumeMs, `${s.id} [${s.startMs},${s.endMs})`).toBe(
        true,
      )
    expect(r.latest.some((s) => s.startMs >= pause.resumeMs)).toBe(true)
    // words spoken after resume are found at their true offsets
    const after = f.utterances().filter((u) => u.startMs >= pause.resumeMs)
    for (const u of after.slice(0, 3)) {
      const seg = r.latest.find((s) => s.track === u.track && s.startMs < u.endMs && u.startMs < s.endMs)
      expect(seg, `segment for "${u.text}" at ${u.startMs}`).toBeDefined()
      expect(Math.abs(seg!.startMs - u.startMs)).toBeLessThan(1500)
    }
  })

  it('the decisions other suites query come out of the pipeline intact', async () => {
    const f = loadFixture('standup-2p')
    const r = await runFixture(f, engines, { finalPass: 'during' })
    const text = normalizeWords(transcript(r.latest)).join(' ')
    expect(text).toContain('retry budget is three attempts')
    expect(text).toContain('migration lands thursday')
    expect(text).toMatch(/owns the dashboard/)
    // and segment offsets line up with the ground truth
    const fact = f.truth.utterances[f.truth.facts.find((x) => x.key === 'migration-thursday')!.utterance]!
    const seg = r.latest.find((s) => normalizeWords(s.text).join(' ').includes('migration lands thursday'))!
    expect(seg.track).toBe(fact.track)
    expect(Math.abs(seg.startMs - fact.startMs)).toBeLessThan(700)
    expect(Math.abs(seg.endMs - fact.endMs)).toBeLessThan(1000)
  })

  it('writes a trend report', () => {
    mkdirSync(ARTIFACTS, { recursive: true })
    writeFileSync(join(ARTIFACTS, 'stt-pipeline-report.json'), JSON.stringify(REPORT, null, 2))
    expect(REPORT.length).toBeGreaterThanOrEqual(listFixtures().length)
  })
})
