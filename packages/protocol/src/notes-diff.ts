import type { MergeChoice } from './notes.ts'

// N-4 — block-level diff and merge of markdown notes: the user's notes ("mine") against an enhanced
// version. Pure and deterministic, shared by the daemon (which applies a merge) and every client (which
// shows the same hunks and sends one choice per hunk back), so both sides always agree on what hunk 7 is.
//
// Guarantees, each property-tested in test/notes-diff.test.ts:
//
//   - splitBlocks is lossless: splitBlocks(md).join('') === md, for every string.
//   - Choosing `mine` for every hunk reproduces the user's text byte for byte; choosing `enhanced` for
//     every hunk reproduces the enhanced text byte for byte. (Texts that differ only in whitespace have
//     no hunk to choose, and the user's text stays exactly as it is.)
//   - For any choices, the merged text is exactly the chosen blocks, in order, each verbatim: re-splitting
//     it yields the same block keys. A block the user kept is never altered, merged into a neighbour or
//     reordered. (One documented exception: an unterminated ``` fence swallows whatever follows it, in
//     the merge as in any markdown renderer — its bytes are still all there.)
//   - Re-diffing a merge against the enhanced version leaves exactly the hunks the user kept as their
//     own, so a later review can still accept them (accept/revert round-trips).
//
// What a block is: a heading line; a top-level list item (with its continuation and nested lines); a
// fenced code block; a thematic break; or a paragraph. Each block carries the blank lines that follow it,
// which is what makes the split lossless.

export type Hunk =
  /** Identical in both (by key). Not a choice. `mine` is what is emitted. */
  | { kind: 'same'; mine: string[]; enhanced: string[] }
  /** Only in the enhanced version. `enhanced` = include it, `mine` = leave it out. */
  | { kind: 'added'; enhanced: string[] }
  /** Only in the user's notes. `enhanced` = drop it, `mine` = keep it. */
  | { kind: 'removed'; mine: string[] }
  /** The user's block rewritten as the enhanced block. */
  | { kind: 'changed'; mine: string[]; enhanced: string[] }

const FENCE = /^ {0,3}(`{3,}|~{3,})/
const HEADING = /^ {0,3}#{1,6}(\s|$)/
/** A list item that starts a block: at most one space of indent, so nested items stay with their parent. */
const TOP_ITEM = /^ ?([-*+]|\d{1,9}[.)])(\s|$)/
const THEMATIC_BREAK = /^ {0,3}([-*_])( *\1){2,} *$/
const blank = (line: string) => line.trim() === ''

/** Split into lines, each keeping its own line terminator. */
function lines(md: string): string[] {
  const out: string[] = []
  let at = 0
  while (at < md.length) {
    const nl = md.indexOf('\n', at)
    const end = nl === -1 ? md.length : nl + 1
    out.push(md.slice(at, end))
    at = end
  }
  return out
}

/** Lossless split into markdown blocks: the result joined with '' is the input. */
export function splitBlocks(md: string): string[] {
  const blocks: string[] = []
  let cur = ''
  /** The current block has content (not just leading blank lines). */
  let hasContent = false
  /** The current block ended with a blank line: the next content line starts a new block. */
  let afterBlank = false
  /** The current block cannot continue (heading, thematic break, closed fence). */
  let closed = false
  let fence: { char: string; len: number } | null = null

  const start = (line: string) => {
    if (hasContent) {
      blocks.push(cur)
      cur = ''
    }
    cur += line
    hasContent = true
    afterBlank = false
    closed = false
  }

  for (const line of lines(md)) {
    // classify without CRs, exactly as blockKey sees the line
    // Stryker disable next-line Regex: equivalent — a line holds at most one '\n', at its end
    const text = line.replace(/\r/g, '').replace(/\n$/, '')
    if (fence) {
      cur += line
      const m = FENCE.exec(text)
      if (m && m[1]![0] === fence.char && m[1]!.length >= fence.len && text.trim() === m[1]) {
        fence = null
        closed = true
      }
      continue
    }
    if (blank(text)) {
      cur += line
      if (hasContent) afterBlank = true
      continue
    }
    const f = FENCE.exec(text)
    if (f) {
      start(line)
      fence = { char: f[1]![0]!, len: f[1]!.length }
      continue
    }
    if (HEADING.test(text) || THEMATIC_BREAK.test(text)) {
      start(line)
      closed = true
      continue
    }
    if (!hasContent) {
      // leading blank lines belong to the first block
      cur += line
      hasContent = true
      continue
    }
    if (afterBlank || closed || TOP_ITEM.test(text)) {
      start(line)
      continue
    }
    cur += line // continuation of a paragraph or a list item
  }
  if (cur !== '') blocks.push(cur)
  return blocks
}

/** What two blocks are compared by: the text without surrounding blank lines, trailing space or CRs. */
export function blockKey(block: string): string {
  const ls = block.replace(/\r/g, '').split('\n')
  let first = 0
  while (first < ls.length && blank(ls[first]!)) first++
  return ls.slice(first).join('\n').trimEnd()
}

const firstLine = (block: string) => blockKey(block).split('\n')[0]!

/** A block that starts a new block wherever it is placed, whatever precedes it. */
function selfStarting(block: string): boolean {
  const l = firstLine(block)
  return FENCE.test(l) || HEADING.test(l) || THEMATIC_BREAK.test(l) || TOP_ITEM.test(l)
}

/** A block after which anything starts a new block: a heading, a thematic break, a closed fence. */
function closesItself(block: string): boolean {
  const k = blockKey(block)
  const l = firstLine(block)
  if (HEADING.test(l) || THEMATIC_BREAK.test(l)) return !k.includes('\n')
  const f = FENCE.exec(l)
  if (!f || !k.includes('\n')) return false
  const last = k.split('\n').at(-1)!.trim()
  return /^(`{3,}|~{3,})$/.test(last) && last[0] === f[1]![0] && last.length >= f[1]!.length
}

/** A fenced code block that is never closed: it runs to the end of the document it is in. */
export function isOpenFence(block: string): boolean {
  return FENCE.test(firstLine(block)) && !closesItself(block)
}

/** Whether the text ends with a blank line (by the splitter's own definition of blank). */
function endsWithBlankLine(s: string): boolean {
  // Stryker disable next-line all: equivalent at the one call site, which appends a '\n' first; kept so the helper means what it says
  if (!s.endsWith('\n')) return false
  const body = s.slice(0, -1)
  return blank(body.slice(body.lastIndexOf('\n') + 1))
}

// ------------------------------------------------------------------------ diff

type Op = { op: 'same'; a: number; b: number } | { op: 'del'; a: number } | { op: 'ins'; b: number }

/** LCS table cells; beyond this the middle is reported as all-removed + all-added rather than stall. */
const MAX_CELLS = 4_000_000

/** Longest common subsequence over block keys, as an edit script. */
function lcsOps(a: string[], b: string[]): Op[] {
  // common prefix/suffix first: cheap, and the usual case for an enhancement that kept the user's lines
  let pre = 0
  while (pre < a.length && pre < b.length && a[pre] === b[pre]) pre++
  let suf = 0
  while (suf < a.length - pre && suf < b.length - pre && a[a.length - 1 - suf] === b[b.length - 1 - suf])
    suf++
  const ops: Op[] = []
  // Stryker disable next-line StringLiteral: equivalent — diffNoteBlocks treats any op that is not del/ins as same
  for (let i = 0; i < pre; i++) ops.push({ op: 'same', a: i, b: i })
  const n = a.length - pre - suf
  const m = b.length - pre - suf
  if (n * m > MAX_CELLS) {
    for (let i = 0; i < n; i++) ops.push({ op: 'del', a: pre + i })
    for (let j = 0; j < m; j++) ops.push({ op: 'ins', b: pre + j })
  } else {
    // dp[i*w+j] = LCS length of a[pre+i..] and b[pre+j..]
    const w = m + 1
    const dp = new Uint32Array((n + 1) * w)
    for (let i = n - 1; i >= 0; i--)
      for (let j = m - 1; j >= 0; j--)
        dp[i * w + j] =
          a[pre + i] === b[pre + j]
            ? dp[(i + 1) * w + j + 1]! + 1
            : Math.max(dp[(i + 1) * w + j]!, dp[i * w + j + 1]!)
    let i = 0
    let j = 0
    while (i < n || j < m) {
      // Stryker disable next-line StringLiteral: equivalent — diffNoteBlocks treats any op that is not del/ins as same
      if (i < n && j < m && a[pre + i] === b[pre + j]) ops.push({ op: 'same', a: pre + i++, b: pre + j++ })
      // on a tie the user's block goes first, then what replaced it
      else if (i < n && (j === m || dp[(i + 1) * w + j]! >= dp[i * w + j + 1]!))
        ops.push({ op: 'del', a: pre + i++ })
      else ops.push({ op: 'ins', b: pre + j++ })
    }
  }
  // Stryker disable next-line StringLiteral: equivalent — diffNoteBlocks treats any op that is not del/ins as same
  for (let k = suf; k > 0; k--) ops.push({ op: 'same', a: a.length - k, b: b.length - k })
  return ops
}

const WORD = /[\p{L}\p{N}]{3,}/gu
const STOP = new Set(['the', 'and', 'for', 'with', 'that', 'this', 'from', 'are', 'was', 'will', 'have'])
function words(block: string): Set<string> {
  return new Set((blockKey(block).toLowerCase().match(WORD) ?? []).filter((w) => !STOP.has(w)))
}

function overlap(wa: Set<string>, wb: Set<string>): number {
  if (!wa.size || !wb.size) return 0
  let common = 0
  for (const w of wa) if (wb.has(w)) common++
  return common / Math.min(wa.size, wb.size)
}

/** How much of the smaller block's vocabulary the other one shares (overlap coefficient), 0..1. */
export const similarity = (a: string, b: string): number => overlap(words(a), words(b))

/** Blocks at least this similar are shown as one block rewritten, rather than one removed + one added. */
export const PAIR_THRESHOLD = 0.5
/** Beyond this many block pairs in one run, skip pairing (removed, then added) rather than stall. */
const MAX_PAIRING = 250_000

/**
 * Within a run of removed user blocks and added enhanced blocks, pair each user block with the enhanced
 * block that rewrote it (monotonic alignment maximising total similarity), so the review offers
 * "your line → its rewrite" one block at a time instead of one wall of changes.
 */
function alignRun(mine: string[], enh: string[]): Hunk[] {
  const n = mine.length
  const m = enh.length
  const removed = (x: string): Hunk => ({ kind: 'removed', mine: [x] })
  const added = (e: string): Hunk => ({ kind: 'added', enhanced: [e] })
  if (!n || !m || n * m > MAX_PAIRING) return [...mine.map(removed), ...enh.map(added)]
  const we = enh.map(words)
  const sim = mine.map((x) => {
    const wx = words(x)
    return we.map((e) => overlap(wx, e))
  })
  const w = m + 1
  const best = new Float64Array((n + 1) * w)
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--) {
      const s = sim[i]![j]!
      const pair = s >= PAIR_THRESHOLD ? s + best[(i + 1) * w + j + 1]! : -1
      best[i * w + j] = Math.max(pair, best[(i + 1) * w + j]!, best[i * w + j + 1]!)
    }
  const out: Hunk[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    const s = sim[i]![j]!
    if (s >= PAIR_THRESHOLD && best[i * w + j] === s + best[(i + 1) * w + j + 1]!)
      out.push({ kind: 'changed', mine: [mine[i++]!], enhanced: [enh[j++]!] })
    else if (best[i * w + j] === best[(i + 1) * w + j]!) out.push(removed(mine[i++]!))
    else out.push(added(enh[j++]!))
  }
  while (i < n) out.push(removed(mine[i++]!))
  while (j < m) out.push(added(enh[j++]!))
  return out
}

/** The hunks between the user's notes and an enhanced version. Deterministic for given inputs. */
export function diffNoteBlocks(mine: string, enhanced: string): Hunk[] {
  const a = splitBlocks(mine)
  const b = splitBlocks(enhanced)
  const ops = lcsOps(a.map(blockKey), b.map(blockKey))
  const hunks: Hunk[] = []
  let dels: string[] = []
  let inss: string[] = []
  const flush = () => {
    hunks.push(...alignRun(dels, inss))
    dels = []
    inss = []
  }
  for (const o of ops) {
    if (o.op === 'del') dels.push(a[o.a]!)
    else if (o.op === 'ins') inss.push(b[o.b]!)
    else {
      flush()
      const last = hunks.at(-1)
      if (last?.kind === 'same') {
        last.mine.push(a[o.a]!)
        last.enhanced.push(b[o.b]!)
      } else hunks.push({ kind: 'same', mine: [a[o.a]!], enhanced: [b[o.b]!] })
    }
  }
  flush()
  return hunks
}

/** Hunks that are a choice (everything but `same`). */
export const isChoice = (h: Hunk): boolean => h.kind !== 'same'

/**
 * The choice a review starts from: take what enhancement added or rewrote, but never drop a block the
 * user wrote that enhancement left out — removing the user's words always takes an explicit decision.
 */
export function defaultChoices(hunks: readonly Hunk[]): MergeChoice[] {
  return hunks.map((h) => (h.kind === 'removed' ? 'mine' : 'enhanced'))
}

/** The blocks one hunk contributes under a choice. */
export function chosenBlocks(h: Hunk, c: MergeChoice): string[] {
  switch (h.kind) {
    case 'same':
      return h.mine
    case 'added':
      return c === 'enhanced' ? h.enhanced : []
    case 'removed':
      return c === 'mine' ? h.mine : []
    case 'changed':
      return c === 'enhanced' ? h.enhanced : h.mine
  }
}

/**
 * Apply one choice per hunk. Blocks are concatenated verbatim; the only bytes ever added are line breaks
 * where a block would otherwise run into its neighbour (a paragraph placed after a list item becomes
 * part of that item unless a blank line separates them).
 */
export function mergeNoteBlocks(hunks: readonly Hunk[], choices: readonly MergeChoice[]): string {
  const blocks = sidedBlocks(hunks, choices)
  // Stryker disable next-line ConditionalExpression: equivalent — the loop below yields the same bytes for an all-enhanced merge (property-tested); the shortcut makes that exactness structural rather than emergent
  if (allEnhanced(hunks, choices)) return blocks.map((b) => b.block).join('')
  let out = ''
  let prev: (typeof blocks)[number] | null = null
  for (const cur of blocks) {
    const { block } = cur
    // whitespace-only content (a blank document) is carried verbatim, never separated
    if (prev && blockKey(block) !== '') {
      if (!out.endsWith('\n')) out += '\n'
      if (!endsWithBlankLine(out)) {
        // a block that would read as a continuation of the previous one needs a blank line before it
        const continuation = !selfStarting(block) && !closesItself(prev.block)
        // where the user's text meets the enhanced text, keep the markdown readable: a blank line
        // between them, except between two items of one list
        const seam = cur.side !== prev.side && !(isListItem(block) && isListItem(prev.block))
        if (continuation || seam) out += '\n'
      }
    }
    out += block
    prev = cur
  }
  return out
}

const isListItem = (block: string) =>
  TOP_ITEM.test(firstLine(block)) && !THEMATIC_BREAK.test(firstLine(block))

function allEnhanced(hunks: readonly Hunk[], choices: readonly MergeChoice[]): boolean {
  const decided = hunks.flatMap((h, i) => (isChoice(h) ? [choices[i]!] : []))
  return decided.length > 0 && decided.every((c) => c === 'enhanced')
}

/**
 * The blocks a merge consists of, in order, each verbatim. When every hunk takes the enhanced side the
 * result is the enhanced text exactly, so unchanged blocks come from that side (they can differ from the
 * user's copy in trailing whitespace); otherwise unchanged blocks are the user's own bytes.
 */
export function mergedBlocks(hunks: readonly Hunk[], choices: readonly MergeChoice[]): string[] {
  return sidedBlocks(hunks, choices).map((b) => b.block)
}

type Sided = { block: string; side: 'mine' | 'enhanced' }

function sidedBlocks(hunks: readonly Hunk[], choices: readonly MergeChoice[]): Sided[] {
  if (choices.length !== hunks.length)
    throw new RangeError(`expected ${hunks.length} choices (one per hunk), got ${choices.length}`)
  if (allEnhanced(hunks, choices))
    return hunks.flatMap((h) =>
      h.kind === 'removed' ? [] : h.enhanced.map((block): Sided => ({ block, side: 'enhanced' })),
    )
  return hunks.flatMap((h, i) => {
    // an added block only appears when chosen `enhanced`, a removed one only when chosen `mine`
    const side: Sided['side'] = h.kind === 'same' ? 'mine' : choices[i]!
    return chosenBlocks(h, choices[i]!).map((block): Sided => ({ block, side }))
  })
}
