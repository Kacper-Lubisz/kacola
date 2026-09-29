import type { CalendarStatus, Meeting } from '@gnomeola/protocol'
import type { Ctx } from '../context.ts'
import { CliError, EXIT } from '../errors.ts'
import { renderJson } from '../output.ts'
import { mapApiError } from '../sessions.ts'

// X-5: `gnomeola meetings --next | --today` — what is on the user's calendar, as the daemon sees it
// (C-3). Read-only. Useful to an agent for "what is my next meeting", and for tying a recorded session
// to the meeting it was for (sessions carry the meeting id).

/** The fields worth a token: no descriptions (they are long, and they are where injected text lives). */
export function briefMeeting(m: Meeting) {
  return {
    id: m.id,
    title: m.title,
    start: m.start,
    end: m.end,
    allDay: m.allDay,
    joinUrl: m.join?.url ?? null,
    provider: m.join?.provider ?? null,
    calendar: m.calendar.name,
    response: m.response,
  }
}

const briefCalendar = (c: CalendarStatus) => ({ state: c.state, detail: c.detail })

/** Calendar reading off or broken is a capability problem (exit 6), not an empty calendar. */
function requireCalendar(c: CalendarStatus): void {
  if (c.state === 'off')
    throw new CliError(
      EXIT.UNAVAILABLE,
      'calendar reading is off in the daemon',
      'set GNOMEOLA_CALENDAR=eds for gnomeolad',
    )
  if (c.state === 'unavailable')
    throw new CliError(EXIT.UNAVAILABLE, `calendar unavailable: ${c.detail ?? 'unknown reason'}`)
}

const p2 = (n: number) => String(n).padStart(2, '0')
const hm = (iso: string) => {
  const d = new Date(iso)
  return `${p2(d.getHours())}:${p2(d.getMinutes())}`
}
const localDate = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`

function line(m: Meeting, label = ''): string {
  const when = m.allDay ? 'all day    ' : `${hm(m.start)}–${hm(m.end)}`
  const join = m.join ? `  ${m.join.provider}: ${m.join.url}` : ''
  const resp = m.response && m.response !== 'accepted' ? ` (${m.response})` : ''
  return `${label}${when}  ${m.title}${resp}${join}\n`
}

export async function meetingsNext(ctx: Ctx) {
  const r = await ctx.client.call('nextMeeting').catch(mapApiError)
  requireCalendar(r.calendar)
  if (ctx.format === 'json')
    return ctx.io.stdout(
      renderJson(
        {
          current: r.current && briefMeeting(r.current),
          next: r.next && briefMeeting(r.next),
          calendar: briefCalendar(r.calendar),
        },
        ctx.io,
      ),
    )
  if (!r.current && !r.next) return ctx.io.stdout('no upcoming meetings\n')
  if (r.current) ctx.io.stdout(line(r.current, 'now   '))
  if (r.next) {
    const day =
      localDate(new Date(r.next.start)) === localDate(ctx.now) ? '' : `${localDate(new Date(r.next.start))} `
    ctx.io.stdout(line(r.next, `next  ${day}`))
  }
}

export async function meetingsToday(ctx: Ctx) {
  const d = ctx.now
  const from = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const to = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)
  const r = await ctx.client
    .call('listMeetings', { query: { from: from.toISOString(), to: to.toISOString() } })
    .catch(mapApiError)
  requireCalendar(r.calendar)
  if (ctx.format === 'json')
    return ctx.io.stdout(
      renderJson(
        { date: localDate(d), meetings: r.meetings.map(briefMeeting), calendar: briefCalendar(r.calendar) },
        ctx.io,
      ),
    )
  if (!r.meetings.length) return ctx.io.stdout(`no meetings today (${localDate(d)})\n`)
  for (const m of r.meetings) ctx.io.stdout(line(m))
}
