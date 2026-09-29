import type { Citation, Session, TrackKind } from '@gnomeola/protocol'
import * as Adw from '@gtkx/gi/adw'
import * as Gtk from '@gtkx/gi/gtk'
import {
  AdwActionRow,
  AdwClamp,
  AdwHeaderBar,
  AdwStatusPage,
  AdwToolbarView,
  AdwViewStack,
  AdwViewStackPage,
  AdwViewSwitcher,
  AdwViewSwitcherBar,
} from '@gtkx/jsx/adw'
import { GtkBox, GtkButton, GtkLabel, GtkLevelBar, GtkListBox, GtkScrolledWindow } from '@gtkx/jsx/gtk'
import { type ReactNode, useState } from 'react'
import {
  displayTitle,
  elapsedMs,
  formatClockTime,
  formatDuration,
  statusLabel,
  statusSummary,
} from '../data/format.ts'
import {
  useEvents,
  useNotesFeed,
  useNow,
  useQaFeed,
  useSpeakersFeed,
  useTranscriptFeed,
} from '../data/hooks.ts'
import { _, fmt } from '../i18n/index.ts'
import { AskPane } from './ask-pane.tsx'
import { useDialogs } from './dialogs.tsx'
import { NotesPane } from './notes-pane.tsx'
import { LineActions, SpeakersDialog } from './speakers.tsx'
import { useToast } from './toasts.tsx'
import { type TranscriptFocus, TranscriptView } from './transcript-view.tsx'

const TRACK_LABEL: Record<TrackKind, () => string> = {
  mic: () => _('Microphone'),
  system: () => _('System audio'),
}

function SectionHeading({ title }: { title: string }) {
  return (
    <GtkLabel
      label={title}
      cssClasses={['heading']}
      xalign={0}
      accessibleRole={Gtk.AccessibleRole.HEADING}
      accessibleLevel={2}
    />
  )
}

/**
 * A titled boxed list. Hand-rolled rather than AdwPreferencesGroup because the group's internal
 * GtkListBox has no accessible name (so a screen reader announces an anonymous "list"), and it
 * cannot be reached to give it one.
 */
function Section({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
      <SectionHeading title={title} />
      <GtkListBox cssClasses={['boxed-list']} selectionMode={Gtk.SelectionMode.NONE} accessibleLabel={title}>
        {children}
      </GtkListBox>
    </GtkBox>
  )
}

/** Live input levels for the recording session, fed by ephemeral audio.level events. */
function Levels({ sessionId }: { sessionId: string }) {
  const [levels, setLevels] = useState<Record<TrackKind, number>>({ mic: 0, system: 0 })
  useEvents((e) => {
    if (e.sessionId !== sessionId || e.data.type !== 'audio.level') return
    const { track, rms } = e.data
    setLevels((l) => (l[track] === rms ? l : { ...l, [track]: rms }))
  })
  return (
    <GtkBox spacing={18} accessibleLabel={_('Levels')}>
      {(['mic', 'system'] as const).map((t) => (
        <GtkBox key={t} spacing={8} hexpand>
          <GtkLabel label={TRACK_LABEL[t]()} cssClasses={['caption', 'dim-label']} />
          <GtkLevelBar
            hexpand
            valign={Gtk.Align.CENTER}
            minValue={0}
            maxValue={1}
            value={levels[t]}
            accessibleLabel={`${TRACK_LABEL[t]()} ${_('level')}`}
          />
        </GtkBox>
      ))}
    </GtkBox>
  )
}

function InfoRow({ title, value }: { title: string; value: string }) {
  return (
    <AdwActionRow
      title={title}
      subtitle={value}
      useMarkup={false}
      subtitleSelectable
      cssClasses={['property']}
    />
  )
}

function Details({ session }: { session: Session }) {
  const now = useNow(30_000)
  return (
    <GtkScrolledWindow vexpand hscrollbarPolicy={Gtk.PolicyType.NEVER}>
      <AdwClamp
        maximumSize={760}
        tighteningThreshold={560}
        marginTop={12}
        marginBottom={24}
        marginStart={12}
        marginEnd={18}
      >
        <Section title={_('Details')}>
          <InfoRow title={_('Status')} value={statusLabel(session.status)} />
          <InfoRow
            title={_('Started')}
            value={session.startedAt ? formatClockTime(session.startedAt, now) : _('Not started')}
          />
          <InfoRow title={_('Duration')} value={formatDuration(elapsedMs(session, now))} />
          <InfoRow
            title={_('Tracks')}
            value={session.tracks.map((t) => TRACK_LABEL[t.kind]()).join(', ') || _('None')}
          />
          {session.private ? (
            <InfoRow title={_('Visibility')} value={_('Private: hidden from the CLI')} />
          ) : null}
          {session.error ? <InfoRow title={_('Error')} value={session.error} /> : null}
        </Section>
      </AdwClamp>
    </GtkScrolledWindow>
  )
}

/** "Recording · 3:12", ticking every second while it records. */
function StatusLine({ session }: { session: Session }) {
  const now = useNow(session.status === 'recording' ? 1000 : 60_000)
  return <GtkLabel label={statusSummary(session, now)} cssClasses={['dim-label']} xalign={0} />
}

export type DetailPage = 'transcript' | 'notes' | 'ask' | 'details'

/**
 * One session: a heading, then Transcript / Notes / Ask / Details as an AdwViewStack with a view switcher
 * in the header bar (and at the bottom when the window is narrow). Mounted with key={session.id},
 * so every per-session feed starts fresh when the selection changes.
 */
export function SessionDetail({ session, narrow }: { session: Session; narrow: boolean }) {
  const live = session.status === 'recording' || session.status === 'paused'
  const transcript = useTranscriptFeed(session.id)
  const qa = useQaFeed(session.id)
  const notes = useNotesFeed(session.id)
  const speakers = useSpeakersFeed(session.id)
  const [speakersOpen, setSpeakersOpen] = useState(false)
  const toast = useToast()
  const dialogs = useDialogs()
  const [stack, setStack] = useState<Adw.ViewStack | null>(null)
  const [page, setPage] = useState<DetailPage>('transcript')
  const [focus, setFocus] = useState<TranscriptFocus | null>(null)

  const cite = (c: Citation) => {
    if (c.sessionId !== session.id) return
    setPage('transcript')
    setFocus((f) => ({ segmentId: c.segmentId, nonce: (f?.nonce ?? 0) + 1 }))
  }

  return (
    <AdwToolbarView
      topBar={
        <AdwHeaderBar
          titleWidget={
            narrow ? undefined : <AdwViewSwitcher stack={stack} policy={Adw.ViewSwitcherPolicy.WIDE} />
          }
          end={
            <GtkButton
              iconName="system-users-symbolic"
              tooltipText={_('Speakers')}
              accessibleLabel={_('Speakers')}
              accessibleDescription={_('Name, merge and split the people in this session')}
              onClicked={() => setSpeakersOpen(true)}
            />
          }
        />
      }
      bottomBar={narrow ? <AdwViewSwitcherBar stack={stack} reveal /> : undefined}
    >
      <GtkBox orientation={Gtk.Orientation.VERTICAL}>
        {/* same clamp as the transcript list, inset like its lines, so the heading lines up with them */}
        <AdwClamp maximumSize={760} tighteningThreshold={560} marginTop={18} marginBottom={6}>
          <GtkBox
            orientation={Gtk.Orientation.VERTICAL}
            spacing={6}
            marginStart={12}
            marginEnd={18}
            accessibleLabel={_('Session details')}
          >
            <GtkLabel
              label={displayTitle(session)}
              cssClasses={['title-1']}
              wrap
              xalign={0}
              // not `selectable`: a selectable label takes focus when the page is shown and
              // selects its whole text (seen in the collapsed-layout screenshot)
              accessibleRole={Gtk.AccessibleRole.HEADING}
              accessibleLevel={1}
            />
            <StatusLine session={session} />
            {live ? <Levels sessionId={session.id} /> : null}
          </GtkBox>
        </AdwClamp>
        <AdwViewStack
          ref={setStack}
          vexpand
          visibleChildName={page}
          onNotifyVisibleChildName={(v) => {
            if (v === 'transcript' || v === 'notes' || v === 'ask' || v === 'details') setPage(v)
          }}
        >
          {/* Each page's content sits in a stable GtkBox: a lazy AdwViewStackPage is bound to its
              child's root widget, and when that root changes (loading page → list) GTKX re-adds
              the page at the END of the stack — the view switcher order then scrambles. */}
          <AdwViewStackPage name="transcript" title={_('Transcript')} iconName="view-list-symbolic">
            <GtkBox orientation={Gtk.Orientation.VERTICAL}>
              <TranscriptView
                feed={transcript}
                live={live}
                focus={focus}
                speakers={speakers.state.speakers}
                lineActions={(row) => (
                  <LineActions
                    sessionId={session.id}
                    row={row}
                    onError={(m) => toast(fmt(_('Could not change the speaker: {reason}'), { reason: m }))}
                  />
                )}
              />
            </GtkBox>
          </AdwViewStackPage>
          <AdwViewStackPage name="notes" title={_('Notes')} iconName="document-edit-symbolic">
            <GtkBox orientation={Gtk.Orientation.VERTICAL}>
              <NotesPane
                session={session}
                state={notes.state}
                feed={notes.feed}
                onOpenPreferences={() => dialogs.open('preferences')}
              />
            </GtkBox>
          </AdwViewStackPage>
          <AdwViewStackPage name="ask" title={_('Ask')} iconName="chat-message-new-symbolic">
            <GtkBox orientation={Gtk.Orientation.VERTICAL}>
              <AskPane
                state={qa.state}
                feed={qa.feed}
                onCite={cite}
                onOpenPreferences={() => dialogs.open('preferences')}
              />
            </GtkBox>
          </AdwViewStackPage>
          <AdwViewStackPage name="details" title={_('Details')} iconName="info-outline-symbolic">
            <GtkBox orientation={Gtk.Orientation.VERTICAL}>
              <Details session={session} />
            </GtkBox>
          </AdwViewStackPage>
        </AdwViewStack>
        {speakersOpen ? (
          <SpeakersDialog
            sessionId={session.id}
            state={speakers.state}
            onClosed={() => setSpeakersOpen(false)}
          />
        ) : null}
      </GtkBox>
    </AdwToolbarView>
  )
}

export function NothingSelected() {
  return (
    <AdwToolbarView topBar={<AdwHeaderBar showTitle={false} />}>
      <AdwStatusPage
        vexpand
        iconName="audio-input-microphone-symbolic"
        title={_('No Session Selected')}
        description={_('Pick a session in the sidebar, or press Record to start one.')}
      />
    </AdwToolbarView>
  )
}
