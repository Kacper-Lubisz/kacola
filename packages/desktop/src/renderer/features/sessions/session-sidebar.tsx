import { displayTitle, sessionSubtitle } from '@gnomeola/ui-core/format'
import { useNow } from '@gnomeola/ui-core/hooks'
import { _, ngettext } from '@gnomeola/ui-core/i18n'
import { filterSessions } from '@gnomeola/ui-core/sessions'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { useStore } from 'zustand'
import { useServices } from '../../data/services.tsx'
import {
  Banner,
  Button,
  EmptyState,
  HeaderBar,
  Icon,
  IconButton,
  ListRow,
  Menu,
  MenuItem,
  MenuSeparator,
  type NavItem,
  NavigationList,
  RecordButton,
  SearchField,
  useSplitView,
} from '../../design/primitives/index.ts'
import { useFollow } from '../agendas/follow.tsx'
import { ComingUp } from '../agendas/upcoming.tsx'
import { ExtensionCard } from '../preferences/extension-setup.tsx'
import { useDialogs } from '../shell/dialogs.tsx'
import { useRecorder } from './recorder.ts'

// The sidebar: record control + primary menu in its header bar, status banners, the search box, the
// session list, and at its foot the top-bar extension card (GNOME only, until it is on or dismissed) (server state from ['sessions'], kept live by the EventBridge; selection from the
// route). A recording shows the red live dot and its running time.

export function PrimaryMenu() {
  const dialogs = useDialogs()
  return (
    <Menu
      label={_('Main menu')}
      trigger={<IconButton icon="menu" label={_('Main menu')} data-shortcut="menu" />}
    >
      <MenuItem icon="settings" shortcut="Ctrl+," onAction={() => dialogs.open('preferences')}>
        {_('Preferences')}
      </MenuItem>
      <MenuItem icon="speakers" onAction={() => useFollow.getState().show()}>
        {_('Follow a Shared Agenda…')}
      </MenuItem>
      <MenuItem icon="download" onAction={() => dialogs.open('onboarding')}>
        {_('Set Up Speech Models…')}
      </MenuItem>
      <MenuItem icon="keyboard" shortcut="Ctrl+?" onAction={() => dialogs.open('shortcuts')}>
        {_('Keyboard Shortcuts')}
      </MenuItem>
      <MenuSeparator />
      <MenuItem icon="info" onAction={() => dialogs.open('about')}>
        {_('About gnomeola')}
      </MenuItem>
    </Menu>
  )
}

export function SessionSidebar({ missingModels }: { missingModels: number }) {
  const { queries, store } = useServices()
  const { data } = useQuery(queries.sessions())
  const connection = useStore(store, (s) => s.connection)
  const params = useParams({ strict: false }) as { sessionId?: string }
  const navigate = useNavigate()
  const dialogs = useDialogs()
  const recorder = useRecorder()
  // collapsed, the sidebar is the whole window: its header bar carries both window-button groups
  const { collapsed } = useSplitView()
  const [query, setQuery] = useState('')
  const all = data?.ordered ?? []
  // relative times ("5 min ago") keep moving; a recording's clock ticks every second
  const now = useNow(all.some((s) => s.status === 'recording') ? 1000 : 30_000)
  const shown = filterSessions(all, query)
  const items: NavItem[] = useMemo(
    () =>
      shown.map((s) => ({
        id: s.id,
        textValue: displayTitle(s),
        content: (
          <ListRow
            title={displayTitle(s)}
            meta={sessionSubtitle(s, now)}
            live={s.status === 'recording'}
            liveLabel={_('Recording')}
            trailing={
              s.private ? (
                <span className="text-text-secondary">
                  <Icon name="lock" size={16} label={_('Private')} />
                </span>
              ) : undefined
            }
          />
        ),
      })),
    [shown, now],
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <HeaderBar
        controls={collapsed ? 'both' : 'start'}
        start={
          <RecordButton
            state={recorder.state}
            elapsedMs={recorder.elapsedMs}
            onRecord={recorder.record}
            onStop={recorder.stop}
            onPause={recorder.pause}
            onResume={recorder.resume}
            compact
          />
        }
        end={<PrimaryMenu />}
      />
      <div className="flex flex-col gap-2 px-3 pt-1 pb-2">
        {connection.kind === 'reconnecting' ? (
          <Banner tone="warning" title={_('Lost the connection to the daemon. Reconnecting…')} />
        ) : missingModels > 0 ? (
          <Banner
            tone="warning"
            title={ngettext(
              'A speech model is not downloaded yet',
              'Speech models are not downloaded yet',
              missingModels,
            )}
            action={
              <Button size="sm" onPress={() => dialogs.open('onboarding')}>
                {_('Set Up')}
              </Button>
            }
          />
        ) : null}
        <SearchField label={_('Search sessions')} value={query} onChange={setQuery} data-shortcut="search" />
      </div>
      {query ? null : <ComingUp />}
      {shown.length === 0 && data ? (
        <EmptyState
          compact
          headingLevel={2}
          icon={query ? 'search' : 'mic'}
          title={query ? _('No Matching Sessions') : _('No Sessions Yet')}
          description={
            query ? _('Try a different search.') : _('Press Record to capture your first meeting.')
          }
        />
      ) : (
        <nav aria-label={_('Session list')} className="min-h-0 flex-1 overflow-y-auto pb-2">
          <NavigationList
            label={_('Sessions')}
            items={items}
            selected={params.sessionId ?? null}
            onSelect={(id) => void navigate({ to: '/sessions/$sessionId', params: { sessionId: id } })}
          />
        </nav>
      )}
      <ExtensionCard />
    </div>
  )
}
