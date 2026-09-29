import { describe, expect, it } from 'vitest'
import { extractActionItems, parseActionItem } from '../src/notes-actions.ts'

// N-5 — action items come out of the notes deterministically: owner and due only where the notes say so.

describe('parseActionItem', () => {
  it.each([
    [
      'Update the dashboard — owner: Ana — due: Thursday',
      { text: 'Update the dashboard', owner: 'Ana', due: 'Thursday' },
    ],
    [
      'Update the dashboard — due: Thursday — owner: Ana',
      { text: 'Update the dashboard', owner: 'Ana', due: 'Thursday' },
    ],
    ['Write the rollback plan — owner: me', { text: 'Write the rollback plan', owner: 'me', due: null }],
    [
      'Ship the migration — owner: TBD — due: 2026-10-01',
      { text: 'Ship the migration', owner: null, due: '2026-10-01' },
    ],
    [
      '**Ana**: send the retry numbers by Friday',
      { text: 'send the retry numbers by Friday', owner: 'Ana', due: 'Friday' },
    ],
    [
      'Ana Lopez: book the staging window',
      { text: 'book the staging window', owner: 'Ana Lopez', due: null },
    ],
    [
      'Ana to send the deck by end of week',
      { text: 'Ana to send the deck by end of week', owner: 'Ana', due: 'end of week' },
    ],
    [
      'I will follow up with legal tomorrow',
      { text: 'I will follow up with legal tomorrow', owner: 'me', due: null },
    ],
    ['ping @marco about the budget [2]', { text: 'ping @marco about the budget', owner: 'marco', due: null }],
    ['We to decide on the vendor', { text: 'We to decide on the vendor', owner: null, due: null }],
    ['Draft the RFC (due next week)', { text: 'Draft the RFC', owner: null, due: 'next week' }],
    ['Review PR before Oct 3rd', { text: 'Review PR before Oct 3rd', owner: null, due: 'Oct 3rd' }],
    ['Plain task with no owner', { text: 'Plain task with no owner', owner: null, due: null }],
  ])('%s', (raw, want) => {
    expect(parseActionItem(raw)).toEqual({ ...want, done: false })
  })

  it('strips citation markers and refuses empty items', () => {
    expect(parseActionItem('Fix retries [1][3]')?.text).toBe('Fix retries')
    expect(parseActionItem('   ')).toBeNull()
    expect(parseActionItem('[1]')).toBeNull()
  })
})

describe('extractActionItems', () => {
  const notes = `# Platform standup

## Decisions

- Retry budget is three attempts [1]
- [x] Agree the migration date — owner: me

## Action items

- [ ] Update the dashboard — owner: Ana — due: Thursday
- Book the staging window — owner: Marco
  - with the infra team
1. Write the rollback plan by Friday

## Notes

- not an action item
\`\`\`
- [ ] inside a code block is not a task
\`\`\`
`

  it('finds task-list items anywhere and list items under an action heading, in order', () => {
    expect(extractActionItems(notes)).toEqual([
      { text: 'Agree the migration date', owner: 'me', due: null, done: true },
      { text: 'Update the dashboard', owner: 'Ana', due: 'Thursday', done: false },
      { text: 'Book the staging window', owner: 'Marco', due: null, done: false },
      { text: 'Write the rollback plan by Friday', owner: null, due: 'Friday', done: false },
    ])
  })

  it('recognises other headings for the section, and ends it at the next heading of that level', () => {
    const md = '### Next steps\n- one\n#### detail\n- two\n### Other\n- three\n'
    expect(extractActionItems(md).map((i) => i.text)).toEqual(['one', 'two'])
    expect(extractActionItems('## To-dos\n* a\n## Follow-ups\n+ b\n').map((i) => i.text)).toEqual(['a', 'b'])
  })

  it('returns nothing for notes without items', () => {
    expect(extractActionItems('')).toEqual([])
    expect(extractActionItems('just a paragraph\n\n- a bullet\n')).toEqual([])
  })
})
