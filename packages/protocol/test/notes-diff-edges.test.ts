import { describe, expect, it } from 'vitest'
import {
  blockKey,
  defaultChoices,
  diffNoteBlocks,
  type Hunk,
  isOpenFence,
  mergeNoteBlocks,
  similarity,
  splitBlocks,
} from '../src/notes-diff.ts'

// Examples for the edges the generated documents in notes-diff.test.ts rarely reach: fence closing
// rules, the similarity threshold, which blocks a rewrite is paired with, and how the diff degrades on
// notes too large to align exactly.

const show = (hunks: Hunk[]) =>
  hunks.map((h) =>
    h.kind === 'same' || h.kind === 'changed'
      ? `${h.kind} ${h.mine.map(blockKey).join('|')} -> ${h.enhanced.map(blockKey).join('|')}`
      : h.kind === 'added'
        ? `added ${h.enhanced.map(blockKey).join('|')}`
        : `removed ${h.mine.map(blockKey).join('|')}`,
  )

describe('splitBlocks — block boundaries', () => {
  it('multi-digit ordered items and deeper headings start blocks', () => {
    expect(splitBlocks('1. a\n10. b\n')).toEqual(['1. a\n', '10. b\n'])
    expect(splitBlocks('para\n## H\n###### H6\n')).toEqual(['para\n', '## H\n', '###### H6\n'])
  })

  it('a fence closes only on a bare fence line of the same character and at least its length', () => {
    // an info string does not close it; trailing spaces do not stop a bare fence closing it
    expect(splitBlocks('```\ncode\n```js\nstill\n```  \nafter\n')).toEqual([
      '```\ncode\n```js\nstill\n```  \n',
      'after\n',
    ])
    expect(splitBlocks('````\nx\n```\ny\n````\nafter\n')).toEqual(['````\nx\n```\ny\n````\n', 'after\n'])
    expect(splitBlocks('```\nx\n~~~\ny\n  ```\nafter\n')).toEqual(['```\nx\n~~~\ny\n  ```\n', 'after\n'])
  })
})

describe('isOpenFence', () => {
  it.each([
    ['```\ncode\n```\n', false],
    ['```\nx\n  ```\n', false],
    ['```\ncode\n', true],
    ['```\n', true],
    ['~~~\nx\n```\n', true],
    ['````\nx\n```\n', true],
    ['```\n`x```\n', true],
    ['para\n', false],
    ['# heading\n', false],
  ])('%j -> %s', (block, open) => expect(isOpenFence(block)).toBe(open))
})

describe('similarity', () => {
  it('is zero when either side has no words, and ignores every stop word', () => {
    expect(similarity('---?', '!!')).toBe(0)
    expect(similarity('!!', 'dashboard')).toBe(0)
    const stop = 'the and for with that this from are was will have'
    expect(similarity(`${stop} dashboard`, `${stop} migration`)).toBe(0)
  })
})

describe('diffNoteBlocks — pairing a rewrite with the block it rewrote', () => {
  it('pairs blocks that share half their vocabulary, and not less', () => {
    expect(show(diffNoteBlocks('alpha beta\n', 'alpha gamma\n'))).toEqual([
      'changed alpha beta -> alpha gamma',
    ])
    expect(show(diffNoteBlocks('alpha beta gamma\n', 'alpha delta epsilon\n'))).toEqual([
      'removed alpha beta gamma',
      'added alpha delta epsilon',
    ])
  })

  it('pairs with the closest rewrite, not the first one that clears the threshold', () => {
    expect(
      show(diffNoteBlocks('budget alpha\n\nbudget review meeting notes\n', 'budget review meeting\n')),
    ).toEqual(['removed budget alpha', 'changed budget review meeting notes -> budget review meeting'])
  })

  it('pairs as many blocks as it can in order, leaving the rest as removed and added', () => {
    const mine = 'launch date moved\n\nbudget approved today\n\nrisks remain open\n'
    const enhanced = 'risks remain open items\n\nlaunch date moved again\n\nbudget approved today finally\n'
    expect(show(diffNoteBlocks(mine, enhanced))).toEqual([
      'added risks remain open items',
      'changed launch date moved -> launch date moved again',
      'changed budget approved today -> budget approved today finally',
      'removed risks remain open',
    ])
    expect(
      show(
        diffNoteBlocks(
          'unrelated words\n\nbudget review meeting\n\ncustomer churn numbers\n',
          'budget review meeting notes\n\nfresh section entirely\n\ncustomer churn numbers rose\n',
        ),
      ),
    ).toEqual([
      'removed unrelated words',
      'changed budget review meeting -> budget review meeting notes',
      'added fresh section entirely',
      'changed customer churn numbers -> customer churn numbers rose',
    ])
  })

  it('when two blocks swap places, the first user block is the one offered as moved', () => {
    expect(show(diffNoteBlocks('alpha one\n\nbeta two\n', 'beta two\n\nalpha one\n'))).toEqual([
      'removed alpha one',
      'same beta two -> beta two',
      'added alpha one',
    ])
  })

  it('an unchanged run is one context hunk', () => {
    expect(show(diffNoteBlocks('a\n\nb\n\nc\n', 'a\n\nb\n\nc\n'))).toEqual(['same a|b|c -> a|b|c'])
  })

  it('a repeated block matches where the notes still agree: at the end', () => {
    expect(show(diffNoteBlocks('X\n\nY\n\nZ\n\nY\n', 'Y\n'))).toEqual([
      'removed X',
      'removed Y',
      'removed Z',
      'same Y -> Y',
    ])
  })
})

describe('diffNoteBlocks — long notes', () => {
  const para = (i: number) => `paragraph number ${i} about topic ${i}\n\n`
  const long = (n: number, edit?: { at: number; text: string }) =>
    Array.from({ length: n }, (_, i) => (edit?.at === i ? edit.text : para(i))).join('')

  it('editing only the last or first block of a long note shows that one change', () => {
    const n = 3000
    const last = diffNoteBlocks(long(n), long(n, { at: n - 1, text: 'a brand new ending\n' }))
    expect(last.map((h) => h.kind)).toEqual(['same', 'removed', 'added'])
    expect(last[0]!.kind === 'same' && last[0]!.mine.length).toBe(n - 1)
    const first = diffNoteBlocks(long(n), long(n, { at: 0, text: 'a brand new opening\n\n' }))
    expect(first.map((h) => h.kind)).toEqual(['removed', 'added', 'same'])
  })

  it('beyond the alignment budget a rewrite degrades to removed + added, and still merges losslessly', () => {
    const mine = Array.from({ length: 2001 }, (_, i) => (i === 1000 ? 'shared\n\n' : `mine ${i}\n\n`)).join(
      '',
    )
    const enhanced = Array.from({ length: 2001 }, (_, i) =>
      i === 1000 ? 'shared\n\n' : `enh ${i}\n\n`,
    ).join('')
    const hunks = diffNoteBlocks(mine, enhanced)
    expect(hunks.filter((h) => h.kind === 'same')).toEqual([])
    expect(hunks.filter((h) => h.kind === 'removed')).toHaveLength(2001)
    expect(hunks.filter((h) => h.kind === 'added')).toHaveLength(2001)
    expect(
      mergeNoteBlocks(
        hunks,
        hunks.map(() => 'enhanced'),
      ),
    ).toBe(enhanced)
    expect(
      mergeNoteBlocks(
        hunks,
        hunks.map(() => 'mine'),
      ),
    ).toBe(mine)
  })

  it('too many rewritten blocks in one run are not paired, so the review cannot stall', () => {
    const n = 501
    const mine = Array.from({ length: n }, (_, i) => `budget line ${i} draft\n\n`).join('')
    const enhanced = Array.from({ length: n }, (_, i) => `budget line ${i} final\n\n`).join('')
    const kinds = diffNoteBlocks(mine, enhanced).map((h) => h.kind)
    expect(kinds).toEqual([...Array(n).fill('removed'), ...Array(n).fill('added')])
    // the same rewrite at a size that can be aligned is paired block by block
    const few = (w: string) => Array.from({ length: 20 }, (_, i) => `budget line ${i} ${w}\n\n`).join('')
    expect(diffNoteBlocks(few('draft'), few('final')).map((h) => h.kind)).toEqual(Array(20).fill('changed'))
  })
})

describe('defaultChoices', () => {
  it('takes every addition and rewrite, and keeps every block only the user wrote', () => {
    const hunks = diffNoteBlocks('# T\n\nalpha beta\n\nmy own line\n', '# T\n\nalpha gamma\n\nzeta eta\n')
    expect(show(hunks)).toEqual([
      'same # T -> # T',
      'changed alpha beta -> alpha gamma',
      'removed my own line',
      'added zeta eta',
    ])
    expect(defaultChoices(hunks)).toEqual(['enhanced', 'enhanced', 'mine', 'enhanced'])
  })
})

describe('mergeNoteBlocks — edges', () => {
  it('whitespace-only differences have nothing to choose, and the user bytes stay', () => {
    const hunks = diffNoteBlocks('a  \n', 'a\n')
    expect(hunks.map((h) => h.kind)).toEqual(['same'])
    expect(mergeNoteBlocks(hunks, ['enhanced'])).toBe('a  \n')
  })

  it('a blank line separates the user text from accepted enhanced text, even before a heading', () => {
    const hunks = diffNoteBlocks('alpha beta\n', '# Gamma\n')
    expect(mergeNoteBlocks(hunks, ['mine', 'enhanced'])).toBe('alpha beta\n\n# Gamma\n')
  })

  it('a kept multi-line paragraph is not joined by the next paragraph', () => {
    const hunks = diffNoteBlocks('line one\nline two\n', 'other text\n')
    expect(mergeNoteBlocks(hunks, ['mine', 'enhanced'])).toBe('line one\nline two\n\nother text\n')
  })

  it('carries whitespace-only content verbatim, without separating it', () => {
    const hunks = diffNoteBlocks('# T\n', '  \n')
    expect(show(hunks)).toEqual(['removed # T', 'added '])
    expect(mergeNoteBlocks(hunks, ['mine', 'enhanced'])).toBe('# T\n  \n')
  })

  it('names both counts when the choice list does not match the hunks', () => {
    expect(() => mergeNoteBlocks(diffNoteBlocks('alpha beta\n', 'alpha gamma\n'), [])).toThrow(
      new RangeError('expected 1 choices (one per hunk), got 0'),
    )
  })
})
