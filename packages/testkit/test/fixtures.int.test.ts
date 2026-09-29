import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { FIXTURE_SCRIPTS, listFixtures, loadFixture, SAMPLE_RATE } from '../src/fixtures/index.ts'

// Decodes every committed fixture with ffmpeg (into a throwaway cache) and checks that the ground
// truth actually lines up with the audio: speech where it says speech, quiet where it says quiet,
// nothing at all inside a recorded gap.

let cache = ''
beforeAll(() => {
  cache = mkdtempSync(join(tmpdir(), 'gnomeola-fixture-cache-'))
  process.env.GNOMEOLA_FIXTURE_CACHE = cache
})
afterAll(() => {
  delete process.env.GNOMEOLA_FIXTURE_CACHE
  rmSync(cache, { recursive: true, force: true })
})

const rms = (x: Float32Array) => Math.sqrt(x.reduce((a, v) => a + v * v, 0) / Math.max(1, x.length))
const slice = (pcm: Float32Array, fromMs: number, toMs: number) =>
  pcm.subarray(Math.round((fromMs * SAMPLE_RATE) / 1000), Math.round((toMs * SAMPLE_RATE) / 1000))

describe.each(listFixtures())('fixture %s', (id) => {
  const f = loadFixture(id)

  it('decodes to 16 kHz mono at the ground-truth length', () => {
    for (const track of ['mic', 'system'] as const) {
      const pcm = f.pcm(track)
      expect(pcm.length).toBe(Math.round((f.truth.durationMs * SAMPLE_RATE) / 1000))
      expect(f.wavPath(track).startsWith(cache)).toBe(true)
    }
  })

  it('has speech inside every utterance and near-silence between them', () => {
    for (const track of ['mic', 'system'] as const) {
      const pcm = f.pcm(track)
      const us = f.utterances(track)
      const quiet: number[] = []
      for (let i = 1; i < us.length; i++) {
        const a = us[i - 1]!.endMs + 150
        const b = us[i]!.startMs - 150
        if (b - a > 300) quiet.push(rms(slice(pcm, a, b)))
      }
      // the crosstalk fixtures leak far-end speech into the mic, so gaps there are not silent
      const floor = quiet.length ? Math.max(...quiet) : 0.001
      const bleeds = FIXTURE_SCRIPTS.find((d) => d.id === id)?.bleedDb !== undefined
      for (const u of us) {
        const level = rms(slice(pcm, u.startMs, u.endMs))
        expect(level, `${track} "${u.text.slice(0, 30)}"`).toBeGreaterThan(0.03)
        if (!(bleeds && track === 'mic'))
          expect(level / floor, `${track} speech-to-quiet ratio`).toBeGreaterThan(20)
      }
    }
  })

  it('delivers no audio for a recorded gap', () => {
    for (const track of ['mic', 'system'] as const) {
      const chunks = f.chunks(track, 100)
      for (const g of f.truth.gaps.filter((x) => x.tracks.includes(track))) {
        const inside = chunks.filter((c) => c.atMs >= g.atMs && c.atMs + 100 <= g.atMs + g.durationMs)
        expect(inside).toEqual([])
        expect(rms(slice(f.pcm(track), g.atMs + 50, g.atMs + g.durationMs - 50))).toBeLessThan(0.001)
      }
      const expectedChunks =
        Math.ceil(f.pcm(track).length / 1600) - f.truth.gaps.reduce((a, g) => a + g.durationMs / 100, 0)
      expect(Math.abs(chunks.length - expectedChunks)).toBeLessThanOrEqual(f.truth.gaps.length * 2)
    }
  })
})
