import type { AgendaItem, AgendaView, Session, StatusChange, Suggestion } from '@gnomeola/protocol'
import {
  activeSuggestions,
  interviewSplit,
  isInterview,
  lastChange,
  nextTalkingPoint,
  notCoveredYet,
  statusCounts,
} from '@gnomeola/ui-core/agendas'
import { useNow } from '@gnomeola/ui-core/hooks'
import { _, fmt, ngettext } from '@gnomeola/ui-core/i18n'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { create } from 'zustand'
import { Button, Card, Chip, Icon, IconButton, SegmentedControl } from '../../design/primitives/index.ts'
import { useAgendaHistory, useAgendaMutation } from './agenda-data.ts'
import { ItemHistory, StatusMenu } from './agenda-editor.tsx'
import { AgendaContextPanel } from './context-panel.tsx'
import { EvidenceChip } from './evidence.tsx'
import { attributionText, displayAgent, kindLabel, whoLabel } from './labels.ts'
import { addItemsMutation, resolveSuggestionMutation, setStatusMutation } from './mutations.ts'
import { RecapView } from './recap.tsx'

// The session page's Agenda tab while recording (and in review after): the items with their status as
// the meeting moves them — auto marks and agents' marks attributed ("auto", "checked by Claude") with a
// one-click undo, evidence chips that jump the transcript to the words that settled an item —, ONE
// "Next talking point" card, "Not covered yet" from five minutes before the calendar end, suggestions
// (accept / dismiss / turn into an item), the interview view (Told / Not told yet, with the answer heard
// and its quote), the context panel, and a compact mode that keeps only what matters mid-sentence.
//
// Everything here folds from the agenda.* events the tracker and connected agents write: the panel
// never polls, and never changes an item by itself.

/** Per-window view preferences of the panel (lossy, like every other ephemeral UI state). */
export const usePanelPrefs = create<{
  compact: boolean
  view: 'agenda' | 'interview'
  set: (p: Partial<{ compact: boolean; view: 'agenda' | 'interview' }>) => void
}>((set) => ({ compact: false, view: 'agenda', set: (p) => set(p) }))

/** "auto" / "checked by Claude" + Undo (the user sets it back: an override, and manual wins after). */
function Attribution({
  agendaId,
  item,
  change,
}: {
  agendaId: string
  item: AgendaItem
  change: StatusChange | null
}) {
  const set = useAgendaMutation(setStatusMutation, _('Could not undo'))
  const text = change && change.to === item.status ? attributionText(change) : null
  if (!text || !change) return null
  return (
    <span className="inline-flex items-center gap-1">
      <Chip icon={change.by.startsWith('agent:') ? 'agent' : 'enhance'} tone="info">
        {text}
      </Chip>
      <Button
        size="sm"
        variant="ghost"
        icon="undo"
        onPress={() =>
          set.mutate({ agendaId, itemId: item.id, status: change.from, note: _('undone in the window') })
        }
      >
        {_('Undo')}
      </Button>
    </span>
  )
}

function LiveItem({
  view,
  item,
  change,
  history,
  compact,
}: {
  view: AgendaView
  item: AgendaItem
  change: StatusChange | null
  history: StatusChange[]
  compact: boolean
}) {
  return (
    <li
      aria-label={item.text}
      className={`flex items-start gap-2 rounded-md px-2 py-1.5 ${item.status === 'in-progress' ? 'bg-bg-selected' : 'bg-bg-surface'}`}
    >
      <StatusMenu agendaId={view.agenda.id} item={item} />
      <div className="flex min-w-0 flex-1 flex-col gap-1 pt-1">
        <span
          className={`type-body break-words ${item.status === 'covered' || item.status === 'skipped' ? 'text-text-secondary' : 'text-text-primary'}`}
        >
          {item.text}
        </span>
        {compact ? null : (
          <>
            <div className="flex flex-wrap items-center gap-1">
              {item.kind !== 'topic' ? <Chip>{kindLabel(item.kind)}</Chip> : null}
              {item.timeboxMin ? <Chip icon="clock">{fmt(_('{n} min'), { n: item.timeboxMin })}</Chip> : null}
              <Attribution agendaId={view.agenda.id} item={item} change={change} />
            </div>
            {item.evidence.length ? (
              <div className="flex flex-wrap gap-1">
                {item.evidence.slice(-3).map((ev) => (
                  <EvidenceChip
                    key={`${ev.segmentId}:${ev.quote}`}
                    sessionId={view.agenda.sessionId}
                    ev={ev}
                  />
                ))}
              </div>
            ) : null}
            {item.outcome ? (
              <p className="m-0 type-callout break-words text-text-secondary">{item.outcome}</p>
            ) : null}
          </>
        )}
      </div>
      {compact ? null : <ItemHistory item={item} history={history} />}
    </li>
  )
}

function NextPointCard({ view, now }: { view: AgendaView; now: number }) {
  const resolve = useAgendaMutation(resolveSuggestionMutation, _('Could not dismiss the suggestion'))
  const set = useAgendaMutation(setStatusMutation, _('Could not change the status'))
  const next = nextTalkingPoint(view, now)
  if (!next) return null
  const item = next.kind === 'item' ? next.item : next.item
  const line = next.kind === 'suggestion' ? next.suggestion.text : null
  const source = next.kind === 'suggestion' ? next.suggestion.source : null
  return (
    <Card as="section" aria-label={_('Next talking point')} className="flex flex-col gap-2 p-3">
      <div className="flex items-center gap-2">
        <Icon name="suggestion" size={18} className="text-accent-record-text" />
        <h3 className="m-0 flex-1 type-overline text-text-secondary">{_('Next talking point')}</h3>
        {source ? (
          <Chip icon={source.startsWith('agent:') ? 'agent' : 'enhance'} tone="info">
            {fmt(_('from {who}'), { who: whoLabel(source) })}
          </Chip>
        ) : null}
      </div>
      {item ? <p className="m-0 type-headline break-words text-text-primary">{item.text}</p> : null}
      {line ? <p className="m-0 type-body break-words text-text-secondary">{line}</p> : null}
      <div className="flex flex-wrap gap-2">
        {item && item.status === 'open' ? (
          <Button
            size="sm"
            icon="inProgress"
            onPress={() => set.mutate({ agendaId: view.agenda.id, itemId: item.id, status: 'in-progress' })}
          >
            {_('Start This')}
          </Button>
        ) : null}
        {next.kind === 'suggestion' ? (
          <Button
            size="sm"
            variant="ghost"
            onPress={() =>
              resolve.mutate({ agendaId: view.agenda.id, suggestion: next.suggestion, action: 'dismiss' })
            }
          >
            {_('Dismiss')}
          </Button>
        ) : null}
      </div>
    </Card>
  )
}

function NotCoveredCard({ view, now }: { view: AgendaView; now: number }) {
  const left = notCoveredYet(view, now)
  if (!left?.length) return null
  const end = Date.parse(view.agenda.meeting!.end!)
  const mins = Math.max(0, Math.ceil((end - now) / 60_000))
  return (
    <Card
      as="section"
      aria-label={_('Not covered yet')}
      className="flex flex-col gap-2 border-status-warning p-3"
    >
      <div className="flex items-center gap-2">
        <Icon name="clock" size={18} className="text-status-warning-text" />
        <h3 className="m-0 flex-1 type-headline text-text-primary">{_('Not covered yet')}</h3>
        <span className="font-mono text-[13px] text-text-secondary tabular-nums">
          {mins > 0 ? fmt(ngettext('{n} min left', '{n} min left', mins), { n: mins }) : _('time’s up')}
        </span>
      </div>
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {left.map((i) => (
          <li key={i.id} className="flex items-center gap-2 type-body text-text-primary">
            <Icon
              name={i.status === 'in-progress' ? 'inProgress' : 'openItem'}
              size={16}
              className="shrink-0 text-text-secondary"
            />
            <span className="min-w-0 flex-1 break-words">{i.text}</span>
            {i.kind === 'must-cover' ? <Chip tone="warning">{kindLabel(i.kind)}</Chip> : null}
          </li>
        ))}
      </ul>
    </Card>
  )
}

export function suggestionKindLabel(s: Suggestion): string {
  switch (s.kind) {
    case 'next-point':
      return _('Next point')
    case 'question':
      return _('Question to ask')
    case 'missed':
      return _('Missed')
    case 'fact-check':
      return _('Fact check')
    case 'looks-covered':
      return _('Looks covered?')
    case 'set-status':
      return _('Status change')
    case 'add-item':
      return _('New item')
  }
}

function SuggestionCard({ view, s }: { view: AgendaView; s: Suggestion }) {
  const resolve = useAgendaMutation(resolveSuggestionMutation, _('Could not resolve the suggestion'))
  const add = useAgendaMutation(addItemsMutation, _('Could not add the item'))
  const item = s.itemId ? view.items.find((i) => i.id === s.itemId) : undefined
  // accepting does something only where the daemon knows what: looks-covered (covers the item) and an
  // agent's proposal (applies it); the rest are notes, which the user may turn into an item
  const acceptable = s.kind === 'looks-covered' || Boolean(s.proposal)
  return (
    <li aria-label={fmt(_('Suggestion: {text}'), { text: s.text })}>
      <Card className="flex flex-col gap-2 p-3">
        <div className="flex flex-wrap items-center gap-1">
          <Chip icon="suggestion" tone="record">
            {suggestionKindLabel(s)}
          </Chip>
          <Chip icon={s.source.startsWith('agent:') ? 'agent' : 'enhance'} tone="info">
            {s.source.startsWith('agent:')
              ? fmt(_('by {name}'), { name: displayAgent(s.source.slice(6)) })
              : _('by the live tracker')}
          </Chip>
          {item ? <span className="type-caption text-text-secondary">· {item.text}</span> : null}
        </div>
        <p className="m-0 type-body break-words text-text-primary">{s.text}</p>
        <div className="flex flex-wrap gap-2">
          {acceptable ? (
            <Button
              size="sm"
              variant="primary"
              icon="check"
              onPress={() => resolve.mutate({ agendaId: view.agenda.id, suggestion: s, action: 'accept' })}
            >
              {_('Accept')}
            </Button>
          ) : null}
          {s.kind !== 'add-item' && s.kind !== 'looks-covered' && s.kind !== 'set-status' ? (
            <Button
              size="sm"
              icon="add"
              onPress={() => {
                add.mutate({
                  agendaId: view.agenda.id,
                  items: [{ text: s.text.slice(0, 500), kind: s.kind === 'question' ? 'question' : 'topic' }],
                })
                resolve.mutate({ agendaId: view.agenda.id, suggestion: s, action: 'dismiss' })
              }}
            >
              {_('Turn into Item')}
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="ghost"
            onPress={() => resolve.mutate({ agendaId: view.agenda.id, suggestion: s, action: 'dismiss' })}
          >
            {_('Dismiss')}
          </Button>
        </div>
      </Card>
    </li>
  )
}

function InterviewView({ view }: { view: AgendaView }) {
  const { told, notYet } = interviewSplit(view)
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <section aria-labelledby="told" className="flex flex-col gap-2">
        <h3 id="told" className="m-0 type-overline text-text-secondary">
          {fmt(_('Told ({n})'), { n: told.length })}
        </h3>
        {told.length === 0 ? (
          <p className="m-0 type-callout text-text-secondary">{_('Nothing yet.')}</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {told.map((i) => (
              <li key={i.id} aria-label={i.text}>
                <Card className="flex flex-col gap-1 p-3">
                  <span className="type-callout text-text-secondary">{i.text}</span>
                  <span className="type-headline break-words text-text-primary">
                    {i.outcome ?? _('(answer not recorded)')}
                  </span>
                  {i.evidence.at(-1) ? (
                    <div className="flex flex-wrap gap-1">
                      <EvidenceChip sessionId={view.agenda.sessionId} ev={i.evidence.at(-1)!} />
                    </div>
                  ) : null}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby="not-told" className="flex flex-col gap-2">
        <h3 id="not-told" className="m-0 type-overline text-text-secondary">
          {fmt(_('Not told yet ({n})'), { n: notYet.length })}
        </h3>
        {notYet.length === 0 ? (
          <p className="m-0 type-callout text-text-secondary">
            {_('Everything asked for has been answered.')}
          </p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {notYet.map((i) => (
              <li key={i.id} className="flex items-center gap-2 rounded-md bg-bg-surface px-2 py-1.5">
                <StatusMenu agendaId={view.agenda.id} item={i} />
                <span className="min-w-0 flex-1 type-body break-words text-text-primary">{i.text}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

export function LivePanel({ view, session }: { view: AgendaView; session: Session }) {
  const navigate = useNavigate()
  const live = session.status === 'recording' || session.status === 'paused'
  const now = useNow(live ? 15_000 : 60_000).getTime()
  const history = useAgendaHistory(view.agenda.id)
  const prefs = usePanelPrefs()
  const [showAll, setShowAll] = useState(false)
  const interview = isInterview(view)
  const mode = interview ? prefs.view : 'agenda'
  const items = [...view.items].sort((a, b) => a.order - b.order)
  const counts = statusCounts(items)
  const suggestions = activeSuggestions(view, now).filter((s) => s.kind !== 'next-point')
  const compact = prefs.compact
  const shown = compact && !showAll ? items.filter((i) => i.status === 'in-progress') : items
  return (
    <div className="mx-auto flex w-full max-w-[860px] flex-col gap-4 px-4 pb-8 sm:px-6">
      <div className="flex flex-wrap items-center gap-2">
        <p className="m-0 flex-1 type-callout text-text-secondary">
          {fmt(_('{covered} of {total} covered'), { covered: counts.covered, total: items.length })}
          {counts['in-progress'] ? ` · ${fmt(_('{n} in progress'), { n: counts['in-progress'] })}` : ''}
        </p>
        {interview ? (
          <SegmentedControl
            label={_('Agenda view')}
            segments={[
              { id: 'agenda', label: _('Agenda') },
              { id: 'interview', label: _('Interview') },
            ]}
            value={mode}
            onChange={(v) => prefs.set({ view: v })}
          />
        ) : null}
        <IconButton
          icon={compact ? 'expand' : 'compact'}
          label={compact ? _('Full view') : _('Compact view')}
          aria-pressed={compact}
          onPress={() => prefs.set({ compact: !compact })}
        />
        <Button
          size="sm"
          icon="edit"
          onPress={() => void navigate({ to: '/agendas/$agendaId', params: { agendaId: view.agenda.id } })}
        >
          {_('Edit Agenda')}
        </Button>
      </div>
      {live ? null : <RecapView view={view} session={session} />}
      {live ? <NotCoveredCard view={view} now={now} /> : null}
      {live ? <NextPointCard view={view} now={now} /> : null}
      {suggestions.length && live ? (
        <section aria-labelledby="suggestions" className="flex flex-col gap-2">
          <h3 id="suggestions" className="m-0 type-overline text-text-secondary">
            {_('Suggestions')}
          </h3>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {(compact ? suggestions.slice(0, 1) : suggestions).map((s) => (
              <SuggestionCard key={s.id} view={view} s={s} />
            ))}
          </ul>
        </section>
      ) : null}
      {mode === 'interview' ? (
        <InterviewView view={view} />
      ) : (
        <section aria-labelledby="live-items" className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <h3 id="live-items" className="m-0 flex-1 type-overline text-text-secondary">
              {compact && !showAll ? _('Now') : _('Items')}
            </h3>
            {compact ? (
              <Button size="sm" variant="link" onPress={() => setShowAll(!showAll)}>
                {showAll ? _('Show less') : fmt(_('Show all {n}'), { n: items.length })}
              </Button>
            ) : null}
          </div>
          {shown.length ? (
            <ul aria-label={_('Agenda items')} className="m-0 flex list-none flex-col gap-1 p-0">
              {shown.map((i) => (
                <LiveItem
                  key={i.id}
                  view={view}
                  item={i}
                  change={lastChange(history.data ?? [], i.id)}
                  history={history.data ?? []}
                  compact={compact}
                />
              ))}
            </ul>
          ) : (
            <p className="m-0 type-callout text-text-secondary">
              {compact ? _('Nothing in progress right now.') : _('This agenda has no items.')}
            </p>
          )}
        </section>
      )}
      {compact ? null : <AgendaContextPanel view={view} />}
    </div>
  )
}
