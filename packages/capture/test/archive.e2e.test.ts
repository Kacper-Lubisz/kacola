import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { detectBursts, encodeWav16, synthesize } from '@kacola/testkit/rig'
import { describe, expect, it } from 'vitest'
import { applyRetention, encodeArchive, planRetention, wavToInt16 } from '../src/index.ts'
import { tempDir } from './scenario.ts'

// R-7 against the real ffmpeg binary (libopus). e2e tier rather than int: the blocking gate must stay
// hermetic, and ffmpeg is an external binary the CI check job does not install.
describe('encodeArchive (real ffmpeg)', () => {
  it('produces an Ogg/Opus file ~1/10 the size that decodes back to the same bursts', async () => {
    const dir = tempDir('archive')
    const wav = join(dir, 'mic.wav')
    const bursts = [
      { atMs: 1000, durationMs: 1500 },
      { atMs: 4000, durationMs: 2000 },
    ]
    writeFileSync(wav, encodeWav16(synthesize({ freq: 700, bursts, totalMs: 8000 })))
    const out = await encodeArchive(wav)
    expect(out).toBe(join(dir, 'mic.opus'))
    expect(readFileSync(out).subarray(0, 4).toString('ascii')).toBe('OggS')
    expect(statSync(out).size).toBeLessThan(statSync(wav).size / 8)
    const probe = JSON.parse(
      execFileSync('ffprobe', [
        '-v',
        'error',
        '-show_streams',
        '-show_format',
        '-of',
        'json',
        out,
      ]).toString(),
    )
    expect(probe.streams[0].codec_name).toBe('opus')
    expect(Math.abs(Number(probe.format.duration) - 8)).toBeLessThan(0.05)
    const back = join(dir, 'back.wav')
    execFileSync('ffmpeg', [
      '-v',
      'error',
      '-y',
      '-i',
      out,
      '-ar',
      '16000',
      '-ac',
      '1',
      '-c:a',
      'pcm_s16le',
      back,
    ])
    const found = detectBursts(wavToInt16(readFileSync(back)).samples, 700)
    expect(found).toHaveLength(2)
    found.forEach((b, i) => {
      expect(Math.abs(b.startMs - bursts[i]!.atMs)).toBeLessThan(15)
      expect(Math.abs(b.endMs - b.startMs - bursts[i]!.durationMs)).toBeLessThan(20)
    })
    expect(readdirSync(dir).some((f) => f.endsWith('.partial'))).toBe(false)
  })

  it('rejects on a bad input and leaves no partial or final file behind', async () => {
    const dir = tempDir('archive-bad')
    const wav = join(dir, 'broken.wav')
    writeFileSync(wav, 'this is not audio')
    await expect(encodeArchive(wav)).rejects.toThrow(/ffmpeg failed/)
    expect(readdirSync(dir)).toEqual(['broken.wav'])
  })

  it('applyRetention with the real encoder: archive written, WAV deleted only after', async () => {
    const dir = tempDir('archive-ret')
    const wav = join(dir, 'system.wav')
    writeFileSync(
      wav,
      encodeWav16(synthesize({ freq: 300, bursts: [{ atMs: 0, durationMs: 500 }], totalMs: 1000 })),
    )
    const plan = planRetention(
      [
        {
          id: 's',
          endedAt: new Date(0),
          transcribedAt: new Date(0),
          tracks: [{ wavPath: wav, archivePath: null }],
        },
      ],
      { audio: 'delete-after-transcription', days: 30, archive: true },
      new Date(1000),
    )
    const r = await applyRetention(plan)
    expect(r.map((x) => [x.type, x.ok])).toEqual([
      ['encode', true],
      ['delete', true],
    ])
    expect(existsSync(wav)).toBe(false)
    expect(statSync(join(dir, 'system.opus')).size).toBeGreaterThan(100)
  })
})
