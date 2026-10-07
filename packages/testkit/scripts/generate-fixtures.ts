// Generates the fixture meetings in packages/testkit/fixtures from scripted dialogue.
//
//   node packages/testkit/scripts/generate-fixtures.ts [fixture-id …]
//   node packages/testkit/scripts/generate-fixtures.ts --agenda [fixture-id …]   (fixtures/agenda/<id>)
//
// Speech is synthesized with sherpa-onnx Piper voices (downloaded and checksum-verified through the stt
// model manager) and placed on a two-track timeline: the mic track carries the user's lines, the system
// track everyone else. Ground truth (who, which track, exact start/end, text) is written alongside.
// One fixture uses real human speech from LibriSpeech test-clean (CC BY 4.0) for realism.
//
// Determinism: the script, voices, placement (seeded RNG), levels, noise and encoder settings are fixed.
// Piper's ONNX graph samples internal noise that onnxruntime seeds per process, so re-running changes
// the audio at the sample level (and utterance lengths by a few tens of ms); the ground truth is always
// regenerated from the audio actually written. Regenerating is therefore a reviewed change: re-record
// the WER baselines (KACOLA_UPDATE_BASELINES=1) in the same commit.

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import type { TrackKind } from '@kacola/protocol'
import { createTts, ModelManager, type SherpaTts, sherpaVersion } from '@kacola/stt'
import { AGENDA_FIXTURES_DIR } from '../src/evals/datasets.ts'
import type { AgendaTruth } from '../src/fixtures/agenda-schema.ts'
import { AGENDA_FIXTURE_SCRIPTS, type AgendaDef } from '../src/fixtures/agenda-scripts.ts'
import { FIXTURES_DIR } from '../src/fixtures/index.ts'
import { GroundTruth, type Utterance } from '../src/fixtures/schema.ts'
import {
  type Channel,
  FIXTURE_SCRIPTS,
  type FixtureDef,
  type Line,
  type Speaker,
} from '../src/fixtures/scripts.ts'

const SR = 16_000
const REPO = join(import.meta.dirname, '..', '..', '..')

const FIXTURES = FIXTURE_SCRIPTS

// ------------------------------------------------------------------------------------------ audio

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const seedOf = (s: string) => createHash('sha256').update(s).digest().readUInt32LE(0)

function ffmpegF32(args: string[], input?: Buffer): Float32Array {
  const out = execFileSync(
    'ffmpeg',
    ['-nostdin', '-v', 'error', ...args, '-f', 'f32le', '-ac', '1', '-ar', String(SR), '-'],
    {
      input,
      maxBuffer: 1 << 30,
    },
  )
  return new Float32Array(out.buffer, out.byteOffset, out.byteLength / 4).slice()
}

function resample(samples: Float32Array, rate: number): Float32Array {
  if (rate === SR) return samples
  return ffmpegF32(['-f', 'f32le', '-ar', String(rate), '-ac', '1', '-i', '-'], Buffer.from(samples.buffer))
}

/** Trim leading/trailing near-silence so ground-truth bounds are tight (±10 ms of padding). */
function trim(s: Float32Array): Float32Array {
  let peak = 0
  for (const x of s) peak = Math.max(peak, Math.abs(x))
  const thr = peak * 0.02
  let a = 0
  let b = s.length - 1
  while (a < b && Math.abs(s[a]!) < thr) a++
  while (b > a && Math.abs(s[b]!) < thr) b--
  const pad = SR / 100
  return s.slice(Math.max(0, a - pad), Math.min(s.length, b + pad + 1))
}

/** A bad far-end link (V-3): telephone band, a starved codec, lost packets — deterministic per `rand`. */
function degrade(s: Float32Array, ch: Channel, rand: () => number): Float32Array {
  let out = s
  const f32 = ['-f', 'f32le', '-ar', String(SR), '-ac', '1', '-i', '-']
  if (ch.narrowband)
    out = ffmpegF32(
      [...f32, '-af', 'highpass=f=300,lowpass=f=3400,aresample=8000,aresample=16000'],
      Buffer.from(out.buffer),
    )
  if (ch.codecKbps) {
    const ogg = execFileSync(
      'ffmpeg',
      ['-nostdin', '-v', 'error', ...f32, '-c:a', 'libopus', '-b:a', `${ch.codecKbps}k`, '-f', 'ogg', '-'],
      { input: Buffer.from(out.buffer), maxBuffer: 1 << 30 },
    )
    out = ffmpegF32(['-f', 'ogg', '-i', '-'], ogg).subarray(0, out.length)
    if (out.length < s.length) {
      const padded = new Float32Array(s.length)
      padded.set(out)
      out = padded
    }
  }
  if (ch.dropoutRate) {
    out = out.slice()
    const frame = SR / 50
    for (let i = 0; i < out.length; i += frame)
      if (rand() < ch.dropoutRate) {
        const len = Math.round(((40 + rand() * 80) * SR) / 1000)
        out.fill(0, i, Math.min(out.length, i + len))
        i += len
      }
  }
  return out
}

/** A reverberant room between the laptop's speakers and its mic: direct path, then a decaying tail. */
function roomBleed(
  x: Float32Array,
  gainDb: number,
  room: { delayMs: number; rt60: number },
  rand: () => number,
) {
  const y = new Float32Array(x.length)
  const g = 10 ** (gainDb / 20)
  const d0 = Math.round((room.delayMs * SR) / 1000)
  // sparse tail: a reflection every 1–3 ms, random sign, decaying 60 dB over rt60, carrying half the
  // direct path's energy (so the whole bleed sits ~1.8 dB above `gainDb`)
  const tail: [number, number][] = []
  for (let t = 0.003; t < room.rt60; t += 0.001 + rand() * 0.002)
    tail.push([d0 + Math.round(t * SR), 10 ** ((-3 * t) / room.rt60) * (rand() < 0.5 ? -1 : 1)])
  const k = Math.sqrt(0.5 / tail.reduce((acc, [, a]) => acc + a * a, 0))
  const taps: [number, number][] = [[d0, g], ...tail.map(([d, a]): [number, number] => [d, a * k * g])]
  for (const [d, a] of taps) for (let i = d; i < x.length; i++) y[i]! += x[i - d]! * a
  return y
}

function normalize(s: Float32Array, targetDbfs: number): Float32Array {
  let sum = 0
  for (const x of s) sum += x * x
  const rms = Math.sqrt(sum / Math.max(1, s.length))
  const gain = rms > 0 ? 10 ** (targetDbfs / 20) / rms : 1
  return s.map((x) => x * gain)
}

// ----------------------------------------------------------------------------------- librispeech

const LIBRI_URL = 'https://www.openslr.org/resources/12/test-clean.tar.gz'
const LIBRI_SHA256 = '39fde525e59672dc6d1551919b1478f724438a95aa55f874b576be21967e6c23'

async function librispeechRoot(ids: string[]): Promise<string> {
  if (process.env.LIBRISPEECH_TEST_CLEAN) return process.env.LIBRISPEECH_TEST_CLEAN
  const cache = join(process.env.XDG_CACHE_HOME || join(homedir(), '.cache'), 'kacola', 'librispeech')
  const root = join(cache, 'LibriSpeech', 'test-clean')
  const have = ids.every((id) => existsSync(libriFlac(root, id)))
  if (have) return root
  mkdirSync(cache, { recursive: true })
  const tgz = join(cache, 'test-clean.tar.gz')
  if (!existsSync(tgz)) {
    console.log(`downloading ${LIBRI_URL} (346 MB)…`)
    execFileSync('curl', ['-fsSL', '-o', `${tgz}.part`, LIBRI_URL], { stdio: 'inherit' })
    execFileSync('mv', [`${tgz}.part`, tgz])
  }
  const h = createHash('sha256')
  await pipeline(createReadStream(tgz), h)
  const got = h.digest('hex')
  if (got !== LIBRI_SHA256) throw new Error(`LibriSpeech checksum mismatch: ${got}`)
  const speakers = [...new Set(ids.map((id) => id.split('-')[0]!))]
  execFileSync('tar', ['-xzf', tgz, '-C', cache, ...speakers.map((s) => `LibriSpeech/test-clean/${s}`)])
  return root
}

const libriFlac = (root: string, id: string) => {
  const [spk, chap] = id.split('-')
  return join(root, spk!, chap!, `${id}.flac`)
}

function libriText(root: string, id: string): string {
  const [spk, chap] = id.split('-')
  const trans = readFileSync(join(root, spk!, chap!, `${spk}-${chap}.trans.txt`), 'utf8')
  const line = trans.split('\n').find((l) => l.startsWith(`${id} `))
  if (!line) throw new Error(`no transcript for ${id}`)
  return line.slice(id.length + 1).trim()
}

// ------------------------------------------------------------------------------------- generator

/** Per-item ground truth from the line labels (`starts`/`evidence`/`settles`/`tangent`), on the real timeline. */
function agendaTruth(agenda: AgendaDef, lines: Line[], utterances: Utterance[]): AgendaTruth {
  const lastEnd = Math.max(...utterances.map((u) => u.endMs))
  const known = new Set(agenda.items.map((i) => i.id))
  lines.forEach((l, i) => {
    for (const id of [...(l.starts ?? []), ...(l.evidence ?? []), ...(l.settles ?? [])])
      if (!known.has(id)) throw new Error(`line ${i} labels unknown agenda item ${id}`)
  })
  return {
    meeting: {
      kind: agenda.meeting.kind,
      ...(agenda.meeting.userRole ? { userRole: agenda.meeting.userRole } : {}),
      scheduledEndMs: Math.round(lastEnd + agenda.meeting.scheduledEndAfterLastMs),
    },
    goals: agenda.goals,
    items: agenda.items.map((it) => {
      const evidence = lines.flatMap((l, i) =>
        [l.starts, l.evidence, l.settles].some((xs) => xs?.includes(it.id)) ? [i] : [],
      )
      const settledBy = lines.findIndex((l) => l.settles?.includes(it.id))
      const settled = settledBy >= 0
      return {
        id: it.id,
        text: it.text,
        kind: it.kind,
        ...(it.owner ? { owner: it.owner } : {}),
        ...(it.timeboxMin ? { timeboxMin: it.timeboxMin } : {}),
        expected: {
          status: settled ? 'covered' : evidence.length ? 'in_progress' : 'not_started',
          settledAtMs: settled ? utterances[settledBy]!.endMs : null,
          startedAtMs: evidence.length ? utterances[evidence[0]!]!.startMs : null,
          evidence,
          settledBy: settled ? settledBy : null,
          outcome: it.outcome,
          answer: it.answer ?? null,
          answerAliases: it.answerAliases ?? [],
          implicit: settled && (it.implicit ?? false),
        },
      }
    }),
    tangents: lines.flatMap((l, i) => (l.tangent ? [i] : [])),
  }
}

async function generate(
  def: FixtureDef & { agenda?: AgendaDef },
  models: ModelManager,
  root = FIXTURES_DIR,
): Promise<void> {
  console.log(`\n== ${def.id}`)
  const rand = mulberry32(seedOf(def.id))
  const speakers = new Map(def.speakers.map((s) => [s.name, s]))
  const lines = def.script.filter((i): i is Line => 'who' in i)
  const libriIds = lines.flatMap((l) => (l.libri ? [l.libri] : []))
  const libriRoot = libriIds.length ? await librispeechRoot(libriIds) : ''

  // One TTS engine per voice, synthesizing in script order.
  const engines = new Map<string, SherpaTts>()
  for (const s of def.speakers)
    if (s.source.startsWith('tts-') && !engines.has(s.source)) {
      await models.ensure(s.source, {
        onProgress: (p) => p.phase !== 'download' && console.log(`  ${s.source}: ${p.phase}`),
      })
      engines.set(s.source, await createTts(models, s.source))
    }

  type Placed = { line: Line; speaker: Speaker; audio: Float32Array; text: string; startMs: number }
  const placed: Placed[] = []
  const silences: GroundTruth['silences'] = []
  const gaps: GroundTruth['gaps'] = []
  const lastEnd: Record<TrackKind, number> = { mic: 0, system: 0 }
  let cursor = 1500
  let prevEnd = cursor

  for (const item of def.script) {
    if ('silenceMs' in item) {
      silences.push({ startMs: Math.round(cursor), endMs: Math.round(cursor + item.silenceMs) })
      cursor += item.silenceMs
      continue
    }
    if ('gapMs' in item) {
      const at = Math.round(cursor + 800)
      gaps.push({ atMs: at, durationMs: item.gapMs, reason: item.reason, tracks: ['mic', 'system'] })
      cursor = at + item.gapMs + 400
      continue
    }
    const speaker = speakers.get(item.who)
    if (!speaker) throw new Error(`${def.id}: unknown speaker ${item.who}`)
    let audio: Float32Array
    let text: string
    if (item.libri) {
      audio = ffmpegF32(['-i', libriFlac(libriRoot, item.libri)])
      text = libriText(libriRoot, item.libri)
    } else {
      const tts = engines.get(speaker.source)!
      const out = tts.synthesize(item.text!)
      audio = resample(out.samples, out.sampleRate)
      text = item.text!
    }
    audio = trim(audio)
    if (speaker.channel) audio = degrade(audio, speaker.channel, rand)
    audio = normalize(audio, -20 + (speaker.gainDb ?? 0))
    const lenMs = (audio.length * 1000) / SR
    let start =
      item.overlapMs !== undefined ? prevEnd - item.overlapMs : cursor + (item.pauseMs ?? 350 + rand() * 550)
    // one person per track at a time — unless the script asks for far-end cross-talk
    if (!(item.crossTalk && item.overlapMs !== undefined))
      start = Math.max(start, lastEnd[speaker.track] + 250)
    start = Math.round(start)
    const end = start + lenMs
    placed.push({ line: item, speaker, audio, text, startMs: start })
    lastEnd[speaker.track] = Math.max(lastEnd[speaker.track], end)
    prevEnd = end
    cursor = Math.max(cursor, end)
  }
  const durationMs = Math.round(cursor + 1500)
  const n = Math.round((durationMs * SR) / 1000)
  const tracks: Record<TrackKind, Float32Array> = { mic: new Float32Array(n), system: new Float32Array(n) }
  for (const p of placed) {
    const at = Math.round((p.startMs * SR) / 1000)
    const buf = tracks[p.speaker.track]
    for (let i = 0; i < p.audio.length && at + i < n; i++) buf[at + i]! += p.audio[i]!
  }
  if (def.bleedDb !== undefined && def.room) {
    const bleed = roomBleed(tracks.system, def.bleedDb, def.room, rand)
    for (let i = 0; i < n; i++) tracks.mic[i]! += bleed[i]!
  } else if (def.bleedDb !== undefined) {
    const g = 10 ** (def.bleedDb / 20)
    const delay = Math.round(0.03 * SR)
    for (let i = n - 1; i >= delay; i--) tracks.mic[i]! += g * tracks.system[i - delay]!
  }
  for (const track of ['mic', 'system'] as const) {
    const amp = 10 ** (def.noiseDbfs[track] / 20)
    const buf = tracks[track]
    for (let i = 0; i < n; i += 2) {
      // Box–Muller: two gaussian samples per pair of uniforms
      const u = Math.max(1e-12, rand())
      const v = rand()
      const r = Math.sqrt(-2 * Math.log(u)) * amp
      buf[i]! += r * Math.cos(2 * Math.PI * v)
      if (i + 1 < n) buf[i + 1]! += r * Math.sin(2 * Math.PI * v)
    }
    for (const g of gaps.filter((x) => x.tracks.includes(track)))
      buf.fill(0, Math.round((g.atMs * SR) / 1000), Math.round(((g.atMs + g.durationMs) * SR) / 1000))
    for (let i = 0; i < n; i++) buf[i] = Math.max(-1, Math.min(1, buf[i]!))
  }

  const dir = join(root, def.id)
  mkdirSync(dir, { recursive: true })
  const tmp = join(tmpdir(), `kacola-fixture-${process.pid}`)
  mkdirSync(tmp, { recursive: true })
  for (const track of ['mic', 'system'] as const) {
    const raw = join(tmp, `${track}.f32`)
    writeFileSync(raw, Buffer.from(tracks[track].buffer))
    execFileSync('ffmpeg', [
      '-nostdin',
      '-v',
      'error',
      '-y',
      '-f',
      'f32le',
      '-ar',
      String(SR),
      '-ac',
      '1',
      '-i',
      raw,
      '-c:a',
      'libopus',
      '-b:a',
      '32k',
      '-application',
      'audio',
      '-map_metadata',
      '-1',
      '-fflags',
      '+bitexact',
      '-flags:a',
      '+bitexact',
      join(dir, `${track}.opus`),
    ])
  }
  rmSync(tmp, { recursive: true, force: true })

  const utterances: Utterance[] = placed.map((p) => ({
    track: p.speaker.track,
    speaker: p.speaker.name,
    startMs: p.startMs,
    endMs: Math.round(p.startMs + (p.audio.length * 1000) / SR),
    text: p.text,
    source: p.line.libri ? `librispeech:${p.line.libri}` : p.speaker.source,
  }))
  const truth: GroundTruth = {
    id: def.id,
    title: def.title,
    description: def.description,
    sampleRate: SR,
    durationMs,
    tracks: { mic: 'mic.opus', system: 'system.opus' },
    speakers: def.speakers.map(({ name, track, source }) => ({ name, track, source })),
    utterances,
    gaps,
    silences,
    facts: placed.flatMap((p, i) => (p.line.fact ? [{ key: p.line.fact, text: p.text, utterance: i }] : [])),
    injections: placed.flatMap((p, i) => (p.line.injection ? [i] : [])),
    license: def.license,
    ...(def.agenda
      ? {
          agenda: agendaTruth(
            def.agenda,
            placed.map((p) => p.line),
            utterances,
          ),
        }
      : {}),
    generator: {
      script: 'packages/testkit/scripts/generate-fixtures.ts',
      sherpaOnnx: sherpaVersion().version,
      generatedAt: new Date().toISOString(),
    },
  }
  GroundTruth.parse(truth)
  writeFileSync(join(dir, 'truth.json'), `${JSON.stringify(truth, null, 2)}\n`)
  const size = (t: TrackKind) => statSync(join(dir, `${t}.opus`)).size
  console.log(
    `  ${utterances.length} utterances, ${(durationMs / 1000).toFixed(1)} s, mic ${size('mic')} B, system ${size('system')} B → ${dir.replace(`${REPO}/`, '')}`,
  )
}

if (import.meta.main) {
  const args = process.argv.slice(2)
  const agenda = args.includes('--agenda')
  const wanted = args.filter((a) => a !== '--agenda')
  const all: (FixtureDef & { agenda?: AgendaDef })[] = agenda ? AGENDA_FIXTURE_SCRIPTS : FIXTURES
  const defs = wanted.length ? all.filter((f) => wanted.includes(f.id)) : all
  if (wanted.length && defs.length !== wanted.length)
    throw new Error(`unknown fixture in ${wanted.join(', ')}`)
  const models = new ModelManager()
  for (const def of defs) await generate(def, models, agenda ? AGENDA_FIXTURES_DIR : FIXTURES_DIR)
}
