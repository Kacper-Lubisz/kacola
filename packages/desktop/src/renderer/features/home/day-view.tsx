import type { Meeting, Session } from '@gnomeola/protocol'
import { displayTitle, elapsedMs, formatDuration } from '@gnomeola/ui-core/format'
import { useNow } from '@gnomeola/ui-core/hooks'
import { _, fmt, ngettext } from '@gnomeola/ui-core/i18n'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { type ReactNode, useState } from 'react'
import { useStore } from 'zustand'
import { useServices } from '../../data/services.tsx'
import { Button, Card, Icon, IconButton, type IconName } from '../../design/primitives/index.ts'
import { MetaDot } from '../meeting/header.tsx'
import { providerLabel, useJoin, useOpenPrep } from '../meeting/join.ts'
import { useMissingModels } from '../onboarding/onboarding-state.ts'
import { useRecorder } from '../sessions/recorder.ts'
import { useDialogs } from '../shell/dialogs.tsx'
import { calendarNotice, useCalendarRefresh } from './calendar-refresh.ts'
import {
  buildDay,
  clock,
  countdown,
  type DayEntry,
  durationLabel,
  type EarlierDay,
  isShortRecording,
  longDate,
  readiness,
} from './day.ts'

// Home's day, latest first: today runs from what is still to come at the top, down through now, to this
// morning; earlier days follow, each latest first too. What is under way — a recording, a meeting
// whose time has come, recorded or not — sits in its own place, highlighted, with its controls, and
// marks now; when nothing is, a thin now line does. The soonest meeting still to come is expanded
// (when nothing is under way, so two big cards never compete). All-day events are a quiet strip above.

const EARLIER_PAGE = 7
const startOfToday = (now: number) => {
  const d = new Date(now)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

// The rail's geometry, shared by every row: a 56 px time column, 8 px, a 22 px node column (centred on
// the rail), 8 px, the content.
const TIME = 'w-14 shrink-0 text-right font-mono text-[13px] tabular-nums'
const NODE = 'flex w-[22px] shrink-0 justify-center'

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
  // only the first meeting under way says what would stop recording (overlapping ones don't repeat it)
  const sayReadiness = day.today.find((e) => e.current && e.kind === 'meeting' && !e.session)?.key
  const [earlierShown, setEarlierShown] = useState(EARLIER_PAGE)
  const line = (key: string) => (
    <li key={key} aria-hidden="true" className="relative">
      <NowLine now={now} />
    </li>
  )
  return (
    <>
      <section aria-labelledby="day-today" className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h2 id="day-today" className="m-0 flex items-baseline gap-3 type-title2 text-text-primary">
            {_('Today')}
            <span className="type-callout font-normal text-text-secondary">{longDate(now)}</span>
          </h2>
          {calendar.data && calendar.data.state !== 'off' ? <RefreshCalendarButton /> : null}
        </div>
        <CalendarNoticeLine />
        {day.allDay.length ? <AllDayStrip meetings={day.allDay} /> : null}
        {day.today.length ? (
          <ol aria-label={_('Today’s meetings')} className="relative m-0 flex list-none flex-col p-0">
            <Rail />
            {day.today.flatMap((e, i) => [
              ...(day.nowAt === i ? [line('now')] : []),
              <li key={e.key} className="relative">
                {e.current ? (
                  <CurrentEntry entry={e} now={now} sayReadiness={e.key === sayReadiness} />
                ) : e.key === day.next && e.kind === 'meeting' ? (
                  <NextMeeting entry={e} now={now} />
                ) : (
                  <EntryRow entry={e} now={now} soonest={e.key === day.soonest} />
                )}
              </li>,
            ])}
            {day.nowAt === day.today.length ? line('now') : null}
          </ol>
        ) : (
          <p className="m-0 type-callout text-text-secondary">
            {calOn
              ? _('Nothing on your calendar today. New recording captures a call as it happens.')
              : _('Nothing recorded today. New recording captures a call as it happens.')}
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

/** Refresh calendar: by the date; F5 does the same from anywhere in the window. */
export function RefreshCalendarButton() {
  const { api, queryClient } = useServices()
  const running = useCalendarRefresh((s) => s.running)
  const refresh = useCalendarRefresh((s) => s.refresh)
  return (
    <IconButton
      icon="refresh"
      size="sm"
      label={running ? _('Refreshing the calendar…') : _('Refresh calendar')}
      tooltip={running ? _('Refreshing the calendar…') : _('Refresh calendar (F5)')}
      spinning={running}
      onPress={() => void refresh(api, queryClient)}
      className="text-text-secondary!"
      data-shortcut="refresh-calendar"
    />
  )
}

/** The calendar is not all there (can't be read; accounts to sign in again; calendars offline): one quiet line, Refresh next to it. */
function CalendarNoticeLine() {
  const { api, queries, queryClient } = useServices()
  const status = useQuery(queries.calendar()).data
  const running = useCalendarRefresh((s) => s.running)
  const refresh = useCalendarRefresh((s) => s.refresh)
  const notice = calendarNotice(status)
  if (!notice) return null
  return (
    <p
      role="status"
      className="m-0 flex flex-wrap items-center gap-x-2 gap-y-0.5 type-callout text-text-secondary"
    >
      <Icon name="calendar" size={15} className="shrink-0 text-text-tertiary" />
      <span>{notice.text}</span>
      <Button size="sm" variant="link" isDisabled={running} onPress={() => void refresh(api, queryClient)}>
        {running ? _('Refreshing…') : _('Refresh')}
      </Button>
      {notice.detail ? (
        <span className="basis-full pl-[23px] type-caption text-text-tertiary">{notice.detail}</span>
      ) : null}
    </p>
  )
}

/** Today's all-day events: one quiet line above the timeline ("All day · Bank holiday · Ana's birthday"). */
function AllDayStrip({ meetings }: { meetings: Meeting[] }) {
  return (
    <section
      aria-label={_('All day')}
      className="flex items-baseline gap-2 rounded-md bg-bg-sidebar px-3 py-1.5 type-callout"
    >
      <span className="shrink-0 type-caption font-semibold text-text-secondary">{_('All day')}</span>
      <ul className="m-0 flex min-w-0 list-none flex-wrap gap-x-1 p-0 text-text-secondary">
        {meetings.map((m, i) => (
          <li key={m.id} className="min-w-0 break-words">
            {i > 0 ? <span aria-hidden="true">· </span> : null}
            {m.title}
          </li>
        ))}
      </ul>
    </section>
  )
}

/** The rail the day's nodes sit on: centred on the node column (56 + 8 + 11 px in). */
function Rail() {
  return <span aria-hidden="true" className="absolute top-3 bottom-3 left-[74.5px] w-px bg-border-default" />
}

function NowLine({ now }: { now: number }) {
  return (
    <div className="relative flex h-6 items-center gap-2">
      <span className="w-14 shrink-0 text-right">
        <span className="rounded-xs bg-ink-primary px-1 font-mono text-[11px] leading-4 text-text-on-ink">
          {clock(new Date(now).toISOString())}
        </span>
      </span>
      <span className="h-px flex-1 bg-text-primary opacity-60" />
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
        className="group flex min-w-0 flex-1 cursor-default items-start gap-2 rounded-md py-2.5 pr-2 text-left outline-none focus-visible:outline-(length:--focus-ring-width) focus-visible:outline-solid focus-visible:outline-(--focus-ring-color) hover:bg-bg-hover"
      >
        <span className={`${TIME} leading-6 text-text-secondary`}>{time}</span>
        <span className={`${NODE} h-6 items-center`}>
          <Node kind={node} />
        </span>
        <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2.5">
          <span
            title={title}
            className={`max-w-full truncate leading-6 ${quiet ? 'type-body text-text-secondary' : 'type-body-strong text-text-primary'}`}
          >
            {title}
          </span>
          {meta ? <span className="type-callout leading-6 text-text-secondary">{meta}</span> : null}
        </span>
        {trailing ? (
          <span className="flex min-h-6 shrink-0 flex-wrap items-center gap-2">{trailing}</span>
        ) : null}
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

const agendaCount = (n: number) => fmt(ngettext('Agenda · {n} item', 'Agenda · {n} items', n), { n })

function EntryRow({ entry: e, now, soonest }: { entry: DayEntry; now: number; soonest: boolean }) {
  const navigate = useNavigate()
  const prep = useOpenPrep()
  const openSession = (id: string) => void navigate({ to: '/sessions/$sessionId', params: { sessionId: id } })
  const time = clock(new Date(e.at).toISOString())
  if (e.kind === 'recording') {
    const s = e.session
    const title = displayTitle(s)
    return (
      <Row
        time={time}
        node="done"
        title={title}
        quiet={isShortRecording(s)}
        meta={recordedMeta(s)}
        trailing={<SessionMarkers s={s} />}
        label={fmt(_('{title}, {time}'), { title, time })}
        onPress={() => openSession(s.id)}
      />
    )
  }
  const m = e.meeting
  const s = e.session
  if (s)
    return (
      <Row
        time={time}
        node="done"
        title={m.title}
        meta={recordedMeta(s)}
        trailing={<SessionMarkers s={s} />}
        label={fmt(_('{title}, {time}'), { title: m.title, time })}
        onPress={() => openSession(s.id)}
      />
    )
  const ended = Date.parse(m.end) <= now
  const provider = providerLabel(m.join?.provider)
  const since = Date.parse(m.start) < e.at ? fmt(_('began yesterday {time}'), { time: clock(m.start) }) : ''
  const meta =
    // a past meeting nobody recorded is simply quiet (its empty node says so), no label on every row
    [since, !ended && soonest ? countdown(m.start, m.end, now) : '', ended ? '' : provider]
      .filter(Boolean)
      .join(' · ') || undefined
  return (
    <Row
      time={time}
      node={ended ? 'missed' : 'future'}
      title={m.title}
      quiet={ended}
      meta={meta}
      trailing={
        !ended && e.agenda ? (
          <span className="type-caption text-text-secondary">{agendaCount(e.agenda.counts.items)}</span>
        ) : null
      }
      label={fmt(ended ? _('{title}, {time}, not recorded') : _('{title}, {time}'), { title: m.title, time })}
      onPress={() => void prep.open(m, e.agenda?.id)}
    />
  )
}

/** The time and node columns of a card on the rail (hidden on a narrow window, where the card is full width). */
function CardGutter({ time, node }: { time: string; node: NodeKind }) {
  return (
    <>
      <span className={`${TIME} hidden pt-4 font-semibold text-text-primary sm:block`}>{time}</span>
      <span className={`${NODE} hidden pt-4 sm:flex`}>
        <Node kind={node} />
      </span>
    </>
  )
}

function useReadiness() {
  const { store } = useServices()
  const connection = useStore(store, (s) => s.connection)
  const missing = useMissingModels()
  return readiness({ missingModels: missing, connected: connection.kind === 'live' })
}

function ReadinessLine() {
  const dialogs = useDialogs()
  const ready = useReadiness()
  return (
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
  )
}

function MeetingFacts({ m }: { m: Meeting }) {
  const provider = providerLabel(m.join?.provider)
  return (
    <p className="m-0 flex flex-wrap items-center gap-x-1.5 type-callout text-text-secondary">
      <span className="font-mono text-[13px] tabular-nums">
        {clock(m.start)}–{clock(m.end)}
      </span>
      {provider ? (
        <>
          <MetaDot />
          <span>{provider}</span>
        </>
      ) : null}
      {m.attendees > 1 ? (
        <>
          <MetaDot />
          <span>{fmt(ngettext('{n} person', '{n} people', m.attendees), { n: m.attendees })}</span>
        </>
      ) : null}
    </p>
  )
}

/** The soonest meeting still to come, expanded in place: when, readiness, its agenda, Join and record, prep. */
function NextMeeting({ entry: e, now }: { entry: Extract<DayEntry, { kind: 'meeting' }>; now: number }) {
  const join = useJoin()
  const prep = useOpenPrep()
  const m = e.meeting
  const items = e.agenda?.counts.items ?? 0
  return (
    <div className="flex items-start gap-2 py-2">
      <CardGutter time={clock(m.start)} node="next" />
      <Card
        as="section"
        aria-label={fmt(_('Next: {title}'), { title: m.title })}
        className="flex min-w-0 flex-1 flex-col gap-4 p-4 sm:p-5"
      >
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
          <div className="flex min-w-0 flex-[1_1_16rem] flex-col gap-1">
            <h3 className="m-0 type-title1 break-words text-text-primary">{m.title}</h3>
            <MeetingFacts m={m} />
          </div>
          <p className="m-0 type-headline text-text-primary first-letter:uppercase">
            {countdown(m.start, m.end, now)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-md bg-bg-sidebar px-3 py-2 type-callout">
          {e.agenda ? (
            <span className="inline-flex items-center gap-1.5">
              <Icon name="agenda" size={16} className="text-text-secondary" />
              <span className="font-semibold text-text-primary">{_('Agenda ready')}</span>
              <span className="text-text-secondary">
                {fmt(ngettext('{n} item', '{n} items', items), { n: items })}
              </span>
            </span>
          ) : null}
          <ReadinessLine />
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
          <Button
            variant="record"
            pill
            isDisabled={join.busy}
            onPress={() => void join.join(m.id)}
            aria-label={fmt(_('Join and record {title}'), { title: m.title })}
          >
            <span aria-hidden="true" className="size-2.5 rounded-full bg-text-on-accent" />
            {_('Join and record')}
          </Button>
        </div>
      </Card>
    </div>
  )
}

/** The recording clock: a red dot and the elapsed time (no red, "Paused", when paused). */
function RecordingClock({ s }: { s: Session }) {
  const recording = s.status === 'recording'
  const now = useNow(recording ? 1000 : 60_000)
  const time = formatDuration(elapsedMs(s, now))
  return (
    <span
      role="timer"
      aria-live="off"
      aria-label={fmt(recording ? _('Recording, {time}') : _('Paused, {time}'), { time })}
      className="inline-flex items-center gap-2"
    >
      <span
        aria-hidden="true"
        className={`size-2.5 rounded-full ${recording ? 'bg-accent-record' : 'bg-text-tertiary'}`}
      />
      <span className={`type-body-strong ${recording ? 'text-accent-record-text' : 'text-text-secondary'}`}>
        {recording ? _('Recording') : _('Paused')}
      </span>
      <span className="type-mono text-text-primary">{time}</span>
    </span>
  )
}

/**
 * What is under way, in its own place on the timeline, highlighted: a recording (its clock, Open, Stop),
 * or a meeting whose time has come (when, Join and record, prep; or Open once it was recorded).
 */
function CurrentEntry({
  entry: e,
  now,
  sayReadiness,
}: {
  entry: DayEntry
  now: number
  sayReadiness: boolean
}) {
  const ready = useReadiness()
  const navigate = useNavigate()
  const recorder = useRecorder()
  const join = useJoin()
  const prep = useOpenPrep()
  const s = e.session
  const live = s !== null && (s.status === 'recording' || s.status === 'paused')
  const m = e.kind === 'meeting' ? e.meeting : null
  const title = m ? m.title : displayTitle(s!)
  const open = (id: string) => void navigate({ to: '/sessions/$sessionId', params: { sessionId: id } })
  return (
    <div className="flex items-start gap-2 py-2">
      <CardGutter time={clock(new Date(e.at).toISOString())} node={live ? 'live' : 'next'} />
      <Card
        as="section"
        aria-label={fmt(live ? _('Recording now: {title}') : _('Now: {title}'), { title })}
        className={`flex min-w-0 flex-1 flex-col gap-3 p-4 sm:p-5 ${
          live
            ? 'border-[color-mix(in_srgb,var(--k-color-accent-record)_45%,var(--k-color-border-default))]'
            : 'border-border-strong'
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
          <div className="flex min-w-0 flex-[1_1_16rem] flex-col gap-1">
            <h3 className="m-0 type-title2 break-words text-text-primary">{title}</h3>
            {m ? <MeetingFacts m={m} /> : null}
          </div>
          {live ? (
            <RecordingClock s={s!} />
          ) : m ? (
            <p className="m-0 type-headline text-text-primary first-letter:uppercase">
              {countdown(m.start, m.end, now)}
            </p>
          ) : null}
        </div>
        {!live && m && !s && (e.agenda || (sayReadiness && !ready.ok)) ? (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-md bg-bg-sidebar px-3 py-2 type-callout">
            {e.agenda ? (
              <span className="inline-flex items-center gap-1.5">
                <Icon name="agenda" size={16} className="text-text-secondary" />
                <span className="font-semibold text-text-primary">{_('Agenda ready')}</span>
                <span className="text-text-secondary">
                  {fmt(ngettext('{n} item', '{n} items', e.agenda.counts.items), {
                    n: e.agenda.counts.items,
                  })}
                </span>
              </span>
            ) : null}
            {sayReadiness && !ready.ok ? <ReadinessLine /> : null}
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          {live ? (
            <>
              <Button onPress={() => open(s!.id)} aria-label={fmt(_('Open {title}'), { title })}>
                {_('Open')}
              </Button>
              <span className="flex-1" />
              <Button
                variant="primary"
                icon="stop"
                onPress={recorder.stop}
                isDisabled={recorder.state === 'stopping'}
              >
                {recorder.state === 'stopping' ? _('Stopping…') : _('Stop')}
              </Button>
            </>
          ) : s ? (
            <>
              <span className="type-callout text-text-secondary">
                {fmt(_('Recorded · {duration}'), { duration: durationLabel(s.durationMs) })}
              </span>
              <span className="flex-1" />
              <Button onPress={() => open(s.id)} aria-label={fmt(_('Open {title}'), { title })}>
                {_('Open')}
              </Button>
            </>
          ) : m ? (
            <>
              <Button
                onPress={() => void prep.open(m, e.agenda?.id)}
                isDisabled={prep.busy === m.id}
                aria-label={fmt(e.agenda ? _('Open prep for {title}') : _('Plan {title}'), { title })}
              >
                {e.agenda ? _('Open prep') : _('Plan an agenda')}
              </Button>
              <span className="flex-1" />
              <Button
                variant="record"
                pill
                isDisabled={join.busy}
                onPress={() => void join.join(m.id)}
                aria-label={fmt(_('Join and record {title}'), { title })}
              >
                <span aria-hidden="true" className="size-2.5 rounded-full bg-text-on-accent" />
                {_('Join and record')}
              </Button>
            </>
          ) : null}
        </div>
      </Card>
    </div>
  )
}

function EarlierSection({ day }: { day: EarlierDay }) {
  const navigate = useNavigate()
  const id = `day-${day.key}`
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <h2 id={id} className="m-0 flex items-baseline gap-3 type-title2 text-text-primary">
        {day.label}
        <span className="type-callout font-normal text-text-secondary">
          {day.date.startsWith(`${day.label} `) ? day.date.slice(day.label.length + 1) : day.date}
        </span>
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
                quiet={isShortRecording(s)}
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
