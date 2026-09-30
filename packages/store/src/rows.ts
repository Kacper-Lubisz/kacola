import type { NoteVersion, QaMessage, Segment, Speaker, Track, TrackKind } from '@gnomeola/protocol'
import type { AudioChunkRecord, DeviceRecord } from './api.ts'

// Row → protocol mapping shared by the StoreApi implementations. Both dialects store the same column
// names and the same encodings (ISO text timestamps, JSON as text, int4 for times), so one mapping
// serves both; only booleans differ (SQLite 0/1, Postgres true/false), and `truthy` absorbs that.

export type Row = Record<string, unknown>

export const truthy = (v: unknown): boolean => v === true || v === 1 || v === '1' || v === 't'

export function rowToQa(r: Row): QaMessage {
  return {
    id: r.id as string,
    sessionId: r.session_id as string | null,
    requestId: r.request_id as string,
    role: r.role as QaMessage['role'],
    text: r.text as string,
    citations: JSON.parse(r.citations as string) as QaMessage['citations'],
    model: r.model as string | null,
    usage: r.usage === null ? null : (JSON.parse(r.usage as string) as QaMessage['usage']),
    stopReason: r.stop_reason as string | null,
    createdAt: r.created_at as string,
  }
}

export function rowToSegment(r: Row): Segment {
  return {
    id: r.id as string,
    sessionId: r.session_id as string,
    track: r.track as TrackKind,
    speaker: r.speaker as string,
    ...(r.speaker_id !== null && r.speaker_id !== undefined ? { speakerId: r.speaker_id as string } : {}),
    startMs: Number(r.start_ms),
    endMs: Number(r.end_ms),
    text: r.text as string,
    quality: r.quality as Segment['quality'],
    revision: Number(r.revision),
    confidence: r.confidence === null ? null : Number(r.confidence),
  }
}

export function rowToTrack(r: Row): Track {
  return {
    kind: r.kind as TrackKind,
    device: r.device as string,
    sampleRate: Number(r.sample_rate),
    audioPath: r.audio_path as string | null,
    archivePath: r.archive_path as string | null,
    gaps: JSON.parse(r.gaps as string) as Track['gaps'],
  }
}

export function rowToDevice(r: Row): DeviceRecord {
  return {
    id: r.id as string,
    name: r.name as string,
    createdAt: r.created_at as string,
    revokedAt: r.revoked_at as string | null,
  }
}

export function rowToChunk(r: Row): AudioChunkRecord {
  return {
    sessionId: r.session_id as string,
    chunkSeq: Number(r.chunk_seq),
    track: r.track as TrackKind,
    bytes: Number(r.bytes),
    sha256: r.sha256 as string,
    blobKey: r.blob_key as string,
    receivedAt: r.received_at as string,
  }
}

export function rowToNoteVersion(r: Row): NoteVersion {
  const meta = JSON.parse(r.meta as string) as Pick<NoteVersion, 'enhancement' | 'merge' | 'restoredFrom'>
  return {
    sessionId: r.session_id as string,
    version: Number(r.version),
    kind: r.kind as NoteVersion['kind'],
    markdown: r.markdown as string,
    baseVersion: Number(r.base_version),
    createdAt: r.created_at as string,
    enhancement: meta.enhancement ?? null,
    merge: meta.merge ?? null,
    restoredFrom: meta.restoredFrom ?? null,
  }
}

export function rowToSpeaker(r: Row): Speaker {
  return {
    id: r.id as string,
    sessionId: r.session_id as string,
    label: r.label as string,
    named: truthy(r.named),
    colour: Number(r.colour),
    voiceprintId: r.voiceprint_id as string | null,
    mergedInto: r.merged_into as string | null,
    createdAt: r.created_at as string,
  }
}
