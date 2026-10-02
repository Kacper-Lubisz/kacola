import type { AgendaMeeting, AgendaView, Session } from '@gnomeola/protocol'
import { displayTitle, formatClockTime } from '@gnomeola/ui-core/format'
import { useNow } from '@gnomeola/ui-core/hooks'
import { _, fmt } from '@gnomeola/ui-core/i18n'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useStore } from 'zustand'
import { useServices } from '../../data/services.tsx'
import {
  Button,
  Chip,
  Dialog,
  HeaderBar,
  Icon,
  IconButton,
  Menu,
  MenuItem,
} from '../../design/primitives/index.ts'
import { AgendaMenu, ImportMarkdownDialog } from '../agendas/agenda-actions.tsx'
import { meetingLive, useAgenda } from '../agendas/agenda-data.ts'
import { PresenceChip } from '../agendas/presence.tsx'
import { SendAgendaButton } from '../agendas/send.tsx'
import { ShareButton } from '../agendas/share.tsx'
import { useAgendaShare } from '../agendas/share-data.ts'
import { clock, countdown, durationLabel, readiness } from '../home/day.ts'
import { useMissingModels } from '../onboarding/onboarding-state.ts'
import { SessionDetails } from '../sessions/session-details.tsx'
import { SpeakersDialog } from '../speakers/speakers-dialog.tsx'
import {
  BackButton,
  CaptureWarning,
  MeetingHeader,
  PanelToggle,
  RecordingControls,
  RecordingPill,
} from './header.tsx'
import { joinHint, useJoin } from './join.ts'
import { LiveView } from './live-view.tsx'
import { useMeetingUi } from './meeting-ui.ts'
import { OutcomeView, ShareSummaryButton, useOutcome } from './outcome-view.tsx'
import { meetingPhase } from './phase.ts'
import { AgendaTitle, PrepView } from './prep-view.tsx'
import type { MeetingSearch } from './search-params.ts'

// A meeting is one page that changes with its phase — Prep → Live → Outcome — reached from home by its
// recording (/sessions/<id>) or by its agenda (/agendas/<id>); both resolve to the same meeting, and the
// page moves on by itself when recording starts and stops. Back always returns to Today.

/** "10:00–10:30" today, "12 Mar, 10:00–10:30" otherwise. */
export function meetingWhen(m: Pick<AgendaMeeting, 'start' | 'end'>): string {
  const start = formatClockTime(m.start)
  if (!m.end) return start
  const end = formatClockTime(m.end)
  return `${start}–${end.slice(end.lastIndexOf(' ') + 1)}`
}

export function BackHeader() {
  return <HeaderBar start={<BackButton />} />
}

export function MeetingPage({ sessionId, agendaId }: { sessionId?: string; agendaId?: string }) {
  const { queries } = useServices()
  const navigate = useNavigate()
  const search = useSearch({ strict: false }) as MeetingSearch
  const link = useQuery({ ...queries.sessionAgenda(sessionId ?? ''), enabled: Boolean(sessionId) })
  const { data: view } = useAgenda(agendaId ?? link.data ?? null)
  const sId = sessionId ?? view?.agenda.sessionId ?? null
  const { data: session } = useQuery({ ...queries.session(sId ?? ''), enabled: Boolean(sId) })
  // the Ask bar belongs to one page: leaving closes it
  useEffect(() => () => useMeetingUi.getState().setAsk(false), [])
  if (sessionId && !session) return null
  if (agendaId && !view) return null
  const phase = meetingPhase(session)
  const transcript = search.panel === 'transcript' && Boolean(session)
  const setTranscript = (open: boolean) =>
    void navigate({ to: '.', search: open ? { panel: 'transcript' } : {}, replace: true })
  if (phase === 'live' && session)
    return (
      <LivePage session={session} view={view ?? null} transcript={transcript} onTranscript={setTranscript} />
    )
  if (session)
    return (
      <OutcomePage
        session={session}
        view={view ?? null}
        transcript={transcript}
        onTranscript={setTranscript}
      />
    )
  return <PrepPage view={view!} />
}

function LivePage({
  session,
  view,
  transcript,
  onTranscript,
}: {
  session: Session
  view: AgendaView | null
  transcript: boolean
  onTranscript: (open: boolean) => void
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <HeaderBar start={<BackButton />} />
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-border-subtle px-4 pb-3 sm:px-6">
        <div className="flex min-w-0 flex-1 flex-col">
          <h1 className="m-0 type-title2 break-words text-text-primary">{displayTitle(session)}</h1>
          <CaptureWarning session={session} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PresenceChip session={session} />
          <RecordingPill session={session} />
          <RecordingControls session={session} />
        </div>
      </div>
      <LiveView session={session} view={view} transcript={transcript} onTranscript={onTranscript} />
    </div>
  )
}

function OutcomePage({
  session,
  view,
  transcript,
  onTranscript,
}: {
  session: Session
  view: AgendaView | null
  transcript: boolean
  onTranscript: (open: boolean) => void
}) {
  const data = useOutcome(session, view)
  const { data: share } = useAgendaShare(view?.agenda.id ?? '')
  const [details, setDetails] = useState(false)
  const [speakers, setSpeakers] = useState(false)
  const askOpen = useMeetingUi((s) => s.askOpen)
  const setAsk = useMeetingUi((s) => s.setAsk)
  const title = displayTitle(session)
  const start = session.startedAt ?? session.createdAt
  const end = session.endedAt
  const when = `${formatClockTime(start)}${end ? `–${clock(end)}` : ''}`
  return (
    <div className="flex h-full min-h-0 flex-col">
      <MeetingHeader
        phase="outcome"
        title={<h1 className="m-0 type-title1 break-words text-text-primary">{title}</h1>}
        meta={
          <>
            <span className="font-mono text-[13px] tabular-nums">{when}</span>
            <span>· {durationLabel(session.durationMs)}</span>
            <span className="inline-flex items-center gap-1">
              · <Icon name="success" size={14} className="text-status-success" />{' '}
              {_('saved on this computer')}
            </span>
            {session.private ? <Chip icon="lock">{_('Private')}</Chip> : null}
            {session.status === 'recovered' ? (
              <Chip icon="refresh" tone="warning">
                {_('Recovered after a crash')}
              </Chip>
            ) : null}
          </>
        }
        actions={
          <>
            <PanelToggle
              icon="ask"
              label={_('Ask about this meeting')}
              shortcut="Ctrl+K"
              pressed={askOpen}
              onPress={() => setAsk(!askOpen)}
            />
            <PanelToggle
              icon="transcript"
              label={_('Transcript')}
              shortcut="Ctrl+T"
              pressed={transcript}
              onPress={() => onTranscript(!transcript)}
            />
            <Menu
              label={_('Meeting actions')}
              trigger={<IconButton icon="more" label={_('Meeting actions')} />}
            >
              <MenuItem icon="details" onAction={() => setDetails(true)}>
                {_('Details…')}
              </MenuItem>
              <MenuItem icon="speakers" onAction={() => setSpeakers(true)}>
                {_('Speakers…')}
              </MenuItem>
            </Menu>
            {/* a shared agenda stays manageable (sync state, unshare) after the meeting */}
            {view && share?.shared ? <ShareButton view={view} status={share} /> : null}
            <ShareSummaryButton
              session={session}
              view={view}
              outcome={data.outcome}
              notes={data.notes}
              when={`${when} · ${durationLabel(session.durationMs)}`}
              title={title}
            />
          </>
        }
      />
      <OutcomeView
        session={session}
        view={view}
        data={data}
        transcript={transcript}
        onTranscript={onTranscript}
      />
      <Dialog title={_('Details')} isOpen={details} onOpenChange={setDetails} size="md">
        <SessionDetails session={session} />
      </Dialog>
      <SpeakersDialog sessionId={session.id} isOpen={speakers} onClose={() => setSpeakers(false)} />
    </div>
  )
}

function PrepPage({ view }: { view: AgendaView }) {
  const { store } = useServices()
  const connection = useStore(store, (s) => s.connection)
  const missing = useMissingModels()
  const { data: share } = useAgendaShare(view.agenda.id)
  const join = useJoin()
  const now = useNow(30_000).getTime()
  const [importing, setImporting] = useState(false)
  const m = view.agenda.meeting
  const ended = m?.end ? Date.parse(m.end) <= now : false
  const ready = readiness({ missingModels: missing, connected: connection.kind === 'live' })
  return (
    <div className="flex h-full min-h-0 flex-col">
      <MeetingHeader
        phase="prep"
        title={<AgendaTitle view={view} />}
        meta={
          <>
            {m ? (
              <>
                <span className="font-mono text-[13px] tabular-nums">{meetingWhen(m)}</span>
                {m.calendar ? <span>· {m.calendar}</span> : null}
                {m.recurring ? <span>· {_('Repeats')}</span> : null}
                {m.end && !ended ? (
                  <span>
                    ·{' '}
                    {meetingLive(view, now)
                      ? _('happening now')
                      : fmt(_('starts {when}'), { when: countdown(m.start, m.end, now) })}
                  </span>
                ) : null}
              </>
            ) : (
              <span>{_('Not linked to a calendar meeting')}</span>
            )}
            {view.agenda.private ? <Chip icon="lock">{_('Private')}</Chip> : null}
          </>
        }
        actions={
          <>
            <SendAgendaButton view={view} status={share} />
            <AgendaMenu view={view} onImport={() => setImporting(true)} />
            {m?.meetingId && !ended ? (
              <div className="flex flex-col items-end gap-1">
                <Button
                  variant="record"
                  pill
                  isDisabled={join.busy}
                  onPress={() => void join.join(m.meetingId!)}
                >
                  <span aria-hidden="true" className="size-2.5 rounded-full bg-text-on-accent" />
                  {_('Join and record')}
                </Button>
                <span className="inline-flex items-center gap-1 type-caption text-text-secondary">
                  <Icon
                    name={ready.ok ? 'success' : 'warning'}
                    size={13}
                    className={ready.ok ? 'text-status-success' : 'text-status-warning'}
                  />
                  {ready.ok ? joinHint(null) : ready.text}
                </span>
              </div>
            ) : null}
          </>
        }
      />
      <PrepView view={view} />
      {importing ? <ImportMarkdownDialog view={view} onClose={() => setImporting(false)} /> : null}
    </div>
  )
}
