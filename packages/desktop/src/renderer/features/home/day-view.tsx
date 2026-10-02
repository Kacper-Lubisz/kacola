import type { Session } from '@gnomeola/protocol'
import { displayTitle, elapsedMs, formatDuration } from '@gnomeola/ui-core/format'
import { useNow } from '@gnomeola/ui-core/hooks'
import { _, fmt, ngettext } from '@gnomeola/ui-core/i18n'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { type ReactNode, useState } from 'react'
import { useStore } from 'zustand'
import { useServices } from '../../data/services.tsx'
import { Button, Card, Icon, type IconName } from '../../design/primitives/index.ts'
import { joinHint, providerLabel, useJoin, useOpenPrep } from '../meeting/join.ts'
import { useMissingModels } from '../onboarding/onboarding-state.ts'
import { useRecorder } from '../sessions/recorder.ts'
import { useDialogs } from '../shell/dialogs.tsx'
import {
  buildDay,
  clock,
  countdown,
  type DayEntry,
  durationLabel,
  type EarlierDay,
  longDate,
  readiness,
} from './day.ts'

// Home's day: a recording under way pinned on top, today's meetings and recordings on one time rail
// with the next unrecorded meeting expanded (countdown, whether recording will work, its agenda, Join
// and record, Open prep), then earlier days with their lengths written out ("12 min") and labelled
// Private / Recovered markers.

const EARLIER_PAGE = 7
const startOfToday = (now: number) => {
  const d = new Date(now)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

export function DayView() {
  const { queries } = useServices()
  const nowDate = useNow(30_000)
  const now = nowDate.getTime()
  const sessions = useQuery({ ...queries.sessions(), enabled: false }).data?.ordered ?? []
  const calendar = useQuery(queries.calendar())
  const calOn = calendar.data?.state === 'ok'
  const meetings = useQuery({ ...queries.day(startOfToday(now)), enabled: calOn }).data?.meetings ?? []
  const agendas = useQuery(queries.agendas()).data ?? []
  const day = buildDay(sessions, calOn ? meetings : [], agendas, now)
  const [earlierShown, setEarlierShown] = useState(EARLIER_PAGE)
  return (
    <>
      {day.live ? <LiveCard session={day.live} /> : null}
      <section aria-labelledby="day-today" className="flex flex-col gap-2">
        <h2 id="day-today" className="m-0 flex items-baseline gap-3 type-title2 text-text-primary">
          {_('Today')}
          <span className="type-callout font-normal text-text-secondary">{longDate(now)}</span>
        </h2>
        {day.today.length ? (
          <ol aria-label={_('Today’s meetings')} className="relative m-0 flex list-none flex-col p-0">
            <Rail />
            {day.today.map((e, i) => (
              <li key={e.key} className="relative">
                {i > 0 && day.today[i - 1]!.at <= now && e.at > now && !day.live ? (
                  <NowLine now={now} />
                ) : null}
                {e.key === day.next && e.kind === 'meeting' ? (
                  <NextMeeting entry={e} now={now} />
                ) : (
                  <EntryRow entry={e} now={now} />
                )}
              </li>
            ))}
          </ol>
        ) : (
          <p className="m-0 type-callout text-text-secondary">
            {calOn
              ? _('Nothing on your calendar today. Record now captures a call as it happens.')
              : _('Nothing recorded today. Record now captures a call as it happens.')}
          </p>
        )}
      </section>
      {day.earlier.slice(0, earlierShown).map((d) => (
        <EarlierSection key={d.key} day={d} />
      ))}
      {day.earlier.length > earlierShown ? (
        <div>
          <Button variant="ghost" onPress={() => setEarlierShown((n) => n + EARLIER_PAGE)}>
            {_('Show earlier days')}
          </Button>
        </div>
      ) : null}
    </>
  )
}

/** The rail the day's nodes sit on. */
function Rail() {
  return <span aria-hidden="true" className="absolute top-3 bottom-3 left-[67px] w-px bg-border-default" />
}

function NowLine({ now }: { now: number }) {
  return (
    <div aria-hidden="true" className="relative flex h-5 items-center">
      <span className="w-[56px] shrink-0 text-right">
        <span className="rounded-xs bg-ink-primary px-1 font-mono text-[11px] leading-4 text-text-on-ink">
          {clock(new Date(now).toISOString())}
        </span>
      </span>
      <span className="ml-2 h-px flex-1 bg-text-primary opacity-60" />
    </div>
  )
}

type NodeKind = 'done' | 'next' | 'future' | 'live' | 'missed'

function Node({ kind }: { kind: NodeKind }) {
  const base = 'relative z-[1] flex size-[17px] items-center justify-center rounded-full border bg-bg-window'
  if (kind === 'done')
    return (
      <span className={`${base} border-border-strong text-text-secondary`}>
        <Icon name="check" size={11} />
      </span>
    )
  if (kind === 'next')
    return (
      <span className={`${base} border-text-primary`}>
        <span className="size-[7px] rounded-full bg-text-primary" />
      </span>
    )
  if (kind === 'live')
    return (
      <span className={`${base} border-accent-record`}>
        <span className="size-[7px] rounded-full bg-accent-record" />
      </span>
    )
  return <span className={`${base} border-border-default`} />
}

/** One row: time · node · title (and a quiet meta) · markers; pressing it opens the meeting. */
function Row({
  time,
  node,
  title,
  meta,
  trailing,
  onPress,
  label,
  quiet,
}: {
  time: string
  node: NodeKind
  title: string
  meta?: ReactNode
  trailing?: ReactNode
  onPress: () => void
  label: string
  quiet?: boolean
}) {
  return (
    <div className="flex min-h-12 items-center">
      <button
        type="button"
        onClick={onPress}
        aria-label={label}
        className="group flex min-w-0 flex-1 cursor-default items-center gap-2 rounded-md py-2 pr-2 text-left outline-none focus-visible:outline-(length:--focus-ring-width) focus-visible:outline-solid focus-visible:outline-(--focus-ring-color) hover:bg-bg-hover"
      >
        <span className="w-[56px] shrink-0 text-right font-mono text-[13px] text-text-secondary tabular-nums">
          {time}
        </span>
        <span className="flex w-[22px] shrink-0 justify-center">
          <Node kind={node} />
        </span>
        <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2.5">
          <span
            className={`truncate type-body-strong ${quiet ? 'text-text-secondary' : 'text-text-primary'}`}
          >
            {title}
          </span>
          {meta ? <span className="type-callout text-text-secondary">{meta}</span> : null}
        </span>
        {trailing ? <span className="flex shrink-0 items-center gap-2">{trailing}</span> : null}
      </button>
    </div>
  )
}

/** A labelled marker (never colour alone): Private, Recovered after a crash, Recording failed. */
function Marker({ icon, tone, children }: { icon: IconName; tone: 'neutral' | 'warning'; children: string }) {
  return (
    <span
      className={`inline-flex h-6 items-center gap-1.5 rounded-pill px-2 type-caption ${
        tone === 'warning'
          ? 'bg-[color-mix(in_srgb,var(--k-color-status-warning)_14%,transparent)] text-text-primary'
          : 'bg-bg-sidebar text-text-secondary'
      }`}
    >
      <Icon name={icon} size={13} className={tone === 'warning' ? 'text-status-warning-text' : ''} />
      {children}
    </span>
  )
}

function SessionMarkers({ s }: { s: Session }) {
  return (
    <>
      {s.private ? (
        <Marker icon="lock" tone="neutral">
          {_('Private')}
        </Marker>
      ) : null}
      {s.status === 'recovered' ? (
        <Marker icon="refresh" tone="warning">
          {_('Recovered after a crash')}
        </Marker>
      ) : null}
      {s.status === 'failed' ? (
        <Marker icon="alert" tone="warning">
          {_('Recording failed')}
        </Marker>
      ) : null}
    </>
  )
}

const recordedMeta = (s: Session) =>
  s.status === 'recording' || s.status === 'paused' ? _('recording now') : durationLabel(s.durationMs)

function EntryRow({ entry: e, now }: { entry: DayEntry; now: number }) {
  const navigate = useNavigate()
  const prep = useOpenPrep()
  const openSession = (id: string) => void navigate({ to: '/sessions/$sessionId', params: { sessionId: id } })
  if (e.kind === 'recording') {
    const s = e.session
    const title = displayTitle(s)
    return (
      <Row
        time={clock(s.startedAt ?? s.createdAt)}
        node={s.status === 'recording' || s.status === 'paused' ? 'live' : 'done'}
        title={title}
        meta={recordedMeta(s)}
        trailing={<SessionMarkers s={s} />}
        label={fmt(_('{title}, {time}'), { title, time: clock(s.startedAt ?? s.createdAt) })}
        onPress={() => openSession(s.id)}
      />
    )
  }
  const m = e.meeting
  const s = e.session
  const ended = Date.parse(m.end) <= now
  const time = clock(m.start)
  if (s)
    return (
      <Row
        time={time}
        node={s.status === 'recording' || s.status === 'paused' ? 'live' : 'done'}
        title={m.title}
        meta={recordedMeta(s)}
        trailing={<SessionMarkers s={s} />}
        label={fmt(_('{title}, {time}'), { title: m.title, time })}
        onPress={() => openSession(s.id)}
      />
    )
  const provider = providerLabel(m.join?.provider)
  return (
    <Row
      time={time}
      node={ended ? 'missed' : 'future'}
      title={m.title}
      quiet={ended}
      meta={ended ? _('not recorded') : provider || undefined}
      trailing={
        ended ? null : e.agenda ? (
          <span className="type-caption text-text-secondary">
            {fmt(ngettext('Agenda · {n} item', 'Agenda · {n} items', e.agenda.counts.items), {
              n: e.agenda.counts.items,
            })}
          </span>
        ) : (
          <span className="type-caption text-text-secondary">{_('No agenda')}</span>
        )
      }
      label={fmt(_('{title}, {time}'), { title: m.title, time })}
      onPress={() => void prep.open(m, e.agenda?.id)}
    />
  )
}

/** The next meeting, expanded in place: countdown, readiness, agenda, Join and record, Open prep. */
function NextMeeting({ entry: e, now }: { entry: Extract<DayEntry, { kind: 'meeting' }>; now: number }) {
  const { store } = useServices()
  const connection = useStore(store, (s) => s.connection)
  const missing = useMissingModels()
  const dialogs = useDialogs()
  const join = useJoin()
  const prep = useOpenPrep()
  const m = e.meeting
  const ready = readiness({ missingModels: missing, connected: connection.kind === 'live' })
  const provider = providerLabel(m.join?.provider)
  const started = Date.parse(m.start) <= now
  const left = countdown(m.start, m.end, now)
  const items = e.agenda?.counts.items ?? 0
  return (
    <div className="flex items-start py-2">
      <span className="w-[56px] shrink-0 pt-4 text-right font-mono text-[13px] font-semibold text-text-primary tabular-nums">
        {clock(m.start)}
      </span>
      <span className="flex w-[22px] shrink-0 justify-center pt-4">
        <Node kind="next" />
      </span>
      <Card
        as="section"
        aria-label={fmt(_('Next: {title}'), { title: m.title })}
        className="ml-2 flex min-w-0 flex-1 flex-col gap-4 p-5"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1">
            <h3 className="m-0 type-title1 break-words text-text-primary">{m.title}</h3>
            <p className="m-0 flex flex-wrap items-center gap-x-2 type-callout text-text-secondary">
              <span className="font-mono text-[13px] tabular-nums">
                {clock(m.start)}–{clock(m.end)}
              </span>
              {provider ? <span>· {provider}</span> : null}
              {m.attendees > 1 ? (
                <span>· {fmt(ngettext('{n} person', '{n} people', m.attendees), { n: m.attendees })}</span>
              ) : null}
            </p>
          </div>
          <p className="m-0 flex flex-col items-end">
            <span className="type-caption text-text-secondary">{started ? _('started') : _('starts')}</span>
            <span className="font-mono text-[28px] leading-8 text-text-primary tabular-nums">{left}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-md bg-bg-sidebar px-3 py-2 type-callout">
          <span className="inline-flex items-center gap-1.5">
            <Icon name="agenda" size={16} className="text-text-secondary" />
            {e.agenda ? (
              <>
                <span className="font-semibold text-text-primary">{_('Agenda ready')}</span>
                <span className="text-text-secondary">
                  {fmt(ngettext('{n} item', '{n} items', items), { n: items })}
                </span>
              </>
            ) : (
              <span className="text-text-secondary">{_('No agenda yet')}</span>
            )}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Icon
              name={ready.ok ? 'success' : 'warning'}
              size={16}
              className={ready.ok ? 'text-status-success' : 'text-status-warning'}
            />
            <span className="font-semibold text-text-primary">{ready.text}</span>
            {!ready.ok && ready.fix === 'models' ? (
              <Button size="sm" variant="link" onPress={() => dialogs.open('onboarding')}>
                {_('Set up')}
              </Button>
            ) : null}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            onPress={() => void prep.open(m, e.agenda?.id)}
            isDisabled={prep.busy === m.id}
            aria-label={fmt(e.agenda ? _('Open prep for {title}') : _('Plan {title}'), { title: m.title })}
          >
            {e.agenda ? _('Open prep') : _('Plan an agenda')}
          </Button>
          <span className="flex-1" />
          <span className="hidden type-callout text-text-secondary sm:inline">
            {joinHint(m.join?.provider)}
          </span>
          <Button
            variant="record"
            pill
            icon="record"
            isDisabled={join.busy}
            onPress={() => void join.join(m.id)}
            aria-label={fmt(_('Join and record {title}'), { title: m.title })}
          >
            {_('Join and record')}
          </Button>
        </div>
      </Card>
    </div>
  )
}

/** A recording under way, pinned on top of the day: what it is, its clock, Open and Stop. */
function LiveCard({ session: s }: { session: Session }) {
  const navigate = useNavigate()
  const recorder = useRecorder()
  const now = useNow(s.status === 'recording' ? 1000 : 60_000)
  const recording = s.status === 'recording'
  const title = displayTitle(s)
  return (
    <Card
      as="section"
      aria-label={_('Recording now')}
      className="flex flex-wrap items-center gap-3 px-4 py-3"
    >
      <span
        role="timer"
        aria-live="off"
        aria-label={fmt(recording ? _('Recording, {time}') : _('Paused, {time}'), {
          time: formatDuration(elapsedMs(s, now)),
        })}
        className="inline-flex items-center gap-2"
      >
        <span
          aria-hidden="true"
          className={`size-2.5 rounded-full ${recording ? 'bg-accent-record' : 'bg-text-tertiary'}`}
        />
        <span className={`type-body-strong ${recording ? 'text-accent-record-text' : 'text-text-secondary'}`}>
          {recording ? _('Recording') : _('Paused')}
        </span>
        <span className="type-mono text-text-primary">{formatDuration(elapsedMs(s, now))}</span>
      </span>
      <span className="min-w-0 flex-1 truncate type-body-strong text-text-primary">{title}</span>
      <Button
        onPress={() => void navigate({ to: '/sessions/$sessionId', params: { sessionId: s.id } })}
        aria-label={fmt(_('Open {title}'), { title })}
      >
        {_('Open')}
      </Button>
      <Button
        variant="primary"
        icon="stop"
        onPress={recorder.stop}
        isDisabled={recorder.state === 'stopping'}
      >
        {recorder.state === 'stopping' ? _('Stopping…') : _('Stop')}
      </Button>
    </Card>
  )
}

function EarlierSection({ day }: { day: EarlierDay }) {
  const navigate = useNavigate()
  const id = `day-${day.key}`
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <h2 id={id} className="m-0 flex items-baseline gap-3 type-title2 text-text-primary">
        {day.label}
        {day.label !== day.date ? (
          <span className="type-callout font-normal text-text-secondary">{day.date}</span>
        ) : null}
      </h2>
      <ol aria-label={day.label} className="relative m-0 flex list-none flex-col p-0">
        <Rail />
        {day.sessions.map((s) => {
          const title = displayTitle(s)
          const time = clock(s.startedAt ?? s.createdAt)
          return (
            <li key={s.id}>
              <Row
                time={time}
                node="done"
                title={title}
                meta={durationLabel(s.durationMs)}
                trailing={<SessionMarkers s={s} />}
                label={fmt(_('{title}, {day} {time}'), { title, day: day.label, time })}
                onPress={() => void navigate({ to: '/sessions/$sessionId', params: { sessionId: s.id } })}
              />
            </li>
          )
        })}
      </ol>
    </section>
  )
}
