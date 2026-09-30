import { describe, expect, it } from 'vitest'
import {
  AgendaItemKind,
  AgendaItemStatus,
  ChangedBy,
  extractInviteBlock,
  formatAgendaLink,
  formatAgendaMarkdown,
  formatItemLine,
  formatMeetingLink,
  INVITE_BLOCK_END,
  INVITE_BLOCK_START,
  ItemText,
  isForwardMove,
  type MarkdownAgenda,
  type MarkdownItem,
  parseAgendaMarkdown,
  parseItemText,
  parseKacolaLink,
  removeInviteBlock,
  renderInviteBlock,
  SuggestionSource,
  upsertInviteBlock,
} from '../src/index.ts'

// Agendas' pure contract: the markdown form (lossless round trip, proved over random agendas), the
// deep links, and the invitation block (idempotent, never touching the organiser's text).

function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
type R = () => number
const pick = <T>(r: R, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!
const int = (r: R, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1))

// Characters chosen to hit every escape path: the group openers/closers, backslashes, @, commas, digits,
// markdown-ish punctuation, unicode.
const ALPHABET = [
  ...'abcdefghijklmnopqrstuvwxyz ABC 0123456789',
  ...'()[]\\@,:-*#>~x"\'`_',
  'é',
  'ł',
  '日',
  '🙂',
]
const TAILS = [
  '(10m)',
  '(@ana)',
  '(5m, @bo)',
  '[decision]',
  '[must-cover]',
  '(x)',
  '[nope]',
  '\\',
  '(',
  '[ ]',
  '[x]',
]

function randomText(r: R): string {
  let s = ''
  const n = int(r, 1, 40)
  for (let i = 0; i < n; i++) s += pick(r, ALPHABET)
  if (r() < 0.4) s += ` ${pick(r, TAILS)}`
  if (r() < 0.15) s = `${pick(r, TAILS)} ${s}`
  return ItemText.safeParse(s).success ? ItemText.parse(s) : 'fallback'
}
const OWNERS = ['me', 'them', 'ana', 'Ana Smith', 'bo-2', 'Zoë', 'o@x.com']

function randomItem(r: R): MarkdownItem {
  return {
    text: randomText(r),
    kind: pick(r, AgendaItemKind.options),
    owner: r() < 0.5 ? pick(r, OWNERS) : null,
    timeboxMin: r() < 0.5 ? int(r, 1, 480) : null,
    status: pick(r, AgendaItemStatus.options),
    outcome:
      r() < 0.3
        ? Array.from({ length: int(r, 1, 3) }, () => randomText(r))
            .map((l) => l.trim())
            .join('\n')
        : null,
  }
}

describe('agenda markdown', () => {
  it('parses the documented form', () => {
    const md = [
      '# 1:1 with Ana',
      '',
      '## Goals',
      '- agree the promo timeline',
      '',
      '## Items',
      '- [ ] Promo timeline (10m, @ana) [must-cover]',
      '- [~] Hiring plan (@me)',
      '- [x] Budget sign-off [decision]',
      '  > approved at 40k',
      '  > pending finance',
      '- [-] Skipped thing',
      '- [>] Offsite dates (1h30m)',
      '- a plain bullet',
      '* [X] star bullet [Question]',
      '  - a nested bullet is ignored',
      'Some prose is ignored.',
    ].join('\n')
    expect(parseAgendaMarkdown(md)).toEqual({
      title: '1:1 with Ana',
      goals: ['agree the promo timeline'],
      items: [
        {
          text: 'Promo timeline',
          kind: 'must-cover',
          owner: 'ana',
          timeboxMin: 10,
          status: 'open',
          outcome: null,
        },
        {
          text: 'Hiring plan',
          kind: 'topic',
          owner: 'me',
          timeboxMin: null,
          status: 'in-progress',
          outcome: null,
        },
        {
          text: 'Budget sign-off',
          kind: 'decision',
          owner: null,
          timeboxMin: null,
          status: 'covered',
          outcome: 'approved at 40k\npending finance',
        },
        {
          text: 'Skipped thing',
          kind: 'topic',
          owner: null,
          timeboxMin: null,
          status: 'skipped',
          outcome: null,
        },
        {
          text: 'Offsite dates',
          kind: 'topic',
          owner: null,
          timeboxMin: 90,
          status: 'parked',
          outcome: null,
        },
        {
          text: 'a plain bullet',
          kind: 'topic',
          owner: null,
          timeboxMin: null,
          status: 'open',
          outcome: null,
        },
        {
          text: 'star bullet',
          kind: 'question',
          owner: null,
          timeboxMin: null,
          status: 'covered',
          outcome: null,
        },
      ],
    })
  })

  it('reads groups in either order, quoted owners, and leaves non-metadata parentheses in the text', () => {
    expect(parseItemText('Roadmap [decision] (15 min, @"Ana Smith")')).toEqual({
      text: 'Roadmap',
      kind: 'decision',
      owner: 'Ana Smith',
      timeboxMin: 15,
    })
    expect(parseItemText('Ship v2 (maybe)')).toMatchObject({ text: 'Ship v2 (maybe)', kind: 'topic' })
    expect(parseItemText('Ask about [x] later')).toMatchObject({ text: 'Ask about [x] later' })
    expect(parseItemText('Budget [unknown-kind]')).toMatchObject({
      text: 'Budget [unknown-kind]',
      kind: 'topic',
    })
  })

  it('a task-list bullet is an item even under Goals; a checkbox-like goal is escaped', () => {
    expect(parseAgendaMarkdown('## Goals\n- ship v2\n\n- [ ] Promo\n- dates too')).toEqual({
      title: null,
      goals: ['ship v2', 'dates too'],
      items: [{ text: 'Promo', kind: 'topic', owner: null, timeboxMin: null, status: 'open', outcome: null }],
    })
    const md = formatAgendaMarkdown({ title: null, goals: ['[x] looks like a task'], items: [] })
    expect(md).toContain('- \\[x] looks like a task')
    expect(parseAgendaMarkdown(md).goals).toEqual(['[x] looks like a task'])
  })

  it('escapes text that would read as metadata, and it survives', () => {
    const item: MarkdownItem = {
      text: 'Discuss (10m) [decision]',
      kind: 'topic',
      owner: null,
      timeboxMin: null,
      status: 'open',
      outcome: null,
    }
    const line = formatItemLine(item)
    // escaping the last group is enough: the one before it no longer ends the line
    expect(line).toBe('- [ ] Discuss (10m) \\[decision]')
    expect(parseAgendaMarkdown(line).items[0]).toEqual(item)
  })

  it('round-trips losslessly: export → import is the identity on random agendas (1000 cases)', () => {
    for (let seed = 1; seed <= 1000; seed++) {
      const r = rng(seed)
      const a: MarkdownAgenda = {
        title: r() < 0.8 ? randomText(r).replace(/^#+/, 'h') : null,
        goals: Array.from({ length: int(r, 0, 3) }, () => randomText(r)),
        items: Array.from({ length: int(r, 0, 8) }, () => randomItem(r)),
      }
      const md = formatAgendaMarkdown(a)
      const back = parseAgendaMarkdown(md)
      expect(back, `seed ${seed}\n${md}`).toEqual(a)
      // and the markdown is stable: formatting what was parsed yields the same text
      expect(formatAgendaMarkdown(back)).toBe(md)
    }
  })
})

describe('deep links', () => {
  it('format and parse agenda and meeting links', () => {
    expect(formatAgendaLink('agd_1')).toBe('kacola://agenda/agd_1')
    expect(parseKacolaLink('kacola://agenda/agd_1')).toEqual({ kind: 'agenda', agendaId: 'agd_1' })
    const uid = 'abc/def@google.com'
    const link = formatMeetingLink(uid, '2026-10-01T09:00:00+02:00')
    expect(link).toBe('kacola://meeting/abc%2Fdef%40google.com?start=2026-10-01T07%3A00%3A00.000Z')
    expect(parseKacolaLink(link)).toEqual({
      kind: 'meeting',
      eventUid: uid,
      start: '2026-10-01T07:00:00.000Z',
    })
    expect(parseKacolaLink(formatMeetingLink(uid))).toEqual({ kind: 'meeting', eventUid: uid, start: null })
  })
  it('rejects what is not a kacola link', () => {
    for (const bad of [
      'https://x/agenda/1',
      'kacola://agenda/',
      'kacola://other/1',
      'kacola://meeting/x?start=not-a-date',
      'kacola://agenda/%E0%A4%A',
    ])
      expect(parseKacolaLink(bad), bad).toBeNull()
  })
})

describe('invitation block', () => {
  const block = renderInviteBlock({ appLink: 'kacola://agenda/agd_1', webLink: 'https://k.example/a/agd_1' })
  it('renders a marked block with both links', () => {
    expect(block).toBe(
      `${INVITE_BLOCK_START}\nAgenda: kacola://agenda/agd_1 · web: https://k.example/a/agd_1\n${INVITE_BLOCK_END}`,
    )
    expect(renderInviteBlock({ appLink: 'kacola://agenda/x' })).toContain('Agenda: kacola://agenda/x\n')
  })
  it('never changes the organiser text, is idempotent, updates in place and removes cleanly', () => {
    const r = rng(7)
    for (let i = 0; i < 300; i++) {
      const organiser = Array.from({ length: int(r, 0, 5) }, () => randomText(r)).join(
        pick(r, ['\n', '\n\n', ' ']),
      )
      const withEnd = organiser + pick(r, ['', '\n', '\n\n'])
      const once = upsertInviteBlock(withEnd, block)
      expect(once.startsWith(withEnd)).toBe(true)
      expect(upsertInviteBlock(once, block)).toBe(once)
      expect(extractInviteBlock(once)).toBe(block)
      const other = renderInviteBlock({ appLink: 'kacola://agenda/agd_2' })
      const updated = upsertInviteBlock(once, other)
      expect(updated.startsWith(withEnd)).toBe(true)
      expect(updated.split(INVITE_BLOCK_START)).toHaveLength(2)
      expect(extractInviteBlock(updated)).toBe(other)
      expect(removeInviteBlock(updated).trimEnd()).toBe(withEnd.trimEnd())
    }
  })
  it('keeps text the organiser wrote after our block', () => {
    const d = `Hello\n\n${block}\nPS from organiser`
    const updated = upsertInviteBlock(d, renderInviteBlock({ appLink: 'kacola://agenda/z' }))
    expect(updated.endsWith('\nPS from organiser')).toBe(true)
    expect(updated.startsWith('Hello\n\n')).toBe(true)
  })
})

describe('rules in the schemas', () => {
  it('forward-only order of statuses', () => {
    expect(isForwardMove('open', 'in-progress')).toBe(true)
    expect(isForwardMove('in-progress', 'covered')).toBe(true)
    expect(isForwardMove('open', 'parked')).toBe(true)
    expect(isForwardMove('covered', 'open')).toBe(false)
    expect(isForwardMove('covered', 'skipped')).toBe(false)
    expect(isForwardMove('in-progress', 'in-progress')).toBe(false)
  })
  it('who can change things', () => {
    for (const ok of ['user', 'tracker', 'agent:claude', 'agent:my.bot-2', 'invitee:ana@example.com'])
      expect(ChangedBy.safeParse(ok).success, ok).toBe(true)
    for (const bad of ['me', 'agent:', 'agent:has space', 'invitee:nope', 'tracker '])
      expect(ChangedBy.safeParse(bad).success, bad).toBe(false)
    expect(SuggestionSource.safeParse('user').success).toBe(false)
    expect(SuggestionSource.safeParse('agent:claude').success).toBe(true)
  })
})
