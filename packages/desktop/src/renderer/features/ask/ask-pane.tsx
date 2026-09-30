import { type Citation, formatOffset } from '@gnomeola/protocol'
import { _, fmt } from '@gnomeola/ui-core/i18n'
import { type AskError, isUnavailable, type QaTurn, splitCitations, viewTurn } from '@gnomeola/ui-core/qa'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useStore } from 'zustand'
import { useServices } from '../../data/services.tsx'
import { LIcon } from '../transcript/local-icons.tsx'
import {
  KButton,
  KEmptyState,
  KNotice,
  KSegmented,
  KSpinner,
  KTextField,
} from '../transcript/local-primitives.tsx'
import { speakerName } from '../transcript/rows.ts'
import '../transcript/transcript.css'
import { mergeTurns, type OwnAsk, runOwnAsk } from './ask-stream.ts'

// Q-5 in the Electron window: ask questions about this meeting (or across recent meetings). History is
// the qa query (getQaHistory + qa.message events from any client, via the EventBridge); this window's
// own question streams in token by token (ephemeral store) until the durable answer arrives. `[n]`
// markers in an answer become citation chips; a chip opens the Transcript at the cited line (the
// session route's ?seg= / ?t= search params) — in another session for a cross-meeting answer.

type Effort = 'low' | 'medium' | 'high'
type Scope = 'session' | 'recent'
const RECENT = '30d'

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
      className="mx-0.5 inline-flex h-5 cursor-default items-center rounded-pill bg-bg-sidebar px-1.5 align-[1px] font-mono text-[12px] font-medium text-text-secondary tabular-nums outline-none hover:text-accent-record-text focus-visible:outline-[3px] focus-visible:outline-offset-1 focus-visible:outline-accent-focus"
    >
      [{n}]
    </button>
  )
}

function ErrorNotice({ error }: { error: AskError }) {
  if (isUnavailable(error)) {
    const credits = /no credits|credit balance|billing/i.test(error.message)
    return (
      <KNotice
        tone={credits ? 'warning' : 'info'}
        title={
          credits ? _('The provider account has no credits left') : _('Questions aren’t available right now')
        }
      >
        {credits
          ? _(
              'Add credits with your language model provider, or switch provider in Preferences, then ask again.',
            )
          : fmt(_('{reason}. Choose a language model provider and add an API key in Preferences.'), {
              reason: error.message.charAt(0).toUpperCase() + error.message.slice(1),
            })}
      </KNotice>
    )
  }
  if (error.code === 'aborted') return <KNotice tone="neutral" title={_('Stopped')} />
  return (
    <KNotice tone="danger" title={_('The question could not be answered')}>
      {error.message}
    </KNotice>
  )
}

function Turn({ turn, onCite }: { turn: QaTurn; onCite: (c: Citation) => void }) {
  const view = viewTurn(turn)
  return (
    <article className="flex flex-col gap-3">
      {turn.question ? (
        <p className="type-headline m-0 self-end max-w-[85%] rounded-lg bg-bg-sidebar px-4 py-2.5 text-text-primary select-text">
          {turn.question}
        </p>
      ) : null}
      {view.kind === 'streaming' ? (
        <div className="flex items-start gap-3">
          <span className="mt-1">
            <KSpinner label={_('Answering')} />
          </span>
          <p
            className={`type-body m-0 whitespace-pre-wrap select-text ${view.text ? 'text-text-primary' : 'text-text-secondary'}`}
          >
            {view.text || _('Thinking…')}
          </p>
        </div>
      ) : null}
      {view.kind === 'answer' ? (
        <p className="type-body m-0 whitespace-pre-wrap text-text-primary select-text">
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
        <KNotice tone="neutral" title={_('No answer')}>
          {_('The model declined to answer this question. Nothing it wrote before declining is shown.')}
        </KNotice>
      ) : null}
      {view.kind === 'error' ? <ErrorNotice error={view.error} /> : null}
      {view.kind === 'unanswered' ? (
        <p className="type-callout m-0 text-text-secondary">{_('No answer was recorded.')}</p>
      ) : null}
    </article>
  )
}

let nextAsk = 0

export function AskPane({ sessionId }: { sessionId: string }) {
  const { api, queries, store } = useServices()
  const navigate = useNavigate()
  const qa = useQuery(queries.qa(sessionId))
  const [own, setOwn] = useState<OwnAsk[]>([])
  const streams = useStore(store, (s) => s.streams)
  const [question, setQuestion] = useState('')
  const [effort, setEffort] = useState<Effort>('low')
  const [scope, setScope] = useState<Scope>('session')
  const abort = useRef<AbortController | null>(null)
  useEffect(() => () => abort.current?.abort(), [])

  // a new session: its own history, none of the previous session's asks
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset on session change only
  useEffect(() => {
    abort.current?.abort()
    setOwn([])
  }, [sessionId])

  const turns = mergeTurns(qa.data, own, streams)
  const asking = turns.some((t) => t.pending)

  const patchOwn = useCallback(
    (localId: string, p: Partial<OwnAsk>) =>
      setOwn((cur) => cur.map((o) => (o.localId === localId ? { ...o, ...p } : o))),
    [],
  )

  const submit = () => {
    const q = question.trim()
    if (!q || asking) return
    setQuestion('')
    following.current = true
    const localId = `ask-${Date.now().toString(36)}-${nextAsk++}`
    const since = scope === 'recent' ? RECENT : null
    setOwn((cur) => [...cur, { localId, question: q, since, requestId: null, answer: null }])
    const ac = new AbortController()
    abort.current = ac
    void runOwnAsk(
      api,
      store,
      localId,
      since
        ? { question: q, since, effort, includePrivate: true }
        : { question: q, sessionId, effort, includePrivate: true },
      {
        onQuestion: (requestId) => patchOwn(localId, { requestId }),
        onAnswer: (answer) => patchOwn(localId, { answer }),
      },
      ac.signal,
    )
  }

  const onCite = (c: Citation) =>
    void navigate({
      to: '/sessions/$sessionId',
      params: { sessionId: c.sessionId },
      search: { pane: 'transcript', seg: c.segmentId, t: c.startMs / 1000 },
    })

  // keep the newest exchange in view as it streams, unless the user scrolled up to read
  const scroller = useRef<HTMLDivElement | null>(null)
  const following = useRef(true)
  const tail = turns.length
    ? `${turns.length}:${(turns.at(-1)!.own ?? '').length}:${turns.at(-1)!.answer?.id ?? ''}`
    : ''
  useLayoutEffect(() => {
    const el = scroller.current
    if (el && following.current && tail) el.scrollTop = el.scrollHeight
  }, [tail])

  return (
    <section aria-label={_('Ask')} className="flex min-h-0 flex-1 flex-col">
      {turns.length === 0 ? (
        <KEmptyState
          icon="question"
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
            className="mx-auto flex w-full max-w-[760px] flex-col gap-8 px-6 py-5"
          >
            {turns.map((t) => (
              <Turn key={t.requestId} turn={t} onCite={onCite} />
            ))}
          </div>
        </div>
      )}
      <div className="shrink-0 border-t border-border-subtle bg-bg-window">
        <div className="mx-auto flex w-full max-w-[760px] flex-col gap-2 px-6 py-3">
          <div className="flex items-center gap-2">
            <KTextField
              label={_('Question')}
              placeholder={
                scope === 'session'
                  ? _('Ask a question about this meeting')
                  : _('Ask across your recent meetings')
              }
              value={question}
              onChange={setQuestion}
              onEnter={submit}
              className="flex-1"
            />
            {asking ? (
              <KButton variant="secondary" onPress={() => abort.current?.abort()}>
                {_('Stop')}
              </KButton>
            ) : (
              <KButton
                variant="primary"
                icon="arrowUp"
                isDisabled={!question.trim()}
                aria-description={_('Ask the question about this meeting')}
                onPress={submit}
              >
                {_('Ask')}
              </KButton>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <KSegmented<Scope>
              label={_('Scope')}
              value={scope}
              onChange={setScope}
              options={[
                { value: 'session', label: _('This meeting') },
                {
                  value: 'recent',
                  label: _('Last 30 days'),
                  description: _('Ask across every meeting of the last 30 days'),
                },
              ]}
            />
            <KSegmented<Effort>
              label={_('Effort')}
              value={effort}
              onChange={setEffort}
              options={[
                { value: 'low', label: _('Quick') },
                { value: 'medium', label: _('Balanced') },
                { value: 'high', label: _('Thorough'), description: _('Slower, reads more closely') },
              ]}
            />
            {asking ? (
              <span className="type-caption inline-flex items-center gap-1.5 text-text-secondary">
                <LIcon name="loader" size={14} className="k-spin" />
                {_('Answering…')}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  )
}
