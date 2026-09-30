import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// BERT's uncased WordPiece tokenizer (BasicTokenizer + WordpieceTokenizer, as in the reference
// implementation and HF `BertTokenizer` with do_lower_case), for all-MiniLM-L6-v2.
//
// The vocabulary (assets/minilm-l6-v2-vocab.txt, 30 522 entries) is the model's own vocab.txt from
// huggingface.co/Xenova/all-MiniLM-L6-v2 at commit 751bff37182d3f1213fa05d7196b954e230abad9 — the
// bert-base-uncased vocabulary, Apache-2.0 (Google Research BERT / sentence-transformers). It is committed
// (230 KB) so the downloadable model stays a single checksummed file in the model catalogue.

export const VOCAB_PATH = join(import.meta.dirname, '..', '..', 'assets', 'minilm-l6-v2-vocab.txt')
export const VOCAB_SHA256 = '07eced375cec144d27c900241f3e339478dec958f92fddbc551f295c992038a3'

export type Encoded = { ids: number[]; length: number }

export class WordPieceTokenizer {
  readonly #vocab: Map<string, number>
  readonly cls: number
  readonly sep: number
  readonly pad: number
  readonly unk: number

  constructor(vocab: readonly string[]) {
    this.#vocab = new Map(vocab.map((t, i) => [t, i]))
    const id = (t: string) => {
      const v = this.#vocab.get(t)
      if (v === undefined) throw new Error(`vocabulary lacks ${t}`)
      return v
    }
    this.cls = id('[CLS]')
    this.sep = id('[SEP]')
    this.pad = id('[PAD]')
    this.unk = id('[UNK]')
  }

  static fromFile(path = VOCAB_PATH, sha256: string | null = VOCAB_SHA256): WordPieceTokenizer {
    const buf = readFileSync(path)
    if (sha256) {
      const got = createHash('sha256').update(buf).digest('hex')
      if (got !== sha256) throw new Error(`vocabulary ${path} checksum mismatch: ${got}`)
    }
    const lines = buf.toString('utf8').split('\n')
    if (lines.at(-1) === '') lines.pop()
    return new WordPieceTokenizer(lines)
  }

  /** Basic tokenization: clean, lowercase, strip accents, split on whitespace and punctuation. */
  basic(text: string): string[] {
    let t = ''
    for (const ch of text) {
      const cp = ch.codePointAt(0)!
      if (cp === 0 || cp === 0xfffd || isControl(ch)) continue
      t += isChinese(cp) ? ` ${ch} ` : /\s/.test(ch) ? ' ' : ch
    }
    const out: string[] = []
    for (const word of t
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Mn}/gu, '')
      .split(' ')) {
      if (!word) continue
      let cur = ''
      for (const ch of word) {
        if (isPunct(ch)) {
          if (cur) out.push(cur)
          out.push(ch)
          cur = ''
        } else cur += ch
      }
      if (cur) out.push(cur)
    }
    return out
  }

  /** Greedy longest-match-first WordPiece over one basic token. */
  wordpiece(token: string): number[] {
    const chars = [...token]
    if (chars.length > 100) return [this.unk]
    const ids: number[] = []
    let start = 0
    while (start < chars.length) {
      let end = chars.length
      let found: number | undefined
      while (start < end) {
        const sub = (start > 0 ? '##' : '') + chars.slice(start, end).join('')
        found = this.#vocab.get(sub)
        if (found !== undefined) break
        end--
      }
      if (found === undefined) return [this.unk]
      ids.push(found)
      start = end
    }
    return ids
  }

  /** [CLS] tokens… [SEP], truncated to `maxLength` (including the two specials). */
  encode(text: string, maxLength = 256): Encoded {
    const ids = [this.cls]
    for (const w of this.basic(text)) {
      for (const id of this.wordpiece(w)) ids.push(id)
      if (ids.length >= maxLength - 1) break
    }
    ids.length = Math.min(ids.length, maxLength - 1)
    ids.push(this.sep)
    return { ids, length: ids.length }
  }
}

function isControl(ch: string): boolean {
  if (ch === '\t' || ch === '\n' || ch === '\r') return false
  return /\p{Cc}|\p{Cf}/u.test(ch)
}

function isPunct(ch: string): boolean {
  const cp = ch.codePointAt(0)!
  // BERT treats all non-letter/number ASCII as punctuation, plus Unicode P*
  if ((cp >= 33 && cp <= 47) || (cp >= 58 && cp <= 64) || (cp >= 91 && cp <= 96) || (cp >= 123 && cp <= 126))
    return true
  return /\p{P}/u.test(ch)
}

function isChinese(cp: number): boolean {
  return (
    (cp >= 0x4e00 && cp <= 0x9fff) ||
    (cp >= 0x3400 && cp <= 0x4dbf) ||
    (cp >= 0x20000 && cp <= 0x2a6df) ||
    (cp >= 0x2a700 && cp <= 0x2b73f) ||
    (cp >= 0x2b740 && cp <= 0x2b81f) ||
    (cp >= 0x2b820 && cp <= 0x2ceaf) ||
    (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0x2f800 && cp <= 0x2fa1f)
  )
}
