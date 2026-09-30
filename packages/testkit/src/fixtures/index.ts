import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { TrackKind } from '@gnomeola/protocol'
import { GroundTruth, type Utterance } from './schema.ts'

// Fixture meetings with exact ground truth. Audio is committed compressed (Opus) to keep the repo
// small; on first use each track is decoded with ffmpeg to 16 kHz mono 16-bit WAV in a cache dir, keyed
// by the hash of the committed file so a regenerated fixture never serves stale audio.

export * from './agenda-schema.ts'
export * from './agenda-scripts.ts'
export * from './schema.ts'
export * from './scripts.ts'

export const FIXTURES_DIR = join(import.meta.dirname, '..', '..', 'fixtures')
export const SAMPLE_RATE = 16_000

export function fixtureCacheDir(env: NodeJS.ProcessEnv = process.env): string {
  if (env.GNOMEOLA_FIXTURE_CACHE) return env.GNOMEOLA_FIXTURE_CACHE
  const base = env.XDG_CACHE_HOME || join(homedir(), '.cache')
  return join(base, 'gnomeola', 'fixtures')
}

/** Ids of every committed fixture (directories containing a truth.json). */
export function listFixtures(): string[] {
  return readdirSync(FIXTURES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(FIXTURES_DIR, d.name, 'truth.json')))
    .map((d) => d.name)
    .sort()
}

export type Chunk = { atMs: number; samples: Float32Array }

export type Fixture = {
  id: string
  dir: string
  truth: GroundTruth
  /** Path to a decoded 16 kHz mono s16 WAV of one track (decoded on first call). */
  wavPath(track: TrackKind): string
  /** The whole track as float PCM on the session timeline (gaps are silence). */
  pcm(track: TrackKind): Float32Array
  /**
   * The track as a capture engine would deliver it: fixed-size chunks with session offsets, skipping
   * recorded gaps (no audio arrives during a gap).
   */
  chunks(track: TrackKind, chunkMs?: number): Chunk[]
  utterances(track?: TrackKind): Utterance[]
  /** Reference transcript for WER: the track's utterances in time order, joined. */
  reference(track?: TrackKind): string
}

export function loadFixture(id: string): Fixture {
  return loadFixtureFrom(FIXTURES_DIR, id)
}

/** A fixture meeting with an agenda (fixtures/agenda/<id>): same shape, plus `truth.agenda`. */
export function loadAgendaFixture(id: string): Fixture {
  return loadFixtureFrom(join(FIXTURES_DIR, 'agenda'), id)
}

function loadFixtureFrom(root: string, id: string): Fixture {
  const dir = join(root, id)
  const truth = GroundTruth.parse(JSON.parse(readFileSync(join(dir, 'truth.json'), 'utf8')))
  const pcmCache = new Map<TrackKind, Float32Array>()

  const wavPath = (track: TrackKind): string => {
    const src = join(dir, truth.tracks[track])
    const hash = createHash('sha256').update(readFileSync(src)).digest('hex').slice(0, 16)
    const out = join(fixtureCacheDir(), id, `${track}-${hash}.wav`)
    if (!existsSync(out)) {
      mkdirSync(join(out, '..'), { recursive: true })
      const tmp = `${out}.${process.pid}.tmp.wav`
      execFileSync(
        'ffmpeg',
        ['-nostdin', '-v', 'error', '-y', '-i', src, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', tmp],
        { stdio: ['ignore', 'ignore', 'pipe'] },
      )
      renameSync(tmp, out)
    }
    return out
  }

  const pcm = (track: TrackKind): Float32Array => {
    let p = pcmCache.get(track)
    if (!p) {
      p = readWav16(readFileSync(wavPath(track)))
      // Pad/trim to the exact session length so offsets line up with the ground truth.
      const n = Math.round((truth.durationMs * SAMPLE_RATE) / 1000)
      if (p.length !== n) {
        const fixed = new Float32Array(n)
        fixed.set(p.subarray(0, n))
        p = fixed
      }
      pcmCache.set(track, p)
    }
    return p
  }

  const utterances = (track?: TrackKind) =>
    truth.utterances.filter((u) => !track || u.track === track).sort((a, b) => a.startMs - b.startMs)

  return {
    id,
    dir,
    truth,
    wavPath,
    pcm,
    utterances,
    reference: (track) =>
      utterances(track)
        .map((u) => u.text)
        .join(' '),
    chunks(track, chunkMs = 100) {
      const all = pcm(track)
      const step = Math.round((chunkMs * SAMPLE_RATE) / 1000)
      const gaps = truth.gaps.filter((g) => g.tracks.includes(track))
      const out: Chunk[] = []
      for (let i = 0; i < all.length; i += step) {
        const atMs = (i * 1000) / SAMPLE_RATE
        const endMs = ((i + step) * 1000) / SAMPLE_RATE
        if (gaps.some((g) => atMs >= g.atMs && endMs <= g.atMs + g.durationMs)) continue
        out.push({ atMs, samples: all.subarray(i, Math.min(all.length, i + step)) })
      }
      return out
    },
  }
}

/** Minimal RIFF/WAVE reader for 16-bit PCM mono. */
export function readWav16(buf: Buffer): Float32Array {
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE')
    throw new Error('not a WAV file')
  let off = 12
  let fmtOk = false
  while (off + 8 <= buf.length) {
    const id = buf.toString('ascii', off, off + 4)
    const size = buf.readUInt32LE(off + 4)
    const body = off + 8
    if (id === 'fmt ') {
      const format = buf.readUInt16LE(body)
      const channels = buf.readUInt16LE(body + 2)
      const bits = buf.readUInt16LE(body + 14)
      if (format !== 1 || channels !== 1 || bits !== 16)
        throw new Error(`unsupported WAV: format ${format}, ${channels} ch, ${bits} bit`)
      fmtOk = true
    } else if (id === 'data') {
      if (!fmtOk) throw new Error('WAV data before fmt')
      const n = Math.floor(Math.min(size, buf.length - body) / 2)
      const out = new Float32Array(n)
      for (let i = 0; i < n; i++) out[i] = buf.readInt16LE(body + i * 2) / 32768
      return out
    }
    off = body + size + (size % 2)
  }
  throw new Error('WAV has no data chunk')
}
