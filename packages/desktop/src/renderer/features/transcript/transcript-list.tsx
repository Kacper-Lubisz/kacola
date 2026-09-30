import { formatOffset } from '@gnomeola/protocol'
import { formatDuration } from '@gnomeola/ui-core/format'
import { _ } from '@gnomeola/ui-core/i18n'
import { useVirtualizer } from '@tanstack/react-virtual'
import { memo, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react'
import { SpeakerChip } from '../speakers/speaker-chip.tsx'
import { KButton } from './local-primitives.tsx'
import { type DisplayRow, isLine, rowName, splitMatches } from './rows.ts'
import './transcript.css'

// The transcript list (T-6 in the Electron window): a WAI-ARIA listbox over @tanstack/react-virtual, so
// only the rows on screen (plus a small overscan) exist in the DOM — the 1,350-line meeting costs what a
// 10-line one does. The contract the e2e suite and screen readers see is the GTK app's:
//   listbox "Transcript" → options named "<Speaker> at <m:ss>: <text>" (+ " (provisional)" / " (in
//   progress)"); the selected option is the highlight (a followed citation, the keyboard's position).
//
// Keyboard: the listbox takes focus (one Tab stop, not 1,350); Up/Down/Page Up/Page Down/Home/End move
// the selection (aria-activedescendant) and scroll it into view.
//
// Following the live end is about intent, not position (ui-core/follow.ts explains why): a wheel or
// key up, or dragging the scrollbar up by more than a page, detaches; reaching the bottom re-attaches;
// growth while attached pins the view to the bottom. "Jump to Live" re-attaches.

const NEAR_BOTTOM_PX = 32
const LINE_PX = 30
const GROUP_PX = 60

export type TranscriptListHandle = {
  scrollToIndex: (i: number, align?: 'start' | 'center' | 'end' | 'auto') => void
  focus: () => void
}

export type TranscriptListProps = {
  rows: readonly DisplayRow[]
  live: boolean
  selectedId: string | null
  onSelect: (id: string | null) => void
  /** Search-within: highlight this text in every line; the current match gets a stronger mark. */
  query?: string
  currentMatchId?: string | null
  /** A row to flash (a followed citation), with a key that changes per follow. */
  flash?: { id: string; key: string } | null
  /** Detach from the live end (something else — a citation, a search hit — took the view). */
  detachSignal?: number
  onFirstPaint?: (rows: number) => void
  handle?: React.Ref<TranscriptListHandle>
}

const optionId = (id: string) => `tl-${id.replace(/[^\w-]/g, '_')}`

const Line = memo(function Line({
  row,
  selected,
  query,
  current,
  flashKey,
}: {
  row: DisplayRow
  selected: boolean
  query: string
  current: boolean
  flashKey: string | null
}) {
  if (!isLine(row)) {
    return (
      <div className="flex items-center gap-3 py-2 pr-4 pl-[76px]">
        <span aria-hidden className="h-px flex-1 border-t border-dashed border-border-strong" />
        <span className="type-caption text-text-secondary">
          {_('Recording gap')} · <span className="font-mono tabular-nums">{formatOffset(row.startMs)}</span> ·{' '}
          <span className="font-mono tabular-nums">{formatDuration(row.durationMs)}</span> · {row.reason}
        </span>
        <span aria-hidden className="h-px flex-1 border-t border-dashed border-border-strong" />
      </div>
    )
  }
  const partial = row.kind === 'partial'
  return (
    <div
      key={flashKey ?? undefined}
      className={`grid grid-cols-[56px_1fr] gap-x-5 rounded-md px-3 ${row.groupStart ? 'pt-4 pb-1' : 'py-1'} ${selected ? 'bg-bg-selected' : 'hover:bg-bg-hover'} ${flashKey ? 'k-cited' : ''}`}
    >
      <span
        className={`type-mono text-right text-text-secondary ${row.groupStart ? 'pt-[30px]' : 'pt-px'}`}
        aria-hidden
      >
        {formatOffset(row.startMs)}
      </span>
      <div className="flex min-w-0 flex-col items-start gap-1.5">
        {row.groupStart ? <SpeakerChip speaker={row.speaker} colour={row.colour} /> : null}
        <p
          className={`type-body m-0 select-text break-words ${partial ? 'italic text-text-secondary' : row.provisional ? 'text-text-secondary' : 'text-text-primary'}`}
        >
          {query
            ? splitMatches(row.text, query).map((p, i) =>
                p.hit ? (
                  // biome-ignore lint/suspicious/noArrayIndexKey: positional pieces of one string
                  <mark key={i} className="k-mark" data-current={current ? '' : undefined}>
                    {p.text}
                  </mark>
                ) : (
                  // biome-ignore lint/suspicious/noArrayIndexKey: positional pieces of one string
                  <span key={i}>{p.text}</span>
                ),
              )
            : row.text}
          {partial ? <span aria-hidden className="k-caret" /> : null}
        </p>
      </div>
    </div>
  )
})

export function TranscriptList({
  rows,
  live,
  selectedId,
  onSelect,
  query = '',
  currentMatchId = null,
  flash = null,
  detachSignal = 0,
  onFirstPaint,
  handle,
}: TranscriptListProps) {
  const scroller = useRef<HTMLDivElement | null>(null)
  const following = useRef(live)
  const [detached, setDetached] = useState(!live)
  const lastTop = useRef(0)
  const latest = useRef(rows)
  latest.current = rows

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scroller.current,
    estimateSize: (i) => (rows[i] && isLine(rows[i]!) && rows[i]!.groupStart ? GROUP_PX : LINE_PX),
    getItemKey: (i) => rows[i]?.id ?? i,
    overscan: 10,
  })

  const setFollowing = useCallback((on: boolean) => {
    following.current = on
    setDetached(!on)
  }, [])

  const toEnd = useCallback(() => {
    const n = latest.current.length
    if (n) virtualizer.scrollToIndex(n - 1, { align: 'end' })
    const el = scroller.current
    if (el) el.scrollTop = el.scrollHeight
  }, [virtualizer])

  useImperativeHandle(
    handle,
    () => ({
      scrollToIndex: (i, align = 'center') => virtualizer.scrollToIndex(i, { align }),
      focus: () => scroller.current?.focus(),
    }),
    [virtualizer],
  )

  // something else took the view (citation, search hit)
  useEffect(() => {
    if (detachSignal) setFollowing(false)
  }, [detachSignal, setFollowing])

  // a session that goes live starts following; one that stops keeps where it is
  useEffect(() => {
    if (live) setFollowing(true)
  }, [live, setFollowing])

  // growth while following: pin to the bottom (new lines, a partial growing, rows re-measured)
  const total = virtualizer.getTotalSize()
  const tail = rows.length
    ? `${rows.length}:${rows.at(-1)!.id}:${(rows.at(-1) as { text?: string }).text ?? ''}`
    : ''
  // biome-ignore lint/correctness/useExhaustiveDependencies: `total` changing (rows re-measured) is a reason to re-pin
  useLayoutEffect(() => {
    if (following.current && live && tail) {
      const el = scroller.current
      if (el) el.scrollTop = el.scrollHeight
    }
  }, [tail, total, live])

  // first paint (perf): the frame after the first commit with rows
  const painted = useRef(false)
  useLayoutEffect(() => {
    if (painted.current || !rows.length) return
    painted.current = true
    if (live) toEnd()
    const n = rows.length
    requestAnimationFrame(() => onFirstPaint?.(n))
  }, [rows.length, live, toEnd, onFirstPaint])

  const selectedIndex = selectedId ? rows.findIndex((r) => r.id === selectedId) : -1

  const moveTo = (i: number) => {
    const n = rows.length
    if (!n) return
    const j = Math.max(0, Math.min(n - 1, i))
    onSelect(rows[j]!.id)
    virtualizer.scrollToIndex(j, { align: 'auto' })
    if (j === n - 1 && live) setFollowing(true)
  }

  const pageRows = () => Math.max(1, Math.floor((scroller.current?.clientHeight ?? 600) / LINE_PX) - 1)

  const onKeyDown = (e: React.KeyboardEvent) => {
    const cur = selectedIndex === -1 ? (virtualizer.getVirtualItems()[0]?.index ?? 0) - 1 : selectedIndex
    switch (e.key) {
      case 'ArrowDown':
        moveTo(cur + 1)
        break
      case 'ArrowUp':
        setFollowing(false)
        moveTo(Math.max(0, cur - 1))
        break
      case 'PageDown':
        moveTo(cur + pageRows())
        break
      case 'PageUp':
        setFollowing(false)
        moveTo(cur - pageRows())
        break
      case 'Home':
        setFollowing(false)
        moveTo(0)
        break
      case 'End':
        moveTo(rows.length - 1)
        if (live) setFollowing(true)
        break
      default:
        return
    }
    e.preventDefault()
  }

  const onFocus = (e: React.FocusEvent) => {
    if (e.target !== e.currentTarget) return
    const n = rows.length
    if (!n) return
    // focus entering a followed transcript lands on the newest line, not a line scrolled far away
    if (following.current && live) {
      onSelect(rows[n - 1]!.id)
      return
    }
    if (selectedIndex === -1) {
      const first = virtualizer.getVirtualItems().find((v) => {
        const el = scroller.current
        return !el || v.start >= el.scrollTop - 1
      })
      if (first) onSelect(rows[first.index]!.id)
    }
  }

  const onScroll = () => {
    const el = scroller.current
    if (!el) return
    const top = el.scrollTop
    if (top >= el.scrollHeight - el.clientHeight - NEAR_BOTTOM_PX) {
      if (!following.current && live) setFollowing(true)
    } else if (top < lastTop.current - el.clientHeight && following.current) {
      setFollowing(false) // more than a page up at once, not by a key or wheel: a scrollbar drag
    }
    lastTop.current = top
  }

  const items = virtualizer.getVirtualItems()
  const activeId = selectedIndex !== -1 ? optionId(rows[selectedIndex]!.id) : undefined

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={scroller}
        role="listbox"
        aria-label={_('Transcript')}
        aria-activedescendant={activeId}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
        onScroll={onScroll}
        onWheel={(e) => {
          if (e.deltaY < 0) setFollowing(false)
        }}
        className="min-h-0 flex-1 overflow-y-auto outline-none [contain:strict] focus-visible:shadow-[inset_0_0_0_2px_var(--k-color-accent-focus)]"
      >
        <div role="presentation" className="relative mx-auto w-full max-w-[800px]" style={{ height: total }}>
          {items.map((v) => {
            const r = rows[v.index]!
            const sel = r.id === selectedId
            return (
              // biome-ignore lint/a11y/useFocusableInteractive: options are reached through the listbox's aria-activedescendant
              // biome-ignore lint/a11y/useKeyWithClickEvents: the keyboard is handled by the listbox (one Tab stop)
              <div
                key={v.key}
                id={optionId(r.id)}
                role="option"
                aria-selected={sel}
                aria-disabled={isLine(r) ? undefined : true}
                aria-label={rowName(r)}
                aria-setsize={rows.length}
                aria-posinset={v.index + 1}
                data-index={v.index}
                ref={virtualizer.measureElement}
                onClick={() => isLine(r) && onSelect(r.id)}
                className="absolute top-0 left-0 w-full px-4"
                style={{ transform: `translateY(${v.start}px)` }}
              >
                <Line
                  row={r}
                  selected={sel}
                  query={query}
                  current={r.id === currentMatchId}
                  flashKey={flash && flash.id === r.id ? flash.key : null}
                />
              </div>
            )
          })}
        </div>
      </div>
      {live && detached ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
          <KButton
            variant="primary"
            pill
            icon="arrowDown"
            className="pointer-events-auto shadow-e2"
            aria-description={_('Scroll to the newest line and keep following')}
            onPress={() => {
              setFollowing(true)
              toEnd()
            }}
          >
            {_('Jump to Live')}
          </KButton>
        </div>
      ) : null}
    </div>
  )
}
