import type {
  AgendaItem,
  AgendaView,
  ChangeOutcome,
  SharedActor,
  SharedChange,
  SharedComment,
  ShareStatus,
  ShareSyncState,
} from '@gnomeola/protocol'
import { personName } from '@gnomeola/ui-core/agendas'
import { formatClockTime } from '@gnomeola/ui-core/format'
import { _, fmt, ngettext } from '@gnomeola/ui-core/i18n'
import { useState } from 'react'
import { useServices } from '../../data/services.tsx'
import {
  AlertDialog,
  Banner,
  Button,
  Chip,
  type ChipTone,
  Dialog,
  Icon,
  type IconName,
  Switch,
  TextArea,
  TextField,
  useToast,
} from '../../design/primitives/index.ts'
import { refusal, useAgendaMutation } from './agenda-data.ts'
import { displayAgent, statusLabel } from './labels.ts'
import {
  shareAgendaMutation,
  shareRecapMutation,
  syncShareMutation,
  unshareAgendaMutation,
  usePeopleNames,
  useShareHistory,
} from './share-data.ts'

// Team sharing in the agenda editor (docs/sharing.md): the Share button and dialog (owner name, goals,
// invitees, attendees who follow it in their own kacola; the link with Copy; the sync state and its
// error; Unshare, confirmed), the page's banner when sharing broke or the owner stopped sharing, the
// Sharing tab (invitees' and attendees' comments, the people on the share, the merge history — every
// change from every device with who made it, what became of it and why), and the recap's "Share recap"
// switch. A follower's copy (role member) shows the same, read from the owner's side.

export function stateLabel(s: ShareSyncState): string {
  switch (s) {
    case 'off':
      return _('Not shared')
    case 'ok':
      return _('Up to date')
    case 'syncing':
      return _('Syncing…')
    case 'error':
      return _('Sync failed')
    case 'revoked':
      return _('No longer shared')
  }
}

const STATE_TONE: Record<ShareSyncState, ChipTone> = {
  off: 'neutral',
  ok: 'success',
  syncing: 'info',
  error: 'danger',
  revoked: 'warning',
}
const STATE_ICON: Record<ShareSyncState, IconName> = {
  off: 'link',
  ok: 'success',
  syncing: 'refresh',
  error: 'alert',
  revoked: 'refused',
}

export function outcomeLabel(o: ChangeOutcome): string {
  switch (o) {
    case 'applied':
      return _('Applied')
    case 'agreed':
      return _('Agreed')
    case 'refused':
      return _('Refused')
    case 'superseded':
      return _('Superseded')
  }
}
const OUTCOME_TONE: Record<ChangeOutcome, ChipTone> = {
  applied: 'success',
  agreed: 'info',
  refused: 'danger',
  superseded: 'warning',
}

/** Who did something on the share: "you", "Ben", "Ben’s tracker", "Ivy (invitee)". */
export function actorLabel(a: SharedActor, s: ShareStatus | undefined, names?: ReadonlyMap<string, string>) {
  const mine = a.role === 'owner' && s?.role === 'owner'
  const who = mine
    ? _('you')
    : a.role === 'owner'
      ? (s?.ownerName ?? a.name ?? personName(a.label, names))
      : (a.name ?? personName(a.label, names))
  if (a.by === 'tracker') return mine ? _('your tracker') : fmt(_('{name}’s tracker'), { name: who })
  if (a.by.startsWith('agent:')) {
    const agent = displayAgent(a.by.slice('agent:'.length))
    return mine ? fmt(_('your {agent}'), { agent }) : fmt(_('{name}’s {agent}'), { name: who, agent })
  }
  return who
}

/** "Up to date · synced 10:42", "Sync failed", with the pending count. */
function StateChip({ status }: { status: ShareStatus }) {
  return (
    <Chip icon={STATE_ICON[status.state]} tone={STATE_TONE[status.state]}>
      {stateLabel(status.state)}
    </Chip>
  )
}

const parseEmails = (text: string): string[] => [
  ...new Set(
    text
      .split(/[\s,;]+/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  ),
]
const looksLikeEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)

// ---------------------------------------------------------------------------------- the button

export function ShareButton({ view, status }: { view: AgendaView; status: ShareStatus | undefined }) {
  const [open, setOpen] = useState(false)
  const shared = Boolean(status?.shared)
  const member = status?.role === 'member'
  const label = member ? _('Following') : shared ? _('Shared') : _('Share…')
  return (
    <>
      <Button
        icon={member ? 'speakers' : 'send'}
        onPress={() => setOpen(true)}
        isDisabled={!status || view.agenda.private}
        aria-label={
          shared || member
            ? fmt(_('{label}: {state}'), { label, state: stateLabel(status!.state) })
            : _('Share…')
        }
      >
        {label}
      </Button>
      {open && status ? <ShareDialog view={view} status={status} onClose={() => setOpen(false)} /> : null}
    </>
  )
}

// ---------------------------------------------------------------------------------- the dialog

function ShareDialog({
  view,
  status,
  onClose,
}: {
  view: AgendaView
  status: ShareStatus
  onClose: () => void
}) {
  const { bridge } = useServices()
  const toast = useToast()
  const agendaId = view.agenda.id
  const share = useAgendaMutation(shareAgendaMutation, _('Could not share the agenda'))
  const sync = useAgendaMutation(syncShareMutation, _('Could not sync'))
  const unshare = useAgendaMutation(unshareAgendaMutation, _('Could not stop sharing'))
  const [ownerName, setOwnerName] = useState(status.ownerName ?? '')
  const [shareGoals, setShareGoals] = useState(status.shareGoals)
  const [allowInvitees, setAllowInvitees] = useState(status.shared ? status.allowInvitees : true)
  const [members, setMembers] = useState(status.members.join('\n'))
  const [error, setError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState(false)
  const member = status.role === 'member'
  const shared = status.shared && !member
  const noHost = !status.shared && !member && !status.host
  const emails = parseEmails(members)
  const bad = emails.filter((e) => !looksLikeEmail(e))
  const submit = () => {
    setError(null)
    share.mutate(
      {
        agendaId,
        options: {
          ...(ownerName.trim() ? { ownerName: ownerName.trim() } : {}),
          shareGoals,
          allowInvitees,
          members: emails,
        },
      },
      {
        onSuccess: () => {
          if (!shared) toast(_('The agenda is shared'))
        },
        onError: (err) => setError(refusal(err)),
      },
    )
  }
  const copy = () => {
    if (!status.link) return
    void bridge.copyText(status.link).then(() => toast(_('Copied the link')))
  }
  const title = member ? _('Shared Agenda') : _('Share Agenda')
  return (
    <Dialog
      title={title}
      isOpen
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
      footer={
        member ? (
          <>
            <Button variant="destructive" onPress={() => setConfirm(true)} className="mr-auto">
              {status.state === 'revoked' ? _('Remove Sharing Details') : _('Stop Following…')}
            </Button>
            {status.state !== 'revoked' ? (
              <Button icon="refresh" onPress={() => sync.mutate({ agendaId })}>
                {_('Sync Now')}
              </Button>
            ) : null}
            <Button variant="primary" onPress={onClose}>
              {_('Done')}
            </Button>
          </>
        ) : shared ? (
          <>
            <Button variant="destructive" onPress={() => setConfirm(true)} className="mr-auto">
              {_('Unshare…')}
            </Button>
            <Button icon="refresh" onPress={() => sync.mutate({ agendaId })}>
              {_('Sync Now')}
            </Button>
            <Button variant="primary" onPress={submit} isDisabled={bad.length > 0 || share.isPending}>
              {_('Save')}
            </Button>
          </>
        ) : (
          <>
            <Button onPress={onClose}>{_('Cancel')}</Button>
            <Button
              variant="primary"
              icon="send"
              onPress={submit}
              isDisabled={bad.length > 0 || share.isPending || noHost}
            >
              {_('Share')}
            </Button>
          </>
        )
      }
    >
      <div className="flex flex-col gap-4">
        {status.shared || member ? (
          <section aria-label={_('Link')} className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <StateChip status={status} />
              {status.lastSyncAt ? (
                <span className="type-caption text-text-secondary" data-share-time>
                  {fmt(_('synced {time}'), { time: formatClockTime(status.lastSyncAt) })}
                </span>
              ) : null}
              {status.pending ? (
                <span className="type-caption text-text-secondary">
                  {fmt(ngettext('{n} change waiting', '{n} changes waiting', status.pending), {
                    n: status.pending,
                  })}
                </span>
              ) : null}
            </div>
            {status.error ? <Banner tone="danger" title={status.error} /> : null}
            {status.link ? (
              <div className="flex items-center gap-2">
                <TextField
                  label={_('Web link')}
                  labelHidden
                  isReadOnly
                  value={status.link}
                  className="min-w-0 flex-1"
                  inputClassName="font-mono text-[13px]"
                />
                <Button icon="copy" onPress={copy}>
                  {_('Copy Link')}
                </Button>
              </div>
            ) : null}
            {member ? (
              <p className="m-0 type-callout text-text-secondary">
                {fmt(
                  _(
                    '{owner} shares this agenda with you. Your status changes and the items you add go to everyone following it.',
                  ),
                  { owner: status.ownerName ?? _('The organizer') },
                )}
              </p>
            ) : null}
          </section>
        ) : (
          <p className="m-0 type-callout text-text-secondary">
            {_(
              'Anyone with the link can read the items and the context cards you marked shared. Transcripts, notes, evidence and private cards never leave this computer.',
            )}
          </p>
        )}
        {member ? null : (
          <>
            <TextField
              label={_('Your name')}
              description={_('How you appear to the people you share with.')}
              placeholder={_('Organizer')}
              value={ownerName}
              onChange={setOwnerName}
            />
            <Switch isSelected={allowInvitees} onChange={setAllowInvitees} className="w-full justify-between">
              <span className="flex flex-col">
                <span className="type-body">{_('Invitees may add items and comment')}</span>
                <span className="type-caption text-text-secondary">
                  {_('After confirming their email address.')}
                </span>
              </span>
            </Switch>
            <Switch isSelected={shareGoals} onChange={setShareGoals} className="w-full justify-between">
              <span className="flex flex-col">
                <span className="type-body">{_('Share the goals too')}</span>
                <span className="type-caption text-text-secondary">{_('Goals are often personal.')}</span>
              </span>
            </Switch>
            <TextArea
              label={_('Attendees who use kacola')}
              description={_(
                'Email addresses, one per line. They can follow this agenda in their own kacola and check items off.',
              )}
              value={members}
              onChange={setMembers}
              rows={3}
            />
            {bad.length ? (
              <p role="alert" className="m-0 -mt-2 type-caption text-status-danger-text">
                {fmt(_('Not an email address: {list}'), { list: bad.join(', ') })}
              </p>
            ) : null}
          </>
        )}
        {noHost ? (
          <Banner
            tone="warning"
            title={_(
              'Sharing needs a hosted kacola server. Pair with one (gnomeola pair --url …), or set GNOMEOLA_SHARE_URL and GNOMEOLA_SHARE_TOKEN.',
            )}
          />
        ) : null}
        {error ? <Banner tone="danger" title={error} /> : null}
      </div>
      <AlertDialog
        isOpen={confirm}
        onOpenChange={setConfirm}
        title={member ? _('Stop following this agenda?') : _('Stop sharing this agenda?')}
        confirmLabel={member ? _('Stop Following') : _('Unshare')}
        destructive
        onConfirm={() => {
          unshare.mutate(
            { agendaId },
            {
              onSuccess: () => {
                toast(member ? _('Stopped following the agenda') : _('The agenda is no longer shared'))
                onClose()
              },
            },
          )
        }}
      >
        {member
          ? _('Your copy stays on this computer; it stops receiving changes.')
          : _(
              'The link stops working, and everything on the server goes: the items people added, their comments and the merge history. Your agenda stays as it is.',
            )}
      </AlertDialog>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------------- the banner

/** On the agenda page: sharing broke (with Sync Now), or the owner stopped sharing a followed agenda. */
export function ShareBanner({ view, status }: { view: AgendaView; status: ShareStatus | undefined }) {
  const sync = useAgendaMutation(syncShareMutation, _('Could not sync'))
  if (!status) return null
  if (status.state === 'revoked')
    return (
      <Banner
        tone="warning"
        title={fmt(_('{owner} stopped sharing this agenda. Your copy stays on this computer.'), {
          owner: status.ownerName ?? _('The organizer'),
        })}
      />
    )
  if (status.state === 'error' && status.shared)
    return (
      <Banner
        tone="danger"
        title={fmt(_('Sharing could not sync: {reason}'), { reason: status.error ?? _('unknown error') })}
        action={
          <Button size="sm" icon="refresh" onPress={() => sync.mutate({ agendaId: view.agenda.id })}>
            {_('Try Again')}
          </Button>
        }
      />
    )
  return null
}

// ---------------------------------------------------------------------------------- comments

/** People's comments on one item (or, with `itemId` null, on the agenda), oldest first. */
export function commentsOn(status: ShareStatus | undefined, itemId: string | null): SharedComment[] {
  return (status?.comments ?? []).filter((c) => !c.hidden && c.itemId === itemId)
}

export function CommentList({
  comments,
  status,
  label,
  names,
}: {
  comments: SharedComment[]
  status: ShareStatus | undefined
  label: string
  names: ReadonlyMap<string, string>
}) {
  if (!comments.length) return null
  return (
    <ul aria-label={label} className="m-0 flex list-none flex-col gap-1 p-0">
      {comments.map((c) => (
        <li key={c.id} className="flex items-start gap-1.5 type-callout text-text-primary">
          <Icon name="ask" size={16} className="mt-0.5 shrink-0 text-text-secondary" />
          <span className="min-w-0 break-words">
            <strong className="font-semibold">{actorLabel(c.author, status, names)}</strong>
            {c.author.role === 'invitee' ? (
              <span className="text-text-secondary"> ({_('invitee')})</span>
            ) : null}
            : {c.text}
          </span>
        </li>
      ))}
    </ul>
  )
}

// ---------------------------------------------------------------------------------- the tab

function HistoryList({
  changes,
  items,
  status,
  names,
}: {
  changes: SharedChange[]
  items: AgendaItem[]
  status: ShareStatus
  names: ReadonlyMap<string, string>
}) {
  const textOf = (id: string) => items.find((i) => i.id === id)?.text ?? _('A removed item')
  if (!changes.length)
    return <p className="m-0 type-callout text-text-secondary">{_('No status changes yet.')}</p>
  return (
    <ol aria-label={_('Merge history')} className="m-0 flex list-none flex-col gap-2 p-0">
      {[...changes].reverse().map((c) => (
        <li
          key={c.id}
          aria-label={fmt(_('{item}: {from} → {to} by {who}, {outcome}'), {
            item: textOf(c.itemId),
            from: statusLabel(c.from),
            to: statusLabel(c.to),
            who: actorLabel(c.actor, status, names),
            outcome: outcomeLabel(c.outcome),
          })}
          className="flex flex-col gap-1 rounded-md border border-border-subtle bg-bg-surface px-3 py-2"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="min-w-0 flex-1 type-body break-words text-text-primary">{textOf(c.itemId)}</span>
            <Chip tone={OUTCOME_TONE[c.outcome]}>{outcomeLabel(c.outcome)}</Chip>
          </div>
          <span className="type-callout text-text-secondary">
            {fmt(_('{from} → {to} by {who}'), {
              from: statusLabel(c.from),
              to: statusLabel(c.to),
              who: actorLabel(c.actor, status, names),
            })}
            {c.auto ? ` · ${_('auto')}` : ''}
          </span>
          {c.reason ? <span className="type-caption text-text-secondary">{c.reason}</span> : null}
          <span className="self-start font-mono text-[13px] text-text-tertiary tabular-nums" data-share-time>
            {formatClockTime(c.at)}
          </span>
        </li>
      ))}
    </ol>
  )
}

export function SharingTab({ view, status }: { view: AgendaView; status: ShareStatus }) {
  const names = usePeopleNames(view.agenda.id)
  const history = useShareHistory(view.agenda.id, status.shared)
  const comments = (status.comments ?? []).filter((c) => !c.hidden)
  const textOf = (id: string | null) => (id ? (view.items.find((i) => i.id === id)?.text ?? null) : null)
  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="share-comments" className="flex flex-col gap-2">
        <h2 id="share-comments" className="m-0 type-overline text-text-secondary">
          {_('Comments')}
        </h2>
        {comments.length ? (
          <ul aria-label={_('Comments')} className="m-0 flex list-none flex-col gap-2 p-0">
            {comments.map((c) => (
              <li
                key={c.id}
                className="flex flex-col gap-0.5 rounded-md border border-border-subtle bg-bg-surface px-3 py-2"
              >
                <span className="type-caption text-text-secondary">
                  {fmt(_('{who} on “{about}”'), {
                    who: actorLabel(c.author, status, names),
                    about: textOf(c.itemId) ?? _('the agenda'),
                  })}
                  {c.author.role === 'invitee' ? ` · ${_('invitee')}` : ''}
                </span>
                <span className="type-body break-words text-text-primary">{c.text}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="m-0 type-callout text-text-secondary">
            {_('No comments yet. Invitees comment from the web link.')}
          </p>
        )}
      </section>
      {status.role === 'owner' ? (
        <section aria-labelledby="share-people" className="flex flex-col gap-2">
          <h2 id="share-people" className="m-0 type-overline text-text-secondary">
            {_('People')}
          </h2>
          {status.participants.length ? (
            <ul aria-label={_('People')} className="m-0 flex list-none flex-col gap-1 p-0">
              {status.participants.map((p) => (
                <li key={p.id} className="flex items-center gap-2 rounded-md bg-bg-surface px-3 py-1.5">
                  <Icon name="person" size={16} className="shrink-0 text-text-secondary" />
                  <span className="min-w-0 flex-1 truncate type-callout text-text-primary">
                    {p.name ? `${p.name} · ${p.email}` : p.email}
                  </span>
                  <Chip tone={p.role === 'member' ? 'info' : 'neutral'}>
                    {p.revokedAt ? _('Removed') : p.role === 'member' ? _('Follows in kacola') : _('Invitee')}
                  </Chip>
                </li>
              ))}
            </ul>
          ) : (
            <p className="m-0 type-callout text-text-secondary">
              {_('Nobody has confirmed an email address on the link yet.')}
            </p>
          )}
        </section>
      ) : null}
      <section aria-labelledby="share-history" className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <h2 id="share-history" className="m-0 type-overline text-text-secondary">
            {_('Merge history')}
          </h2>
          {status.refused ? (
            <span className="type-caption text-text-secondary">
              {fmt(
                ngettext(
                  '{n} change was refused or superseded',
                  '{n} changes were refused or superseded',
                  status.refused,
                ),
                { n: status.refused },
              )}
            </span>
          ) : null}
        </div>
        <p className="m-0 type-callout text-text-secondary">
          {_(
            'Every status change from every device, and what became of it: the organizer’s own changes win, then each attendee’s, then trackers and agents (forward only).',
          )}
        </p>
        {!status.shared ? (
          <p className="m-0 type-callout text-text-secondary">{_('The history went with the share.')}</p>
        ) : history.data ? (
          <HistoryList changes={history.data} items={view.items} status={status} names={names} />
        ) : null}
      </section>
    </div>
  )
}

// ---------------------------------------------------------------------------------- the recap

/** Owner, shared agenda: let attendees and invitees see this occurrence's outcomes. */
export function ShareRecapSwitch({ view, status }: { view: AgendaView; status: ShareStatus | undefined }) {
  const set = useAgendaMutation(shareRecapMutation, _('Could not change the recap’s sharing'))
  if (!status?.shared || status.role !== 'owner') return null
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-border-subtle bg-bg-surface px-3 py-2">
      <Switch
        className="w-full justify-between"
        isSelected={status.recapShared}
        onChange={(shared) => set.mutate({ agendaId: view.agenda.id, shared })}
      >
        <span className="flex flex-col">
          <span className="type-body">{_('Share recap')}</span>
          <span className="type-caption text-text-secondary">
            {status.recapShared
              ? _('People with the link see each item’s outcome.')
              : _('Outcomes stay on this computer until you share them.')}
          </span>
        </span>
      </Switch>
    </div>
  )
}
