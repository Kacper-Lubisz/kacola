import { yesNoAnswer } from '../answers.ts'
import type { LocalRule } from '../local/provider.ts'
import type { DecisionProvider, DecisionResult, Question, YesNoAnswer } from '../types.ts'

// Auto-record's calendar rule, smart mode: is this calendar event one the user will want recorded and
// transcribed? A standup, a 1:1, a customer call: yes. A run club, a dentist appointment, a focus block,
// a flight: no. One yes/no question about the event as the calendar describes it, plus what the user did
// with earlier occurrences of the same series (the strongest signal there is: people are consistent).
//
// The state is deliberately small and factual (Jev's documented weak spot is large irrelevant state): no
// description, no attendee names.

export const TAG_RECORD_WORTHY = 'auto-record.worth-recording'

export type RecordWorthyInput = {
  title: string
  /** The calendar it is on ("Work", "kacper@gmail.com", "Family"). */
  calendar: string
  location: string | null
  /** The video-call provider of its join link (meet, zoom, teams, …), or null when it has none. */
  videoCall: string | null
  /** People invited besides the calendar's owner (0 = an event only for the user). */
  attendees: number
  minutes: number
  recurring: boolean
  /** The user's answer to the invitation; null when it is their own event. */
  response: 'accepted' | 'tentative' | 'needs-action' | 'delegated' | null
  /** Earlier occurrences of the same series in the last weeks, and how many of them were recorded. */
  history: { earlier: number; recorded: number } | null
  /** An agenda has been prepared for it in kacola. */
  agenda: boolean
}

export type RecordWorthyDecision = { record: boolean; p: number; source: YesNoAnswer['source'] }

export function recordWorthyQuestions(input: RecordWorthyInput) {
  const state = {
    event: {
      title: input.title,
      calendar: input.calendar,
      location: input.location ?? '',
      video_call: input.videoCall ?? 'none',
      other_people_invited: input.attendees,
      minutes: input.minutes,
      recurring: input.recurring,
      my_response: input.response ?? 'my own event',
      agenda_prepared: input.agenda,
    },
    ...(input.history && input.history.earlier > 0
      ? {
          earlier_occurrences: {
            in_the_last_weeks: input.history.earlier,
            recorded_by_me: input.history.recorded,
          },
        }
      : {}),
  }
  const questions: Question[] = [
    {
      id: 'record',
      kind: 'yesno',
      tag: TAG_RECORD_WORTHY,
      instructions:
        'This calendar `event` is starting now. Would its owner want a meeting recorder to record and transcribe it, so they can search and recall what was said? Where `earlier_occurrences` is given, what they did with earlier occurrences of the same series is the best guide.',
      yes: 'A conversation where what is said matters later: standups, 1:1s, syncs, planning, reviews, retros, interviews, customer, client or sales calls, kickoffs, workshops, board or all-hands meetings.',
      no: 'Not a conversation worth keeping: exercise and sport (runs, gym, clubs), social plans (lunch, drinks, parties), personal appointments (doctor, dentist, haircut), travel, focus or blocked time, reminders, holidays and time off.',
    },
  ]
  return { state, questions }
}

export async function decideRecordWorthy(
  provider: DecisionProvider,
  input: RecordWorthyInput,
  threshold = 0.5,
): Promise<{ decision: RecordWorthyDecision; result: DecisionResult }> {
  const { state, questions } = recordWorthyQuestions(input)
  const result = await provider.decide({ state, questions })
  const y = result.answers.record as YesNoAnswer
  return { decision: { record: y.p >= threshold, p: y.p, source: y.source }, result }
}

// ---------------------------------------------------------------------------------- on-device rule

const NOT_A_MEETING =
  /\b(run(ning)?|jog|parkrun|walk|gym|work ?out|yoga|pilates|spin|climb(ing)?|swim(ming)?|football|soccer|tennis|padel|squash|cycling|ride|hike|club|lunch|dinner|breakfast|brunch|drinks|pub|party|birthday|wedding|date night|bbq|dentist|doctor|gp|physio|therapy|therapist|haircut|barber|vet|appointment|flight|train|travel|commute|hotel|airport|pick ?up|drop ?off|school|nursery|focus|deep work|heads? down|do not book|no meetings|blocked|block|ooo|out of office|holiday|vacation|annual leave|day off|reminder|pay (rent|bills)|rent|bills|laundry|groceries|errands?)\b/i
/** The same, run together as titles often are ("#nousrunclub", "BookClub", "parkrun"). */
const NOT_A_MEETING_SQUASHED =
  /(run(ning)?club|bookclub|parkrun|yoga|pilates|workout|marathon|\d+k(run)?$|^\d+k)/
const MEETING =
  /\b(stand ?-?up|daily|sync|1 ?: ?1|1-1|1on1|one on one|catch ?-?up|check ?-?in|review|retro(spective)?|planning|kick ?-?off|interview|phone screen|screening|demo|call|meeting|all ?-?hands|town ?hall|workshop|onboarding|customer|client|sales|discovery|board|debrief|brainstorm|design|roadmap|sprint|grooming|refinement|office hours|pairing|post ?-?mortem|incident|weekly|okr|strategy|offsite|talk)\b/i

/**
 * The on-device judgement, also the fallback when the selected provider fails: history first, then what
 * the title says, then the shape of the event (a video call with people invited is probably a meeting).
 */
export function recordWorthyHeuristic(input: RecordWorthyInput): number {
  const h = input.history
  if (h && h.earlier >= 2) return Math.min(0.9, Math.max(0.1, h.recorded / h.earlier))
  if (input.agenda) return 0.85
  const title = input.title.replace(/\blunch (&|and) learn\b/i, 'talk')
  const work = MEETING.test(title)
  const personal =
    NOT_A_MEETING.test(`${title} ${input.location ?? ''}`) ||
    NOT_A_MEETING_SQUASHED.test(title.toLowerCase().replace(/[^a-z0-9]/g, ''))
  // "Run club planning", "Hotel check-in": both kinds of word, so the shape of the event decides
  if (work && personal) return input.videoCall ? 0.7 : 0.4
  if (work) return 0.85
  if (personal) return 0.1
  if (input.videoCall && input.attendees > 0) return 0.7
  if (input.attendees > 0) return 0.55
  return input.videoCall ? 0.5 : 0.2
}

export const recordWorthyRule: LocalRule = {
  tag: TAG_RECORD_WORTHY,
  answer(q, ctx) {
    if (q.kind !== 'yesno') return null
    const st = ctx.state as unknown as ReturnType<typeof recordWorthyQuestions>['state']
    const e = st.event
    const earlier = 'earlier_occurrences' in st ? st.earlier_occurrences : undefined
    return yesNoAnswer(
      recordWorthyHeuristic({
        title: e.title,
        calendar: e.calendar,
        location: e.location || null,
        videoCall: e.video_call === 'none' ? null : e.video_call,
        attendees: e.other_people_invited,
        minutes: e.minutes,
        recurring: e.recurring,
        response: e.my_response === 'my own event' ? null : (e.my_response as RecordWorthyInput['response']),
        history: earlier ? { earlier: earlier.in_the_last_weeks, recorded: earlier.recorded_by_me } : null,
        agenda: e.agenda_prepared,
      }),
      'heuristic',
    )
  },
}
