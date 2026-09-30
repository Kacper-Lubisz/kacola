import type { Session } from '@gnomeola/protocol'
import { displayTitle, statusSummary } from '@gnomeola/ui-core/format'
import { useNow } from '@gnomeola/ui-core/hooks'
import { _ } from '@gnomeola/ui-core/i18n'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useStore } from 'zustand'
import { useServices } from '../../data/services.tsx'
import {
  HeaderBar,
  IconButton,
  Meter,
  TabList,
  TabPanel,
  Tabs,
  useSplitView,
} from '../../design/primitives/index.ts'
import { AskPane } from '../ask/ask-pane.tsx'
import { NotesPane } from '../notes/notes-pane.tsx'
import { TranscriptPane } from '../transcript/transcript-pane.tsx'
import type { SessionTab } from './pane.ts'
import { SessionDetails, TRACK_LABEL } from './session-details.tsx'

// One session: a heading (title, status, live input levels while it records), then the Transcript /
// Ask / Notes / Details tabs. The selected tab is in the URL (?tab=ask), so a pane, a shortcut or a
// citation can switch it by navigating. Mounted per session (key), so pane state starts fresh.

/** Live input levels, from ephemeral audio.level events (the Zustand store, never the query cache). */
function Levels({ sessionId }: { sessionId: string }) {
  const { store } = useServices()
  const levels = useStore(store, (s) => s.levels[sessionId])
  return (
    <fieldset
      aria-label={_('Levels')}
      className="m-0 flex flex-wrap items-center gap-x-6 gap-y-2 border-0 p-0"
    >
      {(['mic', 'system'] as const).map((t) => (
        <div key={t} className="flex min-w-[180px] flex-1 items-center gap-2">
          <span className="w-24 shrink-0 type-caption text-text-secondary">{TRACK_LABEL[t]()}</span>
          <Meter
            label={`${TRACK_LABEL[t]()} ${_('level')}`}
            value={levels?.[t]?.rms ?? 0}
            className="flex-1"
          />
        </div>
      ))}
    </fieldset>
  )
}

function StatusLine({ session }: { session: Session }) {
  const now = useNow(session.status === 'recording' ? 1000 : 60_000)
  return <p className="m-0 type-callout text-text-secondary">{statusSummary(session, now)}</p>
}

export function SessionPage({ sessionId, tab = 'transcript' }: { sessionId: string; tab?: SessionTab }) {
  const { queries } = useServices()
  const { data: session } = useQuery(queries.session(sessionId))
  const navigate = useNavigate()
  const { collapsed, showSidebar } = useSplitView()
  if (!session) return null
  const live = session.status === 'recording' || session.status === 'paused'
  const setTab = (t: SessionTab) =>
    void navigate({ to: '/sessions/$sessionId', params: { sessionId }, search: { tab: t }, replace: true })
  return (
    <div className="flex h-full min-h-0 flex-col bg-view">
      <HeaderBar
        controls="end"
        start={
          collapsed ? (
            <IconButton icon="back" label={_('Back')} tooltip={null} onPress={showSidebar} />
          ) : undefined
        }
        title={collapsed ? displayTitle(session) : undefined}
      />
      <Tabs selectedKey={tab} onSelectionChange={setTab} className="min-h-0 flex-1">
        <div className="mx-auto flex w-full max-w-[860px] flex-col gap-3 px-4 pt-2 pb-3 sm:px-6">
          <div className="flex flex-col gap-1">
            <h1 className="m-0 type-title1 break-words text-text-primary">{displayTitle(session)}</h1>
            <StatusLine session={session} />
          </div>
          {live ? <Levels sessionId={session.id} /> : null}
          <TabList
            label={_('Session views')}
            className="max-w-full overflow-x-auto"
            tabs={[
              { id: 'transcript', label: _('Transcript'), icon: 'transcript' },
              { id: 'ask', label: _('Ask'), icon: 'ask' },
              { id: 'notes', label: _('Notes'), icon: 'notes' },
              { id: 'details', label: _('Details'), icon: 'details' },
            ]}
          />
        </div>
        <TabPanel id="transcript" className="flex flex-col">
          <TranscriptPane session={session} />
        </TabPanel>
        <TabPanel id="ask" className="flex flex-col">
          <AskPane session={session} />
        </TabPanel>
        <TabPanel id="notes" className="flex flex-col">
          <NotesPane session={session} />
        </TabPanel>
        <TabPanel id="details" className="overflow-y-auto">
          <SessionDetails session={session} />
        </TabPanel>
      </Tabs>
    </div>
  )
}
