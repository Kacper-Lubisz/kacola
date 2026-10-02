import { _, fmt } from '@gnomeola/ui-core/i18n'
import { useQuery } from '@tanstack/react-query'
import { useRouterState, useSearch } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from 'zustand'
import { useServices } from '../../data/services.tsx'
import {
  Banner,
  EmptyState,
  IconButton,
  Spinner,
  TextField,
  useToast,
} from '../../design/primitives/index.ts'
import type { PaneProps } from '../sessions/pane.ts'
import { LineActions } from '../speakers/line-actions.tsx'
import { buildRows, citedIndex, findMatches, gapsOf, isLine } from './rows.ts'
import type { CitationTarget } from './search-params.ts'
import { TranscriptList, type TranscriptListHandle } from './transcript-list.tsx'

// The transcript (shown in the meeting's side panel, meeting/transcript-panel.tsx): the transcript query (kept current by the EventBridge's folds: segment revisions,
// live → final, attribution changes) + the live partial lines (ephemeral store) + recorded gaps, in a
// virtualised list; search-within in a slim toolbar; the selected line's actions (Someone Else Said
// This) underneath. Citation targets come in as the session route's ?segment= / ?t= search params.

const LIVE = new Set(['recording', 'paused'])

export function TranscriptPane({ session }: PaneProps) {
  const sessionId = session.id
  const { queries, store } = useServices()
  const toast = useToast()
  const transcript = useQuery(queries.transcript(sessionId))
  const speakers = useQuery(queries.speakers(sessionId)).data
  const live = LIVE.has(session.status)
  const partials = useStore(store, (s) => s.partials[sessionId])
  const gaps = useMemo(() => gapsOf(session), [session])
  const rows = useMemo(
    () => (transcript.data ? buildRows(transcript.data, speakers, live ? partials : undefined, gaps) : []),
    [transcript.data, speakers, partials, live, gaps],
  )

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const list = useRef<TranscriptListHandle | null>(null)
  const [detach, setDetach] = useState(0)

  // ---- search within (Ctrl+F while the pane is shown)
  const [searching, setSearching] = useState(false)
  const [query, setQuery] = useState('')
  const [matchAt, setMatchAt] = useState(0)
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
  const closeSearch = () => {
    setSearching(false)
    setQuery('')
    jumpedFor.current = ''
    list.current?.focus()
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        setSearching(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ---- citation targets (?segment= / ?t=): scroll to the line, select it, flash it. Once per
  // navigation (the router's per-navigation key), retried as rows arrive in case it is not loaded yet.
  const target = useSearch({ strict: false }) as CitationTarget
  const navKey = useRouterState({ select: (s) => s.location.state.__TSR_key ?? '' })
  const [flash, setFlash] = useState<{ id: string; key: string } | null>(null)
  const handled = useRef('')
  const { segment, t } = target
  useEffect(() => {
    if (segment === undefined && t === undefined) return
    const key = `${navKey}|${segment ?? ''}|${t ?? ''}`
    if (handled.current === key) return
    const i = citedIndex(rows, segment, t === undefined ? undefined : t * 1000)
    if (i === -1) return
    handled.current = key
    const id = rows[i]!.id
    setDetach((d) => d + 1)
    setSelectedId(id)
    setFlash({ id, key })
    // after the list has laid out (the pane may have just become visible)
    requestAnimationFrame(() => list.current?.scrollToIndex(i, 'center'))
  }, [rows, segment, t, navKey])

  // perf: snapshot in hand → first painted frame (read by the perf e2e through the Performance API)
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
      <div className="flex flex-1 items-center justify-center">
        <Spinner label={_('Loading Transcript…')} />
      </div>
    )
  } else if (transcript.isError && rows.length === 0) {
    body = (
      <EmptyState
        compact
        headingLevel={2}
        icon="warning"
        title={_('Could Not Load the Transcript')}
        description={transcript.error.message}
      />
    )
  } else if (rows.length === 0) {
    body = live ? (
      <EmptyState
        compact
        headingLevel={2}
        icon="mic"
        title={_('Listening…')}
        description={_('Lines appear here as people speak.')}
      />
    ) : (
      <EmptyState
        compact
        headingLevel={2}
        icon="transcript"
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
      <div className="mx-auto flex h-10 w-full  shrink-0 items-center gap-2 px-4 sm:px-6">
        <div className="flex-1" />
        {searching ? (
          <div className="flex items-center gap-1">
            <TextField
              label={_('Search the transcript')}
              labelHidden
              placeholder={_('Search the transcript')}
              value={query}
              onChange={setQuery}
              autoFocus
              inputClassName="!h-8 w-60"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  goToMatch(matchAt + (e.shiftKey ? -1 : 1))
                } else if (e.key === 'Escape') {
                  e.preventDefault()
                  closeSearch()
                }
              }}
            />
            <span aria-live="polite" className="min-w-[72px] text-center type-mono text-text-secondary">
              {query.trim()
                ? matches.length
                  ? fmt(_('{n} of {total}'), {
                      n: Math.min(matchAt, matches.length - 1) + 1,
                      total: matches.length,
                    })
                  : _('No matches')
                : ''}
            </span>
            <IconButton
              icon="chevronUp"
              size="sm"
              label={_('Previous Match')}
              isDisabled={!matches.length}
              onPress={() => goToMatch(matchAt - 1)}
            />
            <IconButton
              icon="chevronDown"
              size="sm"
              label={_('Next Match')}
              isDisabled={!matches.length}
              onPress={() => goToMatch(matchAt + 1)}
            />
            <IconButton icon="close" size="sm" label={_('Close Search')} onPress={closeSearch} />
          </div>
        ) : (
          <IconButton
            icon="search"
            size="sm"
            label={_('Search the Transcript')}
            tooltip={_('Search the transcript (Ctrl+F)')}
            isDisabled={!rows.length}
            onPress={() => setSearching(true)}
          />
        )}
      </div>
      {session.status === 'recovered' ? (
        <div className="mx-auto w-full  px-4 pb-2 sm:px-6">
          <Banner
            tone="warning"
            title={_(
              'kacola stopped unexpectedly while recording this meeting. Everything up to then was kept.',
            )}
          />
        </div>
      ) : null}
      {session.status === 'failed' && session.error ? (
        <div className="mx-auto w-full  px-4 pb-2 sm:px-6">
          <Banner tone="danger" title={fmt(_('Recording failed: {reason}'), { reason: session.error })} />
        </div>
      ) : null}
      {body}
      {selectedRow && isLine(selectedRow) && selectedRow.kind === 'segment' ? (
        <LineActions
          sessionId={sessionId}
          row={selectedRow}
          onError={(m) =>
            toast(fmt(_('Could not change the speaker: {reason}'), { reason: m }), { tone: 'error' })
          }
        />
      ) : null}
    </section>
  )
}
