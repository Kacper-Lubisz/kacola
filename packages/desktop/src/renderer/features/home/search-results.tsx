import type { Citation } from '@gnomeola/protocol'
import { useNow } from '@gnomeola/ui-core/hooks'
import { _, fmt, ngettext } from '@gnomeola/ui-core/i18n'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { type ReactNode, useEffect, useState } from 'react'
import { useServices } from '../../data/services.tsx'
import { Button, Card, Icon, Kbd, Spinner } from '../../design/primitives/index.ts'
import { Turn, type useAsk } from '../ask/ask-answer.tsx'
import { atLine } from '../meeting/search-params.ts'
import { looksLikeQuestion, type Moment, searchTerms, toMoments } from './search.ts'

// Home's results, in place of the day while there is a query: an answer when the user asked (Enter, or
// the Ask row), then the moments — meeting · day · time · speaker · the line — each opening the meeting
// at that line (Back returns here: the query is in the URL). Searching is on this computer; asking sends
// the matching excerpts to the AI provider, and private meetings are left out of it.

/** The query settles for a moment before it is searched (typing stays smooth). */
function useSettled(value: string, ms = 200): string {
  const [v, setV] = useState(value)
  useEffect(() => {
    const h = setTimeout(() => setV(value), ms)
    return () => clearTimeout(h)
  }, [value, ms])
  return v
}

export function SearchResults({ query, ask }: { query: string; ask: ReturnType<typeof useAsk> }) {
  const { queries } = useServices()
  const navigate = useNavigate()
  const now = useNow(60_000).getTime()
  const q = useSettled(searchTerms(query))
  const search = useQuery({ ...queries.search(q), enabled: q !== '' })
  const sessions = useQuery({ ...queries.sessions(), enabled: false }).data?.ordered ?? []
  const moments = toMoments(q, sessions, search.data?.hits ?? [], now)
  const asked = ask.turns.at(-1)
  const open = (m: Moment) =>
    void navigate({
      to: '/sessions/$sessionId',
      params: { sessionId: m.sessionId },
      search: m.segmentId ? atLine(m.segmentId, m.startMs) : {},
    })
  const onCite = (c: Citation) =>
    void navigate({
      to: '/sessions/$sessionId',
      params: { sessionId: c.sessionId },
      search: atLine(c.segmentId, c.startMs),
    })
  return (
    <div className="flex flex-col gap-5">
      <p className="m-0 -mt-3 flex items-center gap-1.5 type-caption text-text-secondary">
        <Kbd>Esc</Kbd> {_('back to your day')}
      </p>
      {asked ? (
        <Card as="section" aria-label={_('Answer')} className="flex flex-col gap-3 p-5">
          <div className="flex items-start gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-bg-sidebar">
              <Icon name="ask" size={16} className="text-text-secondary" />
            </span>
            <div className="min-w-0 flex-1">
              <Turn turn={asked} onCite={onCite} />
            </div>
            {ask.streaming ? (
              <Button size="sm" variant="ghost" icon="stop" onPress={ask.stop}>
                {_('Stop')}
              </Button>
            ) : null}
          </div>
          <p className="m-0 type-caption text-text-secondary">
            {_(
              'Written by your AI provider from the matching parts of your meetings. Private meetings are left out.',
            )}
          </p>
        </Card>
      ) : (
        <button
          type="button"
          onClick={() => ask.ask(query)}
          disabled={ask.asking}
          className="flex cursor-default items-center gap-3 rounded-lg border border-border-subtle bg-bg-surface px-4 py-3 text-left outline-none hover:border-border-default focus-visible:outline-(length:--focus-ring-width) focus-visible:outline-solid focus-visible:outline-(--focus-ring-color)"
        >
          <Icon name="ask" size={18} className="shrink-0 text-text-secondary" />
          <span className="min-w-0 flex-1 type-body text-text-primary">
            {fmt(_('Ask: “{question}”'), { question: query.trim() })}
          </span>
          <span className="hidden type-caption text-text-secondary sm:inline">
            {looksLikeQuestion(query) ? _('Enter to ask') : _('sends matching excerpts to your AI provider')}
          </span>
        </button>
      )}
      <section aria-labelledby="moments" className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="moments" className="m-0 type-headline text-text-primary">
            {search.isFetching && !search.data
              ? _('Searching…')
              : fmt(ngettext('{n} moment', '{n} moments', moments.length), { n: moments.length })}
          </h2>
          <span className="type-caption text-text-secondary">
            {_('searched titles and transcripts on this computer')}
          </span>
        </div>
        {search.isFetching && !search.data ? <Spinner label={_('Searching…')} /> : null}
        {search.isError ? (
          <p className="m-0 type-callout text-status-danger-text">
            {fmt(_('The search did not work: {reason}'), { reason: search.error.message })}
          </p>
        ) : null}
        {!search.isFetching && search.data && moments.length === 0 ? (
          <p className="m-0 type-callout text-text-secondary">
            {fmt(_('Nothing anyone said matches “{query}”. Try other words, or ask.'), { query: q })}
          </p>
        ) : null}
        {moments.length ? (
          <ul aria-label={_('Moments')} className="m-0 flex list-none flex-col gap-1 p-0">
            {moments.map((m) => (
              <li key={m.key}>
                <MomentRow m={m} onOpen={() => open(m)} />
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  )
}

function MomentRow({ m, onOpen }: { m: Moment; onOpen: () => void }) {
  const where = [m.title, m.day, m.at, m.speaker].filter(Boolean).join(' · ')
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={
        m.at ? fmt(_('{where}: {line}'), { where, line: m.parts.map((p) => p.text).join('') }) : where
      }
      className="flex w-full cursor-default flex-col gap-1 rounded-md px-3 py-2.5 text-left outline-none hover:bg-bg-hover focus-visible:outline-(length:--focus-ring-width) focus-visible:outline-solid focus-visible:outline-(--focus-ring-color)"
    >
      <span className="flex flex-wrap items-center gap-x-1.5 type-caption text-text-secondary">
        <span className="font-semibold text-text-primary">{m.at ? m.title : _('Meeting')}</span>
        {m.day ? <Sep>{m.day}</Sep> : null}
        {m.at ? (
          <Sep>
            <span className="font-mono text-[12px] tabular-nums">{m.at}</span>
          </Sep>
        ) : null}
        {m.speaker ? <Sep>{m.speaker}</Sep> : null}
        {m.private ? (
          <Sep>
            <span className="inline-flex items-center gap-1">
              <Icon name="lock" size={12} /> {_('Private')}
            </span>
          </Sep>
        ) : null}
      </span>
      <span className="type-body break-words text-text-primary">
        {m.at ? '“' : ''}
        {m.parts.map((p, i) =>
          p.mark ? (
            <mark
              // biome-ignore lint/suspicious/noArrayIndexKey: positional pieces of one line
              key={i}
              className="rounded-xs bg-[color-mix(in_srgb,var(--k-color-status-warning)_28%,transparent)] px-0.5 text-text-primary"
            >
              {p.text}
            </mark>
          ) : (
            // biome-ignore lint/suspicious/noArrayIndexKey: positional pieces of one line
            <span key={i}>{p.text}</span>
          ),
        )}
        {m.at ? '”' : ''}
      </span>
    </button>
  )
}

function Sep({ children }: { children: ReactNode }) {
  return (
    <>
      <span aria-hidden="true">·</span>
      {children}
    </>
  )
}
