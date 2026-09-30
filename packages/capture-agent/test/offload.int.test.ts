import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { encodeWav, FileCaptureSource, WAV_HEADER_BYTES } from '@gnomeola/capture'
import { AUDIO_CHUNK_BYTES, createClient, type GnomeolaClient } from '@gnomeola/protocol'
import { createHostedApp, type HostedApp, type Served, serve } from '@gnomeola/server'
import { SqliteStoreApi } from '@gnomeola/store'
import { MemoryBlobStore } from '@gnomeola/store/blob'
import { DeepgramProvider, decodeWav } from '@gnomeola/stt/cloud'
import { type FakeDeepgram, startFakeDeepgram } from '@gnomeola/testkit/cloud-stt'
import { seededRandom } from '@gnomeola/testkit/daemon'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { CaptureAgent } from '../src/agent.ts'
import { ChunkUploader, chunksOfWav, resumeUpload } from '../src/upload.ts'

// H-2 + H-3 + H-8, full offload end to end: the capture-agent records locally (the real capture code
// path, fed from files instead of PipeWire), streams the audio to a hosted server as chunked idempotent
// uploads over a network that drops requests, and the server — with a cloud STT provider (the fake
// Deepgram) — produces a diarized transcript on finalize. The audio the server assembles must be
// byte-identical to the WAVs the agent kept locally; an upload cut short completes later from them.

let dg: FakeDeepgram
let dir: string
let inputs: { mic: string; system: string }
beforeAll(async () => {
  dg = await startFakeDeepgram()
  dir = mkdtempSync(join(tmpdir(), 'gnomeola-offload-'))
  // 12 s per track: two full chunks and a short tail each
  const tone = (hz: number, seconds: number) =>
    Int16Array.from({ length: seconds * 16000 }, (_, i) =>
      Math.round(Math.sin((2 * Math.PI * hz * i) / 16000) * 6000),
    )
  inputs = { mic: join(dir, 'in-mic.wav'), system: join(dir, 'in-system.wav') }
  writeFileSync(inputs.mic, encodeWav(tone(220, 12), 16000))
  writeFileSync(inputs.system, encodeWav(tone(330, 12), 16000))
})
afterAll(async () => {
  await dg.close()
  rmSync(dir, { recursive: true, force: true })
})
const cleanup: (() => Promise<unknown>)[] = []
afterEach(async () => {
  for (const c of cleanup.splice(0)) await c().catch(() => {})
})

type Server = {
  app: HostedApp
  served: Served
  store: SqliteStoreApi
  blobs: MemoryBlobStore
  client: GnomeolaClient
}
async function server(fetchImpl?: typeof fetch): Promise<Server> {
  const store = SqliteStoreApi.open(':memory:')
  const blobs = new MemoryBlobStore()
  const app = createHostedApp({
    store,
    blobs,
    auth: null,
    stt: new DeepgramProvider({ apiKey: 'dg-test-key', baseUrl: dg.url, backoffMs: () => 1 }),
  })
  const served = await serve(app)
  cleanup.push(() => served.close())
  return { app, served, store, blobs, client: createClient({ baseUrl: served.url, fetch: fetchImpl }) }
}

const fileSource = () => () => new FileCaptureSource({ speed: Number.POSITIVE_INFINITY })
const tracks = () => [
  { kind: 'mic' as const, device: inputs.mic },
  { kind: 'system' as const, device: inputs.system },
]
const pcmOf = (path: string) => readFileSync(path).subarray(WAV_HEADER_BYTES)

describe('full offload: capture-agent → hosted server with cloud STT', () => {
  it('records, uploads over a lossy network, and the server transcribes with diarization', async () => {
    const rnd = seededRandom(42)
    let dropped = 0
    const lossy: typeof fetch = async (input, init) => {
      const r = rnd()
      if (r < 0.25) {
        dropped++
        throw new TypeError('network down')
      }
      const res = await fetch(input, init)
      if (r < 0.45) {
        dropped++ // the server stored it, the agent never hears back: its retry must be a no-op
        await res.body?.cancel()
        throw new TypeError('connection reset')
      }
      return res
    }
    const srv = await server()
    const spool = join(dir, 'spool-1')
    const agent = new CaptureAgent({
      remote: createClient({ baseUrl: srv.served.url, fetch: lossy }),
      spoolDir: spool,
      source: fileSource(),
      tracks: tracks(),
    })
    // createSession itself may be dropped: retry it like any client would
    let rec: Awaited<ReturnType<CaptureAgent['record']>> | null = null
    for (let i = 0; !rec && i < 20; i++) rec = await agent.record({ title: 'Offloaded' }).catch(() => null)
    const recording = rec!
    await new Promise((r) => setTimeout(r, 200)) // the file source plays out instantly; let uploads run
    const final = await recording.stop() // retries its own finalize
    expect(dropped).toBeGreaterThan(2)
    expect(recording.uploads.duplicates).toBeGreaterThan(0) // some chunks were re-sent after a lost reply

    const s = final!
    expect(s).toMatchObject({ status: 'stopped', title: 'Offloaded', error: null })
    expect(s.durationMs).toBe(12_000)
    // server audio == the agent's local WAVs, byte for byte
    for (const k of ['mic', 'system'] as const) {
      const server = decodeWav((await srv.blobs.get(`audio/${s.id}/${k}.wav`))!).pcm
      expect(Buffer.from(server).equals(pcmOf(join(spool, s.id, `${k}.wav`))), k).toBe(true)
    }
    const chunks = (await srv.client.call('getAudioStatus', { params: { id: s.id } })).chunks
    expect(chunks.map((c) => c.chunkSeq)).toEqual([0, 1, 2, 3, 4, 5])
    expect(chunks.map((c) => c.bytes)).toEqual([
      AUDIO_CHUNK_BYTES,
      AUDIO_CHUNK_BYTES,
      AUDIO_CHUNK_BYTES,
      AUDIO_CHUNK_BYTES,
      64000,
      64000,
    ])

    const t = await srv.client.call('getTranscript', { params: { id: s.id } })
    expect(t.segments.filter((g) => g.track === 'mic').every((g) => g.speaker === 'me')).toBe(true)
    expect(new Set(t.segments.filter((g) => g.track === 'system').map((g) => g.speaker))).toEqual(
      new Set(['speaker-1', 'speaker-2']),
    )
    expect(t.segments.length).toBe(6) // 12 s → three 4 s utterances per track
  })

  it('an upload cut short (the agent died) completes later from the local WAVs, and resuming twice is harmless', async () => {
    const srv = await server()
    const s = await srv.client.call('createSession', { body: { title: 'interrupted' } })
    const sessionDir = join(dir, 'spool-2', s.id)
    // the capture half ran to completion locally…
    const source = new FileCaptureSource({ speed: Number.POSITIVE_INFINITY })
    await source.start(sessionDir, tracks())
    const result = await source.done
    // …but only two chunks made it up before the agent died
    const up = new ChunkUploader({ client: srv.client, sessionId: s.id })
    for (const c of chunksOfWav(join(sessionDir, 'mic.wav'), 'mic').slice(0, 2))
      up.enqueue('mic', c.seq, c.data)
    await up.drain()

    const r1 = await resumeUpload({
      client: srv.client,
      sessionId: s.id,
      sessionDir,
      durationMs: result.durationMs,
    })
    expect({ uploaded: r1.uploaded, alreadyThere: r1.alreadyThere }).toEqual({ uploaded: 4, alreadyThere: 2 })
    expect(r1.session.status).toBe('stopped')
    const seq = await srv.store.lastSeq()
    const r2 = await resumeUpload({
      client: srv.client,
      sessionId: s.id,
      sessionDir,
      durationMs: result.durationMs,
    })
    expect({ uploaded: r2.uploaded, alreadyThere: r2.alreadyThere }).toEqual({ uploaded: 0, alreadyThere: 6 })
    expect(await srv.store.lastSeq()).toBe(seq)
    for (const k of ['mic', 'system'] as const) {
      const server = decodeWav((await srv.blobs.get(`audio/${s.id}/${k}.wav`))!).pcm
      expect(Buffer.from(server).equals(pcmOf(join(sessionDir, `${k}.wav`))), k).toBe(true)
    }
  })
})
