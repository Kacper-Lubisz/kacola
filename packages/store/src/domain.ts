import {
  type DurableEventData,
  newId,
  type Segment,
  type Session,
  type SessionMeeting,
} from '@gnomeola/protocol'
import type { SegmentInput } from './api.ts'
import { StoreError } from './errors.ts'

// Domain rules shared by every dialect that implements StoreApi without going through `Store`
// (./store.ts keeps its own, older copy of the segment rules inline; the contract suite running on
// both dialects is what keeps the two identical).

export function newSession(
  input: { title?: string; private?: boolean; id?: string; meeting?: SessionMeeting },
  now: Date,
): Session {
  return {
    id: input.id ?? newId('ses', now.getTime()),
    title: input.title?.trim() || `Meeting ${now.toISOString().slice(0, 16).replace('T', ' ')}`,
    createdAt: now.toISOString(),
    startedAt: null,
    endedAt: null,
    status: 'idle',
    private: input.private ?? false,
    durationMs: 0,
    tracks: [],
    error: null,
    ...(input.meeting ? { meeting: input.meeting } : {}),
  }
}

/** The shape rules every stored segment obeys, whoever produced it. Returns a reason, or null. */
export function segmentShapeProblem(g: SegmentInput): string | null {
  if (g.endMs < g.startMs) return `segment ${g.id}: end ${g.endMs} < start ${g.startMs}`
  if (g.track === 'mic' && g.speaker !== 'me') return `segment ${g.id}: mic track must be attributed to 'me'`
  if (g.track === 'system' && g.speaker === 'me') return `segment ${g.id}: far-end track cannot be 'me'`
  if (!g.speaker) return `segment ${g.id}: empty speaker`
  return null
}

/** The next revision of a segment, or a StoreError refusing the upsert. */
export function nextSegment(input: SegmentInput, prev: Segment | null, sessionExists: boolean): Segment {
  const shape = segmentShapeProblem(input)
  if (shape) throw new StoreError('bad_request', shape)
  if (!sessionExists) throw new StoreError('not_found', `no session ${input.sessionId}`)
  if (input.speakerId !== undefined)
    // M3 attribution is written by the recording device (./store.ts) and reaches a replica by sync
    throw new StoreError('bad_request', `segment ${input.id}: speaker attribution is not written here`)
  if (prev) {
    if (prev.sessionId !== input.sessionId || prev.track !== input.track)
      throw new StoreError('conflict', `segment ${input.id}: session/track cannot change`)
    if (prev.quality === 'final' && input.quality === 'live')
      throw new StoreError('conflict', `segment ${input.id}: cannot regress final -> live`)
  }
  return { ...input, revision: (prev?.revision ?? 0) + 1 }
}

// ------------------------------------------------------------------------------ H-7 ingest rules

/** What the server needs to know about current state to decide one pushed item. */
export type IngestFacts = {
  sessionExists: boolean
  prevSegment: Segment | null
  /** For `note.version`: that session already has a version with this number. */
  noteVersionExists?: boolean
  /** For speaker events: every speaker id the item names exists, in the item's session. */
  speakersExist?: boolean
}

export type IngestDecision =
  | { kind: 'apply'; sessionId: string | null; data: DurableEventData }
  | { kind: 'skip' }
  | { kind: 'reject'; reason: string }

/** What an item's facts are about (nulls = not needed). */
export function ingestSubject(data: DurableEventData): {
  sessionId: string | null
  segmentId: string | null
  noteVersion?: number
  speakerIds?: string[]
} {
  switch (data.type) {
    case 'session.upserted':
      return { sessionId: data.session.id, segmentId: null }
    case 'segment.upserted':
      return { sessionId: data.segment.sessionId, segmentId: data.segment.id }
    case 'qa.message':
      return { sessionId: data.message.sessionId, segmentId: null }
    case 'session.deleted':
      return { sessionId: data.sessionId, segmentId: null }
    case 'note.version':
      return { sessionId: data.version.sessionId, segmentId: null, noteVersion: data.version.version }
    case 'speaker.upserted':
      return { sessionId: data.speaker.sessionId, segmentId: null }
    case 'speaker.merged':
      return { sessionId: data.sessionId, segmentId: null, speakerIds: [data.fromId, data.intoId] }
    case 'segments.attributed':
      return { sessionId: data.sessionId, segmentId: null, speakerIds: [data.speakerId] }
    case 'voiceprint.upserted':
    case 'voiceprint.deleted':
    case 'settings.updated':
    case 'template.upserted':
    case 'template.deleted':
    case 'agenda.upserted':
    case 'agenda.deleted':
    case 'agenda.item.upserted':
    case 'agenda.item.status':
    case 'agenda.item.deleted':
    case 'agenda.items.reordered':
    case 'agenda.context.upserted':
    case 'agenda.context.deleted':
    case 'agenda.suggestion.upserted':
    case 'share.upserted':
    case 'share.revoked':
    case 'share.participant.upserted':
    case 'share.item.upserted':
    case 'share.item.deleted':
    case 'share.change':
    case 'share.card.upserted':
    case 'share.card.deleted':
    case 'share.comment.upserted':
      return { sessionId: null, segmentId: null }
  }
}

/**
 * The conflict rules of hybrid sync (docs/hosting.md), as one pure function. The hosted store is a
 * replica: every session has exactly one writer — the device that recorded it — so items are applied
 * verbatim (keeping that device's segment revisions) and the only judgement calls are:
 *
 *   - a segment revision at or below the one already stored is a no-op (snapshots and re-pushes);
 *   - anything that would break a store invariant (unknown session, final → live, track change,
 *     mic not `me`) is rejected, reported back, and does not stop the rest of the batch;
 *   - notes versions are append-only, so a version number already present is a no-op;
 *   - M3 speakers, merges and attributions apply when their session (and every speaker they name)
 *     exists; voiceprints are biometric, device-local data and are never stored here, even if pushed;
 *   - settings and notes templates are device-local and never synced; deleting an absent session is a
 *     no-op;
 *   - agendas: a device's agenda log is never replicated — it holds private context cards, evidence
 *     quoted from transcripts and suggestions. Team sharing pushes a PROJECTION through its own routes
 *     (/shared/:id/push, judged by ./shares.ts), so local `agenda.*` events are skipped here;
 *   - `share.*` events are written by the hosted server itself; a device pushing one is forging server
 *     state, so they are rejected (reported back), never applied.
 */
export function decideIngest(data: DurableEventData, facts: IngestFacts): IngestDecision {
  switch (data.type) {
    case 'session.upserted':
      return { kind: 'apply', sessionId: data.session.id, data }
    case 'segment.upserted': {
      const g = data.segment
      if (!facts.sessionExists) return { kind: 'reject', reason: `no session ${g.sessionId}` }
      const shape = segmentShapeProblem(g)
      if (shape) return { kind: 'reject', reason: shape }
      const prev = facts.prevSegment
      if (prev) {
        if (prev.sessionId !== g.sessionId || prev.track !== g.track)
          return { kind: 'reject', reason: `segment ${g.id}: session/track cannot change` }
        if (prev.revision >= g.revision) return { kind: 'skip' }
        if (prev.quality === 'final' && g.quality === 'live')
          return { kind: 'reject', reason: `segment ${g.id}: cannot regress final -> live` }
      }
      return { kind: 'apply', sessionId: g.sessionId, data }
    }
    case 'qa.message': {
      const m = data.message
      if (m.sessionId !== null && !facts.sessionExists)
        return { kind: 'reject', reason: `no session ${m.sessionId}` }
      return { kind: 'apply', sessionId: m.sessionId, data }
    }
    case 'session.deleted':
      return facts.sessionExists ? { kind: 'apply', sessionId: data.sessionId, data } : { kind: 'skip' }
    case 'note.version': {
      const v = data.version
      if (!facts.sessionExists) return { kind: 'reject', reason: `no session ${v.sessionId}` }
      if (facts.noteVersionExists) return { kind: 'skip' }
      return { kind: 'apply', sessionId: v.sessionId, data }
    }
    case 'speaker.upserted':
      if (!facts.sessionExists) return { kind: 'reject', reason: `no session ${data.speaker.sessionId}` }
      // a voiceprint link is meaningless (and identifying) without the print, which never leaves the device
      return {
        kind: 'apply',
        sessionId: data.speaker.sessionId,
        data: { ...data, speaker: { ...data.speaker, voiceprintId: null } },
      }
    case 'speaker.merged':
    case 'segments.attributed':
      if (!facts.sessionExists) return { kind: 'reject', reason: `no session ${data.sessionId}` }
      if (!facts.speakersExist)
        return { kind: 'reject', reason: `unknown speaker in session ${data.sessionId}` }
      return { kind: 'apply', sessionId: data.sessionId, data }
    case 'voiceprint.upserted':
    case 'voiceprint.deleted':
    case 'settings.updated':
    case 'template.upserted':
    case 'template.deleted':
      return { kind: 'skip' }
    // A device's agenda log never replicates (private cards, evidence quotes, suggestions): team sharing
    // pushes an explicit projection through /shared/:id/push instead (./shares.ts decides it).
    case 'agenda.upserted':
    case 'agenda.deleted':
    case 'agenda.item.upserted':
    case 'agenda.item.status':
    case 'agenda.item.deleted':
    case 'agenda.items.reordered':
    case 'agenda.context.upserted':
    case 'agenda.context.deleted':
    case 'agenda.suggestion.upserted':
      return { kind: 'skip' }
    case 'share.upserted':
    case 'share.revoked':
    case 'share.participant.upserted':
    case 'share.item.upserted':
    case 'share.item.deleted':
    case 'share.change':
    case 'share.card.upserted':
    case 'share.card.deleted':
    case 'share.comment.upserted':
      return {
        kind: 'reject',
        reason: `${data.type} is written by the hosted server, not synced from a device`,
      }
  }
}

/** Items must arrive in non-decreasing seq order; a batch that doesn't is refused whole. */
export function checkIngestOrder(items: { seq: number }[]): void {
  for (let i = 1; i < items.length; i++)
    if (items[i]!.seq < items[i - 1]!.seq)
      throw new StoreError('bad_request', `sync items out of order at index ${i} (seq ${items[i]!.seq})`)
}

// ----------------------------------------------------------------------------- canonical order

export const byKey =
  <T>(...keys: ((x: T) => string | number)[]) =>
  (a: T, b: T): number => {
    for (const k of keys) {
      const x = k(a)
      const y = k(b)
      if (x < y) return -1
      if (x > y) return 1
    }
    return 0
  }
