import type { AgendaView, ContextCard } from '@kacola/protocol'
import { _, fmt } from '@kacola/ui-core/i18n'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useServices } from '../../data/services.tsx'
import {
  Button,
  Card,
  Chip,
  IconButton,
  Switch,
  TextArea,
  TextField,
  useToast,
} from '../../design/primitives/index.ts'
import { refusal, useAgendaMutation } from './agenda-data.ts'
import { displayAgent } from './labels.ts'
import { addContextMutation, deleteContextMutation, updateContextMutation } from './mutations.ts'

// The Context tab: cards of background for the meeting — typed by the user, found by their search, or
// posted by their connected agent. PRIVATE by default: a card is shown to invitees and other people's
// agents only once the user switches it to shared (a deliberate act, with the switch saying so).

export function sourceLabel(c: ContextCard): string {
  switch (c.source.kind) {
    case 'agent':
      return fmt(_('from {name}'), { name: displayAgent(c.source.ref ?? c.createdBy.replace(/^agent:/, '')) })
    case 'session':
      return _('from a past meeting')
    case 'path':
      return fmt(_('from {path}'), { path: c.source.ref ?? '' })
    case 'url':
      return fmt(_('from {url}'), { url: c.source.ref ?? '' })
    case 'user':
      return _('added by you')
  }
}

export function ContextCardView({
  agendaId,
  card,
  compact = false,
  headingLevel = 2,
}: {
  agendaId: string
  card: ContextCard
  compact?: boolean
  /** The card title's heading level (2 in the Context tab, 3 under the live panel's Context). */
  headingLevel?: 2 | 3
}) {
  const H = headingLevel === 2 ? 'h2' : 'h3'
  const update = useAgendaMutation(updateContextMutation, _('Could not change the card'))
  const remove = useAgendaMutation(deleteContextMutation, _('Could not remove the card'))
  const shared = card.visibility === 'shared'
  return (
    <Card as="article" aria-label={card.title} className="flex flex-col gap-2 p-3">
      <div className="flex items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <H className="m-0 type-headline break-words text-text-primary">{card.title}</H>
          <div className="flex flex-wrap gap-1">
            <Chip icon={shared ? 'speakers' : 'lock'} tone={shared ? 'info' : 'neutral'}>
              {shared ? _('Shared') : _('Private')}
            </Chip>
            <Chip icon={card.source.kind === 'agent' ? 'agent' : 'document'}>{sourceLabel(card)}</Chip>
            {card.pinned ? <Chip icon="check">{_('Pinned')}</Chip> : null}
          </div>
        </div>
        {compact ? null : (
          <IconButton
            icon="delete"
            size="sm"
            label={fmt(_('Remove card “{title}”'), { title: card.title })}
            tooltip={_('Remove')}
            onPress={() => remove.mutate({ agendaId, cardId: card.id })}
          />
        )}
      </div>
      <p className="m-0 type-callout break-words whitespace-pre-wrap text-text-secondary select-text">
        {compact && card.body.length > 280 ? `${card.body.slice(0, 280)}…` : card.body}
      </p>
      {compact ? null : (
        <div className="flex flex-wrap gap-4">
          <Switch
            isSelected={shared}
            onChange={(v) =>
              update.mutate({ agendaId, cardId: card.id, patch: { visibility: v ? 'shared' : 'private' } })
            }
          >
            <span className="type-callout">{_('Shared with attendees')}</span>
          </Switch>
          <Switch
            isSelected={card.pinned}
            onChange={(v) => update.mutate({ agendaId, cardId: card.id, patch: { pinned: v } })}
          >
            <span className="type-callout">{_('Pinned')}</span>
          </Switch>
        </div>
      )}
    </Card>
  )
}

export function ContextTab({ view }: { view: AgendaView }) {
  const { api } = useServices()
  const toast = useToast()
  const add = useMutation({
    ...addContextMutation(api),
    onError: (err) =>
      toast(fmt(_('Could not add the card: {reason}'), { reason: refusal(err) }), { tone: 'error' }),
  })
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [shared, setShared] = useState(false)
  const [adding, setAdding] = useState(false)
  const cards = [...view.context].sort((a, b) => Number(b.pinned) - Number(a.pinned))
  const submit = () => {
    if (!title.trim()) return
    add.mutate(
      {
        agendaId: view.agenda.id,
        card: { title: title.trim(), body, visibility: shared ? 'shared' : 'private' },
      },
      {
        onSuccess: () => {
          setTitle('')
          setBody('')
          setShared(false)
          setAdding(false)
        },
      },
    )
  }
  return (
    <div className="flex flex-col gap-4">
      {cards.length ? (
        <div className="flex flex-col gap-2">
          {cards.map((c) => (
            <ContextCardView key={c.id} agendaId={view.agenda.id} card={c} />
          ))}
        </div>
      ) : (
        <p className="m-0 type-callout text-text-secondary">
          {_('Background for the meeting. Cards are private unless you share them.')}
        </p>
      )}
      {adding ? (
        <section aria-labelledby="new-card" className="flex flex-col gap-2">
          <h2 id="new-card" className="m-0 type-overline text-text-secondary">
            {_('New card')}
          </h2>
          <TextField label={_('Card title')} value={title} onChange={setTitle} />
          <TextArea label={_('Card text')} value={body} onChange={setBody} rows={4} />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Switch isSelected={shared} onChange={setShared}>
              <span className="type-callout">{_('Share with attendees')}</span>
            </Switch>
            <span className="flex gap-2">
              <Button variant="ghost" onPress={() => setAdding(false)}>
                {_('Cancel')}
              </Button>
              <Button
                variant="primary"
                icon="add"
                onPress={submit}
                isDisabled={!title.trim() || add.isPending}
              >
                {_('Add card')}
              </Button>
            </span>
          </div>
        </section>
      ) : (
        <Button icon="add" className="self-start" onPress={() => setAdding(true)}>
          {_('Add card')}
        </Button>
      )}
    </div>
  )
}
