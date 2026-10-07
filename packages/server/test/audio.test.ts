import { createHash } from 'node:crypto'
import { AUDIO_CHUNK_BYTES, chunkSeqFor, type KacolaClient, type TrackKind } from '@kacola/protocol'
import { DeepgramProvider, decodeWav } from '@kacola/stt/cloud'
import { type FakeDeepgram, startFakeDeepgram } from '@kacola/testkit/cloud-stt'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { type Hosted, startHosted } from './helpers.ts'

// H-3 + H-8 on the server: chunk receipts are idempotent and conflict-safe, finalize refuses gaps,
// assembles per-track WAVs byte-exact, and (with a cloud provider) writes a diarized final transcript —
// idempotently, and retryably after a provider failure.

let dg: FakeDeepgram
beforeAll(async () => {
  dg = await startFakeDeepgram()
})
afterAll(() => dg.close())
let servers: Hosted[] = []
afterEach(async () => {
  await Promise.all(servers.map((s) => s.close()))
  servers = []
  dg.failNext.length = 0
  dg.script = null
})
const stt = () =>
  new DeepgramProvider({ apiKey: 'dg-test-key', baseUrl: dg.url, backoffMs: () => 1, attempts: 1 })
async function hosted(withStt = true) {
  const h = await startHosted({ stt: withStt ? stt() : null })
  servers.push(h)
  return h
}

const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex')
/** Deterministic, non-silent PCM. */
function pcm(bytes: number, seed: number): Uint8Array {
  const out = new Uint8Array(bytes)
  let x = seed
  for (let i = 0; i < bytes; i++) {
    x = (x * 1103515245 + 12345) & 0x7fffffff
    out[i] = x & 0xff
  }
  return out
}
const put = (c: KacolaClient, id: string, track: TrackKind, index: number, data: Uint8Array, over = {}) =>
  c.call('putAudioChunk', {
    params: { id, chunkSeq: String(chunkSeqFor(track, index)) },
    body: {
      track,
      sampleRate: 16000,
      format: 's16le',
      data: Buffer.from(data).toString('base64'),
      sha256: sha(data),
      ...over,
    },
  })

describe('chunk upload', () => {
  it('stores a chunk once; a byte-identical retry is a no-op; different bytes under the same seq are refused', async () => {
    const h = await hosted()
    const s = await h.client.call('createSession', { body: {} })
    const a = pcm(1000, 1)
    expect(await put(h.client, s.id, 'mic', 0, a)).toEqual({ chunkSeq: 0, stored: true, bytes: 1000 })
    expect(await put(h.client, s.id, 'mic', 0, a)).toEqual({ chunkSeq: 0, stored: false, bytes: 1000 })
    await expect(put(h.client, s.id, 'mic', 0, pcm(1000, 2))).rejects.toMatchObject({ status: 409 })
    expect((await h.client.call('getAudioStatus', { params: { id: s.id } })).chunks).toEqual([
      { chunkSeq: 0, track: 'mic', bytes: 1000, sha256: sha(a) },
    ])
    // the first chunk marks the session as recording
    expect((await h.client.call('getSession', { params: { id: s.id } })).status).toBe('recording')
  })

  it('validates what it is given: checksum, track/seq parity, size, rate, session', async () => {
    const h = await hosted()
    const s = await h.client.call('createSession', { body: {} })
    const a = pcm(100, 3)
    await expect(put(h.client, s.id, 'mic', 0, a, { sha256: sha(pcm(100, 4)) })).rejects.toMatchObject({
      status: 400,
    })
    await expect(
      h.client.call('putAudioChunk', {
        params: { id: s.id, chunkSeq: '1' },
        body: {
          track: 'mic',
          sampleRate: 16000,
          format: 's16le',
          data: Buffer.from(a).toString('base64'),
          sha256: sha(a),
        },
      }),
    ).rejects.toMatchObject({ status: 400 }) // odd seqs are the system track
    await expect(put(h.client, s.id, 'mic', 0, pcm(AUDIO_CHUNK_BYTES + 2, 5))).rejects.toMatchObject({
      status: 400,
    })
    await expect(put(h.client, s.id, 'mic', 0, pcm(101, 5))).rejects.toMatchObject({ status: 400 }) // not s16
    await expect(put(h.client, s.id, 'mic', 0, a, { sampleRate: 48000 })).rejects.toMatchObject({
      status: 400,
    })
    await expect(put(h.client, 'ses_missing', 'mic', 0, a)).rejects.toMatchObject({ status: 404 })
    await expect(
      h.client.call('putAudioChunk', {
        params: { id: s.id, chunkSeq: '-1' },
        body: { track: 'mic', sampleRate: 16000, format: 's16le', data: '', sha256: sha(new Uint8Array()) },
      }),
    ).rejects.toMatchObject({ status: 400 })
    expect((await h.client.call('getAudioStatus', { params: { id: s.id } })).chunks).toEqual([])
  })
})

describe('finalize', () => {
  it('refuses while chunks are missing, then assembles byte-exact WAVs and a diarized transcript', async () => {
    const h = await hosted()
    const s = await h.client.call('createSession', { body: { title: 'offload' } })
    const mic = [pcm(AUDIO_CHUNK_BYTES, 10), pcm(AUDIO_CHUNK_BYTES, 11), pcm(32_000, 12)]
    const sys = [pcm(AUDIO_CHUNK_BYTES, 20), pcm(AUDIO_CHUNK_BYTES, 21)]
    // out of order, with one missing
    await put(h.client, s.id, 'system', 1, sys[1]!)
    await put(h.client, s.id, 'mic', 2, mic[2]!)
    await put(h.client, s.id, 'mic', 0, mic[0]!)
    await put(h.client, s.id, 'system', 0, sys[0]!)
    const body = { chunks: { mic: 3, system: 2 }, durationMs: 11_000 }
    await expect(h.client.call('finalizeAudio', { params: { id: s.id }, body })).rejects.toThrow(
      /missing chunks: 2$/,
    )
    await put(h.client, s.id, 'mic', 1, mic[1]!)
    await expect(
      h.client.call('finalizeAudio', {
        params: { id: s.id },
        body: { ...body, chunks: { mic: 2, system: 2 } },
      }),
    ).rejects.toMatchObject({ status: 409 }) // a chunk beyond the declared count

    const done = await h.client.call('finalizeAudio', { params: { id: s.id }, body })
    expect(done).toMatchObject({ status: 'stopped', durationMs: 11_000, error: null })
    expect(done.tracks.map((t) => [t.kind, t.audioPath])).toEqual([
      ['mic', `blob:audio/${s.id}/mic.wav`],
      ['system', `blob:audio/${s.id}/system.wav`],
    ])
    const micWav = decodeWav((await h.blobs.get(`audio/${s.id}/mic.wav`))!)
    expect(micWav.sampleRate).toBe(16000)
    expect(Buffer.from(micWav.pcm).equals(Buffer.concat(mic))).toBe(true)
    const sysWav = decodeWav((await h.blobs.get(`audio/${s.id}/system.wav`))!)
    expect(Buffer.from(sysWav.pcm).equals(Buffer.concat(sys))).toBe(true)

    const t = await h.client.call('getTranscript', { params: { id: s.id } })
    const bySpeaker = (track: TrackKind) => [
      ...new Set(t.segments.filter((g) => g.track === track).map((g) => g.speaker)),
    ]
    expect(bySpeaker('mic')).toEqual(['me'])
    expect(bySpeaker('system').sort()).toEqual(['speaker-1', 'speaker-2']) // diarized by the provider
    expect(t.segments.every((g) => g.quality === 'final')).toBe(true)
    // the mic went without diarization, the far end with it
    expect(dg.requests.map((r) => r.query.diarize).sort()).toEqual(['false', 'true'])

    // idempotent: no second transcription, no new events
    const seq = await h.store.lastSeq()
    const n = dg.requests.length
    expect(await h.client.call('finalizeAudio', { params: { id: s.id }, body })).toEqual(
      await h.client.call('getSession', { params: { id: s.id } }),
    )
    expect(dg.requests.length).toBe(n)
    expect(await h.store.lastSeq()).toBe(seq)
    await expect(put(h.client, s.id, 'mic', 3, pcm(10, 1))).rejects.toMatchObject({ status: 409 }) // finalized
  })

  it('a provider failure is reported (502, session.error) and a retried finalize completes', async () => {
    const h = await hosted()
    const s = await h.client.call('createSession', { body: {} })
    await put(h.client, s.id, 'mic', 0, pcm(64_000, 1))
    await put(h.client, s.id, 'system', 0, pcm(64_000, 2))
    const body = { chunks: { mic: 1, system: 1 }, durationMs: 2000 }
    dg.failNext.push(503)
    await expect(h.client.call('finalizeAudio', { params: { id: s.id }, body })).rejects.toMatchObject({
      status: 502,
      code: 'unavailable',
    })
    expect((await h.client.call('getSession', { params: { id: s.id } })).error).toMatch(
      /transcription failed/,
    )
    const ok = await h.client.call('finalizeAudio', { params: { id: s.id }, body })
    expect(ok.error).toBeNull()
    const t = await h.client.call('getTranscript', { params: { id: s.id } })
    expect(t.segments.map((g) => g.track).sort()).toEqual(['mic', 'system'])
  })

  it('without a cloud provider, finalize stores the audio and writes no transcript', async () => {
    const h = await hosted(false)
    const s = await h.client.call('createSession', { body: {} })
    await put(h.client, s.id, 'mic', 0, pcm(3200, 1))
    const done = await h.client.call('finalizeAudio', {
      params: { id: s.id },
      body: { chunks: { mic: 1, system: 0 }, durationMs: 100 },
    })
    expect(done.tracks.map((t) => t.kind)).toEqual(['mic'])
    expect((await h.client.call('getTranscript', { params: { id: s.id } })).total).toBe(0)
  })
})
