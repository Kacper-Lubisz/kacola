import { mkdirSync, writeFileSync } from 'node:fs'
import { cpus } from 'node:os'
import { join } from 'node:path'
import { ME, type Segment } from '@kacola/protocol'
import { type Fixture, listFixtures, loadFixture } from '@kacola/testkit/fixtures'
import { assertNoViolations, checkAttribution, checkSegments } from '@kacola/testkit/invariants'
import {
  type Baseline,
  compareToBaseline,
  der,
  readBaseline,
  type Turn,
  updatingBaselines,
  writeBaseline,
} from '@kacola/testkit/metrics'
import { beforeAll, describe, expect, it } from 'vitest'
import type { SpeakerOut } from '../src/pipeline.ts'
import { sherpaVersion } from '../src/sherpa/index.ts'
import {
  EMBEDDING_MODEL,
  type Engines,
  FINAL_MODEL,
  LIVE_MODEL,
  loadDiarizer,
  loadEngines,
  type RunResult,
  runFixture,
  SEGMENTATION_MODEL,
} from './e2e-helpers.ts'

// A-7 + V-3 — diarization error rate on every multi-speaker fixture, through the real pipeline (VAD, both
// tiers, pyannote turn splitting, TitaNet embeddings, online clustering, end-of-session re-clustering),
// against committed baselines with tolerance bands like the WER ones. KACOLA_UPDATE_BASELINES=1 records.
//
// Metrics (DER with a 250 ms collar, overlapped speech scored — the system cannot put two people on one
// track at once, so far-end cross-talk shows up as missed speech, honestly):
//   der_system          far-end DER after re-clustering — what a reader sees once the meeting ends
//   der_system_online   far-end DER of the online attributions alone — what they saw live
//   confusion_system    the speaker-confusion share of der_system (the diarizer's own error)
//   der_all             both tracks, the mic scored as "me"
//   speaker_count_error |far-end speakers found − far-end speakers present|
//   phantom_me_ms       mic-segment time where the user was not speaking (far-end bleed that became "me")
// And the absolute invariant, on every run: every mic segment is "me" and no far-end segment is.

const COLLAR = 250
let engines: Engines
beforeAll(async () => {
  engines = await loadEngines()
  await loadDiarizer()
})

const REPORT: Record<string, unknown>[] = []
const ARTIFACTS = join(import.meta.dirname, '__artifacts__')
const CONFIG = `diarize_emb=${EMBEDDING_MODEL}+seg=${SEGMENTATION_MODEL}+live=${LIVE_MODEL}+final=${FINAL_MODEL}`

/** Cluster per far-end segment from the pipeline's attribution events: online only, or all of them. */
function clusters(r: RunResult, which: 'online' | 'final'): Map<string, number> {
  const out = new Map<string, number>()
  for (const e of r.events)
    if (e.type === 'speaker.attributed' && (which === 'final' || !(e as SpeakerOut).final))
      for (const id of e.segmentIds) out.set(id, e.cluster)
  return out
}

function hypothesis(latest: Segment[], cl: Map<string, number>, track?: 'system'): Turn[] {
  return latest
    .filter((s) => !track || s.track === track)
    .map((s) => ({
      speaker: s.track === 'mic' ? ME : `c${cl.get(s.id) ?? 'none'}`,
      startMs: s.startMs,
      endMs: s.endMs,
    }))
}

function reference(f: Fixture, track?: 'system'): Turn[] {
  return f
    .utterances(track)
    .map((u) => ({ speaker: u.track === 'mic' ? ME : u.speaker, startMs: u.startMs, endMs: u.endMs }))
}

/** Mic-segment time with no mic utterance within 300 ms: bleed the gate let through as "me". */
function phantomMe(f: Fixture, latest: Segment[]): number {
  const truth = f.utterances('mic')
  let ms = 0
  for (const s of latest.filter((x) => x.track === 'mic')) {
    for (let t = s.startMs; t < s.endMs; t += 10)
      if (!truth.some((u) => t >= u.startMs - 300 && t < u.endMs + 300)) ms += 10
  }
  return ms
}

function measure(f: Fixture, r: RunResult) {
  const final = clusters(r, 'final')
  const online = clusters(r, 'online')
  const sys = der(reference(f, 'system'), hypothesis(r.latest, final, 'system'), { collarMs: COLLAR })
  const found = new Set(r.latest.filter((s) => s.track === 'system').map((s) => final.get(s.id)))
  const present = new Set(f.utterances('system').map((u) => u.speaker))
  return {
    der_system: sys.der,
    der_system_online: der(reference(f, 'system'), hypothesis(r.latest, online, 'system'), {
      collarMs: COLLAR,
    }).der,
    confusion_system: sys.confusionMs / sys.scoredMs,
    der_all: der(reference(f), hypothesis(r.latest, final), { collarMs: COLLAR }).der,
    speaker_count_error: Math.abs(found.size - present.size),
    phantom_me_ms: phantomMe(f, r.latest),
  }
}

function gate(id: string, metrics: Record<string, number>) {
  REPORT.push({ fixture: id, config: CONFIG, ...metrics })
  if (updatingBaselines()) {
    const b: Baseline = {
      fixture: id,
      config: CONFIG,
      metrics,
      bands: {
        // clustering is deterministic, but tier-1/tier-2 timing moves segment bounds a little run to run
        der_system: { abs: 0.04, rel: 0.2 },
        der_system_online: { abs: 0.06, rel: 0.2 },
        confusion_system: { abs: 0.04, rel: 0.2 },
        der_all: { abs: 0.04, rel: 0.2 },
        speaker_count_error: { abs: 0 },
        phantom_me_ms: { abs: 500 },
      },
      recordedAt: new Date().toISOString(),
      notes: `${cpus()[0]?.model ?? 'unknown CPU'} × ${cpus().length}; sherpa-onnx ${sherpaVersion().version}; node ${process.version}`,
    }
    writeBaseline(b)
    return
  }
  const base = readBaseline(id, CONFIG)
  if (!base)
    throw new Error(`no committed DER baseline for ${id} × ${CONFIG} — run with KACOLA_UPDATE_BASELINES=1`)
  const c = compareToBaseline(base, metrics)
  if (!c.ok) throw new Error(`${id}: DER regression beyond the baseline band:\n  ${c.failures.join('\n  ')}`)
}

const multiSpeaker = listFixtures().filter((id) => {
  const f = loadFixture(id)
  return new Set(f.truth.utterances.map((u) => u.speaker)).size >= 2
})

describe(`diarization e2e (emb=${EMBEDDING_MODEL}, seg=${SEGMENTATION_MODEL})`, () => {
  for (const id of multiSpeaker)
    it(`${id}: DER within baseline, and attribution is never wrong about the user`, async () => {
      const f = loadFixture(id)
      const d = await loadDiarizer()
      const r = await runFixture(f, engines, { finalPass: 'during', diarizer: d.createSession() })
      expect(r.pipeline.errors).toEqual([])
      // V-3, the absolute invariant — on the pipeline's output as the store will hold it
      assertNoViolations(checkAttribution(r.latest), `${id} attribution`)
      assertNoViolations(checkSegments(r.latest, { durationMs: f.truth.durationMs, requireFinal: true }), id)
      // every far-end segment the pipeline published got a speaker; no mic segment ever did
      const final = clusters(r, 'final')
      for (const s of r.latest) expect(final.has(s.id), `${s.id} (${s.track})`).toBe(s.track === 'system')
      const m = measure(f, r)
      console.log(
        `${id}: ${JSON.stringify(m)} (${r.pipeline.stats().splits} splits, gate ${JSON.stringify(r.pipeline.stats().echoGate)})`,
      )
      gate(id, m)
    })

  it('the echo gate is what keeps loud bleed from becoming "me" (crosstalk-bleed-3p without it)', async () => {
    const f = loadFixture('crosstalk-bleed-3p')
    const d = await loadDiarizer()
    const r = await runFixture(f, engines, { finalPass: 'off', diarizer: d.createSession(), echoGate: false })
    const ungated = phantomMe(f, r.latest)
    REPORT.push({ fixture: f.id, config: 'echo-gate-off', phantom_me_ms: ungated })
    console.log(`crosstalk-bleed-3p without the echo gate: phantom_me_ms=${ungated}`)
    // the invariant still holds (it is structural) — but the far end's words became the user's
    assertNoViolations(checkAttribution(r.latest))
    expect(ungated).toBeGreaterThan(2000)
  })

  it('writes a trend report', () => {
    mkdirSync(ARTIFACTS, { recursive: true })
    writeFileSync(join(ARTIFACTS, 'diarization-report.json'), JSON.stringify(REPORT, null, 2))
    expect(REPORT.length).toBeGreaterThanOrEqual(multiSpeaker.length)
  })
})
