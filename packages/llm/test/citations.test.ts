import type { Citation } from '@gnomeola/protocol'
import { describe, expect, it } from 'vitest'
import { CitationRewriter, resolveCitations } from '../src/citations.ts'

const cite = (n: number): Citation => ({
  sessionId: 'ses_1',
  segmentId: `seg_${n}`,
  startMs: n * 1000,
  endMs: n * 1000 + 500,
  speaker: n % 2 ? 'them' : 'me',
})
const aliases = new Map<string, Citation>([1, 2, 3, 12, 15].map((n) => [`s${n}`, cite(n)]))

describe('resolveCitations', () => {
  it('rewrites aliases to 1-based footnotes in order of first use', () => {
    const r = resolveCitations('Budget is three [s12]. Owner is Ana [s3]. Again three [s12].', aliases)
    expect(r.text).toBe('Budget is three [1]. Owner is Ana [2]. Again three [1].')
    expect(r.citations).toEqual([cite(12), cite(3)])
    expect(r.hallucinated).toEqual([])
  })

  it('expands groups and deduplicates within them', () => {
    const r = resolveCitations('Agreed [s12, s15,s12].', aliases)
    expect(r.text).toBe('Agreed [1][2].')
    expect(r.citations.map((c) => c.segmentId)).toEqual(['seg_12', 'seg_15'])
  })

  it('drops hallucinated aliases with their leading space and reports them', () => {
    const r = resolveCitations('Thursday [s99]. Ana [s3, s77]. End [S404]', aliases)
    expect(r.text).toBe('Thursday. Ana [1]. End')
    expect(r.hallucinated).toEqual(['s99', 's77', 's404'])
    expect(r.citations).toEqual([cite(3)])
  })

  it('leaves brackets that are not citation markers alone', () => {
    const r = resolveCitations('See [the doc] and [s] and [sx1] and a[1].', aliases)
    expect(r.text).toBe('See [the doc] and [s] and [sx1] and a[1].')
    expect(r.citations).toEqual([])
  })

  it('emits a dangling partial marker verbatim at end of stream', () => {
    expect(resolveCitations('cut off [s1', aliases).text).toBe('cut off [s1')
  })
})

describe('CitationRewriter — streaming', () => {
  const answer =
    'The retry budget is three attempts, then dead-letter [s12]. Ana owns the dashboard [s3, s15]. ' +
    'Someone said [s99] something odd [s2].  Bracket [not a cite] stays. Tail [s1]'

  it('produces exactly the batch result for every way of splitting the stream', () => {
    const expected = resolveCitations(answer, aliases)
    // every single split point, plus pseudo-random multi-splits
    const splits: number[][] = []
    for (let i = 0; i <= answer.length; i++) splits.push([i])
    let seed = 7
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) % 2 ** 31
      return seed / 2 ** 31
    }
    for (let k = 0; k < 300; k++) {
      const cuts = Array.from({ length: 1 + Math.floor(rnd() * 12) }, () => Math.floor(rnd() * answer.length))
      splits.push(cuts.sort((a, b) => a - b))
    }
    for (const cuts of splits) {
      const r = new CitationRewriter(aliases)
      let out = ''
      let from = 0
      for (const c of [...cuts, answer.length]) {
        out += r.push(answer.slice(from, c))
        from = c
      }
      out += r.flush()
      expect(out).toBe(expected.text)
      expect(r.text).toBe(expected.text)
      expect(r.citations).toEqual(expected.citations)
      expect(r.hallucinated).toEqual(expected.hallucinated)
    }
  })

  it('never emits a raw alias, even mid-stream', () => {
    const r = new CitationRewriter(aliases)
    const pieces = ['Budget ', 'is three [', 's1', '2', '] and ', '[s3', ',', ' s15]', '.']
    for (const p of pieces) expect(r.push(p)).not.toMatch(/\[s\d/)
    r.flush()
    expect(r.text).toBe('Budget is three [1] and [2][3].')
  })

  it('does not hold text back longer than needed', () => {
    const r = new CitationRewriter(aliases)
    expect(r.push('Hello world')).toBe('Hello world')
    expect(r.push(' and ')).toBe(' and') // trailing space held: it goes if a dropped marker follows
    expect(r.push('more')).toBe(' more')
  })
})
