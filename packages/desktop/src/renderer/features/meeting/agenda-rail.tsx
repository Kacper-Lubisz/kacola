import type { AgendaItem, AgendaView, Session } from '@kacola/protocol'
import { lastChange, statusCounts } from '@kacola/ui-core/agendas'
import { _, fmt } from '@kacola/ui-core/i18n'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useServices } from '../../data/services.tsx'
import {
  Button,
  Icon,
  IconButton,
  Menu,
  MenuItem,
  TextField,
  useToast,
} from '../../design/primitives/index.ts'
import { refusal, useAgendaHistory, useAgendaMutation } from '../agendas/agenda-data.ts'
import { StatusMenu } from '../agendas/agenda-editor.tsx'
import { useDeleteItem } from '../agendas/delete-item.ts'
import { actorFor, isSurprise, STATUS_ICON } from '../agendas/labels.ts'
import { addItemsMutation } from '../agendas/mutations.ts'
import { useMeetingUi } from './meeting-ui.ts'

// The agenda while live and after: a narrow checklist on the left. No times, no bars, nothing that
// hurries anyone. Live: covered items are ticked and quiet, the current one is highlighted, the rest
// plain; a tick kacola or an agent made says so, quietly, with Undo. An item's menu (on hover or focus)
// can delete it, with Undo in the toast — there, not prominent. After: the same list as a recap.
// Private context sits at the bottom, hidden in case the screen is shared.

function CheckItem({
  view,
  item,
  current,
  onDelete,
}: {
  view: AgendaView
  item: AgendaItem
  current: boolean
  /** Delete it (Undo in the toast); null when this window may not. */
  onDelete: (() => void) | null
}) {
  const { api, queries, queryClient } = useServices()
  const toast = useToast()
  const history = useAgendaHistory(view.agenda.id)
  const done = item.status === 'covered' || item.status === 'skipped'
  const change = lastChange(history.data ?? [], item.id)
  // only a surprise is attributed: not you, and not the agenda's author
  const by = change && change.to === item.status && done && isSurprise(view, change.by) ? change : null
  // Undo restores the item as it was before the tick (its history: a restore is itself undoable)
  const undo = async () => {
    try {
      const versions = await queryClient.fetchQuery({
        ...queries.itemHistory(view.agenda.id, item.id),
        staleTime: 0,
      })
      const before = versions
        .slice(0, -1)
        .reverse()
        .find((v) => v.restorable)
      if (before)
        await api.call('restoreAgendaItem', {
          params: { id: view.agenda.id, itemId: item.id },
          body: { seq: before.seq },
        })
    } catch (err) {
      toast(fmt(_('Could not undo: {reason}'), { reason: refusal(err) }), { tone: 'error' })
    }
  }
  return (
    <li
      aria-label={item.text}
      aria-current={current ? 'step' : undefined}
      className={`group relative flex items-start gap-1.5 rounded-md px-1.5 py-1 ${
        current ? 'border border-border-default bg-bg-surface shadow-e1' : 'border border-transparent'
      }`}
    >
      <StatusMenu agendaId={view.agenda.id} item={item} />
      <div className="flex min-w-0 flex-1 flex-col pt-1.5">
        <span
          className={`type-callout break-words ${
            current
              ? 'font-semibold text-text-primary'
              : done
                ? `text-text-secondary ${item.status === 'skipped' ? 'line-through' : ''}`
                : 'text-text-primary'
          }`}
        >
          {item.text}
        </span>
        {by ? (
          <span className="flex flex-wrap items-center gap-x-1.5 type-caption text-text-tertiary">
            {fmt(_('ticked by {who}'), { who: actorFor(view, by.by).label })}
            <Button
              size="sm"
              variant="link"
              className="!text-text-secondary"
              onPress={() => void undo()}
              aria-label={fmt(_('Undo the tick on “{item}”'), { item: item.text })}
            >
              {_('Undo')}
            </Button>
          </span>
        ) : null}
      </div>
      {onDelete ? (
        <div className="absolute top-1 right-1 rounded-md bg-bg-surface opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 has-[[aria-expanded=true]]:opacity-100">
          <Menu
            label={fmt(_('More for “{item}”'), { item: item.text })}
            trigger={
              <IconButton
                icon="more"
                size="sm"
                label={fmt(_('More for “{item}”'), { item: item.text })}
                tooltip={_('More')}
              />
            }
          >
            <MenuItem icon="delete" destructive onAction={onDelete}>
              {_('Delete')}
            </MenuItem>
          </Menu>
        </div>
      ) : null}
    </li>
  )
}

function AddItem({ view }: { view: AgendaView }) {
  const add = useAgendaMutation(addItemsMutation, _('Could not add the item'))
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  if (!open)
    return (
      <Button size="sm" variant="ghost" icon="add" className="self-start" onPress={() => setOpen(true)}>
        {_('Add item')}
      </Button>
    )
  const submit = () => {
    const t = text.trim()
    if (t) add.mutate({ agendaId: view.agenda.id, items: [{ text: t, kind: 'topic' }] })
    setText('')
    setOpen(false)
  }
  return (
    <TextField
      label={_('New item')}
      labelHidden
      placeholder={_('Add an item…')}
      value={text}
      onChange={setText}
      autoFocus
      onBlur={submit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') submit()
        if (e.key === 'Escape') {
          setText('')
          setOpen(false)
        }
      }}
    />
  )
}

export function LiveChecklist({ view }: { view: AgendaView }) {
  const deleting = useDeleteItem(view)
  const items = [...view.items].sort((a, b) => a.order - b.order)
  const counts = statusCounts(items)
  const current = items.find((i) => i.status === 'in-progress')
  return (
    <section aria-labelledby="live-agenda" className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2 px-1.5">
        <h2 id="live-agenda" className="m-0 type-headline text-text-primary">
          {_('Agenda')}
        </h2>
        <span className="type-caption text-text-secondary">
          {fmt(_('{covered} of {total} covered'), { covered: counts.covered, total: items.length })}
        </span>
      </div>
      {items.length ? (
        <ol aria-label={_('Agenda items')} className="m-0 flex list-none flex-col gap-0.5 p-0">
          {items.map((i) => (
            <CheckItem
              key={i.id}
              view={view}
              item={i}
              current={i.id === current?.id}
              onDelete={deleting.can(i) ? () => deleting.del(i) : null}
            />
          ))}
        </ol>
      ) : (
        <p className="m-0 px-1.5 type-callout text-text-secondary">{_('No items yet.')}</p>
      )}
      <AddItem view={view} />
    </section>
  )
}

const RECAP_WORD: Record<AgendaItem['status'], () => string> = {
  covered: () => _('settled'),
  skipped: () => _('skipped'),
  parked: () => _('parked'),
  open: () => _('not settled'),
  'in-progress': () => _('talked about, not settled'),
}

export function OutcomeRecap({ view }: { view: AgendaView }) {
  const items = [...view.items].sort((a, b) => a.order - b.order)
  const counts = statusCounts(items)
  const unsettled = counts.open + counts['in-progress'] + counts.parked
  return (
    <section aria-labelledby="recap-agenda" className="flex flex-col gap-2 px-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="recap-agenda" className="m-0 type-headline text-text-primary">
          {_('Agenda')}
        </h2>
        <span className="type-caption text-text-secondary">
          {fmt(_('{settled} settled, {open} not'), { settled: counts.covered, open: unsettled })}
        </span>
      </div>
      <ol aria-label={_('Recap per item')} className="m-0 flex list-none flex-col p-0">
        {items.map((i) => (
          <li
            key={i.id}
            aria-label={i.text}
            className="flex items-start gap-2 border-b border-border-subtle py-2 last:border-b-0"
          >
            <Icon
              name={i.status === 'open' || i.status === 'in-progress' ? 'carry' : STATUS_ICON[i.status]}
              size={16}
              className={`mt-0.5 shrink-0 ${i.status === 'covered' ? 'text-status-success' : 'text-text-tertiary'}`}
            />
            {/* the state word sits at the end of the item's line, and drops under it when there is no room */}
            <span className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-2">
              <span
                className={`min-w-[7rem] flex-1 type-callout break-words ${i.status === 'covered' ? 'text-text-secondary' : 'text-text-primary'}`}
              >
                {i.text}
              </span>
              <span className="type-caption text-text-tertiary">{RECAP_WORD[i.status]()}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}

/**
 * Private context ("My notes on Ana"): hidden while live in case the screen is shared; Show reveals it
 * for this run. After the meeting and in prep it is simply shown, labelled as only yours.
 */
export function PrivateContext({ view, hidden }: { view: AgendaView; hidden: boolean }) {
  const cards = view.context.filter((c) => c.visibility === 'private')
  const revealed = useMeetingUi((s) => s.revealed[view.agenda.id] ?? false)
  const reveal = useMeetingUi((s) => s.reveal)
  if (!cards.length) return null
  const shown = !hidden || revealed
  return (
    <section
      aria-label={_('Private context')}
      className="flex flex-col gap-2 rounded-lg bg-bg-sidebar px-3 py-2.5"
    >
      <div className="flex items-start gap-2">
        <Icon name={shown ? 'lock' : 'observe'} size={15} className="mt-0.5 shrink-0 text-text-secondary" />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="type-callout font-semibold text-text-primary">
            {cards.length === 1 ? cards[0]!.title : fmt(_('{n} private notes'), { n: cards.length })}
          </span>
          <span className="type-caption text-text-secondary">
            {shown ? _('Only you. Never in what others get.') : _('Hidden in case you share your screen')}
          </span>
        </div>
        {hidden ? (
          <Button size="sm" variant="ghost" onPress={() => reveal(view.agenda.id, !revealed)}>
            {revealed ? _('Hide') : _('Show')}
          </Button>
        ) : null}
      </div>
      {shown
        ? cards.map((c) => (
            <div key={c.id} className="flex flex-col gap-0.5 pl-[23px]">
              {cards.length > 1 ? (
                <span className="type-caption font-semibold text-text-primary">{c.title}</span>
              ) : null}
              <p className="m-0 type-callout break-words whitespace-pre-wrap text-text-secondary select-text">
                {c.body}
              </p>
            </div>
          ))
        : null}
    </section>
  )
}

/** A recording with no agenda: say so, and offer one (the daemon links it to the recording). */
export function NoAgenda({ session }: { session: Session }) {
  const { api, queryClient } = useServices()
  const toast = useToast()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const create = async () => {
    setBusy(true)
    try {
      const m = session.meeting
      const v = await api.call('createAgenda', {
        body: m
          ? { eventUid: m.uid, start: m.start, ifExists: 'reuse' }
          : { title: fmt(_('Agenda for {title}'), { title: session.title || _('this meeting') }) },
      })
      await queryClient.invalidateQueries({ queryKey: ['sessionAgenda', session.id] })
      if (!v.agenda.sessionId) void navigate({ to: '/agendas/$agendaId', params: { agendaId: v.agenda.id } })
    } catch (err) {
      toast(fmt(_('Could not create the agenda: {reason}'), { reason: refusal(err) }), { tone: 'error' })
    } finally {
      setBusy(false)
    }
  }
  return (
    <section aria-label={_('Agenda')} className="flex flex-col items-start gap-2 px-1.5">
      <h2 className="m-0 type-headline text-text-primary">{_('Agenda')}</h2>
      <p className="m-0 type-callout text-text-secondary">{_('No agenda for this meeting.')}</p>
      {session.meeting ? (
        <Button size="sm" icon="add" onPress={() => void create()} isDisabled={busy}>
          {_('Add an agenda')}
        </Button>
      ) : null}
    </section>
  )
}
