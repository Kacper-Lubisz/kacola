import type { AnyEvent, Meeting, ModelInfo, TrackKind } from '@gnomeola/protocol'
import type { PartialLine } from '@gnomeola/ui-core/transcript'
import { createStore } from 'zustand/vanilla'

// Everything that is NOT server state lives here (React Query holds the server state): the event
// stream's connection, live audio levels, in-progress transcript partials, streaming answer / enhance
// tokens, model download progress, the last meeting.starting. Lossy by design: nothing here survives a
// reload, and nothing here is ever written back to the daemon.

export type Connection =
  | { kind: 'connecting' }
  | { kind: 'live' }
  /** We had data and lost the event stream; what is shown may be stale. */
  | { kind: 'reconnecting'; error: string }
  /** Never got a snapshot: the daemon is not answering. */
  | { kind: 'unreachable'; error: string }

export type Level = { rms: number; peak: number; elapsedMs: number; at: number }

export type StreamState = {
  /** Text so far (ask answer tokens, or enhanced notes). */
  text: string
  status: 'streaming' | 'done' | 'error'
  error?: { code: string; message: string }
}

export type EphemeralState = {
  connection: Connection
  /** sessionId → track → last level. */
  levels: Record<string, Partial<Record<TrackKind, Level>>>
  /** sessionId → track → the line being spoken right now. */
  partials: Record<string, Partial<Record<TrackKind, PartialLine>>>
  /** Local stream id → tokens so far (ask / enhance). */
  streams: Record<string, StreamState>
  /** model id → the latest progress report. */
  modelProgress: Record<string, ModelInfo>
  meetingStarting: Meeting | null
}

export const initialEphemeral: EphemeralState = {
  connection: { kind: 'connecting' },
  levels: {},
  partials: {},
  streams: {},
  modelProgress: {},
  meetingStarting: null,
}

export const createEphemeralStore = (init: Partial<EphemeralState> = {}) =>
  createStore<EphemeralState>()(() => ({ ...initialEphemeral, ...init }))

export type EphemeralStore = ReturnType<typeof createEphemeralStore>

const LIVE = new Set(['recording', 'paused'])

/** Fold one event into the ephemeral store. Durable events only matter here when they end something. */
export function applyEphemeral(store: EphemeralStore, e: AnyEvent, now = Date.now()): void {
  const d = e.data
  const sid = e.sessionId
  switch (d.type) {
    case 'audio.level':
      if (!sid) return
      store.setState((s) => ({
        levels: {
          ...s.levels,
          [sid]: {
            ...s.levels[sid],
            [d.track]: { rms: d.rms, peak: d.peak, elapsedMs: d.elapsedMs, at: now },
          },
        },
      }))
      return
    case 'transcript.partial':
      if (!sid) return
      store.setState((s) => ({
        partials: {
          ...s.partials,
          [sid]: {
            ...s.partials[sid],
            [d.track]: { track: d.track, speaker: d.speaker, startMs: d.startMs, text: d.text },
          },
        },
      }))
      return
    case 'segment.upserted': {
      // the final for a track supersedes its partial
      const cur = store.getState().partials[d.segment.sessionId]?.[d.segment.track]
      if (!cur || cur.startMs > d.segment.startMs) return
      store.setState((s) => {
        const { [d.segment.track]: _gone, ...rest } = s.partials[d.segment.sessionId] ?? {}
        return { partials: { ...s.partials, [d.segment.sessionId]: rest } }
      })
      return
    }
    case 'session.upserted':
      if (LIVE.has(d.session.status)) return
      clearSession(store, d.session.id)
      return
    case 'session.deleted':
      clearSession(store, d.sessionId)
      return
    case 'model.progress':
      store.setState((s) => ({ modelProgress: { ...s.modelProgress, [d.model.id]: d.model } }))
      return
    case 'meeting.starting':
      store.setState({ meetingStarting: d.meeting })
      return
    default:
      return
  }
}

function clearSession(store: EphemeralStore, id: string): void {
  const s = store.getState()
  if (!(id in s.partials) && !(id in s.levels)) return
  const { [id]: _p, ...partials } = s.partials
  const { [id]: _l, ...levels } = s.levels
  store.setState({ partials, levels })
}
