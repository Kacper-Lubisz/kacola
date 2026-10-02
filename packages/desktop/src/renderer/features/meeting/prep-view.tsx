import type { AgendaView, Session } from '@gnomeola/protocol'
import { displayTitle } from '@gnomeola/ui-core/format'
import { useNow } from '@gnomeola/ui-core/hooks'
import { _, fmt, ngettext } from '@gnomeola/ui-core/i18n'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useServices } from '../../data/services.tsx'
import { Chip, IconButton, TextField, useToast } from '../../design/primitives/index.ts'
import { refusal, useAgendaMutation } from '../agendas/agenda-data.ts'
import { GoalsEditor, ItemsEditor } from '../agendas/agenda-editor.tsx'
import { ContextTab } from '../agendas/context-cards.tsx'
import { addContextMutation, updateAgendaMutation } from '../agendas/mutations.ts'
import { ShareBanner, SharingTab } from '../agendas/share.tsx'
import { useAgendaShare } from '../agendas/share-data.ts'
import { clock, dayLabel, durationLabel } from '../home/day.ts'
import { AskBar } from './ask-bar.tsx'

// Prep, before the meeting: the agenda (goals, items), the context (private unless
// shared on purpose), sharing once the agenda is shared, the earlier meetings of the same name, and Ask
// across past meetings ("what did I promise Ana last time?") whose answer can be kept as a private
// card. No timeboxes asked for, no slot to fill: an item's timebox, if one was set, is quiet metadata.

/** The agenda's title, renamed in place. */
export function AgendaTitle({ view }: { view: AgendaView }) {
  const rename = useAgendaMutation(updateAgendaMutation, _('Could not rename the agenda'))
  const [editing, setEditing] = useState<string | null>(null)
  const commit = () => {
    const t = editing?.trim()
    if (t && t !== view.agenda.title) rename.mutate({ agendaId: view.agenda.id, patch: { title: t } })
    setEditing(null)
  }
  if (editing !== null)
    return (
      <TextField
        label={_('Agenda title')}
        labelHidden
        value={editing}
        onChange={setEditing}
        autoFocus
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') setEditing(null)
        }}
      />
    )
  return (
    <div className="flex items-start gap-1">
      <h1 className="m-0 min-w-0 type-title1 break-words text-text-primary">{view.agenda.title}</h1>
      <IconButton icon="edit" label={_('Rename agenda')} onPress={() => setEditing(view.agenda.title)} />
    </div>
  )
}

/** Earlier meetings of the same name (a 1:1 series, a standup): what happened last time, one press away. */
function EarlierWith({ view }: { view: AgendaView }) {
  const { queries } = useServices()
  const navigate = useNavigate()
  const now = useNow(60_000).getTime()
  const sessions = useQuery({ ...queries.sessions(), enabled: false }).data?.ordered ?? []
  const name = (view.agenda.meeting?.title ?? view.agenda.title).trim().toLowerCase()
  const earlier: Session[] = sessions
    .filter(
      (s) =>
        s.id !== view.agenda.sessionId &&
        s.status !== 'recording' &&
        s.status !== 'paused' &&
        displayTitle(s).trim().toLowerCase() === name,
    )
    .slice(0, 3)
  if (!earlier.length) return null
  return (
    <section aria-labelledby="prep-earlier" className="flex flex-col gap-2">
      <h2 id="prep-earlier" className="m-0 type-headline text-text-primary">
        {_('Earlier meetings')}
      </h2>
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {earlier.map((s) => {
          const at = s.startedAt ?? s.createdAt
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => void navigate({ to: '/sessions/$sessionId', params: { sessionId: s.id } })}
                className="flex w-full cursor-default items-baseline gap-2 rounded-md border border-border-subtle bg-bg-surface px-3 py-2 text-left outline-none hover:border-border-default focus-visible:outline-(length:--focus-ring-width) focus-visible:outline-solid focus-visible:outline-(--focus-ring-color)"
              >
                <span className="type-callout font-semibold text-text-primary">
                  {dayLabel(Date.parse(at), now)}
                </span>
                <span className="font-mono text-[12px] text-text-secondary tabular-nums">{clock(at)}</span>
                <span className="min-w-0 flex-1 truncate type-callout text-text-secondary">
                  {displayTitle(s)}
                </span>
                <span className="type-caption text-text-secondary">{durationLabel(s.durationMs)}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export function PrepView({ view }: { view: AgendaView }) {
  const { api } = useServices()
  const toast = useToast()
  const { data: share } = useAgendaShare(view.agenda.id)
  const keep = useMutation({
    ...addContextMutation(api),
    onError: (err) =>
      toast(fmt(_('Could not keep the answer: {reason}'), { reason: refusal(err) }), { tone: 'error' }),
  })
  const carried = view.items.filter((i) => i.carriedFrom).length
  const sharing = Boolean(share && (share.shared || share.state === 'revoked'))
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto grid w-full max-w-[1160px] gap-8 px-4 py-6 sm:px-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-6">
          <ShareBanner view={view} status={share} />
          <section aria-labelledby="prep-agenda" className="flex flex-col gap-4">
            <h2 id="prep-agenda" className="m-0 type-title2 text-text-primary">
              {_('Agenda')}
            </h2>
            {carried ? (
              <p className="m-0 flex items-center gap-1 type-callout text-text-secondary">
                <Chip icon="carry">
                  {fmt(ngettext('{n} item carried over', '{n} items carried over', carried), { n: carried })}
                </Chip>
                <span>{_('from the last meeting')}</span>
              </p>
            ) : null}
            <GoalsEditor view={view} />
            <ItemsEditor view={view} />
          </section>
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <section aria-labelledby="prep-context" className="flex flex-col gap-2">
            <h2 id="prep-context" className="m-0 type-headline text-text-primary">
              {_('Context')}
            </h2>
            <ContextTab view={view} />
          </section>
          {sharing && share ? (
            <section aria-labelledby="prep-sharing" className="flex flex-col gap-2">
              <h2 id="prep-sharing" className="m-0 type-headline text-text-primary">
                {_('Sharing')}
              </h2>
              <SharingTab view={view} status={share} />
            </section>
          ) : null}
          <EarlierWith view={view} />
          <AskBar
            inline
            askKey={`prep:${view.agenda.id}`}
            sessionId={null}
            label={_('Ask about past meetings')}
            placeholder={_('What did I promise last time?')}
            pinLabel={_('Keep as a private card')}
            onPin={(text) =>
              keep.mutate({
                agendaId: view.agenda.id,
                card: { title: _('From Ask'), body: text, visibility: 'private' },
              })
            }
          />
        </div>
      </div>
    </div>
  )
}
