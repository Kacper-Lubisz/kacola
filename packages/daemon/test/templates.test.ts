import { NoteTemplate } from '@gnomeola/protocol'
import { describe, expect, it } from 'vitest'
import { BUILT_IN_TEMPLATES, keywordMatches, suggestTemplate } from '../src/notes/templates.ts'

// N-3 — the default template per meeting type, chosen by keyword from the session title or (the hook
// calendar integration uses) the calendar event's title.

describe('suggestTemplate', () => {
  it.each([
    ['Daily standup', 'standup'],
    ['Platform stand-up', 'standup'],
    ['Scrum', 'standup'],
    ['Ana / Kacper 1:1', 'one-on-one'],
    ['One-on-one with Marco', 'one-on-one'],
    ['Interview — backend candidate', 'interview'],
    ['Phone screen: J. Doe', 'interview'],
    ['Quarterly planning', 'general'],
    ['Meeting 2026-09-29 10:00', 'general'],
    ['Dailymotion review', 'general'], // whole words only
    ['Candidates for the offsite venue', 'general'], // "candidate" is not "candidates"
  ])('%s → %s', (title, id) => {
    expect(suggestTemplate({ sessionTitle: title }).templateId).toBe(id)
  })

  it('prefers the calendar event title over the session title', () => {
    expect(suggestTemplate({ sessionTitle: 'Daily standup', calendarTitle: 'Interview loop' })).toEqual({
      templateId: 'interview',
      reason: 'keyword',
      matched: { keyword: 'interview', source: 'calendar' },
    })
    expect(suggestTemplate({ sessionTitle: 'Daily standup', calendarTitle: 'Budget review' })).toMatchObject({
      templateId: 'standup',
      matched: { source: 'session' },
    })
    expect(suggestTemplate({})).toEqual({ templateId: 'general', reason: 'default', matched: null })
  })

  it('lets a custom template take over a keyword', () => {
    const custom = [{ id: 'eng-sync', name: 'Eng sync', builtIn: false, keywords: ['standup'], body: '## x' }]
    expect(suggestTemplate({ sessionTitle: 'Daily standup' }, custom).templateId).toBe('eng-sync')
  })

  it('matches keywords case-insensitively on word boundaries, including punctuation-bearing ones', () => {
    expect(keywordMatches('1:1', 'HR 1:1')).toBe(true)
    expect(keywordMatches('1:1', 'HR 11:15')).toBe(false)
    expect(keywordMatches('Stand up', 'weekly stand up')).toBe(true)
    expect(keywordMatches('', 'anything')).toBe(false)
  })

  it('ships valid built-ins, each with an Action items or Next steps section', () => {
    for (const t of BUILT_IN_TEMPLATES) {
      expect(NoteTemplate.parse(t)).toEqual(t)
      expect(t.body).toMatch(/## (Action items|Next steps)/)
    }
  })
})
