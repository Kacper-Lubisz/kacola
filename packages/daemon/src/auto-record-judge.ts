import {
  type DecisionProvider,
  decideRecordWorthy,
  type RecordWorthyInput,
  recordWorthyHeuristic,
} from '@kacola/decisions'
import type { Agenda, Meeting, Session } from '@kacola/protocol'
import type { Logger } from './logger.ts'

// Auto-record's smart calendar rule (./auto-record.ts): is this meeting one the user will want recorded?
// The facts come from the calendar (the event's shape) and from kacola (earlier occurrences of the same
// series and whether they were recorded; an agenda prepared for it); the judgement is the decisions
// provider's (@kacola/decisions recordWorthy task: Jev when selected, else on-device rules).
//
//   private   a series with a private agenda is only ever judged on this computer
//   failure   a provider that fails or takes longer than JUDGE_TIMEOUT_MS: the on-device heuristic decides
//             (missing a standup and recording a run club are both wrong; neither is a safe default)

/** How far back earlier occurrences of a series count. */
export const HISTORY_DAYS = 56
export const JUDGE_TIMEOUT_MS = 8_000

export type RecordJudgement = {
  record: boolean
  p: number
  /** Which provider decided (`fallback` = the on-device heuristic after the selected one failed). */
  provider: string
  source: string
}

export type JudgeDeps = {
  provider: () => Promise<DecisionProvider | null>
  localProvider: () => Promise<DecisionProvider>
  /** Every occurrence of every series between two instants (the calendar, widened as needed). */
  meetings: (from: Date, to: Date) => Promise<Meeting[]>
  /** Sessions created since an instant, private ones included. */
  sessions: (since: Date) => Session[]
  agendas: (eventUid: string) => Agenda[]
  logger: Logger
  timeoutMs?: number
}

export async function recordWorthyInput(
  m: Meeting,
  d: Pick<JudgeDeps, 'meetings' | 'sessions' | 'agendas'>,
): Promise<RecordWorthyInput> {
  const start = new Date(m.start)
  const since = new Date(start.getTime() - HISTORY_DAYS * 86_400_000)
  const earlier = m.recurring
    ? (await d.meetings(since, start)).filter(
        (x) =>
          x.uid === m.uid &&
          x.id !== m.id &&
          new Date(x.start) < start &&
          x.status !== 'cancelled' &&
          x.response !== 'declined',
      )
    : []
  const earlierIds = new Set(earlier.map((x) => x.id))
  const recorded = new Set(
    d
      .sessions(since)
      .filter((s) => s.meeting && earlierIds.has(s.meeting.id))
      .map((s) => s.meeting!.id),
  ).size
  const agendas = d.agendas(m.uid)
  return {
    title: m.title,
    calendar: m.calendar.name,
    location: m.join && m.location === m.join.url ? null : m.location,
    videoCall: m.join?.provider ?? null,
    attendees: m.attendees,
    minutes: Math.max(1, Math.round((new Date(m.end).getTime() - start.getTime()) / 60_000)),
    recurring: m.recurring,
    response: m.response === 'declined' ? null : m.response,
    history: earlier.length ? { earlier: earlier.length, recorded } : null,
    agenda: agendas.some((a) => a.meeting?.meetingId === m.id || a.meeting?.start === m.start),
  }
}

export async function judgeMeeting(m: Meeting, d: JudgeDeps): Promise<RecordJudgement> {
  const input = await recordWorthyInput(m, d)
  const privateSeries = d.agendas(m.uid).some((a) => a.private)
  let provider: DecisionProvider | null = null
  try {
    provider = privateSeries ? await d.localProvider() : ((await d.provider()) ?? (await d.localProvider()))
    const p = provider
    const { decision } = await withTimeout(decideRecordWorthy(p, input), d.timeoutMs ?? JUDGE_TIMEOUT_MS)
    return { ...decision, provider: p.id }
  } catch (err) {
    d.logger.warn('auto-record: the decision failed; deciding on this computer', {
      provider: provider?.id ?? null,
      err: err instanceof Error ? err.message : String(err),
    })
    const p = recordWorthyHeuristic(input)
    return { record: p >= 0.5, p, provider: 'fallback', source: 'heuristic' }
  }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`no answer within ${ms} ms`)), ms)
    t.unref()
    p.then(
      (v) => {
        clearTimeout(t)
        resolve(v)
      },
      (e: unknown) => {
        clearTimeout(t)
        reject(e)
      },
    )
  })
}
