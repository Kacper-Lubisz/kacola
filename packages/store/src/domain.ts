import { type DurableEventData, newId, type Segment, type Session } from '@gnomeola/protocol'
import type { SegmentInput } from './api.ts'
import { StoreError } from './errors.ts'

// Domain rules shared by every dialect that implements StoreApi without going through `Store`
// (./store.ts keeps its own, older copy of the segment rules inline; the contract suite running on
// both dialects is what keeps the two identical).

export function newSession(input: { title?: string; private?: boolean; id?: string }, now: Date): Session {
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
export type IngestFacts = { sessionExists: boolean; prevSegment: Segment | null }

export type IngestDecision =
  | { kind: 'apply'; sessionId: string | null; data: DurableEventData }
  | { kind: 'skip' }
  | { kind: 'reject'; reason: string }

/** Which session an item's facts are about (null = none needed). */
export function ingestSubject(data: DurableEventData): {
  sessionId: string | null
  segmentId: string | null
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
    case 'settings.updated':
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
 *   - settings are device-local and never synced; deleting an absent session is a no-op.
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
    case 'settings.updated':
      return { kind: 'skip' }
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
