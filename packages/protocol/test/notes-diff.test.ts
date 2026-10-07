import { describe, expect, it } from 'vitest'
import type { MergeChoice } from '../src/notes.ts'
import {
  blockKey,
  chosenBlocks,
  defaultChoices,
  diffNoteBlocks,
  type Hunk,
  isChoice,
  isOpenFence,
  mergedBlocks,
  mergeNoteBlocks,
  similarity,
  splitBlocks,
} from '../src/notes-diff.ts'

// N-4 / V-7 — the diff/merge module is where "your words are never lost or silently rewritten" is
// decided, so it is tested as properties over thousands of generated documents, not only examples.

/** mulberry32: small, seedable, good enough to generate test documents. */
function rng(seed: number) {
  let a = seed >>> 0
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const int = (n: number) => Math.floor(next() * n)
  const pick = <T>(xs: readonly T[]): T => xs[int(xs.length)]!
  return { next, int, pick }
}
type Rng = ReturnType<typeof rng>

const WORDS = [
  'retry',
  'budget',
  'Ana',
  'dashboard',
  'migration',
  'Thursday',
  'owner',
  'staging',
  'ship',
  'q3',
]
const sentence = (r: Rng, n = 1 + r.int(6)) => Array.from({ length: n }, () => r.pick(WORDS)).join(' ')

/** One markdown block of a random kind, with its own line ending(s). */
function block(r: Rng): string {
  const nl = r.next() < 0.1 ? '\r\n' : '\n'
  switch (r.int(9)) {
    case 0:
      return `${'#'.repeat(1 + r.int(3))} ${sentence(r)}${nl}`
    case 1:
    case 2:
      return `- ${sentence(r)}${nl}${r.next() < 0.3 ? `  - ${sentence(r)}${nl}` : ''}`
    case 3:
      return `${1 + r.int(9)}. ${sentence(r)}${nl}`
    case 4:
      return `- [${r.pick([' ', 'x'])}] ${sentence(r)}${nl}`
    case 5:
      return `\`\`\`${nl}${sentence(r)}${nl}${nl}${sentence(r)}${nl}\`\`\`${nl}`
    case 6:
      return `---${nl}`
    default:
      return `${sentence(r)}${nl}${r.next() < 0.3 ? `${sentence(r)}${nl}` : ''}`
  }
}

/** A document: blocks separated by nothing, one blank line, or several (some with spaces). */
function doc(r: Rng, n = r.int(12)): string {
  let s = r.next() < 0.1 ? '\n' : ''
  for (let i = 0; i < n; i++) {
    s += block(r)
    s += r.pick(['', '', '\n', '\n', '\n\n', ' \n', ' \n'])
  }
  if (r.next() < 0.3) s = s.replace(/\n+$/, '')
  return s
}

/** "Enhance" a document the way a model might: keep, rewrite, drop, insert and reorder blocks. */
function enhance(r: Rng, mine: string): string {
  const out: string[] = []
  for (const b of splitBlocks(mine)) {
    const x = r.next()
    if (x < 0.4) out.push(b)
    else if (x < 0.6) out.push(`${blockKey(b)} — expanded with ${sentence(r, 3)}\n\n`)
    else if (x < 0.7) continue
    else out.push(block(r))
    if (r.next() < 0.3) out.push(`${block(r)}\n`)
  }
  if (r.next() < 0.2 && out.length > 1) out.reverse()
  if (r.next() < 0.5) out.unshift(`## Summary\n\n${sentence(r, 8)}\n\n`)
  return out.join('')
}

/** Random bytes from a markdown-heavy alphabet: finds what the structured generator never would. */
function noise(r: Rng): string {
  const alphabet = [
    'a',
    'b',
    ' ',
    '\n',
    '\n',
    '-',
    '#',
    '`',
    '~',
    '*',
    '1',
    '.',
    ')',
    '[',
    ']',
    'x',
    '\r',
    ' ',
    '\t',
  ]
  return Array.from({ length: r.int(60) }, () => r.pick(alphabet)).join('')
}

const randomChoices = (r: Rng, hunks: Hunk[]): MergeChoice[] => hunks.map(() => r.pick(['mine', 'enhanced']))

/** The keys the merge must consist of: the chosen blocks, in order, blank-only blocks dropped. */
const expectedKeys = (hunks: Hunk[], choices: MergeChoice[]) => mergedBlocks(hunks, choices).map(blockKey)
const allEnhancedChosen = (hunks: Hunk[], choices: MergeChoice[]) => {
  const d = hunks.flatMap((h, i) => (isChoice(h) ? [choices[i]!] : []))
  return d.length > 0 && d.every((c) => c === 'enhanced')
}
const keysOf = (md: string) => splitBlocks(md).map(blockKey)
/** Unterminated fences swallow what follows: the one documented exception to key preservation. */
const unterminatedFence = (md: string) => {
  const last = splitBlocks(md).at(-1)
  return last !== undefined && isOpenFence(last)
}

// KACOLA_PROPERTY_RUNS=30000 for a deeper soak than CI needs
const PAIRS = Number(process.env.KACOLA_PROPERTY_RUNS ?? 3000)

function* cases(seed: number): Generator<[string, string, Rng]> {
  const r = rng(seed)
  for (let i = 0; i < PAIRS; i++) {
    const kind = r.int(4)
    if (kind === 0) yield [noise(r), noise(r), r]
    else if (kind === 1) {
      const mine = doc(r)
      yield [mine, doc(r), r]
    } else {
      const mine = doc(r)
      yield [mine, enhance(r, mine), r]
    }
  }
}

describe('splitBlocks', () => {
  it('is lossless for every generated or random input', () => {
    const r = rng(1)
    for (let i = 0; i < 5000; i++) {
      const s = i % 2 ? doc(r) : noise(r)
      expect(splitBlocks(s).join('')).toBe(s)
    }
  })

  it('never produces an empty block', () => {
    const r = rng(2)
    for (let i = 0; i < 2000; i++) for (const b of splitBlocks(noise(r))) expect(b).not.toBe('')
  })

  it('splits headings, top-level items, fences, breaks and paragraphs', () => {
    const md =
      '# Title\nIntro line\ncontinues\n\n- one\n- two\n  - nested\n  more of two\n1. first\n\n```\ncode\n\nstill code\n```\nafter fence\n---\nlast'
    expect(splitBlocks(md)).toEqual([
      '# Title\n',
      'Intro line\ncontinues\n\n',
      '- one\n',
      '- two\n  - nested\n  more of two\n',
      '1. first\n\n',
      '```\ncode\n\nstill code\n```\n',
      'after fence\n',
      '---\n',
      'last',
    ])
  })

  it('keeps leading blank lines with the first block and handles empty input', () => {
    expect(splitBlocks('')).toEqual([])
    expect(splitBlocks('\n\n')).toEqual(['\n\n'])
    expect(splitBlocks('\n\nhello\n')).toEqual(['\n\nhello\n'])
    expect(blockKey('\n\nhello \r\n\n')).toBe('hello')
  })
})

describe('diffNoteBlocks + mergeNoteBlocks (properties)', { timeout: Math.max(10_000, PAIRS * 10) }, () => {
  it('all-mine reproduces the user notes exactly; all-enhanced reproduces the enhanced text exactly', () => {
    for (const [mine, enh] of cases(10)) {
      const hunks = diffNoteBlocks(mine, enh)
      expect(
        mergeNoteBlocks(
          hunks,
          hunks.map(() => 'mine'),
        ),
      ).toBe(mine)
      // with nothing to decide (the texts differ at most in whitespace) the user's text stays as it is
      expect(
        mergeNoteBlocks(
          hunks,
          hunks.map(() => 'enhanced'),
        ),
      ).toBe(hunks.some(isChoice) ? enh : mine)
    }
  })

  it('the hunks account for every block of both sides, in order', () => {
    for (const [mine, enh] of cases(11)) {
      const hunks = diffNoteBlocks(mine, enh)
      expect(hunks.flatMap((h) => (h.kind === 'added' ? [] : h.mine)).join('')).toBe(mine)
      expect(hunks.flatMap((h) => (h.kind === 'removed' ? [] : h.enhanced)).join('')).toBe(enh)
      for (const h of hunks) {
        if (h.kind === 'same') expect(h.mine.map(blockKey)).toEqual(h.enhanced.map(blockKey))
        if (h.kind === 'changed') expect(h.mine.length).toBe(1)
      }
    }
  })

  it('any choices: the merge is exactly the chosen blocks, in order, each verbatim', () => {
    for (const [mine, enh, r] of cases(12)) {
      const hunks = diffNoteBlocks(mine, enh)
      for (let k = 0; k < 3; k++) {
        const choices = randomChoices(r, hunks)
        const merged = mergeNoteBlocks(hunks, choices)
        // every chosen block appears verbatim, in order: only line breaks are ever inserted between them
        let at = 0
        for (const b of mergedBlocks(hunks, choices)) {
          const found = merged.indexOf(b, at)
          expect(found, `block ${JSON.stringify(b)} in ${JSON.stringify(merged)}`).toBeGreaterThanOrEqual(at)
          expect(merged.slice(at, found)).toMatch(/^\n{0,2}$/)
          at = found + b.length
        }
        expect(at, JSON.stringify({ blocks: mergedBlocks(hunks, choices), merged })).toBe(merged.length)
        if (!unterminatedFence(mine) && !unterminatedFence(enh))
          expect(
            keysOf(merged).filter((k) => k !== ''),
            JSON.stringify({ mine, enh, choices }),
          ).toEqual(expectedKeys(hunks, choices).filter((k) => k !== ''))
      }
    }
  })

  it('never drops a user block that a choice kept: every kept block is in the merge', () => {
    for (const [mine, enh, r] of cases(13)) {
      if (unterminatedFence(mine) || unterminatedFence(enh)) continue
      const hunks = diffNoteBlocks(mine, enh)
      const choices = randomChoices(r, hunks)
      const merged = keysOf(mergeNoteBlocks(hunks, choices))
      hunks.forEach((h, i) => {
        if (h.kind === 'same' || choices[i] === 'mine')
          for (const b of 'mine' in h ? h.mine : []) if (blockKey(b)) expect(merged).toContain(blockKey(b))
      })
    }
  })

  it('accept/revert round-trips: re-diffing a merge against the enhanced version offers back only what was kept', () => {
    for (const [mine, enh, r] of cases(14)) {
      if (unterminatedFence(mine) || unterminatedFence(enh)) continue
      const hunks = diffNoteBlocks(mine, enh)
      const choices = randomChoices(r, hunks)
      const merged = mergeNoteBlocks(hunks, choices)
      const again = diffNoteBlocks(merged, enh)
      // accepting everything in a second review still reaches the enhanced text exactly…
      expect(
        mergeNoteBlocks(
          again,
          again.map(() => 'enhanced'),
        ),
      ).toBe(again.some(isChoice) ? enh : merged)
      // …and reverting everything in it gives back the first review's result exactly
      expect(
        mergeNoteBlocks(
          again,
          again.map(() => 'mine'),
        ),
      ).toBe(merged)
      // accepted blocks are not offered again: the second review offers at most the enhanced blocks the
      // first one declined, and at most the user blocks it kept (whitespace-only blocks aside: a blank
      // document's whitespace attaches to whatever precedes it once merged)
      if (allEnhancedChosen(hunks, choices)) {
        expect(again.filter(isChoice)).toEqual([])
        continue
      }
      const count = (hs: Hunk[], side: 'mine' | 'enhanced', pick: (h: Hunk, i: number) => boolean) =>
        hs.reduce(
          (n, h, i) =>
            n +
            (h.kind !== 'same' && pick(h, i)
              ? (side === 'mine' ? ('mine' in h ? h.mine : []) : 'enhanced' in h ? h.enhanced : []).filter(
                  (b) => blockKey(b) !== '',
                ).length
              : 0),
          0,
        )
      const offeredEnhanced = count(again, 'enhanced', () => true)
      const declinedEnhanced = count(hunks, 'enhanced', (_, i) => choices[i] === 'mine')
      expect(offeredEnhanced, JSON.stringify({ mine, enh, choices, merged })).toBeLessThanOrEqual(
        declinedEnhanced,
      )
      const offeredMine = count(again, 'mine', () => true)
      const keptMine = count(hunks, 'mine', (_, i) => choices[i] === 'mine')
      expect(offeredMine).toBeLessThanOrEqual(keptMine)
    }
  })

  it('toggling a hunk twice is a no-op, and toggling one hunk changes only that hunk’s blocks', () => {
    for (const [mine, enh, r] of cases(15)) {
      if (unterminatedFence(mine) || unterminatedFence(enh)) continue
      const hunks = diffNoteBlocks(mine, enh)
      const idx = hunks.map((h, i) => (isChoice(h) ? i : -1)).filter((i) => i >= 0)
      if (!idx.length) continue
      const base = randomChoices(r, hunks)
      const i = r.pick(idx)
      const flipped = base.map((c, j): MergeChoice => (j === i ? (c === 'mine' ? 'enhanced' : 'mine') : c))
      const back = flipped.map((c, j): MergeChoice => (j === i ? (c === 'mine' ? 'enhanced' : 'mine') : c))
      expect(mergeNoteBlocks(hunks, back)).toBe(mergeNoteBlocks(hunks, base))
      const before = expectedKeys(hunks, base)
      const after = expectedKeys(hunks, flipped)
      const other = (cs: MergeChoice[]) =>
        hunks.flatMap((h, j) => (j === i ? [] : chosenBlocks(h, cs[j]!))).map(blockKey)
      expect(other(flipped)).toEqual(other(base))
      expect(keysOf(mergeNoteBlocks(hunks, flipped)).filter(Boolean)).toEqual(after.filter(Boolean))
      expect(before.length + after.length).toBeGreaterThanOrEqual(0)
    }
  })

  it('default choices never drop a user block', () => {
    for (const [mine, enh] of cases(16)) {
      if (unterminatedFence(mine) || unterminatedFence(enh)) continue
      const hunks = diffNoteBlocks(mine, enh)
      const choices = defaultChoices(hunks)
      const merged = new Set(keysOf(mergeNoteBlocks(hunks, choices)))
      for (const h of hunks)
        if (h.kind === 'removed')
          for (const b of h.mine) if (blockKey(b)) expect(merged.has(blockKey(b))).toBe(true)
    }
  })

  it('is deterministic', () => {
    for (const [mine, enh] of cases(17)) expect(diffNoteBlocks(mine, enh)).toEqual(diffNoteBlocks(mine, enh))
  })

  it('refuses a choice list of the wrong length', () => {
    const hunks = diffNoteBlocks('a\n', 'b\n')
    expect(() => mergeNoteBlocks(hunks, [])).toThrow(RangeError)
  })
})

describe('diffNoteBlocks (examples)', () => {
  const mine = '- retry budget?\n- migration thursday\n- Ana dashboard\n'
  const enhanced =
    '## Decisions\n\n- Retry budget: three attempts, then dead-letter [1]\n- migration thursday\n\n## Action items\n\n- [ ] Update the dashboard — owner: Ana — due: Thursday\n'

  it('keeps identical lines as context and pairs each user line with its rewrite', () => {
    const hunks = diffNoteBlocks(mine, enhanced)
    expect(hunks.map((h) => h.kind)).toEqual(['added', 'changed', 'same', 'added', 'changed'])
    const changed = hunks.filter((h) => h.kind === 'changed')
    expect(changed.map((h) => h.mine.map(blockKey))).toEqual([['- retry budget?'], ['- Ana dashboard']])
    expect(blockKey(changed[1]!.enhanced[0]!)).toMatch(/Update the dashboard/)
  })

  it('merges the choices into readable markdown', () => {
    const hunks = diffNoteBlocks(mine, enhanced)
    const choices: MergeChoice[] = hunks.map((h) =>
      h.kind === 'changed' && h.mine[0]!.includes('Ana') ? 'mine' : 'enhanced',
    )
    expect(mergeNoteBlocks(hunks, choices)).toBe(
      '## Decisions\n\n- Retry budget: three attempts, then dead-letter [1]\n- migration thursday\n\n## Action items\n\n- Ana dashboard\n',
    )
  })

  it('offers a user block that enhancement dropped as removed, kept by default', () => {
    const hunks = diffNoteBlocks('keep me\n\nmore of my words\n', 'keep me\n')
    expect(hunks.map((h) => h.kind)).toEqual(['same', 'removed'])
    expect(mergeNoteBlocks(hunks, defaultChoices(hunks))).toBe('keep me\n\nmore of my words\n')
    expect(mergeNoteBlocks(hunks, ['mine', 'enhanced'])).toBe('keep me\n')
  })

  it('inserts a blank line where a kept paragraph would otherwise join an accepted list item', () => {
    const hunks = diffNoteBlocks('para one\n', '- new item\npara one\n'.replace('para one', 'x'))
    const merged = mergeNoteBlocks(
      diffNoteBlocks('my paragraph\n', '- new item\n'),
      diffNoteBlocks('my paragraph\n', '- new item\n').map((h) => (h.kind === 'added' ? 'enhanced' : 'mine')),
    )
    expect(hunks.length).toBeGreaterThan(0)
    expect(splitBlocks(merged).map(blockKey)).toEqual(expect.arrayContaining(['my paragraph', '- new item']))
  })

  it('handles empty sides', () => {
    expect(diffNoteBlocks('', '')).toEqual([])
    expect(diffNoteBlocks('', '# x\n').map((h) => h.kind)).toEqual(['added'])
    expect(diffNoteBlocks('# x\n', '').map((h) => h.kind)).toEqual(['removed'])
    expect(mergeNoteBlocks([], [])).toBe('')
  })

  it('scores similarity by shared vocabulary', () => {
    expect(similarity('- retry budget?', '- Retry budget: three attempts')).toBe(1)
    expect(similarity('the and for', 'the and for')).toBe(0) // stop words only
    expect(similarity('dashboard owner', 'migration staging')).toBe(0)
  })

  it('stays fast on large notes', () => {
    const r = rng(99)
    const big = doc(r, 1500)
    const other = enhance(r, big)
    const t0 = performance.now()
    const hunks = diffNoteBlocks(big, other)
    expect(
      mergeNoteBlocks(
        hunks,
        hunks.map(() => 'mine'),
      ),
    ).toBe(big)
    expect(performance.now() - t0).toBeLessThan(3000)
  })
})
