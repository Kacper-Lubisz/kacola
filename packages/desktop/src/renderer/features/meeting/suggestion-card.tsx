import type { AgendaView } from '@gnomeola/protocol'
import { _, fmt } from '@gnomeola/ui-core/i18n'
import { useNavigate } from '@tanstack/react-router'
import { Button, Card, Icon } from '../../design/primitives/index.ts'
import { useAgendaMutation } from '../agendas/agenda-data.ts'
import { actorFor, isSurprise } from '../agendas/labels.ts'
import { resolveSuggestionMutation, setStatusMutation } from '../agendas/mutations.ts'
import { atLine } from './search-params.ts'
import { pickSuggestion, type Slot } from './suggestion-slot.ts'

// The one suggestion slot, drawn only when there is a suggestion: a single quiet card — "Say next: …"
// or "Looks covered?" — with the words that prompted it and one-click Accept / Not now. The page lays it
// over the bottom of the notepad (whose last line always has room under it), so it never moves the text.

function heading(slot: Slot): string {
  switch (slot.kind) {
    case 'looks-covered':
      return _('Looks covered?')
    case 'say-next':
      return _('Say next')
    case 'check':
      return _('Worth checking')
    case 'proposal':
      return slot.suggestion.kind === 'add-item' ? _('Add to the agenda?') : _('Change the agenda?')
  }
}

export function SuggestionCard({
  view,
  now,
  sessionId,
}: {
  view: AgendaView
  now: number
  sessionId: string | null
}) {
  const navigate = useNavigate()
  const resolve = useAgendaMutation(resolveSuggestionMutation, _('Could not answer the suggestion'))
  const set = useAgendaMutation(setStatusMutation, _('Could not change the status'))
  const slot = pickSuggestion(view, now)
  if (!slot) return null
  const s = slot.suggestion
  // who suggested it, only when that is a surprise (an agent, another attendee — never kacola's own)
  const from = s.source !== 'tracker' && isSurprise(view, s.source) ? actorFor(view, s.source).label : null
  const text = slot.kind === 'looks-covered' && slot.item ? slot.item.text : s.text
  const accept = () => {
    resolve.mutate({ agendaId: view.agenda.id, suggestion: s, action: 'accept' })
    // saying what was suggested next starts that item
    if (slot.kind === 'say-next' && slot.item?.status === 'open')
      set.mutate({ agendaId: view.agenda.id, itemId: slot.item.id, status: 'in-progress' })
  }
  return (
    <Card
      as="section"
      aria-label={fmt(_('Suggestion: {text}'), { text })}
      className="flex flex-col gap-2 px-4 py-3 shadow-e2"
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="type-overline text-text-secondary">{heading(slot)}</span>
        {from ? (
          <span className="type-caption text-text-tertiary">{fmt(_('from {who}'), { who: from })}</span>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p
          className={`m-0 min-w-[min(100%,16rem)] flex-1 break-words text-text-primary ${
            slot.kind === 'say-next'
              ? 'font-editorial text-[17px] leading-6 italic sm:text-[19px] sm:leading-7'
              : 'type-headline'
          }`}
        >
          {slot.kind === 'say-next' ? `“${text}”` : text}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onPress={() => resolve.mutate({ agendaId: view.agenda.id, suggestion: s, action: 'dismiss' })}
          >
            {_('Not now')}
          </Button>
          <Button size="sm" variant="primary" icon="check" onPress={accept}>
            {_('Accept')}
          </Button>
        </div>
      </div>
      {slot.evidence ? (
        slot.evidence.segmentId && sessionId ? (
          <button
            type="button"
            onClick={() =>
              void navigate({
                to: '.',
                search: atLine(slot.evidence!.segmentId),
                replace: true,
                state: { cite: Date.now() } as never,
              })
            }
            aria-label={fmt(_('Show in transcript: “{quote}”'), { quote: slot.evidence.quote })}
            className="flex cursor-default items-start gap-1.5 self-start rounded-sm text-left type-caption text-text-secondary outline-none hover:text-text-primary focus-visible:outline-(length:--focus-ring-width) focus-visible:outline-solid focus-visible:outline-(--focus-ring-color)"
          >
            <Icon name="quote" size={13} className="mt-0.5 shrink-0" />
            <span className="line-clamp-2">“{slot.evidence.quote}”</span>
          </button>
        ) : (
          <p className="m-0 flex items-start gap-1.5 type-caption text-text-secondary">
            <Icon name="quote" size={13} className="mt-0.5 shrink-0" />
            <span className="line-clamp-2">“{slot.evidence.quote}”</span>
          </p>
        )
      ) : null}
    </Card>
  )
}
