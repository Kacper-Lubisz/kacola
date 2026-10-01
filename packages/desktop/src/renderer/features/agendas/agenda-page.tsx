import type { AgendaMeeting, AgendaView } from '@gnomeola/protocol'
import { formatClockTime } from '@gnomeola/ui-core/format'
import { useNow } from '@gnomeola/ui-core/hooks'
import { _, fmt, ngettext } from '@gnomeola/ui-core/i18n'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useServices } from '../../data/services.tsx'
import {
  Banner,
  Button,
  Chip,
  HeaderBar,
  IconButton,
  TabList,
  TabPanel,
  Tabs,
  TextField,
  useSplitView,
  useToast,
} from '../../design/primitives/index.ts'
import { AgendaMenu, ImportMarkdownDialog, InviteButton } from './agenda-actions.tsx'
import { meetingLive, refusal, useAgenda, useAgendaMutation } from './agenda-data.ts'
import { GoalsEditor, ItemsEditor } from './agenda-editor.tsx'
import { ContextTab } from './context-cards.tsx'
import { updateAgendaMutation } from './mutations.ts'
import { PlanWithClaudeDialog } from './plan-with-claude.tsx'
import { ShareBanner, ShareButton, SharingTab } from './share.tsx'
import { useAgendaShare } from './share-data.ts'

// One agenda (#/agendas/<id>): for a calendar meeting before it happens, or for a recording. The title,
// when the meeting is, "Join and record" while it is on, the Items tab (goals, items) and the Context tab
// (private / shared cards), Plan with Claude, Add link to invite, markdown in and out.

export type AgendaTab = 'items' | 'context' | 'sharing'
export const AGENDA_TABS: readonly AgendaTab[] = ['items', 'context', 'sharing']

/** "10:00–10:30" today, "12 Mar, 10:00–10:30" otherwise. */
export function meetingWhen(m: AgendaMeeting): string {
  const start = formatClockTime(m.start)
  if (!m.end) return start
  const end = formatClockTime(m.end)
  // the end's date repeats the start's: show only its time
  return `${start}–${end.slice(end.lastIndexOf(' ') + 1)}`
}

function Title({ view }: { view: AgendaView }) {
  const rename = useAgendaMutation(updateAgendaMutation, _('Could not rename the agenda'))
  const [editing, setEditing] = useState<string | null>(null)
  const commit = () => {
    const t = editing?.trim()
    if (t && t !== view.agenda.title) rename.mutate({ agendaId: view.agenda.id, patch: { title: t } })
    setEditing(null)
  }
  if (editing !== null)
    return (
      <TextField
        label={_('Agenda title')}
        labelHidden
        value={editing}
        onChange={setEditing}
        autoFocus
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') setEditing(null)
        }}
      />
    )
  return (
    <div className="flex items-start gap-1">
      <h1 className="m-0 min-w-0 flex-1 type-title1 break-words text-text-primary">{view.agenda.title}</h1>
      <IconButton icon="edit" label={_('Rename agenda')} onPress={() => setEditing(view.agenda.title)} />
    </div>
  )
}

/** While the meeting is on and nothing records it yet: Join and record. */
function LiveMeetingBanner({ view }: { view: AgendaView }) {
  const { api, bridge } = useServices()
  const toast = useToast()
  const navigate = useNavigate()
  const now = useNow(30_000)
  const [busy, setBusy] = useState(false)
  const m = view.agenda.meeting
  if (!m || !meetingLive(view, now.getTime())) return null
  if (view.agenda.sessionId)
    return (
      <Banner
        tone="info"
        title={_('This meeting is being recorded')}
        action={
          <Button
            size="sm"
            onPress={() =>
              void navigate({
                to: '/sessions/$sessionId',
                params: { sessionId: view.agenda.sessionId! },
                search: { tab: 'agenda' },
              })
            }
          >
            {_('Open Live Agenda')}
          </Button>
        }
      />
    )
  const join = async () => {
    if (!m.meetingId) return
    setBusy(true)
    try {
      const r = await api.call('joinMeeting', { params: { id: m.meetingId }, body: {} })
      if (r.joinUrl) void bridge.openExternal(r.joinUrl)
      void navigate({
        to: '/sessions/$sessionId',
        params: { sessionId: r.session.id },
        search: { tab: 'agenda' },
      })
    } catch (err) {
      toast(fmt(_('Could not start recording: {reason}'), { reason: refusal(err) }), { tone: 'error' })
    } finally {
      setBusy(false)
    }
  }
  return (
    <Banner
      tone="info"
      title={_('This meeting is happening now')}
      action={
        <Button
          size="sm"
          variant="primary"
          icon="record"
          onPress={() => void join()}
          isDisabled={busy || !m.meetingId}
        >
          {_('Join and Record')}
        </Button>
      }
    />
  )
}

export function AgendaPage({ agendaId, tab = 'items' }: { agendaId: string; tab?: AgendaTab }) {
  const { data: view } = useAgenda(agendaId)
  const { data: share } = useAgendaShare(agendaId)
  const navigate = useNavigate()
  const { collapsed, showSidebar } = useSplitView()
  const [planning, setPlanning] = useState(false)
  const [importing, setImporting] = useState(false)
  if (!view) return null
  const m = view.agenda.meeting
  const carried = view.items.filter((i) => i.carriedFrom).length
  // the Sharing tab exists while the agenda is shared or followed (and for a copy whose owner stopped)
  const sharing = Boolean(share && (share.shared || share.state === 'revoked'))
  const current: AgendaTab = tab === 'sharing' && !sharing ? 'items' : tab
  const setTab = (t: AgendaTab) =>
    void navigate({ to: '/agendas/$agendaId', params: { agendaId }, search: { tab: t }, replace: true })
  return (
    <div className="flex h-full min-h-0 flex-col bg-view">
      <HeaderBar
        controls={collapsed ? 'both' : 'end'}
        start={
          collapsed ? (
            <IconButton icon="back" label={_('Back')} tooltip={null} onPress={showSidebar} />
          ) : undefined
        }
        title={collapsed ? view.agenda.title : undefined}
      />
      <Tabs selectedKey={current} onSelectionChange={setTab} className="min-h-0 flex-1">
        <div className="mx-auto flex w-full max-w-[860px] flex-col gap-3 px-4 pt-2 pb-3 sm:px-6">
          <div className="flex flex-col gap-1">
            <p className="m-0 type-overline text-text-secondary">{_('Agenda')}</p>
            <Title view={view} />
            <p className="m-0 flex flex-wrap items-center gap-x-2 type-callout text-text-secondary">
              {m ? (
                <>
                  <span>{meetingWhen(m)}</span>
                  {m.calendar ? <span>· {m.calendar}</span> : null}
                  {m.recurring ? <span>· {_('Repeats')}</span> : null}
                </>
              ) : (
                <span>{_('Not linked to a calendar meeting')}</span>
              )}
              {view.agenda.private ? <Chip icon="lock">{_('Private')}</Chip> : null}
            </p>
          </div>
          <LiveMeetingBanner view={view} />
          <ShareBanner view={view} status={share} />
          {carried ? (
            <p className="m-0 flex items-center gap-1 type-callout text-text-secondary">
              <Chip icon="carry">
                {fmt(ngettext('{n} item carried over', '{n} items carried over', carried), { n: carried })}
              </Chip>
              <span>{_('from the last meeting')}</span>
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" icon="enhance" onPress={() => setPlanning(true)}>
              {_('Plan with Claude')}
            </Button>
            <InviteButton view={view} />
            <ShareButton view={view} status={share} />
            {view.agenda.sessionId && !meetingLive(view, Date.now()) ? (
              <Button
                icon="transcript"
                onPress={() =>
                  void navigate({
                    to: '/sessions/$sessionId',
                    params: { sessionId: view.agenda.sessionId! },
                    search: { tab: 'agenda' },
                  })
                }
              >
                {_('Open Recording')}
              </Button>
            ) : null}
            <span className="flex-1" />
            <AgendaMenu view={view} onImport={() => setImporting(true)} />
          </div>
          <TabList
            label={_('Agenda views')}
            tabs={[
              { id: 'items', label: _('Items'), icon: 'agenda' },
              { id: 'context', label: _('Context'), icon: 'document' },
              ...(sharing
                ? [{ id: 'sharing' as const, label: _('Sharing'), icon: 'speakers' as const }]
                : []),
            ]}
          />
        </div>
        <TabPanel id="items" className="overflow-y-auto">
          <div className="mx-auto flex w-full max-w-[860px] flex-col gap-6 px-4 pb-8 sm:px-6">
            <GoalsEditor view={view} />
            <ItemsEditor view={view} />
          </div>
        </TabPanel>
        <TabPanel id="context" className="overflow-y-auto">
          <div className="mx-auto w-full max-w-[860px] px-4 pb-8 sm:px-6">
            <ContextTab view={view} />
          </div>
        </TabPanel>
        {sharing && share ? (
          <TabPanel id="sharing" className="overflow-y-auto">
            <div className="mx-auto w-full max-w-[860px] px-4 pb-8 sm:px-6">
              <SharingTab view={view} status={share} />
            </div>
          </TabPanel>
        ) : null}
      </Tabs>
      {planning ? <PlanWithClaudeDialog view={view} onClose={() => setPlanning(false)} /> : null}
      {importing ? <ImportMarkdownDialog view={view} onClose={() => setImporting(false)} /> : null}
    </div>
  )
}
