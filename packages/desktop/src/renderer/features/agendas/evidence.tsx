import type { Evidence } from '@kacola/protocol'
import { _, fmt } from '@kacola/ui-core/i18n'
import { useNavigate } from '@tanstack/react-router'
import { Chip, ChipButton } from '../../design/primitives/index.ts'
import { atLine } from '../meeting/search-params.ts'

/** An evidence chip: the quote; pressing it opens the Transcript at that line. */
export function EvidenceChip({ sessionId, ev }: { sessionId: string | null; ev: Evidence }) {
  const navigate = useNavigate()
  const quote = ev.quote.length > 60 ? `${ev.quote.slice(0, 57)}…` : ev.quote
  if (!sessionId || !ev.segmentId)
    return (
      <Chip icon="quote" label={fmt(_('Evidence: “{quote}”'), { quote: ev.quote })}>
        {quote}
      </Chip>
    )
  return (
    <ChipButton
      icon="quote"
      label={fmt(_('Show in transcript: “{quote}”'), { quote: ev.quote })}
      onPress={() =>
        void navigate({
          to: '/sessions/$sessionId',
          params: { sessionId },
          search: atLine(ev.segmentId),
        })
      }
    >
      {quote}
    </ChipButton>
  )
}
