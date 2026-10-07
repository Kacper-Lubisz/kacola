import type { NoteTemplate, TemplateSuggestion } from '@kacola/protocol'

// N-3 — note templates. Built-ins ship with the daemon; the user's custom templates live in the store.
// A meeting gets a default template from its title — or its calendar event's title, when a client that
// knows the calendar (M4) passes one — by keyword. The first match wins: custom templates are checked
// before built-ins (so a user can take over "standup"), the calendar title before the session title
// (it is what the organiser named the meeting; a session title is often "Meeting 2026-09-29 10:00").

export const DEFAULT_TEMPLATE_ID = 'general'

export const BUILT_IN_TEMPLATES: readonly NoteTemplate[] = [
  {
    id: 'general',
    name: 'General meeting',
    builtIn: true,
    keywords: [],
    body: `## Summary
Two or three sentences: what the meeting was for and where it landed.

## Discussion
One sub-list per topic, in the order discussed. Who argued what, where it matters.

## Decisions
Each decision on its own line, with who made it.

## Open questions
What was raised and not settled.

## Action items`,
  },
  {
    id: 'standup',
    name: 'Standup',
    builtIn: true,
    keywords: ['standup', 'stand-up', 'stand up', 'daily', 'scrum', 'check-in', 'sync-up'],
    body: `## Updates
One sub-heading per person ("### Ana"), each with:
- Done since last time
- Doing next
- Blockers (only if any)

## Blockers
Every blocker raised, who is blocked and who can unblock it.

## Action items`,
  },
  {
    id: 'one-on-one',
    name: '1:1',
    builtIn: true,
    keywords: ['1:1', '1-1', '1on1', '1-on-1', 'one on one', 'one-on-one', 'catch up', 'catch-up'],
    body: `## Topics
What each person brought, in the order discussed, with the gist of each conversation.

## Feedback
Feedback given in either direction, stated as it was given.

## Growth and goals
Career, goals or development points, if any came up.

## Action items`,
  },
  {
    id: 'interview',
    name: 'Interview',
    builtIn: true,
    keywords: ['interview', 'candidate', 'screening', 'phone screen', 'hiring', 'debrief'],
    body: `## Candidate
Name, role interviewed for, interview stage, interviewers.

## Background
Experience and context the candidate described.

## Questions and answers
One line per question asked, then the substance of the answer.

## Strengths

## Concerns

## Signals for the hiring decision
Evidence only; no overall verdict unless an interviewer stated one.

## Next steps`,
  },
]

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Whole-word, case-insensitive: "daily" matches "Daily sync" but not "dailymotion review". */
export function keywordMatches(keyword: string, title: string): boolean {
  const k = keyword.trim()
  if (!k) return false
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRe(k)}($|[^\\p{L}\\p{N}])`, 'iu').test(title)
}

/**
 * Pick the default template for a meeting. `calendarTitle` is the hook for calendar integration: a
 * client that knows the meeting's calendar event passes its title; nothing here depends on how.
 */
export function suggestTemplate(
  titles: { sessionTitle?: string | null; calendarTitle?: string | null },
  custom: readonly NoteTemplate[] = [],
): TemplateSuggestion {
  const candidates = [...custom, ...BUILT_IN_TEMPLATES]
  const sources = [
    ['calendar', titles.calendarTitle],
    ['session', titles.sessionTitle],
  ] as const
  for (const [source, title] of sources) {
    if (!title) continue
    for (const t of candidates)
      for (const keyword of t.keywords)
        if (keywordMatches(keyword, title))
          return { templateId: t.id, reason: 'keyword', matched: { keyword, source } }
  }
  return { templateId: DEFAULT_TEMPLATE_ID, reason: 'default', matched: null }
}

export function allTemplates(custom: readonly NoteTemplate[]): NoteTemplate[] {
  return [...BUILT_IN_TEMPLATES, ...custom]
}

export const isBuiltIn = (id: string): boolean => BUILT_IN_TEMPLATES.some((t) => t.id === id)
