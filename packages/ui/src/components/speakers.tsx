import { formatOffset, ME, type SpeakerSummary, THEM } from '@gnomeola/protocol'
import { formatDuration } from '@gnomeola/ui-core/format'
import { useStore } from '@gnomeola/ui-core/hooks'
import { _, fmt, ngettext } from '@gnomeola/ui-core/i18n'
import { type SpeakersFeedState, speakerClass } from '@gnomeola/ui-core/speakers'
import type { TranscriptRow } from '@gnomeola/ui-core/transcript'
import * as Gtk from '@gtkx/gi/gtk'
import { AdwActionRow, AdwClamp, AdwDialog, AdwHeaderBar, AdwToolbarView } from '@gtkx/jsx/adw'
import {
  GtkBox,
  GtkButton,
  GtkEntry,
  GtkImage,
  GtkLabel,
  GtkListBox,
  GtkMenuButton,
  GtkPopover,
  GtkScrolledWindow,
} from '@gtkx/jsx/gtk'
import { useEffect, useRef, useState } from 'react'
import { NamedButton } from './named-button.tsx'
import { colourDescription, speakerName } from './transcript-view.tsx'

// A-5: the session's speakers. Far-end speakers can be renamed inline, merged into another, and a line
// can be split off to a new speaker ("Someone Else Said This" under the transcript). The user (`me`,
// the microphone) is never renamed, merged or split: the mic is always you. Every change goes to the
// daemon; what is shown comes back through the durable events, so another window sees the same.

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e))
const editable = (s: SpeakerSummary) => s.id !== ME && s.id !== THEM

function Swatch({ s }: { s: SpeakerSummary }) {
  return (
    <GtkImage
      iconName={s.id === ME ? 'audio-input-microphone-symbolic' : 'avatar-default-symbolic'}
      cssClasses={['speaker-swatch', speakerClass(s, s.label)]}
      valign={Gtk.Align.CENTER}
      accessibleLabel={fmt(_('{speaker}, {colour}'), {
        speaker: speakerName(s.label),
        colour: colourDescription(s.colour, s.label),
      })}
    />
  )
}

function RenameEntry({
  sessionId,
  s,
  onDone,
  onError,
}: {
  sessionId: string
  s: SpeakerSummary
  onDone: () => void
  onError: (message: string) => void
}) {
  const store = useStore()
  const entry = useRef<Gtk.Entry | null>(null)
  const busy = useRef(false)
  // the entry appears because Rename was pressed: take the keyboard straight to it
  // (deferred: during the commit the entry is not mapped yet, and grab_focus is a no-op)
  useEffect(() => {
    const h = setTimeout(() => entry.current?.grabFocus(), 0)
    return () => clearTimeout(h)
  }, [])
  return (
    <GtkEntry
      ref={entry}
      text={s.label}
      valign={Gtk.Align.CENTER}
      widthChars={14}
      accessibleLabel={fmt(_('New name for {speaker}'), { speaker: s.label })}
      onActivate={(self) => {
        const label = self.getText().trim()
        if (busy.current) return
        if (!label || label === s.label) return onDone()
        busy.current = true
        store.api
          .renameSpeaker(sessionId, s.id, label)
          .then(onDone, (e: unknown) => onError(errorText(e)))
          .finally(() => {
            busy.current = false
          })
      }}
    />
  )
}

function MergeMenu({
  sessionId,
  s,
  others,
  onError,
}: {
  sessionId: string
  s: SpeakerSummary
  others: SpeakerSummary[]
  onError: (message: string) => void
}) {
  const store = useStore()
  const popover = useRef<Gtk.Popover | null>(null)
  if (!others.length) return null
  return (
    <GtkMenuButton
      iconName="insert-link-symbolic"
      valign={Gtk.Align.CENTER}
      cssClasses={['flat']}
      tooltipText={_('Merge Into Another Speaker')}
      accessibleLabel={fmt(_('Merge {speaker} into…'), { speaker: s.label })}
      popover={
        <GtkPopover ref={popover} cssClasses={['menu']}>
          <GtkBox orientation={Gtk.Orientation.VERTICAL} marginTop={6} marginBottom={6}>
            <GtkLabel
              label={_('Same person as…')}
              cssClasses={['dim-label', 'caption']}
              xalign={0}
              marginStart={12}
              marginBottom={6}
            />
            {others.map((o) => (
              <NamedButton
                key={o.id}
                text={o.label}
                name={fmt(_('Merge {speaker} into {other}'), { speaker: s.label, other: o.label })}
                cssClasses={['flat', 'menu-entry']}
                onClicked={() => {
                  popover.current?.popdown()
                  store.api.mergeSpeaker(sessionId, s.id, o.id).catch((e: unknown) => onError(errorText(e)))
                }}
              />
            ))}
          </GtkBox>
        </GtkPopover>
      }
    />
  )
}

function SpeakerRow({
  sessionId,
  s,
  others,
  onError,
}: {
  sessionId: string
  s: SpeakerSummary
  others: SpeakerSummary[]
  onError: (message: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const talk = s.segments
    ? fmt(ngettext('{n} line · {time}', '{n} lines · {time}', s.segments), {
        n: s.segments,
        time: formatDuration(s.talkMs),
      })
    : _('No lines yet')
  const role =
    s.id === ME
      ? _('You (microphone)')
      : s.id === THEM
        ? _('Far end, not yet told apart')
        : s.voiceprintId
          ? _('Recognised from an earlier meeting')
          : null
  return (
    <AdwActionRow
      title={speakerName(s.label)}
      subtitle={role ? `${role} · ${talk}` : talk}
      useMarkup={false}
      prefix={<Swatch s={s} />}
      suffix={
        editable(s) ? (
          <GtkBox spacing={6}>
            {editing ? (
              <RenameEntry sessionId={sessionId} s={s} onDone={() => setEditing(false)} onError={onError} />
            ) : (
              <GtkButton
                iconName="document-edit-symbolic"
                valign={Gtk.Align.CENTER}
                cssClasses={['flat']}
                tooltipText={_('Rename')}
                accessibleLabel={fmt(_('Rename {speaker}'), { speaker: s.label })}
                onClicked={() => setEditing(true)}
              />
            )}
            <MergeMenu sessionId={sessionId} s={s} others={others} onError={onError} />
          </GtkBox>
        ) : undefined
      }
    />
  )
}

export function SpeakersDialog({
  sessionId,
  state,
  onClosed,
}: {
  sessionId: string
  state: SpeakersFeedState
  onClosed: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const list = state.speakers.list
  const far = list.filter(editable)
  return (
    <AdwDialog title={_('Speakers')} contentWidth={520} contentHeight={480} onClosed={onClosed}>
      <AdwToolbarView topBar={<AdwHeaderBar />}>
        <GtkScrolledWindow vexpand hscrollbarPolicy={Gtk.PolicyType.NEVER}>
          <AdwClamp maximumSize={480} marginTop={6} marginBottom={24} marginStart={18} marginEnd={18}>
            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
              <GtkLabel
                label={_(
                  'Your microphone is always you. The other side is told apart by voice: name people, merge two that are the same person, or split a line off from the transcript.',
                )}
                wrap
                xalign={0}
                cssClasses={['dim-label']}
              />
              {error ? (
                <GtkLabel label={error} wrap xalign={0} cssClasses={['speakers-error']} selectable />
              ) : null}
              {state.status === 'error' ? (
                <GtkLabel label={state.error} wrap xalign={0} cssClasses={['speakers-error']} />
              ) : null}
              <GtkListBox
                cssClasses={['boxed-list']}
                selectionMode={Gtk.SelectionMode.NONE}
                accessibleLabel={_('Speakers')}
              >
                {list.map((s) => (
                  <SpeakerRow
                    key={s.id}
                    sessionId={sessionId}
                    s={s}
                    others={far.filter((o) => o.id !== s.id)}
                    onError={(m) => setError(m)}
                  />
                ))}
              </GtkListBox>
            </GtkBox>
          </AdwClamp>
        </GtkScrolledWindow>
      </AdwToolbarView>
    </AdwDialog>
  )
}

/**
 * Under the transcript, for the selected line: who said it, and — for a far-end line — "Someone Else
 * Said This", which splits it off to a new speaker. A mic line says why it cannot be changed.
 */
export function LineActions({
  sessionId,
  row,
  onError,
}: {
  sessionId: string
  row: TranscriptRow
  onError: (message: string) => void
}) {
  const store = useStore()
  const [busy, setBusy] = useState(false)
  if (row.kind !== 'segment' || !row.segmentId) return null
  const where = fmt(_('{speaker} at {time}'), {
    speaker: speakerName(row.speaker),
    time: formatOffset(row.startMs),
  })
  const mic = row.track === 'mic'
  return (
    <GtkBox spacing={12} cssClasses={['line-actions']} accessibleLabel={_('Selected line')}>
      <GtkLabel
        label={mic ? fmt(_('{line} — your microphone is always you'), { line: where }) : where}
        xalign={0}
        hexpand
        ellipsize={3 /* Pango.EllipsizeMode.END */}
        cssClasses={['dim-label']}
      />
      {mic ? null : (
        <GtkButton
          label={_('Someone Else Said This')}
          sensitive={!busy}
          accessibleDescription={fmt(_('Give the line {line} to a new speaker'), { line: where })}
          onClicked={() => {
            setBusy(true)
            store.api
              .splitSpeaker(sessionId, row.speakerId ?? THEM, [row.segmentId!])
              .catch((e: unknown) => onError(errorText(e)))
              .finally(() => setBusy(false))
          }}
        />
      )}
    </GtkBox>
  )
}
