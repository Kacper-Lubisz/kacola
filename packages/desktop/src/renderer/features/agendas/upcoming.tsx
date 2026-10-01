import type { Meeting } from '@gnomeola/protocol'
import { formatClockTime } from '@gnomeola/ui-core/format'
import { useNow } from '@gnomeola/ui-core/hooks'
import { _, fmt, ngettext } from '@gnomeola/ui-core/i18n'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { keys } from '../../data/keys.ts'
import { useServices } from '../../data/services.tsx'
import { Button, IconButton, useToast } from '../../design/primitives/index.ts'
import { refusal } from './agenda-data.ts'
import { useFollow } from './follow.tsx'

// The sidebar's "Coming up": the next few calendar meetings, each with its agenda — "Plan" makes one
// (the daemon's resolveAgendaLink with create: one agenda per occurrence, seeded by carry-over for a
// recurring meeting), "Agenda" opens the one it has. Shown only when the calendar is on and has some.

const SHOWN = 3

export function ComingUp() {
  const { queries, api, queryClient } = useServices()
  const navigate = useNavigate()
  const toast = useToast()
  const now = useNow(60_000).getTime()
  const calendar = useQuery(queries.calendar())
  const upcoming = useQuery({ ...queries.upcoming(), enabled: calendar.data?.state === 'ok' })
  const agendas = useQuery({ ...queries.agendas(), enabled: calendar.data?.state === 'ok' })
  const [busy, setBusy] = useState<string | null>(null)
  const meetings = (upcoming.data?.meetings ?? [])
    .filter((m) => !m.allDay && m.status !== 'cancelled' && Date.parse(m.end) > now)
    .slice(0, SHOWN)
  if (calendar.data?.state !== 'ok' || !meetings.length) return null
  const agendaOf = (m: Meeting) =>
    agendas.data?.find(
      (a) =>
        a.meeting?.eventUid === m.uid &&
        (a.meeting.meetingId === m.id || a.meeting.recurrenceId === m.recurrenceId || !m.recurring),
    )
  const open = async (m: Meeting) => {
    const known = agendaOf(m)
    if (known) {
      void navigate({ to: '/agendas/$agendaId', params: { agendaId: known.id } })
      return
    }
    setBusy(m.id)
    try {
      const r = await api.call('resolveAgendaLink', {
        body: { eventUid: m.uid, start: m.start, create: true, includePrivate: true },
      })
      if (r.agenda) {
        queryClient.setQueryData(keys.agenda(r.agenda.agenda.id), r.agenda)
        void navigate({ to: '/agendas/$agendaId', params: { agendaId: r.agenda.agenda.id } })
      }
    } catch (err) {
      toast(fmt(_('Could not open the agenda: {reason}'), { reason: refusal(err) }), { tone: 'error' })
    } finally {
      setBusy(null)
    }
  }
  return (
    <section aria-labelledby="coming-up" className="flex flex-col gap-1 px-3 pb-2">
      <div className="flex items-center justify-between gap-2">
        <h2 id="coming-up" className="m-0 px-1 type-overline text-text-secondary">
          {_('Coming up')}
        </h2>
        <IconButton
          icon="speakers"
          size="sm"
          label={_('Follow a shared agenda')}
          tooltip={_('Follow a shared agenda')}
          onPress={() => useFollow.getState().show()}
        />
      </div>
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {meetings.map((m) => {
          const a = agendaOf(m)
          const live = Date.parse(m.start) <= now
          return (
            <li key={m.id} className="flex items-center gap-2 rounded-md px-2 py-1.5">
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate type-callout font-semibold text-text-primary">{m.title}</span>
                <span className="type-caption text-text-secondary">
                  {live ? _('Now') : formatClockTime(m.start)}
                  {a
                    ? ` · ${fmt(ngettext('{n} item', '{n} items', a.counts.items), { n: a.counts.items })}`
                    : ''}
                </span>
              </div>
              <Button
                size="sm"
                variant={a ? 'secondary' : 'ghost'}
                icon="agenda"
                isDisabled={busy === m.id}
                onPress={() => void open(m)}
                aria-label={fmt(a ? _('Agenda for {title}, {when}') : _('Plan {title}, {when}'), {
                  title: m.title,
                  when: live ? _('now') : formatClockTime(m.start),
                })}
              >
                {a ? _('Agenda') : _('Plan')}
              </Button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
