import type { ModelInfo, Session } from '@gnomeola/protocol'
import * as Gtk from '@gtkx/gi/gtk'
import {
  AdwActionRow,
  AdwBanner,
  AdwHeaderBar,
  AdwStatusPage,
  AdwToolbarView,
  AdwWindowTitle,
} from '@gtkx/jsx/adw'
import { GMenu } from '@gtkx/jsx/gio'
import { GtkBox, GtkImage, GtkListBox, GtkMenuButton, GtkScrolledWindow, GtkSearchEntry } from '@gtkx/jsx/gtk'
import { useState } from 'react'
import { displayTitle, sessionSubtitle } from '../data/format.ts'
import { useConnection, useNow, useSessions } from '../data/hooks.ts'
import { filterSessions } from '../data/sessions.ts'
import { _, ngettext } from '../i18n/index.ts'
import { useDialogs } from './dialogs.tsx'
import { RecordButton } from './record-button.tsx'

/** The primary menu (GNOME HIG): app-wide actions, each also reachable by a keyboard shortcut. */
function MainMenu() {
  return (
    <GtkMenuButton
      iconName="open-menu-symbolic"
      primary
      tooltipText={_('Main Menu')}
      accessibleLabel={_('Main menu')}
      menuModel={
        <GMenu
          items={[
            {
              section: [
                { label: _('Preferences'), action: 'win.preferences' },
                { label: _('Set Up Speech Models…'), action: 'win.onboarding' },
              ],
            },
            { section: [{ label: _('About gnomeola'), action: 'win.about' }] },
          ]}
        />
      }
    />
  )
}

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
          accessibleLabel={recording ? _('Recording') : _('Recorded session')}
        />
      }
    />
  )
}

export type SidebarProps = {
  selectedId: string | null
  onSelect: (id: string) => void
  subtitle: string | null
  /** Required speech models that are not downloaded (onboarding was skipped). */
  missingModels: readonly ModelInfo[]
}

export function Sidebar({ selectedId, onSelect, subtitle, missingModels }: SidebarProps) {
  const dialogs = useDialogs()
  const sessions = useSessions()
  const connection = useConnection()
  // a recording's row shows its running time, so tick every second while one records
  const now = useNow(sessions.some((s) => s.status === 'recording') ? 1000 : 15_000)
  const [query, setQuery] = useState('')
  const shown = filterSessions(sessions, query)

  return (
    <AdwToolbarView
      topBar={
        <AdwHeaderBar
          start={<RecordButton onStarted={onSelect} />}
          end={<MainMenu />}
          titleWidget={<AdwWindowTitle title="gnomeola" subtitle={subtitle ?? ''} />}
        />
      }
    >
      <GtkBox orientation={Gtk.Orientation.VERTICAL}>
        {/* Mounted only while reconnecting: an unrevealed AdwBanner stays in the accessibility tree
            as a visible, named node, which would read out a stale warning. */}
        {connection.kind === 'reconnecting' ? (
          <AdwBanner
            revealed
            title={_('Lost the connection to the daemon. Reconnecting…')}
            useMarkup={false}
          />
        ) : null}
        {connection.kind !== 'reconnecting' && missingModels.length > 0 ? (
          <AdwBanner
            revealed
            useMarkup={false}
            title={ngettext(
              'A speech model is not downloaded yet',
              'Speech models are not downloaded yet',
              missingModels.length,
            )}
            buttonLabel={_('Set Up')}
            onButtonClicked={() => dialogs.open('onboarding')}
          />
        ) : null}
        <GtkSearchEntry
          placeholderText={_('Search sessions')}
          accessibleLabel={_('Search sessions')}
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
            title={query ? _('No Matching Sessions') : _('No Sessions Yet')}
            description={
              query ? _('Try a different search.') : _('Press Record to capture your first meeting.')
            }
            cssClasses={['compact']}
          />
        ) : (
          <GtkScrolledWindow vexpand hscrollbarPolicy={Gtk.PolicyType.NEVER}>
            <GtkListBox
              cssClasses={['navigation-sidebar']}
              accessibleLabel={_('Sessions')}
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
