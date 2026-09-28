// Word error rate. Both sides go through the same normaliser first, so a model is not penalised for
// writing "3" where the reference says "three", for casing, or for punctuation — only for words.

const ONES = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
]
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']
const ORDINAL_IRREGULAR: Record<string, string> = {
  one: 'first',
  two: 'second',
  three: 'third',
  five: 'fifth',
  eight: 'eighth',
  nine: 'ninth',
  twelve: 'twelfth',
}

/** Integer → English words ("2024" → "two thousand twenty four"). */
export function numberToWords(n: number): string {
  if (!Number.isInteger(n) || n < 0) throw new Error(`not a non-negative integer: ${n}`)
  if (n < 20) return ONES[n]!
  if (n < 100) return [TENS[Math.floor(n / 10)]!, n % 10 ? ONES[n % 10]! : ''].filter(Boolean).join(' ')
  if (n < 1000)
    return [`${ONES[Math.floor(n / 100)]} hundred`, n % 100 ? numberToWords(n % 100) : '']
      .filter(Boolean)
      .join(' ')
  for (const [size, name] of [
    [1e9, 'billion'],
    [1e6, 'million'],
    [1e3, 'thousand'],
  ] as const) {
    if (n >= size) {
      const rest = n % size
      return [`${numberToWords(Math.floor(n / size))} ${name}`, rest ? numberToWords(rest) : '']
        .filter(Boolean)
        .join(' ')
    }
  }
  return String(n)
}

function ordinal(words: string): string {
  const parts = words.split(' ')
  const last = parts.pop()!
  const irregular = ORDINAL_IRREGULAR[last]
  const ord = irregular ?? (last.endsWith('y') ? `${last.slice(0, -1)}ieth` : `${last}th`)
  return [...parts, ord].join(' ')
}

const SPELLING: Record<string, string> = {
  ok: 'okay',
  alright: 'all right',
}

/** Lower-case, spell out numbers, drop punctuation. Returns the word sequence. */
export function normalizeWords(text: string): string[] {
  let s = text.toLowerCase().replace(/[‘’ʼ]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, ' ')
  s = s.replace(/\$(\d+)/g, '$1 dollars')
  s = s.replace(/(\d+)%/g, '$1 percent')
  s = s.replace(/(\d),(\d{3})/g, '$1$2')
  s = s.replace(/(\d+)\.(\d+)/g, (_, a: string, b: string) => `${a} point ${b.split('').join(' ')}`)
  s = s.replace(/\b(\d+)(st|nd|rd|th)\b/g, (_, d: string) => ordinal(numberToWords(Number(d))))
  s = s.replace(/\d+/g, (d) => ` ${numberToWords(Number(d))} `)
  s = s.replace(/[-/]/g, ' ')
  // keep apostrophes inside words (don't, ana's), drop every other non-letter
  s = s.replace(/[^a-z' ]+/g, ' ').replace(/(^|\s)'+|'+(?=\s|$)/g, ' ')
  const out: string[] = []
  for (const w of s.split(/\s+/)) {
    if (!w) continue
    const mapped = SPELLING[w] ?? w
    out.push(...mapped.split(' '))
  }
  return out
}

export type WerResult = {
  wer: number
  substitutions: number
  deletions: number
  insertions: number
  /** Reference word count (the denominator). */
  refWords: number
  hypWords: number
}

/** Word-level Levenshtein alignment over normalised words. */
export function wer(reference: string | string[], hypothesis: string | string[]): WerResult {
  const ref = Array.isArray(reference) ? reference.flatMap(normalizeWords) : normalizeWords(reference)
  const hyp = Array.isArray(hypothesis) ? hypothesis.flatMap(normalizeWords) : normalizeWords(hypothesis)
  const n = ref.length
  const m = hyp.length
  // dp[i][j] = [cost, subs, dels, ins] aligning ref[0..i) with hyp[0..j)
  type Cell = [number, number, number, number]
  let prev: Cell[] = Array.from({ length: m + 1 }, (_, j): Cell => [j, 0, 0, j])
  for (let i = 1; i <= n; i++) {
    const cur: Cell[] = [[i, 0, i, 0]]
    for (let j = 1; j <= m; j++) {
      const same = ref[i - 1] === hyp[j - 1]
      const diag = prev[j - 1]!
      const up = prev[j]!
      const left = cur[j - 1]!
      const cands: Cell[] = [
        [diag[0] + (same ? 0 : 1), diag[1] + (same ? 0 : 1), diag[2], diag[3]],
        [up[0] + 1, up[1], up[2] + 1, up[3]],
        [left[0] + 1, left[1], left[2], left[3] + 1],
      ]
      cands.sort((a, b) => a[0] - b[0])
      cur.push(cands[0]!)
    }
    prev = cur
  }
  const [cost, substitutions, deletions, insertions] = prev[m]!
  return {
    wer: n === 0 ? (m === 0 ? 0 : 1) : cost / n,
    substitutions,
    deletions,
    insertions,
    refWords: n,
    hypWords: m,
  }
}
