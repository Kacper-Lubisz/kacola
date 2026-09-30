import { type DurableEvent, ME, type Segment } from '@gnomeola/protocol'

// Invariants that hold even when model output does not. They are the deterministic half of verifying a
// nondeterministic pipeline: whisper may transcribe a sentence differently on every run, but it may
// never produce overlapping segments, regress a final to live, or attribute the microphone to anyone
// other than the user. Every fixture, every tier, every run.

export type Violation = { rule: string; detail: string }

export type SegmentCheckOptions = {
  /** Wall-clock length of the session; segments must lie inside it. */
  durationMs?: number
  /** Require every segment to have reached `final` (end-of-session check). */
  requireFinal?: boolean
}

export function checkSegments(segments: readonly Segment[], opts: SegmentCheckOptions = {}): Violation[] {
  const v: Violation[] = []
  const ids = new Set<string>()
  const byTrack = new Map<string, Segment[]>()
  const limit = (opts.durationMs ?? Number.POSITIVE_INFINITY) + 250
  for (const s of segments) {
    if (ids.has(s.id)) v.push({ rule: 'unique-id', detail: `duplicate segment id ${s.id}` })
    ids.add(s.id)
    if (s.endMs < s.startMs)
      v.push({ rule: 'ordered-bounds', detail: `${s.id}: end ${s.endMs} < start ${s.startMs}` })
    if (s.endMs > limit)
      v.push({
        rule: 'inside-session',
        detail: `${s.id}: ends at ${s.endMs} beyond duration ${opts.durationMs}`,
      })
    if (s.track === 'mic' && s.speaker !== ME)
      v.push({ rule: 'mic-is-me', detail: `${s.id}: mic segment attributed to ${JSON.stringify(s.speaker)}` })
    if (s.track === 'system' && s.speaker === ME)
      v.push({ rule: 'system-is-not-me', detail: `${s.id}: far-end segment attributed to me` })
    if (!s.speaker) v.push({ rule: 'has-speaker', detail: `${s.id}: empty speaker` })
    if (opts.requireFinal && s.quality !== 'final')
      v.push({ rule: 'all-final', detail: `${s.id} still ${s.quality}` })
    const list = byTrack.get(s.track) ?? []
    list.push(s)
    byTrack.set(s.track, list)
  }
  for (const [track, list] of byTrack) {
    const sorted = [...list].sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs)
    for (let i = 1; i < sorted.length; i++) {
      const a = sorted[i - 1]!
      const b = sorted[i]!
      if (b.startMs < a.endMs)
        v.push({
          rule: 'non-overlapping',
          detail: `${track}: ${a.id} [${a.startMs},${a.endMs}) overlaps ${b.id} [${b.startMs},${b.endMs})`,
        })
    }
    const total = list.reduce((acc, s) => acc + (s.endMs - s.startMs), 0)
    if (total > limit)
      v.push({
        rule: 'duration-sum',
        detail: `${track}: segments sum to ${total}ms > session ${opts.durationMs}ms`,
      })
  }
  return v
}

/**
 * Checks the history of upserts for each segment id, in the order they were emitted:
 * revisions strictly increase, quality goes live→final at most once and never back, and
 * track/speaker never change after the first upsert.
 */
export function checkSegmentHistory(upserts: readonly Segment[]): Violation[] {
  const v: Violation[] = []
  const last = new Map<string, Segment>()
  for (const s of upserts) {
    const prev = last.get(s.id)
    if (prev) {
      if (s.revision <= prev.revision)
        v.push({ rule: 'revision-increases', detail: `${s.id}: revision ${prev.revision} -> ${s.revision}` })
      if (prev.quality === 'final' && s.quality === 'live')
        v.push({ rule: 'never-back-to-live', detail: `${s.id}: final -> live` })
      if (prev.track !== s.track) v.push({ rule: 'track-stable', detail: `${s.id}: track changed` })
      if (prev.sessionId !== s.sessionId)
        v.push({ rule: 'session-stable', detail: `${s.id}: session changed` })
    } else if (s.revision !== 1) {
      v.push({ rule: 'revision-starts-at-1', detail: `${s.id}: first seen at revision ${s.revision}` })
    }
    last.set(s.id, s)
  }
  return v
}

/** Durable events: strictly increasing, gap-free, starting after `after` (default 0). */
export function checkEventLog(events: readonly Pick<DurableEvent, 'seq'>[], after = 0): Violation[] {
  const v: Violation[] = []
  let expected = after + 1
  const seen = new Set<number>()
  for (const e of events) {
    if (seen.has(e.seq)) v.push({ rule: 'no-duplicates', detail: `seq ${e.seq} delivered twice` })
    seen.add(e.seq)
    if (e.seq !== expected) v.push({ rule: 'gap-free', detail: `expected seq ${expected}, got ${e.seq}` })
    expected = e.seq + 1
  }
  return v
}

/**
 * Fold the log into the latest state per segment — what a replay must reproduce. An independent
 * reading of the attribution events (M3): a speaker's label follows every rename onto their segments, a
 * merge moves one speaker's segments onto another, and an attribution moves exactly the listed ids.
 */
export function foldSegments(events: readonly DurableEvent[]): Map<string, Segment> {
  const out = new Map<string, Segment>()
  const labels = new Map<string, string>()
  const relabel = (pred: (s: Segment) => boolean, speakerId: string) => {
    for (const [id, s] of out)
      if (pred(s)) out.set(id, { ...s, speakerId, speaker: labels.get(speakerId) ?? s.speaker })
  }
  for (const e of events) {
    const d = e.data
    if (d.type === 'segment.upserted') out.set(d.segment.id, d.segment)
    else if (d.type === 'speaker.upserted') {
      labels.set(d.speaker.id, d.speaker.label)
      relabel((s) => s.speakerId === d.speaker.id, d.speaker.id)
    } else if (d.type === 'speaker.merged') relabel((s) => s.speakerId === d.fromId, d.intoId)
    else if (d.type === 'segments.attributed') {
      const ids = new Set(d.segmentIds)
      relabel((s) => ids.has(s.id), d.speakerId)
    }
  }
  return out
}

/**
 * The absolute attribution invariant (V-3): every microphone segment is the user's and carries no
 * far-end speaker id; no far-end segment is ever the user's. Checked on any segment list — a pipeline's
 * output, a store's transcript, or the fold of a log.
 */
export function checkAttribution(segments: readonly Segment[]): Violation[] {
  const v: Violation[] = []
  for (const s of segments) {
    if (s.track === 'mic' && (s.speaker !== ME || s.speakerId !== undefined))
      v.push({
        rule: 'mic-is-me',
        detail: `${s.id}: mic segment is ${JSON.stringify(s.speaker)}${s.speakerId ? ` (${s.speakerId})` : ''}`,
      })
    if (s.track === 'system' && s.speaker.trim().toLowerCase() === ME)
      v.push({ rule: 'system-is-not-me', detail: `${s.id}: far-end segment attributed to me` })
  }
  return v
}

const RANK: Record<string, number> = { open: 0, 'in-progress': 1, covered: 2, skipped: 2, parked: 2 }

/**
 * Agendas: an independent reading of the log's status changes. Each change starts from the status the
 * item was left in; only the user moves an item anywhere but forward (and such a move is flagged as an
 * override); after a user override, no automated changer (tracker, agent) touches that item until the
 * user moves it again; every agenda-scoped event raises its agenda's version by exactly one.
 */
export function checkAgendaLog(events: readonly DurableEvent[]): Violation[] {
  const v: Violation[] = []
  const status = new Map<string, string>()
  const lockedByUser = new Set<string>()
  const version = new Map<string, number>()
  for (const e of events) {
    const d = e.data
    if (d.type === 'agenda.upserted') {
      version.set(d.agenda.id, d.agenda.version)
      continue
    }
    if (d.type === 'agenda.deleted') {
      version.delete(d.agendaId)
      continue
    }
    if (!d.type.startsWith('agenda.') || d.type === 'agenda.suggestion.upserted') continue
    const scoped = d as { agendaId: string; version: number }
    const prev = version.get(scoped.agendaId)
    if (prev === undefined)
      v.push({ rule: 'agenda-exists', detail: `${d.type} for unknown agenda ${scoped.agendaId}` })
    else if (scoped.version !== prev + 1)
      v.push({ rule: 'version-steps', detail: `${scoped.agendaId}: version ${prev} -> ${scoped.version}` })
    version.set(scoped.agendaId, scoped.version)
    if (d.type === 'agenda.item.upserted') {
      const was = status.get(d.item.id)
      if (was !== undefined && was !== d.item.status)
        v.push({
          rule: 'status-only-by-change',
          detail: `${d.item.id}: upsert moved ${was} -> ${d.item.status}`,
        })
      status.set(d.item.id, d.item.status)
    } else if (d.type === 'agenda.item.status') {
      const c = d.change
      const was = status.get(c.itemId)
      if (was !== c.from)
        v.push({ rule: 'change-continuity', detail: `${c.itemId}: was ${was}, change says ${c.from}` })
      const forward = RANK[c.to]! > RANK[c.from]!
      if (c.override === forward)
        v.push({ rule: 'override-flag', detail: `${c.itemId}: ${c.from}->${c.to} override=${c.override}` })
      if (c.by !== 'user' && !forward)
        v.push({ rule: 'forward-only', detail: `${c.itemId}: ${c.by} moved ${c.from}->${c.to}` })
      if (c.by !== 'user' && lockedByUser.has(c.itemId))
        v.push({ rule: 'manual-wins', detail: `${c.itemId}: ${c.by} changed it after the user's override` })
      if (c.by === 'user') {
        if (c.override) lockedByUser.add(c.itemId)
        else lockedByUser.delete(c.itemId)
      }
      if (d.item.status !== c.to)
        v.push({ rule: 'item-matches-change', detail: `${c.itemId}: item ${d.item.status}, change ${c.to}` })
      status.set(c.itemId, c.to)
    } else if (d.type === 'agenda.item.deleted') {
      status.delete(d.itemId)
      lockedByUser.delete(d.itemId)
    }
  }
  return v
}

/** Throw with every violation listed — for use as a single assertion in tests. */
export function assertNoViolations(violations: Violation[], context = ''): void {
  if (!violations.length) return
  const lines = violations.slice(0, 50).map((x) => `  [${x.rule}] ${x.detail}`)
  const more = violations.length > 50 ? `\n  …and ${violations.length - 50} more` : ''
  throw new Error(
    `${violations.length} invariant violation(s)${context ? ` in ${context}` : ''}:\n${lines.join('\n')}${more}`,
  )
}
