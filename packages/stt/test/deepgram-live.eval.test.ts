import { loadFixture } from '@gnomeola/testkit/fixtures'
import { describe, expect, it } from 'vitest'
import { DeepgramProvider, float32ToS16 } from '../src/cloud/index.ts'

// H-8 live, opt-in: the real Deepgram API on a committed multi-speaker fixture's far-end track. Needs
// DEEPGRAM_API_KEY (a fraction of a cent per run). Checks shape and plausibility, not accuracy — WER/DER
// for the cloud tier would be baselined like the local tiers if full offload ever became a default.
const key = process.env.DEEPGRAM_API_KEY

describe.skipIf(!key)('Deepgram live', () => {
  it('transcribes and diarizes a real multi-speaker recording', async () => {
    const f = loadFixture('planning-3p-crosstalk')
    const pcm = float32ToS16(f.pcm('system'))
    const utts = await new DeepgramProvider({ apiKey: key! }).transcribe(
      { pcm, sampleRate: 16000 },
      { diarize: true },
    )
    expect(utts.length).toBeGreaterThan(1)
    expect(new Set(utts.map((u) => u.speaker)).size).toBeGreaterThanOrEqual(2)
    for (const u of utts) {
      expect(u.endMs).toBeGreaterThanOrEqual(u.startMs)
      expect(u.text.length).toBeGreaterThan(0)
    }
  })
})
