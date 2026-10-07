import { type FakeDeepgram, RECORDED_DEEPGRAM_RESPONSE, startFakeDeepgram } from '@kacola/testkit/cloud-stt'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { CloudSttError, cloudSttFromEnv, DeepgramProvider, decodeWav, encodeWav } from '../src/cloud/index.ts'

// H-8 against the fake Deepgram (recorded response shapes). The live service: deepgram-live.eval.test.ts.

let dg: FakeDeepgram
beforeAll(async () => {
  dg = await startFakeDeepgram()
})
afterAll(() => dg.close())
beforeEach(() => {
  dg.requests.length = 0
  dg.failNext.length = 0
  dg.script = null
})

const provider = (over: Partial<ConstructorParameters<typeof DeepgramProvider>[0]> = {}) =>
  new DeepgramProvider({ apiKey: 'dg-test-key', baseUrl: dg.url, backoffMs: () => 1, ...over })

/** `seconds` of a 440 Hz tone, s16le at 16 kHz. */
function tone(seconds: number): Uint8Array {
  const n = Math.round(seconds * 16000)
  const out = new Uint8Array(n * 2)
  const v = new DataView(out.buffer)
  for (let i = 0; i < n; i++)
    v.setInt16(i * 2, Math.round(Math.sin((2 * Math.PI * 440 * i) / 16000) * 8000), true)
  return out
}

describe('DeepgramProvider (batch, diarized)', () => {
  it('sends a WAV with the right auth and options, and maps utterances to ms with speakers', async () => {
    dg.script = [
      { start: 0.25, end: 2.5, transcript: 'We should ship on Thursday.', speaker: 0 },
      { start: 2.75, end: 5.125, transcript: 'Agreed, Thursday it is.', speaker: 1, confidence: 0.91 },
    ]
    const utts = await provider().transcribe({ pcm: tone(6), sampleRate: 16000 }, { diarize: true })
    expect(utts).toEqual([
      expect.objectContaining({ startMs: 250, endMs: 2500, text: 'We should ship on Thursday.', speaker: 0 }),
      expect.objectContaining({
        startMs: 2750,
        endMs: 5125,
        text: 'Agreed, Thursday it is.',
        speaker: 1,
        confidence: 0.91,
      }),
    ])
    expect(utts[0]!.words[0]).toEqual({ text: 'We', startMs: 250, endMs: expect.any(Number) })
    const req = dg.requests[0]!
    expect(req.authorization).toBe('Token dg-test-key')
    expect(req.contentType).toBe('audio/wav')
    expect(req.query).toMatchObject({
      model: 'nova-3',
      diarize: 'true',
      utterances: 'true',
      punctuate: 'true',
    })
    expect(req.durationSec).toBeCloseTo(6, 3)
  })

  it('omits speakers when diarization is off, and returns nothing for silence or empty audio', async () => {
    const utts = await provider().transcribe({ pcm: tone(9), sampleRate: 16000 }, { diarize: false })
    expect(utts.map((u) => u.text)).toEqual(['utterance 1', 'utterance 2', 'utterance 3'])
    expect(utts.every((u) => u.speaker === null)).toBe(true)
    expect(dg.requests[0]!.query.diarize).toBe('false')
    expect(await provider().transcribe({ pcm: new Uint8Array(32000), sampleRate: 16000 })).toEqual([])
    expect(await provider().transcribe({ pcm: new Uint8Array(0), sampleRate: 16000 })).toEqual([])
    expect(dg.requests).toHaveLength(2) // empty audio never leaves the machine
  })

  it('parses the recorded response verbatim (utterances block)', async () => {
    const recorded: typeof fetch = async () =>
      new Response(JSON.stringify(RECORDED_DEEPGRAM_RESPONSE), {
        headers: { 'content-type': 'application/json' },
      })
    const utts = await provider({ fetch: recorded }).transcribe({ pcm: tone(1), sampleRate: 16000 })
    expect(utts).toEqual([
      {
        startMs: 80,
        endMs: 3200,
        text: "Yeah. As as much as, it's worth celebrating",
        speaker: 0,
        confidence: 0.97143555,
        words: [{ text: 'Yeah.', startMs: 80, endMs: 320 }],
      },
    ])
  })

  it('falls back to the channel transcript when there is no utterances block', async () => {
    const { utterances: _u, ...results } = RECORDED_DEEPGRAM_RESPONSE.results
    const noUtts: typeof fetch = async () =>
      new Response(JSON.stringify({ ...RECORDED_DEEPGRAM_RESPONSE, results }))
    const utts = await provider({ fetch: noUtts }).transcribe({ pcm: tone(1), sampleRate: 16000 })
    expect(utts).toEqual([
      expect.objectContaining({
        startMs: 80,
        endMs: 800,
        speaker: null,
        text: "Yeah. As as much as, it's worth celebrating",
      }),
    ])
  })

  it('retries 429/5xx, then succeeds; gives up on 4xx at once with the provider message', async () => {
    dg.failNext.push(503, 429)
    const utts = await provider().transcribe({ pcm: tone(3), sampleRate: 16000 })
    expect(utts).toHaveLength(1)
    expect(dg.requests).toHaveLength(3)

    dg.requests.length = 0
    const bad = provider({ apiKey: 'wrong' })
    const err = await bad.transcribe({ pcm: tone(1), sampleRate: 16000 }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(CloudSttError)
    expect((err as CloudSttError).status).toBe(401)
    expect((err as CloudSttError).message).toMatch(/INVALID_AUTH: Invalid credentials/)
    expect(dg.requests).toHaveLength(1)

    dg.failNext.push(500, 500, 500)
    const exhausted = await provider()
      .transcribe({ pcm: tone(1), sampleRate: 16000 })
      .catch((e: unknown) => e)
    expect((exhausted as CloudSttError).retryable).toBe(true)
  })

  it('reports an unreachable service as retryable', async () => {
    const p = provider({ baseUrl: 'http://127.0.0.1:9', attempts: 2 })
    const err = await p.transcribe({ pcm: tone(1), sampleRate: 16000 }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(CloudSttError)
    expect((err as CloudSttError).retryable).toBe(true)
  })
})

describe('DeepgramProvider as a FinalTranscriber (tier 2, behind the existing interface)', () => {
  it('transcribes one float32 segment to text + mean confidence, without diarization', async () => {
    dg.script = [
      { start: 0, end: 1, transcript: 'three', speaker: 0, confidence: 0.8 },
      { start: 1, end: 2, transcript: 'attempts', speaker: 0, confidence: 0.6 },
    ]
    const samples = new Float32Array(16000 * 2).map((_, i) => Math.sin(i / 10) * 0.3)
    const r = await provider().transcribe(samples)
    expect(r).toEqual({ text: 'three attempts', confidence: 0.7 })
    expect(dg.requests[0]!.query.diarize).toBe('false')
  })
})

describe('config and framing', () => {
  it('is configured from the environment only when a key is present', () => {
    expect(cloudSttFromEnv({})).toBeNull()
    expect(cloudSttFromEnv({ DEEPGRAM_API_KEY: 'k' })?.id).toBe('deepgram:nova-3')
    expect(cloudSttFromEnv({ DEEPGRAM_API_KEY: 'k', DEEPGRAM_MODEL: 'nova-2' })?.id).toBe('deepgram:nova-2')
    expect(() => new DeepgramProvider({ apiKey: '' })).toThrow(/missing/)
  })

  it('WAV framing round-trips', () => {
    const pcm = tone(0.5)
    const wav = encodeWav(pcm, 16000)
    expect(wav.length).toBe(44 + pcm.length)
    expect(decodeWav(wav)).toEqual({ pcm, sampleRate: 16000 })
    expect(() => decodeWav(new Uint8Array(50))).toThrow(/WAV/)
  })
})
