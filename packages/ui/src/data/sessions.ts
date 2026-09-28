import type { AnyEvent, Session } from '@gnomeola/protocol'
import { displayTitle } from './format.ts'

// The session list as the UI sees it, and the pure fold that keeps it current. The store feeds it
// a snapshot and then every durable event; nothing else mutates it.

export type SessionsState = {
  readonly byId: ReadonlyMap<string, Session>
  /** Newest first (createdAt desc, id desc as a tie-break — ids are time-prefixed). */
  readonly ordered: readonly Session[]
  /** The durable seq this state reflects; events at or below it are already folded in. */
  readonly seq: number
}

export const emptySessions: SessionsState = { byId: new Map(), ordered: [], seq: 0 }

export function compareSessions(a: Session, b: Session): number {
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0
}

function build(byId: Map<string, Session>, seq: number): SessionsState {
  return { byId, ordered: [...byId.values()].sort(compareSessions), seq }
}

/** Replace everything with a snapshot taken at durable seq `seq`. */
export function fromSnapshot(sessions: readonly Session[], seq: number): SessionsState {
  return build(new Map(sessions.map((s) => [s.id, s])), seq)
}

/**
 * Fold one event in. Returns the same object when nothing changed, so React can skip a render.
 * Durable events at or below `state.seq` are ignored: the snapshot already contains them, which is
 * what makes "snapshot at seq N, then subscribe since N" free of both gaps and double-applies.
 */
export function applyEvent(state: SessionsState, event: AnyEvent): SessionsState {
  if (event.seq !== null && event.seq <= state.seq) return state
  const seq = event.seq ?? state.seq
  if (event.data.type !== 'session.upserted') {
    return seq === state.seq ? state : { ...state, seq }
  }
  const next = event.data.session
  const byId = new Map(state.byId)
  byId.set(next.id, next)
  return build(byId, seq)
}

/** Case-insensitive substring match on the displayed title. Blank query matches everything. */
export function filterSessions(sessions: readonly Session[], query: string): readonly Session[] {
  const q = query.trim().toLowerCase()
  if (!q) return sessions
  return sessions.filter((s) => displayTitle(s).toLowerCase().includes(q))
}

/** The session currently recording (or paused mid-recording), if any. */
export const activeSession = (sessions: readonly Session[]): Session | undefined =>
  sessions.find((s) => s.status === 'recording' || s.status === 'paused')
