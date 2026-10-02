import { type AskScope, type BodyIn, type Citation, formatOffset, providerName } from '@gnomeola/protocol'
import { _, fmt, ngettext } from '@gnomeola/ui-core/i18n'
import { type AskError, isUnavailable, type QaTurn, splitCitations, viewTurn } from '@gnomeola/ui-core/qa'
import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useStore } from 'zustand'
import { useServices } from '../../data/services.tsx'
import { Button, Icon, type IconName, Spinner } from '../../design/primitives/index.ts'
import { useDialogs } from '../shell/dialogs.tsx'
import { speakerName } from '../transcript/rows.ts'
import { mergeTurns, type OwnAsk, runOwnAsk } from './ask-stream.ts'
import { addOwnAsk, finishOwnAsk, ownAsks, patchOwnAsk, stopOwnAsk } from './own-asks.ts'

// Ask, wherever it is offered (the meeting's Ctrl+K bar, home's search-and-ask box): an answer with
// citation chips, the notices in place of one, and the hook that asks. History is the qa query
// (getQaHistory + qa.message events from any client, via the EventBridge); this window's own question
// streams in token by token (ephemeral store) until the durable answer arrives. `[n]` markers become
// citation chips; a chip opens the transcript at the cited line — in another meeting for a
// cross-meeting answer. No scope or quality choices: a meeting asks about itself, home across meetings.

const NONE: readonly OwnAsk[] = []
/** How far back home's questions reach. */
export const ACROSS = '90d'

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

/**
 * In place of an answer when asking failed: the daemon's message as written, and the ONE action its
 * `action` names — Try Again (the question is kept), Set Up a Provider (Preferences), Add Credits (the
 * provider's billing page). A private meeting with a cloud provider is not a failure: it says so calmly.
 */
function ErrorNotice({ error, onRetry }: { error: AskError; onRetry?: () => void }) {
  const dialogs = useDialogs()
  const { bridge } = useServices()
  if (error.code === 'aborted') return <Notice icon="stop" tone="neutral" title={_('Stopped')} />
  if (error.reason === 'private-meeting')
    return (
      <Notice icon="lock" tone="neutral" title={_('Private meetings stay on this computer')}>
        <p className="m-0 type-callout text-text-secondary select-text">{error.message}</p>
      </Notice>
    )
  const action = error.action ?? (isUnavailable(error) ? 'set-up-provider' : error.reason ? 'none' : 'retry')
  const tone =
    action === 'retry' || action === 'add-credits'
      ? 'warning'
      : action === 'set-up-provider'
        ? 'info'
        : 'danger'
  return (
    <Notice icon={tone === 'info' ? 'info' : 'alert'} tone={tone} title={_('No answer this time')}>
      <p className="m-0 type-callout text-text-secondary select-text">{error.message}</p>
      {action === 'retry' && onRetry ? (
        <Button size="sm" className="mt-1" icon="refresh" onPress={onRetry}>
          {_('Try Again')}
        </Button>
      ) : null}
      {action === 'set-up-provider' ? (
        <Button size="sm" className="mt-1" onPress={() => dialogs.open('preferences')}>
          {_('Set Up a Provider')}
        </Button>
      ) : null}
      {action === 'add-credits' ? (
        error.link ? (
          <Button
            size="sm"
            className="mt-1"
            icon="external"
            onPress={() => void bridge.openExternal(error.link!)}
          >
            {_('Add Credits')}
          </Button>
        ) : (
          <Button size="sm" className="mt-1" onPress={() => dialogs.open('preferences')}>
            {_('Switch Provider')}
          </Button>
        )
      ) : null}
    </Notice>
  )
}

/** "Sent 4 meetings to Anthropic · 1 private left out" / "Stayed on this computer". */
export function scopeLine(scope: AskScope): string {
  if (scope.onDevice) return _('Answered on this computer: nothing left it')
  const sent = fmt(
    ngettext('Sent {n} meeting to {provider}', 'Sent {n} meetings to {provider}', scope.sessionIds.length),
    { n: scope.sessionIds.length, provider: providerName(scope.provider) },
  )
  return scope.excludedPrivate
    ? `${sent} · ${fmt(ngettext('{n} private left out', '{n} private left out', scope.excludedPrivate), { n: scope.excludedPrivate })}`
    : sent
}

/** The answer as notes text: the question in bold, the answer quoted, citations as their times. */
export function pinText(turn: QaTurn): string | null {
  const view = viewTurn(turn)
  if (view.kind !== 'answer') return null
  const body = splitCitations(view.text, view.citations.length)
    .map((p) => (p.kind === 'text' ? p.text : `[${formatOffset(view.citations[p.n - 1]!.startMs)}]`))
    .join('')
    .trim()
    .split('\n')
    .map((l) => `> ${l}`.trimEnd())
    .join('\n')
  return `**${turn.question.trim()}**\n${body}\n`
}

export function Turn({
  turn,
  onCite,
  actions,
  scope,
  onRetry,
}: {
  turn: QaTurn
  onCite: (c: Citation) => void
  /** Under a finished answer (Pin to notes). */
  actions?: ReactNode
  /** What was sent where, when this window asked it. */
  scope?: AskScope | null
  /** Ask the same question again (offered when the error says Retry). */
  onRetry?: () => void
}) {
  const view = viewTurn(turn)
  return (
    <article className="flex flex-col gap-2">
      {turn.question ? (
        <p className="m-0 type-body-strong text-text-primary select-text">{turn.question}</p>
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
      {view.kind === 'answer' && actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
      {view.kind === 'refusal' ? (
        <Notice icon="refused" tone="neutral" title={_('No answer')}>
          <p className="m-0 type-callout text-text-secondary">
            {_('The model declined to answer this question. Nothing it wrote before declining is shown.')}
          </p>
        </Notice>
      ) : null}
      {view.kind === 'error' ? <ErrorNotice error={view.error} onRetry={onRetry} /> : null}
      {scope && view.kind !== 'error' ? (
        <p className="m-0 type-caption text-text-tertiary">{scopeLine(scope)}</p>
      ) : null}
      {view.kind === 'unanswered' ? (
        <p className="m-0 type-callout text-text-secondary">{_('No answer was recorded.')}</p>
      ) : null}
    </article>
  )
}

let nextAsk = 0

/**
 * Ask about one meeting (`sessionId`), or across recent meetings (`sessionId` null: home). `key` keeps
 * this window's own questions apart (a session id, or "home"). Returns the turns to show (history +
 * this window's own), whether one is in flight, and ask / stop.
 */
export function useAsk(key: string, sessionId: string | null) {
  const { api, queries, store } = useServices()
  const qa = useQuery({ ...queries.qa(sessionId ?? ''), enabled: sessionId !== null })
  const own = useStore(ownAsks, (s) => s.bySession[key] ?? NONE)
  const streams = useStore(store, (s) => s.streams)
  const turns = mergeTurns(sessionId ? qa.data : undefined, own, streams)
  const asking = turns.some((t) => t.pending)
  const streaming = own.find((o) => streams[o.localId]?.status === 'streaming' && !o.answer)
  const ask = (question: string) => {
    const q = question.trim()
    if (!q || asking) return
    const localId = `ask-${Date.now().toString(36)}-${nextAsk++}`
    const since = sessionId ? null : ACROSS
    const signal = addOwnAsk(key, { localId, question: q, since, requestId: null, answer: null })
    // across meetings, private ones are left out: private means never sent to the AI provider
    const body: BodyIn<'ask'> = since
      ? { question: q, since, effort: 'low', includePrivate: false }
      : { question: q, sessionId: sessionId!, effort: 'low', includePrivate: true }
    void runOwnAsk(
      api,
      store,
      localId,
      body,
      {
        onQuestion: (requestId, scope) => patchOwnAsk(key, localId, { requestId, scope }),
        onAnswer: (answer) => patchOwnAsk(key, localId, { answer }),
      },
      signal,
    ).finally(() => finishOwnAsk(localId))
  }
  const stop = () => {
    if (streaming) stopOwnAsk(streaming.localId)
  }
  /** The scope this window's own question reported, by request id. */
  const scopeOf = (requestId: string) =>
    own.find((o) => o.requestId === requestId || o.localId === requestId)?.scope ?? null
  return {
    turns,
    asking,
    streaming: Boolean(streaming),
    ask,
    stop,
    scopeOf,
    historyError: qa.isError ? qa.error : null,
  }
}
