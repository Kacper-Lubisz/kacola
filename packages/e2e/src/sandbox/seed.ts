import { join } from 'node:path'
import { NoteStore, Store } from '@gnomeola/store'
import { CALENDAR_NAME, meetingId, type SandboxMeeting } from './calendar.ts'

// Past meetings for a new sandbox, written through the store's own API (so the event log is what the
// daemon would have produced) before the daemon first starts: home has a history, search finds what was
// said, Plan with Claude finds last week's 1:1, and one private meeting shows what never leaves.

type Line = [startS: number, who: 'me' | string, text: string]

const PAST: { uid: string; private?: boolean; notes?: string; lines: Line[] }[] = [
  {
    uid: 'sandbox-ana-1on1@kacola.test',
    notes: '- promo: ask what is missing\n- conference budget?\n- demo went long\n',
    lines: [
      [4, 'me', 'Quick one today. How is the onboarding doc coming along?'],
      [9, 'Ana', 'Almost done. I will share the onboarding doc with the team on Friday.'],
      [21, 'me', 'I want to talk about the promotion to senior next time, properly.'],
      [27, 'Ana', 'Sure, put it first on the agenda for next week and I will bring the committee criteria.'],
      [40, 'me', 'Also, I might ask for budget for the Berlin conference in November.'],
      [46, 'Ana', 'Send me the numbers when you have them.'],
      [58, 'Ana', 'One more thing: the nightly billing export failed twice this week. Who owns it now?'],
      [65, 'me', 'Still me, but I want to hand it over. Let us decide next week.'],
    ],
  },
  {
    uid: 'sandbox-design-review@kacola.test',
    lines: [
      [3, 'me', 'Let us walk through the checkout flow from the cart.'],
      [10, 'Ben', 'The retry banner shows up even when the payment went through. That confuses people.'],
      [19, 'Priya', 'We should hide the retry banner once the webhook confirms the payment.'],
      [28, 'me', 'Agreed. Ben, can you own the copy for the confirmation screen?'],
      [33, 'Ben', 'Yes, I will own the confirmation copy and have a draft by Wednesday.'],
      [45, 'Priya', 'And the coupon field moves below the total. Decision made.'],
    ],
  },
  {
    uid: 'sandbox-hiring-sync@kacola.test',
    private: true,
    lines: [
      [5, 'me', 'This is the private one: compensation for the senior backend role.'],
      [12, 'Lena', 'We can go up to ninety-five thousand for the right person, but keep that between us.'],
      [24, 'me', 'Understood. The second candidate asked for a four-day week.'],
    ],
  },
]

export function seedPast(dataDir: string, meetings: SandboxMeeting[]): string[] {
  const store = Store.open(join(dataDir, 'gnomeola.db'))
  const notes = new NoteStore(store)
  const made: string[] = []
  let n = 0
  try {
    for (const p of PAST) {
      // the earliest occurrence of that event (last week's, for the recurring 1:1)
      const m = meetings.filter((x) => x.uid === p.uid).sort((a, b) => a.start.localeCompare(b.start))[0]
      if (!m) continue
      const durationMs = Date.parse(m.end) - Date.parse(m.start)
      const s = store.createSession({
        title: m.title,
        private: p.private ?? false,
        meeting: {
          id: meetingId(m.uid, m.recurrenceId),
          uid: m.uid,
          title: m.title,
          start: m.start,
          end: m.end,
          join: null,
          calendar: CALENDAR_NAME,
        },
      })
      store.updateSession(s.id, (x) => ({
        ...x,
        status: 'stopped',
        createdAt: m.start,
        startedAt: m.start,
        endedAt: m.end,
        durationMs,
        tracks: (['mic', 'system'] as const).map((kind) => ({
          kind,
          device: `sandbox.${kind}`,
          sampleRate: 16000,
          audioPath: null,
          archivePath: null,
          gaps: [],
        })),
      }))
      for (const [startS, who, text] of p.lines) {
        const seg = {
          id: `seg_${String(++n).padStart(9, '0')}${'5'.repeat(12)}`,
          sessionId: s.id,
          track: who === 'me' ? ('mic' as const) : ('system' as const),
          speaker: who,
          startMs: startS * 1000,
          endMs: startS * 1000 + 4000,
          text,
          quality: 'live' as const,
          confidence: 0.9,
        }
        store.upsertSegment(seg)
        store.upsertSegment({ ...seg, quality: 'final' })
      }
      if (p.notes) notes.put(s.id, p.notes, 0)
      made.push(s.id)
    }
  } finally {
    store.close()
  }
  return made
}
