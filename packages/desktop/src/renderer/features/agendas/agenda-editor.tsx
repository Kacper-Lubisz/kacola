import type { AgendaItem, AgendaItemKind, AgendaView, StatusChange } from '@gnomeola/protocol'
import { MAX_TIMEBOX_MIN } from '@gnomeola/protocol'
import { itemHistory, lastChange } from '@gnomeola/ui-core/agendas'
import { formatClockTime } from '@gnomeola/ui-core/format'
import { _, fmt, ngettext } from '@gnomeola/ui-core/i18n'
import { useMemo, useState } from 'react'
import {
  Button,
  Chip,
  Dialog,
  Icon,
  IconButton,
  Menu,
  MenuItem,
  MenuSeparator,
  NumberField,
  Popover,
  Select,
  type SortableItem,
  SortableList,
  TextArea,
  TextField,
} from '../../design/primitives/index.ts'
import { useAgendaHistory, useAgendaMutation } from './agenda-data.ts'
import {
  attributionText,
  KINDS,
  kindLabel,
  STATUS_ICON,
  STATUS_TONE,
  STATUSES,
  statusLabel,
  whoLabel,
} from './labels.ts'
import {
  addItemsMutation,
  deleteItemMutation,
  isTemporary,
  reorderMutation,
  setStatusMutation,
  updateAgendaMutation,
  updateItemMutation,
} from './mutations.ts'

// The agenda editor: goals, then the items — drag to reorder (or Move up / Move down from an item's
// menu, the keyboard path), a status menu per item, kind / owner / timebox / outcome in an Edit dialog,
// and each item's history in a popover. Every edit is optimistic; the daemon's echo reconciles
// (features/agendas/mutations.ts). Items another changer touched carry the attribution ("auto",
// "checked by Claude").

const kindOptions = () => KINDS.map((k) => ({ value: k, label: kindLabel(k) }))

export function GoalsEditor({ view }: { view: AgendaView }) {
  const update = useAgendaMutation(updateAgendaMutation, _('Could not change the goals'))
  const [draft, setDraft] = useState('')
  const goals = view.agenda.goals
  const set = (next: string[]) => update.mutate({ agendaId: view.agenda.id, patch: { goals: next } })
  const add = () => {
    const g = draft.trim()
    if (!g) return
    if (!goals.includes(g)) set([...goals, g])
    setDraft('')
  }
  return (
    <section aria-labelledby="agenda-goals" className="flex flex-col gap-2">
      <h2 id="agenda-goals" className="m-0 type-overline text-text-secondary">
        {_('Goals')}
      </h2>
      {goals.length ? (
        <ul aria-label={_('Goals')} className="m-0 flex list-none flex-col gap-1 p-0">
          {goals.map((g, i) => (
            <li key={g} className="flex items-center gap-2 rounded-md bg-bg-surface px-2 py-1">
              <Icon name="goal" size={16} className="shrink-0 text-text-secondary" />
              <span className="min-w-0 flex-1 type-body break-words text-text-primary">{g}</span>
              <IconButton
                icon="close"
                size="sm"
                label={fmt(_('Remove goal “{goal}”'), { goal: g })}
                tooltip={_('Remove goal')}
                onPress={() => set(goals.filter((_g, j) => j !== i))}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-0 type-callout text-text-secondary">
          {_('What should this meeting achieve? Goals help Claude plan the items.')}
        </p>
      )}
      <div className="flex items-end gap-2">
        <TextField
          label={_('Add a goal')}
          labelHidden
          placeholder={_('Add a goal…')}
          value={draft}
          onChange={setDraft}
          onKeyDown={(e) => {
            if (e.key === 'Enter') add()
          }}
          className="flex-1"
        />
        <Button onPress={add} isDisabled={!draft.trim()} icon="add">
          {_('Add Goal')}
        </Button>
      </div>
    </section>
  )
}

export function ItemsEditor({ view, readOnly = false }: { view: AgendaView; readOnly?: boolean }) {
  const agendaId = view.agenda.id
  const reorder = useAgendaMutation(reorderMutation, _('Could not reorder the items'))
  const add = useAgendaMutation(addItemsMutation, _('Could not add the item'))
  const [text, setText] = useState('')
  const [kind, setKind] = useState<AgendaItemKind>('topic')
  const [editing, setEditing] = useState<AgendaItem | null>(null)
  const history = useAgendaHistory(agendaId)
  const items = useMemo(() => [...view.items].sort((a, b) => a.order - b.order), [view.items])
  const move = (from: number, to: number) => {
    const ids = items.map((i) => i.id)
    const [id] = ids.splice(from, 1)
    ids.splice(to, 0, id!)
    reorder.mutate({ agendaId, itemIds: ids })
  }
  const submit = () => {
    const t = text.trim()
    if (!t) return
    add.mutate({ agendaId, items: [{ text: t, kind }] })
    setText('')
  }
  const rows: SortableItem[] = items.map((item, i) => ({
    id: item.id,
    textValue: item.text,
    content: (
      <ItemRow
        agendaId={agendaId}
        item={item}
        index={i}
        count={items.length}
        change={lastChange(history.data ?? [], item.id)}
        history={history.data ?? []}
        onEdit={() => setEditing(item)}
        onMove={move}
      />
    ),
  }))
  return (
    <section aria-labelledby="agenda-items" className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="agenda-items" className="m-0 type-overline text-text-secondary">
          {_('Items')}
        </h2>
        <span className="type-caption text-text-secondary">
          {fmt(ngettext('{n} item', '{n} items', items.length), { n: items.length })}
        </span>
      </div>
      <SortableList
        label={_('Agenda items')}
        dragLabel={_('Drag to reorder')}
        items={rows}
        onReorder={(ids) => reorder.mutate({ agendaId, itemIds: ids })}
        empty={
          <p className="m-0 px-2 py-3 type-callout text-text-secondary">
            {_('No items yet. Add one below, or plan them with Claude.')}
          </p>
        }
      />
      {readOnly ? null : (
        <div className="flex flex-wrap items-end gap-2">
          <TextField
            label={_('New item')}
            labelHidden
            placeholder={_('Add an item…')}
            value={text}
            onChange={setText}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit()
            }}
            className="min-w-[200px] flex-1"
          />
          <Select label={_('Kind')} labelHidden options={kindOptions()} value={kind} onChange={setKind} />
          <Button variant="primary" icon="add" onPress={submit} isDisabled={!text.trim()}>
            {_('Add Item')}
          </Button>
        </div>
      )}
      {editing ? (
        <EditItemDialog
          agendaId={agendaId}
          item={view.items.find((i) => i.id === editing.id) ?? editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </section>
  )
}

/** "10 min", "@ana", kind, carried over, and who last changed it. */
export function ItemMeta({ item, change }: { item: AgendaItem; change: StatusChange | null }) {
  const by = change && change.to === item.status ? attributionText(change) : null
  return (
    <div className="flex flex-wrap items-center gap-1">
      {item.kind !== 'topic' ? <Chip>{kindLabel(item.kind)}</Chip> : null}
      {item.owner ? <Chip icon="person">{item.owner === 'me' ? _('me') : item.owner}</Chip> : null}
      {item.timeboxMin ? <Chip icon="clock">{fmt(_('{n} min'), { n: item.timeboxMin })}</Chip> : null}
      {item.carriedFrom ? (
        <Chip icon="carry" label={_('Carried over from the last meeting')}>
          {_('carried over')}
        </Chip>
      ) : null}
      {by ? (
        <Chip icon={change?.by.startsWith('agent:') ? 'agent' : 'enhance'} tone="info">
          {by}
        </Chip>
      ) : null}
    </div>
  )
}

function ItemRow({
  agendaId,
  item,
  index,
  count,
  change,
  history,
  onEdit,
  onMove,
}: {
  agendaId: string
  item: AgendaItem
  index: number
  count: number
  change: StatusChange | null
  history: StatusChange[]
  onEdit: () => void
  onMove: (from: number, to: number) => void
}) {
  const remove = useAgendaMutation(deleteItemMutation, _('Could not remove the item'))
  const pending = isTemporary(item.id)
  return (
    <div className="flex min-w-0 items-start gap-2">
      <StatusMenu agendaId={agendaId} item={item} isDisabled={pending} />
      <div className="flex min-w-0 flex-1 flex-col gap-1 pt-1">
        <span
          className={`type-body break-words ${item.status === 'skipped' ? 'text-text-secondary line-through' : 'text-text-primary'}`}
        >
          {item.text}
        </span>
        <ItemMeta item={item} change={change} />
        {item.outcome ? (
          <p className="m-0 type-callout break-words text-text-secondary">{item.outcome}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center">
        <ItemHistory item={item} history={history} />
        <IconButton
          icon="edit"
          size="sm"
          label={fmt(_('Edit “{item}”'), { item: item.text })}
          tooltip={_('Edit')}
          onPress={onEdit}
          isDisabled={pending}
        />
        <Menu
          label={fmt(_('More for “{item}”'), { item: item.text })}
          trigger={
            <IconButton
              icon="more"
              size="sm"
              label={fmt(_('More for “{item}”'), { item: item.text })}
              tooltip={_('More')}
              isDisabled={pending}
            />
          }
        >
          <MenuItem icon="arrowUp" isDisabled={index === 0} onAction={() => onMove(index, index - 1)}>
            {_('Move Up')}
          </MenuItem>
          <MenuItem
            icon="arrowDown"
            isDisabled={index === count - 1}
            onAction={() => onMove(index, index + 1)}
          >
            {_('Move Down')}
          </MenuItem>
          <MenuSeparator />
          <MenuItem icon="delete" destructive onAction={() => remove.mutate({ agendaId, itemId: item.id })}>
            {_('Remove')}
          </MenuItem>
        </Menu>
      </div>
    </div>
  )
}

/** The status mark, and a menu to change it (the user may move an item anywhere). */
export function StatusMenu({
  agendaId,
  item,
  isDisabled,
}: {
  agendaId: string
  item: AgendaItem
  isDisabled?: boolean
}) {
  const set = useAgendaMutation(setStatusMutation, _('Could not change the status'))
  const label = fmt(_('Status of “{item}”: {status}'), { item: item.text, status: statusLabel(item.status) })
  return (
    <Menu
      label={fmt(_('Set the status of “{item}”'), { item: item.text })}
      placement="bottom start"
      trigger={
        <IconButton
          icon={STATUS_ICON[item.status]}
          label={label}
          tooltip={statusLabel(item.status)}
          isDisabled={isDisabled}
          className={STATUS_CLASS[STATUS_TONE[item.status]]}
        />
      }
    >
      {STATUSES.map((s) => (
        <MenuItem
          key={s}
          icon={STATUS_ICON[s]}
          isDisabled={s === item.status}
          onAction={() => set.mutate({ agendaId, itemId: item.id, status: s })}
        >
          {statusLabel(s)}
        </MenuItem>
      ))}
    </Menu>
  )
}

const STATUS_CLASS: Record<string, string> = {
  // `!`: over the icon button's own text colour
  neutral: 'text-text-secondary!',
  info: 'text-status-info-text!',
  success: 'text-status-success-text!',
  warning: 'text-status-warning-text!',
}

/** An item's status history: who moved it where, when, and why. */
export function ItemHistory({ item, history }: { item: AgendaItem; history: readonly StatusChange[] }) {
  const mine = itemHistory(history, item.id)
  return (
    <Popover
      label={fmt(_('History of “{item}”'), { item: item.text })}
      className="w-[320px]"
      trigger={
        <IconButton
          icon="history"
          size="sm"
          label={fmt(_('History of “{item}”'), { item: item.text })}
          tooltip={_('History')}
        />
      }
    >
      <h3 className="m-0 mb-2 type-headline text-text-primary">{_('History')}</h3>
      {mine.length === 0 ? (
        <p className="m-0 type-callout text-text-secondary">{_('No status changes yet.')}</p>
      ) : (
        <ol aria-label={_('Status changes')} className="m-0 flex list-none flex-col gap-2 p-0">
          {mine.map((c) => (
            <li key={`${c.at}:${c.to}:${c.by}`} className="flex flex-col gap-0.5">
              <span className="type-callout text-text-primary">
                {fmt(_('{from} → {to} by {who}'), {
                  from: statusLabel(c.from),
                  to: statusLabel(c.to),
                  who: whoLabel(c.by),
                })}
                {c.auto ? ` · ${_('auto')}` : ''}
                {c.override ? ` · ${_('override')}` : ''}
              </span>
              <span className="font-mono text-[13px] text-text-tertiary tabular-nums">
                {formatClockTime(c.at)}
              </span>
              {c.note ? <span className="type-caption text-text-secondary">{c.note}</span> : null}
              {c.evidence.map((ev) => (
                <q key={`${ev.segmentId}:${ev.quote}`} className="type-caption text-text-secondary italic">
                  {ev.quote}
                </q>
              ))}
            </li>
          ))}
        </ol>
      )}
    </Popover>
  )
}

function EditItemDialog({
  agendaId,
  item,
  onClose,
}: {
  agendaId: string
  item: AgendaItem
  onClose: () => void
}) {
  const update = useAgendaMutation(updateItemMutation, _('Could not save the item'))
  const [text, setText] = useState(item.text)
  const [kind, setKind] = useState<AgendaItemKind>(item.kind)
  const [owner, setOwner] = useState(item.owner ?? '')
  const [timebox, setTimebox] = useState(item.timeboxMin ?? 0)
  const [outcome, setOutcome] = useState(item.outcome ?? '')
  const save = () => {
    update.mutate({
      agendaId,
      itemId: item.id,
      patch: {
        text: text.trim() || item.text,
        kind,
        owner: owner.trim() || null,
        timeboxMin: timebox > 0 ? Math.min(timebox, MAX_TIMEBOX_MIN) : null,
        outcome: outcome.trim() || null,
      },
    })
    onClose()
  }
  return (
    <Dialog
      title={_('Edit Item')}
      isOpen
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
      footer={
        <>
          <Button onPress={onClose}>{_('Cancel')}</Button>
          <Button variant="primary" onPress={save} isDisabled={!text.trim()}>
            {_('Save')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <TextField label={_('Item')} value={text} onChange={setText} autoFocus />
        <div className="flex flex-wrap gap-3">
          <Select label={_('Kind')} options={kindOptions()} value={kind} onChange={setKind} />
          <TextField
            label={_('Owner')}
            description={_('me, them, or a name')}
            value={owner}
            onChange={setOwner}
            className="min-w-[160px] flex-1"
          />
          <NumberField
            label={_('Timebox (minutes)')}
            description={_('0 for none')}
            value={timebox}
            onChange={(v) => setTimebox(Number.isFinite(v) ? v : 0)}
            minValue={0}
            maxValue={MAX_TIMEBOX_MIN}
          />
        </div>
        <TextArea
          label={item.kind === 'info-to-get' ? _('Answer heard') : _('Outcome')}
          value={outcome}
          onChange={setOutcome}
          rows={3}
        />
      </div>
    </Dialog>
  )
}
