import type { AgendaItem, AgendaItemKind, AgendaView, ItemVersion, StatusChange } from '@gnomeola/protocol'
import { lastChange } from '@gnomeola/ui-core/agendas'
import { formatClockTime } from '@gnomeola/ui-core/format'
import { _, fmt, ngettext } from '@gnomeola/ui-core/i18n'
import { useQuery } from '@tanstack/react-query'
import { type ReactNode, useMemo, useState } from 'react'
import { useServices } from '../../data/services.tsx'
import {
  Button,
  Chip,
  Dialog,
  Icon,
  IconButton,
  Menu,
  MenuItem,
  MenuSeparator,
  Popover,
  Select,
  type SortableItem,
  SortableList,
  Spinner,
  TextArea,
  TextField,
} from '../../design/primitives/index.ts'
import { useAgendaHistory, useAgendaMutation } from './agenda-data.ts'
import {
  actorFor,
  addedByText,
  attributionIcon,
  isSurprise,
  KINDS,
  kindLabel,
  STATUS_ICON,
  STATUS_TONE,
  STATUSES,
  statusLabel,
} from './labels.ts'
import {
  addItemsMutation,
  deleteItemMutation,
  isTemporary,
  reorderMutation,
  restoreItemMutation,
  setStatusMutation,
  updateAgendaMutation,
  updateItemMutation,
} from './mutations.ts'
import { CommentList, commentsOn } from './share.tsx'
import { useAgendaShare, usePeopleNames } from './share-data.ts'

// The agenda editor: goals, then the items — drag to reorder (or Move up / Move down from an item's
// menu, the keyboard path), a status menu per item, kind / owner / timebox / outcome in an Edit dialog,
// and each item's history in a popover. Every edit is optimistic; the daemon's echo reconciles
// (features/agendas/mutations.ts). An item someone else moved says who ("by kacola", "by your Claude",
// the daemon's actors), only when that is a surprise.

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
  const share = useAgendaShare(agendaId).data
  const names = usePeopleNames(agendaId)
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
        view={view}
        agendaId={agendaId}
        item={item}
        index={i}
        count={items.length}
        change={lastChange(history.data ?? [], item.id)}
        names={names}
        comments={
          <CommentList
            comments={commentsOn(share, item.id)}
            status={share}
            names={names}
            label={fmt(_('Comments on “{item}”'), { item: item.text })}
          />
        }
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

/** Kind, owner, a timebox someone set (quiet), carried over, and who last changed it when that is a surprise. */
export function ItemMeta({
  view,
  item,
  change,
  names,
}: {
  view: AgendaView
  item: AgendaItem
  change: StatusChange | null
  names?: ReadonlyMap<string, string>
}) {
  const by =
    change && change.to === item.status && isSurprise(view, change.by)
      ? fmt(_('by {who}'), { who: actorFor(view, change.by, names).label })
      : null
  const added = addedByText(item.createdBy, names)
  return (
    <div className="flex flex-wrap items-center gap-1">
      {item.kind !== 'topic' ? <Chip>{kindLabel(item.kind)}</Chip> : null}
      {item.owner ? <Chip icon="person">{item.owner === 'me' ? _('me') : item.owner}</Chip> : null}
      {item.timeboxMin ? (
        <span className="type-caption text-text-tertiary">{fmt(_('{n} min'), { n: item.timeboxMin })}</span>
      ) : null}
      {item.carriedFrom ? (
        <Chip icon="carry" label={_('Carried over from the last meeting')}>
          {_('carried over')}
        </Chip>
      ) : null}
      {added ? <Chip icon="person">{added}</Chip> : null}
      {by ? (
        <Chip icon={attributionIcon(change?.by ?? '')} tone="info">
          {by}
        </Chip>
      ) : null}
    </div>
  )
}

function ItemRow({
  view,
  agendaId,
  item,
  index,
  count,
  change,
  names,
  comments,
  onEdit,
  onMove,
}: {
  agendaId: string
  item: AgendaItem
  index: number
  count: number
  view: AgendaView
  change: StatusChange | null
  names: ReadonlyMap<string, string>
  comments: ReactNode
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
        <ItemMeta view={view} item={item} change={change} names={names} />
        {item.outcome ? (
          <p className="m-0 type-callout break-words text-text-secondary">{item.outcome}</p>
        ) : null}
        {comments}
      </div>
      <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100 group-data-[focus-visible]:opacity-100 focus-within:opacity-100">
        <ItemHistory agendaId={agendaId} item={item} />
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

const CHANGE: Record<ItemVersion['kind'], () => string> = {
  added: () => _('Added'),
  edited: () => _('Edited'),
  status: () => _('Status changed'),
  removed: () => _('Removed'),
  imported: () => _('Imported'),
  restored: () => _('Restored'),
}

function versionLine(v: ItemVersion): string {
  if (v.kind === 'status' && v.status)
    return fmt(_('{from} → {to} by {who}'), {
      from: statusLabel(v.status.from),
      to: statusLabel(v.status.to),
      who: v.actor.label,
    })
  return fmt(_('{what} by {who}'), { what: CHANGE[v.kind](), who: v.actor.label })
}

function HistoryList({ agendaId, item }: { agendaId: string; item: AgendaItem }) {
  const { queries } = useServices()
  const versions = useQuery(queries.itemHistory(agendaId, item.id))
  const restore = useAgendaMutation(restoreItemMutation, _('Could not restore the item'))
  const list = [...(versions.data ?? [])].reverse()
  if (versions.isPending) return <Spinner label={_('Loading…')} size={18} />
  if (versions.isError)
    return <p className="m-0 type-callout text-status-danger-text">{versions.error.message}</p>
  if (list.length === 0) return <p className="m-0 type-callout text-text-secondary">{_('No changes yet.')}</p>
  return (
    <ol aria-label={_('Versions')} className="m-0 flex list-none flex-col gap-2 p-0">
      {list.map((v, i) => (
        <li key={v.seq} className="flex flex-col gap-0.5">
          <span className="type-callout text-text-primary">{versionLine(v)}</span>
          <span className="flex items-center gap-2">
            <span className="font-mono text-[13px] text-text-tertiary tabular-nums">
              {formatClockTime(v.at)}
            </span>
            {i > 0 && v.restorable ? (
              <Button
                size="sm"
                variant="link"
                isDisabled={restore.isPending}
                onPress={() => restore.mutate({ agendaId, itemId: item.id, seq: v.seq })}
                aria-label={fmt(_('Restore “{item}” to this version'), { item: v.item?.text ?? item.text })}
              >
                {_('Restore')}
              </Button>
            ) : null}
          </span>
          {v.status?.note ? <span className="type-caption text-text-secondary">{v.status.note}</span> : null}
          {(v.status?.evidence ?? []).map((ev) => (
            <q key={`${ev.segmentId}:${ev.quote}`} className="type-caption text-text-secondary italic">
              {ev.quote}
            </q>
          ))}
        </li>
      ))}
    </ol>
  )
}

/** An item's history: every version (who, what, when), and Restore for the ones that can come back. */
export function ItemHistory({ agendaId, item }: { agendaId: string; item: AgendaItem }) {
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
      <HistoryList agendaId={agendaId} item={item} />
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
  const [outcome, setOutcome] = useState(item.outcome ?? '')
  const save = () => {
    update.mutate({
      agendaId,
      itemId: item.id,
      patch: {
        text: text.trim() || item.text,
        kind,
        owner: owner.trim() || null,
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
