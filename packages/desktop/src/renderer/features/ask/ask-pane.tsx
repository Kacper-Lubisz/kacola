import { type Citation, formatOffset } from '@gnomeola/protocol'
import { _, fmt } from '@gnomeola/ui-core/i18n'
import { type AskError, isUnavailable, type QaTurn, splitCitations, viewTurn } from '@gnomeola/ui-core/qa'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { type ReactNode, useLayoutEffect, useRef, useState } from 'react'
import { useStore } from 'zustand'
import { useServices } from '../../data/services.tsx'
import {
  Button,
  EmptyState,
  Icon,
  type IconName,
  SegmentedControl,
  Spinner,
  TextField,
} from '../../design/primitives/index.ts'
import type { PaneProps } from '../sessions/pane.ts'
import { useDialogs } from '../shell/dialogs.tsx'
import { speakerName } from '../transcript/rows.ts'
import { mergeTurns, type OwnAsk, runOwnAsk } from './ask-stream.ts'
import { addOwnAsk, finishOwnAsk, ownAsks, patchOwnAsk, stopOwnAsk } from './own-asks.ts'

// Q-5 in the Electron window: ask questions about this meeting (or across recent meetings). History is
// the qa query (getQaHistory + qa.message events from any client, via the EventBridge); this window's
// own question streams in token by token (ephemeral store) until the durable answer arrives. `[n]`
// markers in an answer become citation chips; a chip opens the Transcript at the cited line (the
// session route's ?segment= / ?t= search params) — in another session for a cross-meeting answer.

type Effort = 'low' | 'medium' | 'high'
type Scope = 'session' | 'recent'
const RECENT = '30d'
const NONE: readonly OwnAsk[] = []

export const citationName = (n: number, c: Citation): string =>
  fmt(_('Citation {n}: {speaker} at {time}'), {
    n,
    speaker: speakerName(c.speaker),
    time: formatOffset(c.startMs),
  })

function CitationChip({ n, c, onCite }: { n: number; c: Citation; onCite: (c: Citation) => void }) {
  return (
    <button
      type="button"
      aria-label={citationName(n, c)}
      title={_('Show this line in the transcript')}
      onClick={() => onCite(c)}
      className="mx-0.5 inline-flex h-5 cursor-default items-center rounded-pill bg-bg-sidebar px-1.5 align-[1px] font-mono text-[12px] font-medium text-text-secondary tabular-nums focus-ring hover:text-accent-record-text"
    >
      [{n}]
    </button>
  )
}

/** A notice in place of an answer (refusal, unavailable, error): surface + border, icon, title, body. */
function Notice({
  icon,
  tone,
  title,
  children,
}: {
  icon: IconName
  tone: 'neutral' | 'info' | 'warning' | 'danger'
  title: string
  children?: ReactNode
}) {
  const colour =
    tone === 'info'
      ? 'text-status-info'
      : tone === 'warning'
        ? 'text-status-warning'
        : tone === 'danger'
          ? 'text-status-danger'
          : 'text-text-secondary'
  return (
    <div className="flex gap-3 rounded-lg border border-border-default bg-bg-surface px-4 py-3">
      <Icon name={icon} size={18} className={`mt-0.5 shrink-0 ${colour}`} />
      <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
        <p className="m-0 type-body-strong text-text-primary">{title}</p>
        {children}
      </div>
    </div>
  )
}

function ErrorNotice({ error }: { error: AskError }) {
  const dialogs = useDialogs()
  if (isUnavailable(error)) {
    const credits = /no credits|credit balance|billing/i.test(error.message)
    return (
      <Notice
        icon={credits ? 'warning' : 'info'}
        tone={credits ? 'warning' : 'info'}
        title={
          credits ? _('The provider account has no credits left') : _('Questions aren’t available right now')
        }
      >
        <p className="m-0 type-callout text-text-secondary">
          {credits
            ? _(
                'Add credits with your language model provider, or switch provider in Preferences, then ask again.',
              )
            : fmt(_('{reason}. Choose a language model provider and add an API key in Preferences.'), {
                reason: error.message.charAt(0).toUpperCase() + error.message.slice(1),
              })}
        </p>
        <Button size="sm" className="mt-1" onPress={() => dialogs.open('preferences')}>
          {_('Open Preferences')}
        </Button>
      </Notice>
    )
  }
  if (error.code === 'aborted') return <Notice icon="stop" tone="neutral" title={_('Stopped')} />
  return (
    <Notice icon="alert" tone="danger" title={_('The question could not be answered')}>
      <p className="m-0 type-callout text-text-secondary select-text">{error.message}</p>
    </Notice>
  )
}

function Turn({ turn, onCite }: { turn: QaTurn; onCite: (c: Citation) => void }) {
  const view = viewTurn(turn)
  return (
    <article className="flex flex-col gap-3">
      {turn.question ? (
        <p className="m-0 max-w-[85%] self-end rounded-lg bg-bg-sidebar px-4 py-2.5 type-headline text-text-primary select-text">
          {turn.question}
        </p>
      ) : null}
      {view.kind === 'streaming' ? (
        <div className="flex items-start gap-3">
          <span className="mt-0.5">
            <Spinner label={_('Answering')} size={18} />
          </span>
          <p
            className={`m-0 whitespace-pre-wrap type-body select-text ${view.text ? 'text-text-primary' : 'text-text-secondary'}`}
          >
            {view.text || _('Thinking…')}
          </p>
        </div>
      ) : null}
      {view.kind === 'answer' ? (
        <p className="m-0 whitespace-pre-wrap type-body text-text-primary select-text">
          {splitCitations(view.text, view.citations.length).map((p, i) =>
            p.kind === 'text' ? (
              // biome-ignore lint/suspicious/noArrayIndexKey: positional pieces of one answer
              <span key={i}>{p.text}</span>
            ) : (
              // biome-ignore lint/suspicious/noArrayIndexKey: positional pieces of one answer
              <CitationChip key={i} n={p.n} c={view.citations[p.n - 1]!} onCite={onCite} />
            ),
          )}
        </p>
      ) : null}
      {view.kind === 'refusal' ? (
        <Notice icon="refused" tone="neutral" title={_('No answer')}>
          <p className="m-0 type-callout text-text-secondary">
            {_('The model declined to answer this question. Nothing it wrote before declining is shown.')}
          </p>
        </Notice>
      ) : null}
      {view.kind === 'error' ? <ErrorNotice error={view.error} /> : null}
      {view.kind === 'unanswered' ? (
        <p className="m-0 type-callout text-text-secondary">{_('No answer was recorded.')}</p>
      ) : null}
    </article>
  )
}

let nextAsk = 0

export function AskPane({ session }: PaneProps) {
  const sessionId = session.id
  const { api, queries, store } = useServices()
  const navigate = useNavigate()
  const qa = useQuery(queries.qa(sessionId))
  const own = useStore(ownAsks, (s) => s.bySession[sessionId] ?? NONE)
  const streams = useStore(store, (s) => s.streams)
  const [question, setQuestion] = useState('')
  const [effort, setEffort] = useState<Effort>('low')
  const [scope, setScope] = useState<Scope>('session')

  const turns = mergeTurns(qa.data, own, streams)
  const asking = turns.some((t) => t.pending)
  const streaming = own.find((o) => streams[o.localId]?.status === 'streaming' && !o.answer)

  const submit = () => {
    const q = question.trim()
    if (!q || asking) return
    setQuestion('')
    following.current = true
    const localId = `ask-${Date.now().toString(36)}-${nextAsk++}`
    const since = scope === 'recent' ? RECENT : null
    const signal = addOwnAsk(sessionId, { localId, question: q, since, requestId: null, answer: null })
    void runOwnAsk(
      api,
      store,
      localId,
      since
        ? { question: q, since, effort, includePrivate: true }
        : { question: q, sessionId, effort, includePrivate: true },
      {
        onQuestion: (requestId) => patchOwnAsk(sessionId, localId, { requestId }),
        onAnswer: (answer) => patchOwnAsk(sessionId, localId, { answer }),
      },
      signal,
    ).finally(() => finishOwnAsk(localId))
  }

  const onCite = (c: Citation) =>
    void navigate({
      to: '/sessions/$sessionId',
      params: { sessionId: c.sessionId },
      search: { tab: 'transcript', segment: c.segmentId, t: c.startMs / 1000 },
    })

  // keep the newest exchange in view as it streams, unless the user scrolled up to read
  const scroller = useRef<HTMLDivElement | null>(null)
  const following = useRef(true)
  const last = turns.at(-1)
  const tail = last
    ? `${turns.length}:${(last.own ?? '').length}:${last.answer?.id ?? ''}:${last.error?.code ?? ''}`
    : ''
  useLayoutEffect(() => {
    const el = scroller.current
    if (el && following.current && tail) el.scrollTop = el.scrollHeight
  }, [tail])

  return (
    <section aria-label={_('Ask')} className="flex min-h-0 flex-1 flex-col">
      {turns.length === 0 ? (
        <EmptyState
          compact
          headingLevel={2}
          icon="ask"
          title={_('Ask About This Meeting')}
          description={
            qa.isError
              ? fmt(_('Earlier questions could not be loaded: {reason}'), { reason: qa.error.message })
              : _('Answers come from this transcript, with citations you can follow back to the line.')
          }
        />
      ) : (
        <div
          ref={scroller}
          onScroll={() => {
            const el = scroller.current
            if (el) following.current = el.scrollTop >= el.scrollHeight - el.clientHeight - 32
          }}
          className="min-h-0 flex-1 overflow-y-auto"
        >
          <div
            role="log"
            aria-label={_('Questions and answers')}
            className="mx-auto flex w-full max-w-[760px] flex-col gap-8 px-4 py-5 sm:px-6"
          >
            {turns.map((t) => (
              <Turn key={t.requestId} turn={t} onCite={onCite} />
            ))}
          </div>
        </div>
      )}
      <div className="shrink-0 border-t border-border-subtle bg-bg-window">
        <div className="mx-auto flex w-full max-w-[760px] flex-col gap-2 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <TextField
              label={_('Question')}
              labelHidden
              placeholder={
                scope === 'session'
                  ? _('Ask a question about this meeting')
                  : _('Ask across your recent meetings')
              }
              value={question}
              onChange={setQuestion}
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  submit()
                }
              }}
            />
            {streaming ? (
              <Button variant="secondary" icon="stop" onPress={() => stopOwnAsk(streaming.localId)}>
                {_('Stop')}
              </Button>
            ) : (
              <Button
                variant="primary"
                icon="arrowUp"
                isDisabled={!question.trim() || asking}
                onPress={submit}
              >
                {_('Ask')}
              </Button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <SegmentedControl<Scope>
              label={_('Scope')}
              value={scope}
              onChange={setScope}
              segments={[
                { id: 'session', label: _('This meeting') },
                { id: 'recent', label: _('Last 30 days') },
              ]}
            />
            <SegmentedControl<Effort>
              label={_('Effort')}
              value={effort}
              onChange={setEffort}
              segments={[
                { id: 'low', label: _('Quick') },
                { id: 'medium', label: _('Balanced') },
                { id: 'high', label: _('Thorough') },
              ]}
            />
          </div>
        </div>
      </div>
    </section>
  )
}
