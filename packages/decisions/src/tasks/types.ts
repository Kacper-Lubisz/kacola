// Plain-data inputs for the agenda tasks. Deliberately not the protocol's agenda model: the tasks (and
// the evals built on them) must not move when the tracker's storage shape does. The tracker maps its
// items onto these.

export type ItemKind = 'topic' | 'question' | 'must-cover' | 'decision' | 'info-to-get' | 'competency'

export type AgendaItemInput = {
  id: string
  text: string
  kind: ItemKind
  /** `me`, `them`, or a person's name. */
  owner?: string
  timeboxMin?: number
}

/** One closed transcript segment as the tasks see it. `id` is what evidence points back to. */
export type TranscriptLine = { id: string; speaker: string; text: string; startMs?: number; endMs?: number }

export type TrackStatus = 'not_started' | 'in_progress' | 'covered'
