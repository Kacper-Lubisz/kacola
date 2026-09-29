import { createHash } from 'node:crypto'
import {
  AUDIO_CHUNK_BYTES,
  type AudioChunkBody,
  type AudioChunkResult,
  type AudioStatus,
  chunkIndexOf,
  chunkSeqFor,
  type FinalizeAudioBody,
  type Session,
  type Track,
  type TrackKind,
} from '@gnomeola/protocol'
import type { BlobStore } from '@gnomeola/store/blob'
import type { StoreApi } from '@gnomeola/store/core'
import { type BatchTranscriber, encodeWav } from '@gnomeola/stt/cloud'
import { HttpError } from './errors.ts'

// H-3 — chunked, idempotent, resumable audio upload for full-offload mode, and the finalize step that
// turns the chunks into per-track WAVs and (with a cloud STT provider, H-8) a diarized transcript.
//
//   PUT  /sessions/:id/audio/chunks/:chunkSeq   one chunk; same bytes again → stored:false (a retry),
//                                               different bytes under the same seq → 409
//   GET  /sessions/:id/audio                    what has arrived (resume = upload the rest)
//   POST /sessions/:id/audio/finalize           all chunks present → WAVs, tracks, transcript
//
// Bytes go to the BlobStore under a content-addressed key; the receipt in the store decides which
// bytes own a chunk seq, so two racing uploads with different bytes cannot corrupt an accepted chunk.

export type AudioDeps = {
  store: StoreApi
  blobs: BlobStore
  stt: BatchTranscriber | null
  now: () => Date
}

const SAMPLE_RATE = 16_000
export const FINALIZED_DEVICE = 'capture-agent'
const sha256 = (b: Uint8Array) => createHash('sha256').update(b).digest('hex')
const chunkKey = (sessionId: string, seq: number, sha: string) =>
  `audio/${sessionId}/${String(seq).padStart(8, '0')}-${sha.slice(0, 16)}.pcm`
const wavKey = (sessionId: string, track: TrackKind) => `audio/${sessionId}/${track}.wav`
const doneKey = (sessionId: string, track: TrackKind) => `audio/${sessionId}/${track}.transcribed`

const isFinalized = (s: Session) =>
  s.tracks.length > 0 && s.tracks.every((t) => t.device === FINALIZED_DEVICE)

async function requireSession(store: StoreApi, id: string): Promise<Session> {
  const s = await store.getSession(id)
  if (!s) throw new HttpError('not_found', `no session ${id}`)
  return s
}

export async function putChunk(
  d: AudioDeps,
  sessionId: string,
  chunkSeqRaw: string,
  body: AudioChunkBody,
): Promise<AudioChunkResult> {
  if (!/^\d{1,9}$/.test(chunkSeqRaw))
    throw new HttpError('bad_request', `chunk seq must be a non-negative integer`)
  const chunkSeq = Number(chunkSeqRaw)
  const session = await requireSession(d.store, sessionId)
  if (chunkIndexOf(chunkSeq).track !== body.track)
    throw new HttpError(
      'bad_request',
      `chunk ${chunkSeq} belongs to the ${chunkIndexOf(chunkSeq).track} track`,
    )
  if (body.sampleRate !== SAMPLE_RATE) throw new HttpError('bad_request', `audio must be ${SAMPLE_RATE} Hz`)
  const bytes = new Uint8Array(Buffer.from(body.data, 'base64'))
  if (bytes.length > AUDIO_CHUNK_BYTES || bytes.length % 2 !== 0)
    throw new HttpError('bad_request', `a chunk is at most ${AUDIO_CHUNK_BYTES} bytes of s16le`)
  const sha = sha256(bytes)
  if (sha !== body.sha256)
    throw new HttpError('bad_request', 'checksum mismatch: the chunk was damaged in transit')

  const prev = (await d.store.audioChunks(sessionId)).find((c) => c.chunkSeq === chunkSeq)
  if (prev) {
    if (prev.sha256 === sha) return { chunkSeq, stored: false, bytes: bytes.length }
    throw new HttpError('conflict', `chunk ${chunkSeq} already holds different audio`)
  }
  if (isFinalized(session)) throw new HttpError('conflict', `session ${sessionId} is already finalized`)
  const blobKey = chunkKey(sessionId, chunkSeq, sha)
  await d.blobs.put(blobKey, bytes)
  const r = await d.store.putAudioChunk({
    sessionId,
    chunkSeq,
    track: body.track,
    bytes: bytes.length,
    sha256: sha,
    blobKey,
    receivedAt: d.now().toISOString(),
  })
  if (r === 'conflict') throw new HttpError('conflict', `chunk ${chunkSeq} already holds different audio`)
  if (session.status === 'idle') {
    // The first audio to arrive is when the recording started, as far as the server can know.
    await d.store.updateSession(sessionId, (s) =>
      s.status === 'idle' ? { ...s, status: 'recording', startedAt: d.now().toISOString() } : s,
    )
  }
  return { chunkSeq, stored: r === 'stored', bytes: bytes.length }
}

export async function audioStatus(d: AudioDeps, sessionId: string): Promise<AudioStatus> {
  await requireSession(d.store, sessionId)
  return {
    sessionId,
    chunks: (await d.store.audioChunks(sessionId)).map((c) => ({
      chunkSeq: c.chunkSeq,
      track: c.track,
      bytes: c.bytes,
      sha256: c.sha256,
    })),
  }
}

/**
 * Idempotent: a finalized session with a transcript is returned as is; one finalized but not (fully)
 * transcribed — a provider error or a timeout mid-way — is transcribed again (segment ids are
 * deterministic, so a rerun revises rather than duplicates).
 */
export async function finalize(d: AudioDeps, sessionId: string, body: FinalizeAudioBody): Promise<Session> {
  let session = await requireSession(d.store, sessionId)
  const transcribed = async (track: TrackKind) => (await d.blobs.get(doneKey(sessionId, track))) !== null
  if (isFinalized(session)) {
    let done = true
    for (const t of session.tracks) if (d.stt && !(await transcribed(t.kind))) done = false
    if (done) return session
  }

  const chunks = await d.store.audioChunks(sessionId)
  const have = new Set(chunks.map((c) => c.chunkSeq))
  const missing: number[] = []
  for (const track of ['mic', 'system'] as const)
    for (let i = 0; i < body.chunks[track] && missing.length < 20; i++)
      if (!have.has(chunkSeqFor(track, i))) missing.push(chunkSeqFor(track, i))
  if (missing.length) throw new HttpError('conflict', `missing chunks: ${missing.join(', ')}`)
  const extra = chunks.filter((c) => chunkIndexOf(c.chunkSeq).index >= body.chunks[c.track])
  if (extra.length)
    throw new HttpError(
      'conflict',
      `chunk ${extra[0]!.chunkSeq} is beyond the ${extra[0]!.track} track's count`,
    )

  const pcm: Record<TrackKind, Uint8Array> = { mic: new Uint8Array(0), system: new Uint8Array(0) }
  for (const track of ['mic', 'system'] as const) {
    const parts = chunks.filter((c) => c.track === track).sort((a, b) => a.chunkSeq - b.chunkSeq)
    const bufs: Uint8Array[] = []
    for (const c of parts) {
      const b = await d.blobs.get(c.blobKey)
      if (!b) throw new HttpError('internal', `chunk ${c.chunkSeq} is recorded but its audio is missing`)
      bufs.push(b)
    }
    pcm[track] = new Uint8Array(Buffer.concat(bufs))
  }

  if (!isFinalized(session)) {
    const tracks: Track[] = []
    for (const kind of ['mic', 'system'] as const) {
      if (!pcm[kind].length) continue
      await d.blobs.put(wavKey(sessionId, kind), encodeWav(pcm[kind], SAMPLE_RATE), {
        contentType: 'audio/wav',
      })
      tracks.push({
        kind,
        device: FINALIZED_DEVICE,
        sampleRate: SAMPLE_RATE,
        audioPath: `blob:${wavKey(sessionId, kind)}`,
        archivePath: null,
        gaps: [],
      })
    }
    const now = d.now().toISOString()
    session = await d.store.updateSession(sessionId, (s) => ({
      ...s,
      status: 'stopped',
      startedAt: s.startedAt ?? now,
      endedAt: now,
      durationMs: body.durationMs,
      tracks,
      error: null,
    }))
  }
  if (!d.stt) return session

  const suffix = sessionId.replace(/^ses_/, '')
  try {
    for (const track of ['mic', 'system'] as const) {
      if (!pcm[track].length || (await transcribed(track))) continue
      const utts = await d.stt.transcribe(
        { pcm: pcm[track], sampleRate: SAMPLE_RATE },
        { diarize: track === 'system' },
      )
      let i = 0
      for (const u of utts) {
        await d.store.upsertSegment({
          id: `seg_${suffix}${track === 'mic' ? 'm' : 's'}${String(i++).padStart(5, '0')}`,
          sessionId,
          track,
          speaker: track === 'mic' ? 'me' : u.speaker === null ? 'them' : `speaker-${u.speaker + 1}`,
          startMs: u.startMs,
          endMs: u.endMs,
          text: u.text,
          quality: 'final',
          confidence: u.confidence === null ? null : Math.min(1, Math.max(0, u.confidence)),
        })
      }
      // A per-track marker, written only once every segment is in: a function killed mid-way (its
      // duration cap) leaves no marker, and the retried finalize redoes exactly that track.
      await d.blobs.put(doneKey(sessionId, track), new TextEncoder().encode(String(utts.length)))
    }
  } catch (err) {
    await d.store.updateSession(sessionId, (s) => ({
      ...s,
      error: `transcription failed: ${(err as Error).message}`,
    }))
    throw err
  }
  if (session.error !== null) session = await d.store.updateSession(sessionId, (s) => ({ ...s, error: null }))
  return (await d.store.getSession(sessionId))!
}

/** Everything a session left in the blob store (called when the session is deleted). */
export async function deleteAudio(blobs: BlobStore, sessionId: string): Promise<void> {
  const keys = (await blobs.list(`audio/${sessionId}/`)).map((b) => b.key)
  if (keys.length) await blobs.delete(keys)
}
