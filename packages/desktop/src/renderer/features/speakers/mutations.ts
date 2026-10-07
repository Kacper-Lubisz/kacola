import type { DurableEvent, Speaker, SpeakerSummary } from '@kacola/protocol'
import { _ } from '@kacola/ui-core/i18n'
import { applySpeakerEvent, type SpeakersState } from '@kacola/ui-core/speakers'
import { applyTranscriptEvent, type TranscriptState } from '@kacola/ui-core/transcript'
import type { QueryClient } from '@tanstack/react-query'
import { keys } from '../../data/keys.ts'
import { optimistic } from '../../data/mutations.ts'
import type { Api } from '../../data/queries.ts'

// Speaker edits (A-5) as optimistic mutations (docs/desktop-app.md, "Add a mutation"). The optimistic
// value is computed by folding the very event the daemon will echo (speaker.upserted, speaker.merged)
// through ui-core's folds — so the echo, when the EventBridge folds it into the optimistic cache, is a
// no-op by construction, and the transcript and the speaker list can never disagree. A split's new
// speaker id is the daemon's to choose, so the line shows a provisional "New speaker" until the echo
// (speaker.upserted + segments.attributed) names it.

/** A durable event as the daemon would echo it, for folding locally (seq 0: never in any log). */
const local = (sessionId: string, data: DurableEvent['data']): DurableEvent => ({
  seq: 0,
  at: new Date().toISOString(),
  sessionId,
  data,
})

const asSpeaker = (sessionId: string, s: SpeakerSummary, label: string): Speaker => ({
  id: s.id,
  sessionId,
  label,
  named: true,
  colour: s.colour ?? 0,
  voiceprintId: s.voiceprintId,
  mergedInto: null,
  createdAt: new Date(0).toISOString(),
})

export type RenameVars = { sessionId: string; speaker: SpeakerSummary; label: string }
export type MergeVars = { sessionId: string; fromId: string; intoId: string }
export type SplitVars = { sessionId: string; speakerId: string; segmentIds: string[] }

export const PENDING_SPEAKER = 'pending:split'

export function renameSpeakerMutation(api: Api, qc: QueryClient) {
  return {
    mutationKey: ['renameSpeaker'],
    mutationFn: ({ sessionId, speaker, label }: RenameVars) =>
      api.call('renameSpeaker', { params: { id: sessionId, speakerId: speaker.id }, body: { label } }),
    ...optimistic<RenameVars>(qc, ({ sessionId, speaker, label }) => {
      const e = local(sessionId, { type: 'speaker.upserted', speaker: asSpeaker(sessionId, speaker, label) })
      return [
        {
          key: keys.speakers(sessionId),
          update: (p) => applySpeakerEvent(p as SpeakersState, sessionId, e).state,
        },
        {
          key: keys.transcript(sessionId),
          update: (p) => applyTranscriptEvent(p as TranscriptState, sessionId, e),
        },
      ]
    }),
  }
}

export function mergeSpeakerMutation(api: Api, qc: QueryClient) {
  return {
    mutationKey: ['mergeSpeaker'],
    mutationFn: ({ sessionId, fromId, intoId }: MergeVars) =>
      api.call('mergeSpeaker', { params: { id: sessionId, speakerId: fromId }, body: { into: intoId } }),
    ...optimistic<MergeVars>(qc, ({ sessionId, fromId, intoId }) => {
      const e = local(sessionId, { type: 'speaker.merged', sessionId, fromId, intoId })
      return [
        {
          key: keys.speakers(sessionId),
          update: (p) => applySpeakerEvent(p as SpeakersState, sessionId, e).state,
        },
        {
          key: keys.transcript(sessionId),
          update: (p) => applyTranscriptEvent(p as TranscriptState, sessionId, e),
        },
      ]
    }),
  }
}

export function splitSpeakerMutation(api: Api, qc: QueryClient) {
  return {
    mutationKey: ['splitSpeaker'],
    mutationFn: ({ sessionId, speakerId, segmentIds }: SplitVars) =>
      api.call('splitSpeaker', { params: { id: sessionId, speakerId }, body: { segmentIds } }),
    ...optimistic<SplitVars>(qc, ({ sessionId, segmentIds }) => [
      {
        key: keys.transcript(sessionId),
        update: (p) => markSplit(p as TranscriptState, segmentIds),
      },
    ]),
  }
}

/** The lines being split off, shown as a provisional new speaker until the daemon names it. */
export function markSplit(t: TranscriptState, segmentIds: readonly string[]): TranscriptState {
  const ids = new Set(segmentIds)
  let changed = false
  const byId = new Map(t.byId)
  const label = _('New speaker')
  const ordered = t.ordered.map((s) => {
    if (!ids.has(s.id) || s.track !== 'system') return s
    changed = true
    const next = { ...s, speakerId: PENDING_SPEAKER, speaker: label }
    byId.set(s.id, next)
    return next
  })
  return changed ? { ...t, byId, ordered } : t
}

/** The daemon's refusal in words (409 duplicate name, 400 reserved label …). */
export function speakerError(err: unknown): string {
  const e = err as { message?: unknown; body?: { error?: { message?: unknown } } } | null
  const m = e?.body?.error?.message ?? e?.message
  return typeof m === 'string' ? m : String(err)
}
