import type { DecisionProvider } from '@kacola/decisions'
import type { Agenda, Meeting, Session } from '@kacola/protocol'
import { describe, expect, it } from 'vitest'
import { judgeMeeting, recordWorthyInput } from '../src/auto-record-judge.ts'
import { Logger } from '../src/logger.ts'

// The smart calendar rule's judge: the facts it gathers (history of the series, an agenda), which
// provider it asks, and what happens when that provider fails or hangs.

const day = 86_400_000
const now = Date.parse('2026-10-22T09:00:00Z')

function meeting(o: Partial<Meeting> & { start: string }): Meeting {
  return {
    id: `mtg_${o.start}`,
    uid: 'standup@example.com',
    recurrenceId: o.start,
    calendar: { id: 'work', name: 'Work' },
    title: 'Standup',
    end: new Date(Date.parse(o.start) + 15 * 60_000).toISOString(),
    allDay: false,
    timezone: null,
    location: null,
    join: { url: 'https://meet.google.com/abc', provider: 'meet' },
    status: 'confirmed',
    response: 'accepted',
    organizer: null,
    attendees: 6,
    recurring: true,
    ...o,
  } as Meeting
}

const weeks = [3, 2, 1].map((w) => meeting({ start: new Date(now - w * 7 * day).toISOString() }))
const today = meeting({ start: new Date(now).toISOString() })
const recordedOf = (m: Meeting) =>
  ({ id: `ses_${m.id}`, meeting: { id: m.id, uid: m.uid } }) as unknown as Session

function deps(
  o: { provider?: DecisionProvider | null; recorded?: Meeting[]; agendas?: Partial<Agenda>[] } = {},
) {
  const local = {
    id: 'local',
    model: 'rules',
    async decide() {
      return { answers: { record: { kind: 'yesno', p: 0.2, confidence: 0.6, source: 'heuristic' } } }
    },
  } as unknown as DecisionProvider
  return {
    provider: async () => (o.provider === undefined ? null : o.provider),
    localProvider: async () => local,
    meetings: async () => [...weeks, today],
    sessions: () => (o.recorded ?? []).map(recordedOf),
    agendas: () => (o.agendas ?? []) as Agenda[],
    logger: new Logger(),
    timeoutMs: 100,
  }
}

describe('recordWorthyInput', () => {
  it('counts earlier occurrences of the series and how many were recorded', async () => {
    const input = await recordWorthyInput(today, deps({ recorded: weeks.slice(1) }))
    expect(input.history).toEqual({ earlier: 3, recorded: 2 })
    expect(input).toMatchObject({ videoCall: 'meet', attendees: 6, minutes: 15, agenda: false })
  })

  it('sees an agenda prepared for this occurrence', async () => {
    const input = await recordWorthyInput(
      today,
      deps({ agendas: [{ private: false, meeting: { meetingId: today.id } as Agenda['meeting'] }] }),
    )
    expect(input.agenda).toBe(true)
  })
})

describe('judgeMeeting', () => {
  const answering = (p: number, id = 'jev') =>
    ({
      id,
      model: 'jev-1',
      async decide() {
        return { answers: { record: { kind: 'yesno', p, confidence: 0.9, source: 'calibrated' } } }
      },
    }) as unknown as DecisionProvider

  it('asks the selected provider', async () => {
    expect(await judgeMeeting(today, deps({ provider: answering(0.92) }))).toEqual({
      record: true,
      p: 0.92,
      provider: 'jev',
      source: 'calibrated',
    })
  })

  it('a series with a private agenda is judged on this computer only', async () => {
    const v = await judgeMeeting(
      today,
      deps({ provider: answering(0.92), agendas: [{ private: true, meeting: null }] }),
    )
    expect(v.provider).toBe('local')
  })

  it('falls back to the on-device heuristic when the provider fails or hangs', async () => {
    const failing = {
      id: 'jev',
      model: 'jev-1',
      decide: async () => {
        throw new Error('quota')
      },
    } as unknown as DecisionProvider
    const hanging = {
      id: 'jev',
      model: 'jev-1',
      decide: () => new Promise(() => {}),
    } as unknown as DecisionProvider
    // three earlier standups, all recorded: the heuristic follows the history
    for (const provider of [failing, hanging]) {
      const v = await judgeMeeting(today, deps({ provider, recorded: weeks }))
      expect(v).toMatchObject({ record: true, provider: 'fallback', source: 'heuristic' })
    }
  })
})
