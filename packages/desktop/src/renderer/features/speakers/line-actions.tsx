import { formatOffset, THEM } from '@gnomeola/protocol'
import { _, fmt } from '@gnomeola/ui-core/i18n'
import type { TranscriptRow } from '@gnomeola/ui-core/transcript'
import { useMutation } from '@tanstack/react-query'
import { useServices } from '../../data/services.tsx'
import { KButton } from '../transcript/local-primitives.tsx'
import { speakerName } from '../transcript/rows.ts'
import { PENDING_SPEAKER, speakerError, splitSpeakerMutation } from './mutations.ts'

/**
 * Under the transcript, for the selected line: who said it, and — for a far-end line — "Someone Else
 * Said This", which splits it off to a new speaker (optimistic; the daemon's echo names the speaker).
 * A microphone line says why it cannot be changed: the mic is always you.
 */
export function LineActions({
  sessionId,
  row,
  onError,
}: {
  sessionId: string
  row: TranscriptRow
  onError: (message: string | null) => void
}) {
  const { api, queryClient } = useServices()
  const mutation = useMutation(splitSpeakerMutation(api, queryClient))
  if (row.kind !== 'segment' || !row.segmentId) return null
  const where = fmt(_('{speaker} at {time}'), {
    speaker: speakerName(row.speaker),
    time: formatOffset(row.startMs),
  })
  const mic = row.track === 'mic'
  const pending = row.speakerId === PENDING_SPEAKER
  return (
    <section
      aria-label={_('Selected line')}
      className="flex shrink-0 items-center gap-3 border-t border-border-subtle bg-bg-window px-5 py-2"
    >
      <p className="type-callout m-0 min-w-0 flex-1 truncate text-text-secondary">
        {mic ? fmt(_('{line} — your microphone is always you'), { line: where }) : where}
      </p>
      {mic ? null : (
        <KButton
          size="sm"
          icon="userPlus"
          isDisabled={mutation.isPending || pending}
          aria-description={fmt(_('Give the line {line} to a new speaker'), { line: where })}
          onPress={() => {
            onError(null)
            mutation.mutate(
              { sessionId, speakerId: row.speakerId ?? THEM, segmentIds: [row.segmentId!] },
              { onError: (e) => onError(speakerError(e)) },
            )
          }}
        >
          {_('Someone Else Said This')}
        </KButton>
      )}
    </section>
  )
}
