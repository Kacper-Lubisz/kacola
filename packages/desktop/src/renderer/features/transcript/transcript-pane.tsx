import { _, fmt, ngettext } from '@gnomeola/ui-core/i18n'
import { useQuery } from '@tanstack/react-query'
import { useRouterState } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from 'zustand'
import { useServices } from '../../data/services.tsx'
import { LineActions } from '../speakers/line-actions.tsx'
import { SpeakersDialog } from '../speakers/speakers-dialog.tsx'
import { KButton, KEmptyState, KIconButton, KNotice, KSpinner, KTextField } from './local-primitives.tsx'
import { buildRows, citedIndex, findMatches, gapsOf, isLine } from './rows.ts'
import type { SessionSearch } from './search-params.ts'
import { TranscriptList, type TranscriptListHandle } from './transcript-list.tsx'

// The Transcript pane: the transcript query (kept current by the EventBridge's folds: segment revisions,
// live → final, attribution changes) + the live partial lines (ephemeral store) + recorded gaps, in a
// virtualised list; a toolbar with search-within and the Speakers dialog; the selected line's actions
// (Someone Else Said This) underneath. Citation targets come in as the route's search params.

const LIVE = new Set(['recording', 'paused'])

export function TranscriptPane({ sessionId, target }: { sessionId: string; target?: SessionSearch }) {
  const { queries, store } = useServices()
  const session = useQuery(queries.session(sessionId)).data
  const transcript = useQuery(queries.transcript(sessionId))
  const speakers = useQuery(queries.speakers(sessionId)).data
  const live = session ? LIVE.has(session.status) : false
  const partials = useStore(store, (s) => s.partials[sessionId])
  const tracks = session?.tracks
  const gaps = useMemo(() => gapsOf(tracks ? { tracks } : undefined), [tracks])
  const rows = useMemo(
    () => (transcript.data ? buildRows(transcript.data, speakers, live ? partials : undefined, gaps) : []),
    [transcript.data, speakers, partials, live, gaps],
  )

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [speakersOpen, setSpeakersOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const list = useRef<TranscriptListHandle | null>(null)
  const [detach, setDetach] = useState(0)

  // ---- search within
  const [searching, setSearching] = useState(false)
  const [query, setQuery] = useState('')
  const [matchAt, setMatchAt] = useState(0)
  const searchInput = useRef<HTMLInputElement | null>(null)
  const matches = useMemo(() => findMatches(rows, query), [rows, query])
  const current = matches.length ? matches[Math.min(matchAt, matches.length - 1)]! : -1
  const goToMatch = useCallback(
    (k: number) => {
      if (!matches.length) return
      const n = ((k % matches.length) + matches.length) % matches.length
      setMatchAt(n)
      setDetach((d) => d + 1)
      setSelectedId(rows[matches[n]!]!.id)
      list.current?.scrollToIndex(matches[n]!, 'center')
    },
    [matches, rows],
  )
  // a new query jumps to its first match (like a browser's find bar); Enter / the arrows move on
  const jumpedFor = useRef('')
  useEffect(() => {
    if (!searching || jumpedFor.current === query || !matches.length) return
    jumpedFor.current = query
    goToMatch(0)
  }, [searching, query, matches, goToMatch])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        setSearching(true)
        requestAnimationFrame(() => searchInput.current?.focus())
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ---- citation targets (?seg= / ?t=): scroll to the line, select it, flash it. Once per navigation
  // (the router's per-navigation key), retried as rows arrive in case the line is not loaded yet.
  const navKey = useRouterState({ select: (s) => s.location.state.__TSR_key ?? '' })
  const [flash, setFlash] = useState<{ id: string; key: string } | null>(null)
  const handled = useRef('')
  const seg = target?.seg
  const t = target?.t
  useEffect(() => {
    if (seg === undefined && t === undefined) return
    const key = `${navKey}|${seg ?? ''}|${t ?? ''}`
    if (handled.current === key) return
    const i = citedIndex(rows, seg, t === undefined ? undefined : t * 1000)
    if (i === -1) return
    handled.current = key
    const id = rows[i]!.id
    setDetach((d) => d + 1)
    setSelectedId(id)
    setFlash({ id, key })
    // after the list has laid out (the pane may have just become visible)
    requestAnimationFrame(() => list.current?.scrollToIndex(i, 'center'))
  }, [rows, seg, t, navKey])

  // perf: snapshot in hand → first painted frame (read by the perf e2e via the Performance API)
  const loadedAt = useRef<number | null>(null)
  if (transcript.data && loadedAt.current === null) loadedAt.current = performance.now()
  const onFirstPaint = useCallback((n: number) => {
    if (loadedAt.current === null) return
    performance.measure('transcript.first-paint', { start: loadedAt.current, detail: { rows: n } })
  }, [])

  const selectedRow = selectedId ? rows.find((r) => r.id === selectedId) : undefined

  let body: React.ReactNode
  if (transcript.isPending) {
    body = (
      <div className="flex flex-1 flex-col items-center justify-center gap-3">
        <KSpinner label={_('Loading Transcript…')} size={24} />
        <p className="type-callout m-0 text-text-secondary">{_('Loading Transcript…')}</p>
      </div>
    )
  } else if (transcript.isError && rows.length === 0) {
    body = (
      <div className="p-6">
        <KNotice tone="danger" role="alert" title={_('Could Not Load the Transcript')}>
          {transcript.error.message}
        </KNotice>
      </div>
    )
  } else if (rows.length === 0) {
    body = live ? (
      <KEmptyState icon="mic" title={_('Listening…')} description={_('Lines appear here as people speak.')} />
    ) : (
      <KEmptyState
        icon="fileText"
        title={_('No Transcript')}
        description={_('Nothing was transcribed in this session.')}
      />
    )
  } else {
    body = (
      <TranscriptList
        handle={list}
        rows={rows}
        live={live}
        selectedId={selectedId}
        onSelect={setSelectedId}
        query={searching ? query : ''}
        currentMatchId={current === -1 ? null : rows[current]!.id}
        flash={flash}
        detachSignal={detach}
        onFirstPaint={onFirstPaint}
      />
    )
  }

  return (
    <section aria-label={_('Transcript')} className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2 px-5 pb-2">
        {live ? (
          <span className="inline-flex items-center gap-1.5 type-caption font-semibold text-accent-record-text">
            <span aria-hidden className="size-2 rounded-pill bg-accent-record" />
            {session?.status === 'paused' ? _('Paused') : _('Live')}
          </span>
        ) : null}
        <div className="flex-1" />
        {searching ? (
          <div className="flex items-center gap-1">
            <KTextField
              label={_('Search the transcript')}
              placeholder={_('Search the transcript')}
              leadingIcon="search"
              value={query}
              onChange={setQuery}
              inputRef={searchInput}
              onEnter={(shift) => goToMatch(matchAt + (shift ? -1 : 1))}
              onEscape={() => {
                setSearching(false)
                setQuery('')
              }}
              className="w-64"
            />
            <span aria-live="polite" className="type-mono min-w-[64px] text-center text-text-secondary">
              {query.trim()
                ? matches.length
                  ? fmt(_('{n} of {total}'), {
                      n: Math.min(matchAt, matches.length - 1) + 1,
                      total: matches.length,
                    })
                  : _('No matches')
                : ''}
            </span>
            <KIconButton
              icon="chevronUp"
              label={_('Previous Match')}
              isDisabled={!matches.length}
              onPress={() => goToMatch(matchAt - 1)}
            />
            <KIconButton
              icon="chevronDown"
              label={_('Next Match')}
              isDisabled={!matches.length}
              onPress={() => goToMatch(matchAt + 1)}
            />
            <KIconButton
              icon="x"
              label={_('Close Search')}
              onPress={() => {
                setSearching(false)
                setQuery('')
              }}
            />
          </div>
        ) : (
          <KIconButton
            icon="search"
            label={_('Search the Transcript')}
            onPress={() => {
              setSearching(true)
              requestAnimationFrame(() => searchInput.current?.focus())
            }}
          />
        )}
        <KButton variant="ghost" size="sm" icon="users" onPress={() => setSpeakersOpen(true)}>
          {_('Speakers')}
        </KButton>
      </div>
      {session?.status === 'recovered' ? (
        <div className="px-5 pb-2">
          <KNotice tone="warning" title={_('Recovered Session')}>
            {_('gnomeola stopped unexpectedly while recording. Everything up to that point was kept.')}
          </KNotice>
        </div>
      ) : null}
      {session?.status === 'failed' && session.error ? (
        <div className="px-5 pb-2">
          <KNotice tone="danger" title={_('Recording Failed')}>
            {session.error}
          </KNotice>
        </div>
      ) : null}
      {error ? (
        <div className="px-5 pb-2">
          <KNotice tone="danger" role="alert" title={_('Could not change the speaker')}>
            {error}
          </KNotice>
        </div>
      ) : null}
      {body}
      {selectedRow && isLine(selectedRow) && selectedRow.kind === 'segment' ? (
        <LineActions sessionId={sessionId} row={selectedRow} onError={setError} />
      ) : null}
      {gaps.length && rows.length ? (
        <p className="sr-only">
          {fmt(ngettext('{n} recorded gap', '{n} recorded gaps', gaps.length), { n: gaps.length })}
        </p>
      ) : null}
      <SpeakersDialog sessionId={sessionId} isOpen={speakersOpen} onClose={() => setSpeakersOpen(false)} />
    </section>
  )
}
