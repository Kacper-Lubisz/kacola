import { formatOffset } from '@gnomeola/protocol'
import * as Gtk from '@gtkx/gi/gtk'
import { AdwButtonContent, AdwClampScrollable, AdwSpinner, AdwStatusPage } from '@gtkx/jsx/adw'
import {
  GtkBox,
  GtkButton,
  GtkEventControllerKey,
  GtkEventControllerScroll,
  GtkLabel,
  GtkOverlay,
  GtkScrolledWindow,
} from '@gtkx/jsx/gtk'
import { useProperty, useSignal } from '@gtkx/react'
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Follow } from '../data/follow.ts'
import { escapeMarkup } from '../data/format.ts'
import { perf } from '../data/perf.ts'
import { type TranscriptFeedState, type TranscriptRow, transcriptRows } from '../data/transcript.ts'
import { _, fmt } from '../i18n/index.ts'
import { VirtualList } from './virtual-list.tsx'

// T-6: the transcript. A GtkListView (./virtual-list.tsx), so only the rows on screen
// exist as widgets — a 1,350-segment meeting costs the same to scroll as a 10-segment one.
//
// Autoscroll: while the view is at the bottom it follows new lines; scrolling up stops that, and a
// "Jump to Live" button brings it back. A citation (from the Ask pane) scrolls to its segment and
// selects it — the selection is the highlight, visible and announced by screen readers.

export const speakerName = (speaker: string): string =>
  speaker === 'me' ? _('Me') : speaker === 'them' ? _('Them') : speaker

/** What a screen reader reads for one line (and what the e2e tests look rows up by). */
export function rowAccessibleName(r: TranscriptRow): string {
  const state = r.kind === 'partial' ? _('in progress') : r.provisional ? _('provisional') : null
  const base = fmt(_('{speaker} at {time}: {text}'), {
    speaker: speakerName(r.speaker),
    time: formatOffset(r.startMs),
    text: r.text,
  })
  return state ? `${base} (${state})` : base
}

const Line = memo(function Line({ row }: { row: TranscriptRow }) {
  const who = row.speaker === 'me' ? 'speaker-me' : 'speaker-them'
  const textClasses = ['transcript-text']
  if (row.kind === 'partial') textClasses.push('partial')
  else if (row.provisional) textClasses.push('provisional')
  return (
    <GtkBox
      spacing={12}
      cssClasses={row.groupStart ? ['transcript-line', 'group-start'] : ['transcript-line']}
    >
      <GtkLabel
        label={formatOffset(row.startMs)}
        cssClasses={['transcript-time', 'dim-label', 'caption', 'numeric']}
        xalign={1}
        yalign={0}
        valign={Gtk.Align.START}
        marginTop={row.groupStart ? 21 : 2}
      />
      <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={2} hexpand>
        {row.groupStart ? (
          <GtkLabel label={speakerName(row.speaker)} cssClasses={['speaker', who]} xalign={0} />
        ) : null}
        <GtkLabel
          label={row.kind === 'partial' ? `${row.text}…` : row.text}
          cssClasses={textClasses}
          xalign={0}
          wrap
          wrapMode={2 /* Pango.WrapMode.WORD_CHAR */}
          naturalWrapMode={Gtk.NaturalWrapMode.WORD}
        />
      </GtkBox>
    </GtkBox>
  )
})

const keyOf = (r: TranscriptRow) => r.id
const renderLine = (r: TranscriptRow) => <Line row={r} />

export type TranscriptFocus = { segmentId: string; nonce: number }

export type TranscriptViewProps = {
  feed: TranscriptFeedState
  live: boolean
  /** Scroll to and select this segment (a citation was followed). */
  focus: TranscriptFocus | null
}

export function TranscriptView({ feed, live, focus }: TranscriptViewProps) {
  const rows = useMemo(() => transcriptRows(feed.transcript), [feed.transcript])
  const list = useRef<Gtk.ListView | null>(null)
  // state, not a ref: the scrolled window mounts only once the transcript has loaded, and the
  // adjustment subscription below must follow it
  const [scrolled, setScrolled] = useState<Gtk.ScrolledWindow | null>(null)
  const adjustment = useProperty(scrolled, 'vadjustment') ?? null
  // Follow the live end (data/follow.ts): on for a live session until the user scrolls up.
  const [follow] = useState(() => new Follow(live))
  const [detached, setDetached] = useState(!live)
  const [selected, setSelected] = useState<string | null>(null)
  // the latest rows/adjustment for callbacks that must not be re-created every render
  const latest = useRef({ rows, adjustment })
  latest.current = { rows, adjustment }

  const sync = useCallback(() => setDetached(!follow.following), [follow])

  const scrollToEnd = useCallback(() => {
    const { rows: r, adjustment: adj } = latest.current
    if (r.length > 0) list.current?.scrollTo(r.length - 1, Gtk.ListScrollFlags.NONE, null)
    if (adj) adj.setValue(adj.getUpper() - adj.getPageSize())
  }, [])

  useSignal(adjustment, 'value-changed', () => {
    const adj = adjustment
    if (!adj) return
    follow.scrolled(adj.getValue(), adj.getUpper(), adj.getPageSize())
    sync()
  })
  useSignal(adjustment, 'changed', () => {
    const adj = adjustment
    if (!adj) return
    const pin = follow.resized(adj.getValue(), adj.getUpper(), adj.getPageSize())
    if (pin !== null) adj.setValue(pin)
  })

  // New or revised last line while following: keep the newest line in view.
  const tail = rows.length ? `${rows.length}:${rows.at(-1)!.text}` : ''
  useEffect(() => {
    if (tail && follow.following) scrollToEnd()
  }, [tail, follow, scrollToEnd])

  // A followed citation: stop following, scroll to the segment, select it. Retried as rows arrive,
  // in case the cited line is not loaded yet; handled once per request (nonce).
  const handled = useRef(0)
  useEffect(() => {
    if (!focus || focus.nonce === handled.current) return
    const i = rows.findIndex((r) => r.segmentId === focus.segmentId)
    if (i === -1) return
    handled.current = focus.nonce
    follow.detach()
    sync()
    setSelected(rows[i]!.id)
    list.current?.scrollTo(i, Gtk.ListScrollFlags.NONE, null)
  }, [focus, rows, follow, sync])

  // Time from "the snapshot is here" to "the list has it", for GNOMEOLA_UI_PERF.
  const loadedAt = useRef<number | null>(null)
  if (feed.status === 'ready' && loadedAt.current === null) loadedAt.current = performance.now()
  const reported = useRef(false)
  useLayoutEffect(() => {
    if (feed.status !== 'ready' || reported.current || loadedAt.current === null) return
    reported.current = true
    const start = loadedAt.current
    perf('transcript.commit', { rows: rows.length, ms: Math.round(performance.now() - start) })
  })

  if (feed.status === 'loading') {
    return (
      <AdwStatusPage vexpand title={_('Loading Transcript…')}>
        <AdwSpinner widthRequest={32} heightRequest={32} halign={Gtk.Align.CENTER} />
      </AdwStatusPage>
    )
  }
  if (feed.status === 'error' && rows.length === 0) {
    return (
      <AdwStatusPage
        vexpand
        iconName="dialog-warning-symbolic"
        title={_('Could Not Load the Transcript')}
        description={escapeMarkup(feed.error)}
      />
    )
  }
  if (rows.length === 0) {
    return (
      <AdwStatusPage
        vexpand
        iconName={live ? 'audio-input-microphone-symbolic' : 'text-x-generic-symbolic'}
        title={live ? _('Listening…') : _('No Transcript')}
        description={
          live ? _('Lines appear here as people speak.') : _('Nothing was transcribed in this session.')
        }
      />
    )
  }

  return (
    <GtkOverlay
      vexpand
      overlays={
        live && detached ? (
          <GtkButton
            halign={Gtk.Align.CENTER}
            valign={Gtk.Align.END}
            cssClasses={['pill', 'suggested-action', 'jump-to-live']}
            tooltipText={_('Scroll to the newest line and keep following')}
            onClicked={() => {
              follow.attach()
              sync()
              scrollToEnd()
            }}
          >
            <AdwButtonContent iconName="go-bottom-symbolic" label={_('Jump to Live')} />
          </GtkButton>
        ) : null
      }
    >
      <GtkScrolledWindow
        ref={setScrolled}
        vexpand
        hscrollbarPolicy={Gtk.PolicyType.NEVER}
        // user intent for Follow: wheel/touchpad and keys, seen before the list handles them
        controllers={
          <>
            <GtkEventControllerScroll
              flags={Gtk.EventControllerScrollFlags.VERTICAL}
              propagationPhase={Gtk.PropagationPhase.CAPTURE}
              onScroll={(_dx, dy) => {
                follow.userScrolled(dy)
                sync()
                return false
              }}
            />
            <GtkEventControllerKey
              propagationPhase={Gtk.PropagationPhase.CAPTURE}
              onKeyPressed={(keyval) => {
                follow.userKey(keyval)
                sync()
                return false
              }}
            />
          </>
        }
      >
        <AdwClampScrollable maximumSize={760} tighteningThreshold={560}>
          <VirtualList<TranscriptRow>
            listRef={list}
            rows={rows}
            keyOf={keyOf}
            labelOf={rowAccessibleName}
            render={renderLine}
            selectedKey={selected}
            onSelectedKey={setSelected}
            cssClasses={['transcript']}
            accessibleLabel={_('Transcript')}
          />
        </AdwClampScrollable>
      </GtkScrolledWindow>
    </GtkOverlay>
  )
}
