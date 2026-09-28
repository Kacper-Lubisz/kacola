import type { Session } from '@gnomeola/protocol'
import * as Gtk from '@gtkx/gi/gtk'
import {
  AdwActionRow,
  AdwBanner,
  AdwHeaderBar,
  AdwStatusPage,
  AdwToolbarView,
  AdwWindowTitle,
} from '@gtkx/jsx/adw'
import { GtkBox, GtkImage, GtkListBox, GtkScrolledWindow, GtkSearchEntry } from '@gtkx/jsx/gtk'
import { useState } from 'react'
import { displayTitle, sessionSubtitle } from '../data/format.ts'
import { useConnection, useNow, useSessions } from '../data/hooks.ts'
import { filterSessions } from '../data/sessions.ts'
import { RecordButton } from './record-button.tsx'

function SessionRow({ session, now }: { session: Session; now: Date }) {
  const recording = session.status === 'recording'
  return (
    <AdwActionRow
      // AdwPreferencesRow titles are Pango markup by default; session titles are user text.
      useMarkup={false}
      title={displayTitle(session)}
      subtitle={sessionSubtitle(session, now)}
      activatable
      prefix={
        <GtkImage
          iconName={recording ? 'media-record-symbolic' : 'audio-x-generic-symbolic'}
          cssClasses={recording ? ['error'] : ['dim-label']}
          accessibleLabel={recording ? 'Recording' : 'Recorded session'}
        />
      }
    />
  )
}

export type SidebarProps = {
  selectedId: string | null
  onSelect: (id: string) => void
  subtitle: string | null
}

export function Sidebar({ selectedId, onSelect, subtitle }: SidebarProps) {
  const sessions = useSessions()
  const connection = useConnection()
  const now = useNow(15_000)
  const [query, setQuery] = useState('')
  const shown = filterSessions(sessions, query)

  return (
    <AdwToolbarView
      topBar={
        <AdwHeaderBar
          start={<RecordButton onStarted={onSelect} />}
          titleWidget={<AdwWindowTitle title="gnomeola" subtitle={subtitle ?? ''} />}
        />
      }
    >
      <GtkBox orientation={Gtk.Orientation.VERTICAL}>
        <AdwBanner
          revealed={connection.kind === 'reconnecting'}
          title="Lost the connection to the daemon. Reconnecting…"
          useMarkup={false}
        />
        <GtkSearchEntry
          placeholderText="Search sessions"
          accessibleLabel="Search sessions"
          marginStart={12}
          marginEnd={12}
          marginTop={6}
          marginBottom={6}
          onSearchChanged={(self) => setQuery(self.getText())}
        />
        {shown.length === 0 ? (
          <AdwStatusPage
            vexpand
            iconName={query ? 'edit-find-symbolic' : 'audio-input-microphone-symbolic'}
            title={query ? 'No Matching Sessions' : 'No Sessions Yet'}
            description={query ? 'Try a different search.' : 'Press Record to capture your first meeting.'}
            cssClasses={['compact']}
          />
        ) : (
          <GtkScrolledWindow vexpand hscrollbarPolicy={Gtk.PolicyType.NEVER}>
            <GtkListBox
              cssClasses={['navigation-sidebar']}
              accessibleLabel="Sessions"
              selectedIndex={shown.findIndex((s) => s.id === selectedId)}
              onRowSelected={(row) => {
                if (!row) return
                const s = shown[row.getIndex()]
                if (s) onSelect(s.id)
              }}
            >
              {shown.map((s) => (
                <SessionRow key={s.id} session={s} now={now} />
              ))}
            </GtkListBox>
          </GtkScrolledWindow>
        )}
      </GtkBox>
    </AdwToolbarView>
  )
}
