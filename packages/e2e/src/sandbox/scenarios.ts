import type { MeetingScript, ScriptLine } from '@kacola/daemon'

// The sandbox's scripted meetings (`pnpm sandbox play <scenario>`): one per mock calendar meeting, each
// with the agenda it is meant to be recorded against and a script that exercises the live tracker in a
// particular way. `--audio mic` prints the same script as a card for one person to read both parts.

export type Scenario = {
  id: string
  /** The calendar meeting it belongs to (calendar.ts SEED_MEETINGS uid). */
  meetingUid: string
  title: string
  /** The far end's name (system track); the mic is always `me`. */
  them: string
  /** What it exercises, one line. */
  summary: string
  /** What should happen on the agenda, item by item (the guide's "what you should see"). */
  expect: string[]
  /** The suggested agenda, in the markdown form `kacola agenda import` reads. */
  agenda: string
  lines: [who: 'me' | 'them', text: string][]
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'one-on-one',
    meetingUid: 'sandbox-ana-1on1@kacola.test',
    title: '1:1 with Ana',
    them: 'Ana',
    summary:
      'Covers 3 of 5 items outright, settles one only loosely (a "looks covered?" case), never mentions one.',
    expect: [
      'Promotion timeline to senior: ticked (Ana agrees outright).',
      'Handover of the nightly billing export: ticked (Priya owns it from Monday).',
      'Budget for the Berlin conference: only loosely settled ("we can probably make it work"), so a "looks covered?" suggestion or in progress, not a confident tick.',
      'December vacation dates: never mentioned, so it stays open.',
      'Feedback on last week’s demo: ticked (five slides and a dry run).',
    ],
    agenda: `# 1:1 with Ana

## Goals
- Know what is missing for the promotion
- Hand over the nightly billing export

## Items
- [ ] Promotion timeline to senior [must-cover]
- [ ] Handover of the nightly billing export
- [ ] Budget for the Berlin conference [question]
- [ ] December vacation dates [decision]
- [ ] Feedback on last week's demo
`,
    lines: [
      ['them', 'Hey, good to see you. How was the trip?'],
      ['me', 'Great, thanks, the mountains were lovely. I have a few things for today, so let us dive in.'],
      ['me', 'First, the promotion to senior. What is still missing from your side?'],
      [
        'them',
        'Honestly, not much. The committee wants to see you lead one cross-team project from start to finish.',
      ],
      ['me', 'Would the billing export migration count? It touches three teams.'],
      ['them', 'It would. The committee meets in March.'],
      ['me', 'So if I lead the migration, you would put me forward for senior in March?'],
      ['them', 'Yes. Agreed: you lead the migration, and I will nominate you for senior in March.'],
      ['me', 'Great, thank you. Next, the handover of the nightly billing export job.'],
      ['them', 'Who should take it over?'],
      ['me', 'Priya knows the code best. I would pair with her on Monday morning.'],
      [
        'them',
        'Fine by me. So Priya owns the nightly billing export from Monday, and you pair with her on Monday morning.',
      ],
      ['me', 'Done. I will tell her today.'],
      [
        'me',
        'Then the Berlin conference in November. The ticket and the hotel come to about nine hundred euros.',
      ],
      [
        'them',
        'Hmm, it is a good conference. Send me the numbers and we will see. I think we can probably make it work.',
      ],
      ['me', 'Okay, I will put it in the budget sheet.'],
      ['me', 'Last thing, I wanted your feedback on last week’s demo.'],
      ['them', 'The content was strong, but the demo ran ten minutes over and the second half lost people.'],
      ['me', 'Fair. What would you change?'],
      ['them', 'Five slides at most, and do a dry run with me the day before.'],
      ['me', 'Got it: for the next demo, five slides and a dry run with you the day before.'],
      ['them', 'Perfect. Anything else?'],
      ['me', 'No, I think that is everything for today. Thanks, Ana.'],
    ],
  },
  {
    id: 'intro-call',
    meetingUid: 'sandbox-sam-intro@kacola.test',
    title: 'Intro call with Sam',
    them: 'Sam',
    summary: 'Every question gets answered, but out of order: budget first, next steps last.',
    expect: [
      'Budget and timeline: answered first, before you ask (about twenty thousand, by January).',
      'How they take meeting notes today: answered second (Google Docs, rarely shared).',
      'What Sam’s team builds: answered third (a payments dashboard for small shops).',
      'Team size and who decides on tools: answered fourth (twelve engineers, two designers; Sam and Lena decide).',
      'Next steps: agreed last (a trial this week, a follow-up next Thursday).',
    ],
    agenda: `# Intro call with Sam

## Goals
- Find out whether Sam's team is a fit for a trial

## Items
- [ ] What does Sam's team build today? [info-to-get]
- [ ] How big is the team, and who decides on tools? [info-to-get]
- [ ] How do they take meeting notes now? [info-to-get]
- [ ] Budget and timeline [info-to-get]
- [ ] Agree the next steps [decision]
`,
    lines: [
      ['them', 'Hi! Thanks for making time. Before you start, let me get the boring part out of the way.'],
      [
        'them',
        'We have budget set aside for this quarter, around twenty thousand, and we would want something running by January.',
      ],
      ['me', 'That is really helpful. So the budget is about twenty thousand, and the timeline is January.'],
      ['them', 'Right. And the reason is that our meeting notes situation is a mess.'],
      [
        'them',
        'Today everyone takes notes in Google Docs during calls, and half of them never get shared with anyone.',
      ],
      ['me', 'So meeting notes are manual Google Docs right now. Got it.'],
      ['me', 'Tell me a bit about what your team builds.'],
      ['them', 'We build the payments dashboard for small online shops, mostly the reporting side.'],
      ['me', 'And how big is the team? Who picks the tools you use?'],
      [
        'them',
        'We are twelve engineers and two designers. Tools are decided by me together with our CTO, Lena.',
      ],
      ['me', 'Great, so twelve engineers and two designers, and you and Lena decide on tools.'],
      [
        'me',
        'For next steps, how about I send you a trial setup this week and we do a follow-up call next Thursday?',
      ],
      ['them', 'Yes, let us do that. Agreed: a trial this week and a follow-up call next Thursday.'],
      ['me', 'Perfect. I will send the invite right after this call.'],
    ],
  },
  {
    id: 'pm-feedback',
    meetingUid: 'sandbox-pm-feedback@kacola.test',
    title: 'Prototype feedback with the PM',
    them: 'Priya',
    summary: 'Clear answers on four items, and a decision that is explicitly left open.',
    expect: [
      'First impressions of the home screen: covered (great, but the past list is crowded).',
      'Is the live checklist distracting: covered (not at all).',
      'Would they send the share link to customers: covered (not until it has branding).',
      'Top three changes before the beta: covered (calmer list, branding, undo on every tick).',
      'Decide the beta date: discussed but left open, so in progress, never ticked.',
    ],
    agenda: `# Prototype feedback with the PM

## Items
- [ ] First impressions of the home screen
- [ ] Is the live checklist distracting during a call? [question]
- [ ] Would they send the share link to customers? [question]
- [ ] Top three changes before the beta [must-cover]
- [ ] Decide the beta date [decision]
`,
    lines: [
      ['them', 'Okay, I spent the morning with the prototype. Do you want my first impressions?'],
      ['me', 'Please. Start with the home screen.'],
      ['them', 'The home screen is great. Seeing my day, with the next meeting on top, is exactly right.'],
      ['them', 'The only thing is that the list of past meetings on the home screen feels a bit crowded.'],
      ['me', 'Noted: the home screen works, but the past meetings list is crowded.'],
      ['me', 'During a call, was the live checklist distracting?'],
      [
        'them',
        'The checklist was not distracting at all. I liked that items tick themselves off. I only glanced at it twice.',
      ],
      ['me', 'Good to hear. What about the share link? Would you send it to customers?'],
      ['them', 'Internally, yes. For customers I would want our logo on the shared page first, so not yet.'],
      ['me', 'Okay, so we do not send the share link to customers until the page has our branding.'],
      ['me', 'If you had to pick the top three changes before the beta, what are they?'],
      [
        'them',
        'One, a calmer past meetings list. Two, branding on the shared page. Three, an undo for every tick.',
      ],
      [
        'me',
        'Got it. The top three changes before the beta: a calmer list, branding on the share page, and undo on every tick.',
      ],
      ['them', 'Exactly.'],
      ['me', 'Last one, the beta date. Can we commit to a day?'],
      ['them', 'Let us not decide that today. Maybe mid November, but I need to check with marketing first.'],
      ['me', 'Okay, we leave the beta date open until you have talked to marketing.'],
    ],
  },
]

export const scenario = (id: string): Scenario | undefined => SCENARIOS.find((s) => s.id === id)

/**
 * The scenario as the fake pipeline speaks it: real-time by default (about 2.6 words a second, a short
 * pause between turns), `speed` times faster for tests.
 */
export function scriptFor(s: Scenario, speed = 1): MeetingScript {
  let t = 1000
  const utterances: ScriptLine[] = []
  for (const [who, text] of s.lines) {
    const words = text.split(/\s+/).length
    const dur = Math.max(1500, words * 380)
    utterances.push({
      track: who === 'me' ? 'mic' : 'system',
      ...(who === 'me' ? {} : { speaker: s.them }),
      startMs: Math.round(t / speed),
      endMs: Math.round((t + dur) / speed),
      text,
    })
    t += dur + 700
  }
  return { utterances }
}

/** The script's length at real-time speed, in seconds. */
export const scriptSeconds = (s: Scenario): number =>
  Math.ceil((scriptFor(s).utterances.at(-1)?.endMs ?? 0) / 1000)

/** The card one person reads aloud in `--audio mic` mode (both parts, the other in a different voice). */
export function scriptCard(s: Scenario): string {
  const out = [
    `── ${s.title} · read both parts aloud (about ${Math.round(scriptSeconds(s) / 60)} min) ──`,
    `   YOU lines in your own voice; ${s.them.toUpperCase()} lines in a different voice, after a short pause.`,
    '',
  ]
  for (const [who, text] of s.lines)
    out.push(`${who === 'me' ? 'YOU ' : `${s.them.toUpperCase()}`.padEnd(4)}  ${text}`)
  out.push('', 'What should happen:', ...s.expect.map((e) => `  • ${e}`))
  return out.join('\n')
}
