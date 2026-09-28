import type { Session, TrackKind } from '@gnomeola/protocol'
import * as Gtk from '@gtkx/gi/gtk'
import {
  AdwActionRow,
  AdwClamp,
  AdwHeaderBar,
  AdwPreferencesGroup,
  AdwStatusPage,
  AdwToolbarView,
} from '@gtkx/jsx/adw'
import { GtkBox, GtkLabel, GtkLevelBar, GtkScrolledWindow } from '@gtkx/jsx/gtk'
import { useState } from 'react'
import { displayTitle, formatClockTime, formatDuration, statusLabel, statusSummary } from '../data/format.ts'
import { useEvents, useNow } from '../data/hooks.ts'

const TRACK_LABEL: Record<TrackKind, string> = { mic: 'Microphone', system: 'System audio' }

/** Live input levels for the recording session, fed by ephemeral audio.level events. */
function Levels({ sessionId }: { sessionId: string }) {
  const [levels, setLevels] = useState<Record<TrackKind, number>>({ mic: 0, system: 0 })
  useEvents((e) => {
    if (e.sessionId !== sessionId || e.data.type !== 'audio.level') return
    const { track, rms } = e.data
    setLevels((l) => (l[track] === rms ? l : { ...l, [track]: rms }))
  })
  return (
    <AdwPreferencesGroup title="Levels">
      {(['mic', 'system'] as const).map((t) => (
        <AdwActionRow key={t} title={TRACK_LABEL[t]} useMarkup={false}>
          {/* AdwActionRow children land in its suffix area */}
          <GtkLevelBar
            valign={Gtk.Align.CENTER}
            widthRequest={160}
            minValue={0}
            maxValue={1}
            value={levels[t]}
            accessibleLabel={`${TRACK_LABEL[t]} level`}
          />
        </AdwActionRow>
      ))}
    </AdwPreferencesGroup>
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

export function SessionDetail({ session }: { session: Session }) {
  const now = useNow(30_000)
  const live = session.status === 'recording' || session.status === 'paused'
  return (
    <AdwToolbarView topBar={<AdwHeaderBar />}>
      <GtkScrolledWindow vexpand hscrollbarPolicy={Gtk.PolicyType.NEVER}>
        <AdwClamp maximumSize={720} marginTop={24} marginBottom={24} marginStart={12} marginEnd={12}>
          <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={24} accessibleLabel="Session details">
            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={6}>
              <GtkLabel
                label={displayTitle(session)}
                cssClasses={['title-1']}
                wrap
                xalign={0}
                selectable
                accessibleRole={Gtk.AccessibleRole.HEADING}
                accessibleLevel={1}
              />
              <GtkLabel label={statusSummary(session)} cssClasses={['dim-label']} xalign={0} />
            </GtkBox>
            {live ? <Levels sessionId={session.id} /> : null}
            <AdwPreferencesGroup title="Details">
              <InfoRow title="Status" value={statusLabel(session.status)} />
              <InfoRow
                title="Started"
                value={session.startedAt ? formatClockTime(session.startedAt, now) : 'Not started'}
              />
              <InfoRow title="Duration" value={formatDuration(session.durationMs)} />
              <InfoRow
                title="Tracks"
                value={session.tracks.map((t) => TRACK_LABEL[t.kind]).join(', ') || 'None'}
              />
              {session.private ? <InfoRow title="Visibility" value="Private: hidden from the CLI" /> : null}
              {session.error ? <InfoRow title="Error" value={session.error} /> : null}
            </AdwPreferencesGroup>
            <AdwPreferencesGroup title="Transcript">
              <GtkLabel
                label="The transcript will appear here."
                cssClasses={['dim-label']}
                xalign={0}
                marginTop={6}
              />
            </AdwPreferencesGroup>
          </GtkBox>
        </AdwClamp>
      </GtkScrolledWindow>
    </AdwToolbarView>
  )
}

export function NothingSelected() {
  return (
    <AdwToolbarView topBar={<AdwHeaderBar showTitle={false} />}>
      <AdwStatusPage
        vexpand
        iconName="audio-input-microphone-symbolic"
        title="No Session Selected"
        description="Pick a session in the sidebar, or press Record to start one."
      />
    </AdwToolbarView>
  )
}
