import type { AgendaView, DraftedItem } from '@gnomeola/protocol'
import { draftEvents } from '@gnomeola/protocol'
import { _, fmt, ngettext } from '@gnomeola/ui-core/i18n'
import { useEffect, useRef, useState } from 'react'
import { useServices } from '../../data/services.tsx'
import {
  Banner,
  Button,
  Checkbox,
  Chip,
  Dialog,
  Spinner,
  TextArea,
  TextField,
} from '../../design/primitives/index.ts'
import { useDialogs } from '../shell/dialogs.tsx'
import { useAgendaMutation } from './agenda-data.ts'
import { kindLabel } from './labels.ts'
import { addItemsMutation, updateAgendaMutation } from './mutations.ts'

// "Plan with Claude": the user's goals (and an optional ask) go to the daemon's draft route, which
// streams proposed items built from them, what is already on the agenda, its context and past meetings
// with the same people (POST /agendas/:id/draft, the existing LLM layer). Proposals arrive one by one,
// each checked; the user unticks what they don't want and adds the rest. Nothing reaches the agenda
// until then (the route never writes). The proposals are this dialog's own state: closing it drops them.

type Proposal = DraftedItem & { key: number; keep: boolean }
type Phase =
  | { kind: 'idle' }
  | { kind: 'drafting' }
  | { kind: 'done'; model: string }
  | { kind: 'error'; code: string; message: string }

export function PlanWithClaudeDialog({ view, onClose }: { view: AgendaView; onClose: () => void }) {
  const { api } = useServices()
  const dialogs = useDialogs()
  const addItems = useAgendaMutation(addItemsMutation, _('Could not add the items'))
  const saveGoals = useAgendaMutation(updateAgendaMutation, _('Could not save the goals'))
  const [goals, setGoals] = useState(view.agenda.goals.join('\n'))
  const [ask, setAsk] = useState('')
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [basedOn, setBasedOn] = useState<{ pastMeetings: number; existingItems: number } | null>(null)
  const ac = useRef<AbortController | null>(null)
  useEffect(() => () => ac.current?.abort(), [])

  const goalList = goals
    .split('\n')
    .map((g) => g.trim())
    .filter(Boolean)
  const draft = async () => {
    ac.current?.abort()
    const c = new AbortController()
    ac.current = c
    setProposals([])
    setBasedOn(null)
    setPhase({ kind: 'drafting' })
    // goals typed here become the agenda's goals too (they are what the meeting is for)
    if (goalList.join('\n') !== view.agenda.goals.join('\n'))
      saveGoals.mutate({ agendaId: view.agenda.id, patch: { goals: goalList } })
    let key = 0
    try {
      for await (const e of draftEvents(
        api.stream('draftAgenda', {
          params: { id: view.agenda.id },
          body: {
            goals: goalList,
            ...(ask.trim() ? { instructions: ask.trim() } : {}),
            includePrivate: true,
          },
          signal: c.signal,
        }),
      )) {
        if (e.type === 'started') setBasedOn(e.basedOn)
        else if (e.type === 'item') setProposals((p) => [...p, { ...e.item, key: key++, keep: true }])
        else if (e.type === 'done') setPhase({ kind: 'done', model: e.model })
        else if (e.type === 'error') setPhase({ kind: 'error', code: e.error.code, message: e.error.message })
      }
    } catch (err) {
      if (c.signal.aborted) return
      const e = err as { code?: string; message?: string }
      setPhase({ kind: 'error', code: e.code ?? 'internal', message: e.message ?? String(err) })
    }
  }
  const kept = proposals.filter((p) => p.keep)
  const accept = () => {
    if (!kept.length) return
    addItems.mutate({
      agendaId: view.agenda.id,
      items: kept.map(({ text, kind, owner, timeboxMin }) => ({ text, kind, owner, timeboxMin })),
    })
    onClose()
  }
  const drafting = phase.kind === 'drafting'
  return (
    <Dialog
      title={_('Plan with Claude')}
      size="lg"
      isOpen
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
      footer={
        <>
          <Button onPress={onClose}>{_('Cancel')}</Button>
          <Button variant="primary" onPress={accept} isDisabled={!kept.length || drafting}>
            {kept.length
              ? fmt(ngettext('Add {n} Item', 'Add {n} Items', kept.length), { n: kept.length })
              : _('Add Items')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="m-0 type-callout text-text-secondary">
          {_(
            'Claude drafts items from your goals, what is already on the agenda, its context and past meetings with the same people. Nothing is added until you choose.',
          )}
        </p>
        <TextArea label={_('Goals (one per line)')} value={goals} onChange={setGoals} rows={3} autoFocus />
        <TextField
          label={_('Anything else? (optional)')}
          placeholder={_('e.g. keep it to 30 minutes')}
          value={ask}
          onChange={setAsk}
        />
        <div className="flex items-center gap-3">
          <Button variant="secondary" icon="enhance" onPress={() => void draft()} isDisabled={drafting}>
            {proposals.length || phase.kind === 'done' ? _('Draft Again') : _('Draft Items')}
          </Button>
          {drafting ? <Spinner label={_('Drafting…')} /> : null}
          {basedOn ? (
            <span className="type-caption text-text-secondary">
              {fmt(ngettext('Using {n} past meeting', 'Using {n} past meetings', basedOn.pastMeetings), {
                n: basedOn.pastMeetings,
              })}
            </span>
          ) : null}
        </div>
        {phase.kind === 'error' ? (
          phase.code === 'unavailable' ? (
            <Banner
              tone="warning"
              title={_('Planning needs a language model provider')}
              action={
                <Button
                  size="sm"
                  onPress={() => {
                    onClose()
                    dialogs.open('preferences')
                  }}
                >
                  {_('Open Preferences')}
                </Button>
              }
            />
          ) : (
            <Banner tone="danger" title={fmt(_('Could not draft: {reason}'), { reason: phase.message })} />
          )
        ) : null}
        {proposals.length ? (
          <section aria-labelledby="proposals" className="flex flex-col gap-1">
            <h2 id="proposals" className="m-0 type-overline text-text-secondary">
              {_('Proposed items')}
            </h2>
            <ul aria-label={_('Proposed items')} className="m-0 flex list-none flex-col gap-1 p-0">
              {proposals.map((p) => (
                <li key={p.key} className="rounded-md bg-bg-surface px-2 py-1.5">
                  <Checkbox
                    isSelected={p.keep}
                    onChange={(v) =>
                      setProposals((all) => all.map((x) => (x.key === p.key ? { ...x, keep: v } : x)))
                    }
                  >
                    <span className="flex min-w-0 flex-col gap-1">
                      <span className="type-body text-text-primary">{p.text}</span>
                      <span className="flex flex-wrap gap-1">
                        {p.kind !== 'topic' ? <Chip>{kindLabel(p.kind)}</Chip> : null}
                        {p.owner ? <Chip icon="person">{p.owner}</Chip> : null}
                        {p.timeboxMin ? (
                          <Chip icon="clock">{fmt(_('{n} min'), { n: p.timeboxMin })}</Chip>
                        ) : null}
                      </span>
                    </span>
                  </Checkbox>
                </li>
              ))}
            </ul>
            {phase.kind === 'done' ? (
              <p className="m-0 type-caption text-text-secondary">
                {fmt(_('Drafted by {model}'), { model: phase.model })}
              </p>
            ) : null}
          </section>
        ) : phase.kind === 'done' ? (
          <p className="m-0 type-callout text-text-secondary">{_('Claude had nothing to add.')}</p>
        ) : null}
      </div>
    </Dialog>
  )
}
