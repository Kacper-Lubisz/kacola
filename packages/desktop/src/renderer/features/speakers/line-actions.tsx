import { formatOffset, THEM } from '@gnomeola/protocol'
import { _, fmt } from '@gnomeola/ui-core/i18n'
import type { TranscriptRow } from '@gnomeola/ui-core/transcript'
import { useMutation } from '@tanstack/react-query'
import { useServices } from '../../data/services.tsx'
import { Button } from '../../design/primitives/index.ts'
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
  onError: (message: string) => void
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
    <section aria-label={_('Selected line')} className="shrink-0 border-t border-border-subtle bg-bg-window">
      <div className="mx-auto flex w-full max-w-[860px] items-center gap-3 px-4 py-2 sm:px-6">
        <p className="m-0 min-w-0 flex-1 truncate type-callout text-text-secondary">
          {mic ? fmt(_('{line} — your microphone is always you'), { line: where }) : where}
        </p>
        {mic ? null : (
          <Button
            size="sm"
            icon="split"
            isDisabled={mutation.isPending || pending}
            onPress={() =>
              mutation.mutate(
                { sessionId, speakerId: row.speakerId ?? THEM, segmentIds: [row.segmentId!] },
                { onError: (e) => onError(speakerError(e)) },
              )
            }
          >
            {_('Someone Else Said This')}
          </Button>
        )}
      </div>
    </section>
  )
}
