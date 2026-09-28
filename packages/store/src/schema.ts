import type { Generated } from 'kysely'

// Row shapes as SQLite stores them (snake_case, 0/1 booleans, JSON text). Mapping to protocol types
// happens in store.ts and nowhere else.

export type SessionRow = {
  id: string
  title: string
  created_at: string
  started_at: string | null
  ended_at: string | null
  status: string
  private: number
  duration_ms: number
  error: string | null
}

export type TrackRow = {
  session_id: string
  position: number
  kind: string
  device: string
  sample_rate: number
  audio_path: string | null
  archive_path: string | null
  /** JSON array of gaps */
  gaps: string
}

export type SegmentRow = {
  id: string
  session_id: string
  track: string
  speaker: string
  start_ms: number
  end_ms: number
  text: string
  quality: string
  revision: number
  confidence: number | null
}

export type QaRow = {
  id: string
  session_id: string | null
  request_id: string
  role: string
  text: string
  /** JSON */
  citations: string
  model: string | null
  /** JSON or null */
  usage: string | null
  stop_reason: string | null
  created_at: string
}

export type EventRow = {
  seq: number
  at: string
  session_id: string | null
  type: string
  /** JSON DurableEventData */
  data: string
}

export type DB = {
  counters: { name: string; value: number }
  events: EventRow
  sessions: SessionRow
  tracks: TrackRow
  segments: SegmentRow & { pk: Generated<number> }
  qa_messages: QaRow
  settings: { id: number; value: string }
  schema_migrations: { version: number; name: string; applied_at: string }
}
