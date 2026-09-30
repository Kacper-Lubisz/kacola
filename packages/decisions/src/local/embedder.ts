import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { WordPieceTokenizer } from './wordpiece.ts'

// Sentence embeddings for the on-device decision provider.
//
//   OnnxEmbedder     all-MiniLM-L6-v2 (int8 ONNX, 23 MB, Apache-2.0) through onnxruntime-node (MIT):
//                    WordPiece → BERT → mean pooling over the attention mask → L2 normalisation, i.e.
//                    sentence-transformers' own recipe for this model. Loaded lazily (dynamic import),
//                    so nothing native loads unless the local provider is used. Co-loading with
//                    sherpa-onnx's bundled onnxruntime in one process was checked (both load orders).
//   HashingEmbedder  no model at all: signed feature hashing of word unigrams + bigrams. Deterministic
//                    and instant; the floor the product falls back to before the model is downloaded.

export interface Embedder {
  readonly id: string
  /** Unit-length vectors, one per text. */
  embed(texts: readonly string[]): Promise<Float32Array[]>
}

export const TEXT_EMBEDDING_MODEL_ID = 'text-embedding-minilm-l6-v2-int8'
export const TEXT_EMBEDDING_MODEL_FILE = 'model_quantized.onnx'

export function cosine(a: Float32Array, b: Float32Array): number {
  let s = 0
  for (let i = 0; i < a.length; i++) s += a[i]! * b[i]!
  return s
}

function l2(v: Float32Array): Float32Array {
  let n = 0
  for (const x of v) n += x * x
  n = Math.sqrt(n)
  if (n > 0) for (let i = 0; i < v.length; i++) v[i]! /= n
  return v
}

type Ort = typeof import('onnxruntime-node')
type Session = import('onnxruntime-node').InferenceSession

export class OnnxEmbedder implements Embedder {
  readonly id = TEXT_EMBEDDING_MODEL_ID
  readonly #ort: Ort
  readonly #session: Session
  readonly #tok: WordPieceTokenizer
  readonly #maxLength: number
  readonly #batch: number

  private constructor(ort: Ort, session: Session, tok: WordPieceTokenizer, maxLength: number, batch: number) {
    this.#ort = ort
    this.#session = session
    this.#tok = tok
    this.#maxLength = maxLength
    this.#batch = batch
  }

  /** `dir` = the installed model directory (the model manager's path for TEXT_EMBEDDING_MODEL_ID). */
  static async create(dir: string, opts: { maxLength?: number; batch?: number; threads?: number } = {}) {
    const file = join(dir, TEXT_EMBEDDING_MODEL_FILE)
    if (!existsSync(file)) throw new Error(`text embedding model not found at ${file}`)
    const ort = await import('onnxruntime-node')
    const session = await ort.InferenceSession.create(file, {
      intraOpNumThreads: opts.threads ?? 1,
      interOpNumThreads: 1,
      graphOptimizationLevel: 'all',
    })
    return new OnnxEmbedder(
      ort,
      session,
      WordPieceTokenizer.fromFile(),
      opts.maxLength ?? 256,
      opts.batch ?? 16,
    )
  }

  async embed(texts: readonly string[]): Promise<Float32Array[]> {
    const out: Float32Array[] = []
    for (let i = 0; i < texts.length; i += this.#batch)
      out.push(...(await this.#run(texts.slice(i, i + this.#batch))))
    return out
  }

  async #run(texts: readonly string[]): Promise<Float32Array[]> {
    const enc = texts.map((t) => this.#tok.encode(t, this.#maxLength))
    const n = enc.length
    const len = Math.max(...enc.map((e) => e.length))
    const ids = new BigInt64Array(n * len)
    const mask = new BigInt64Array(n * len)
    for (let b = 0; b < n; b++)
      for (let j = 0; j < len; j++) {
        const e = enc[b]!
        ids[b * len + j] = BigInt(j < e.length ? e.ids[j]! : this.#tok.pad)
        mask[b * len + j] = j < e.length ? 1n : 0n
      }
    const T = this.#ort.Tensor
    const feeds: Record<string, import('onnxruntime-node').Tensor> = {
      input_ids: new T('int64', ids, [n, len]),
      attention_mask: new T('int64', mask, [n, len]),
    }
    if (this.#session.inputNames.includes('token_type_ids'))
      feeds.token_type_ids = new T('int64', new BigInt64Array(n * len), [n, len])
    const res = await this.#session.run(feeds)
    const hidden = res[this.#session.outputNames[0]!]!
    const data = hidden.data as Float32Array
    const dim = hidden.dims[2]!
    const vecs: Float32Array[] = []
    for (let b = 0; b < n; b++) {
      const v = new Float32Array(dim)
      const L = enc[b]!.length
      for (let j = 0; j < L; j++) {
        const off = (b * len + j) * dim
        for (let d = 0; d < dim; d++) v[d]! += data[off + d]!
      }
      for (let d = 0; d < dim; d++) v[d]! /= L
      vecs.push(l2(v))
    }
    return vecs
  }
}

const STOP = new Set(
  'a an the and or but if of to in on at for with by from is are was were be been being it its this that these those i you he she we they me him her us them my your our their do does did so as not no yes'.split(
    ' ',
  ),
)

export class HashingEmbedder implements Embedder {
  readonly id = 'hashing-512'
  readonly #dim: number
  constructor(dim = 512) {
    this.#dim = dim
  }
  async embed(texts: readonly string[]): Promise<Float32Array[]> {
    return texts.map((t) => {
      const v = new Float32Array(this.#dim)
      const words = t
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{Mn}/gu, '')
        .split(/[^\p{L}\p{N}]+/u)
        .filter((w) => w && !STOP.has(w))
        .map(stem)
      const feats = [...words, ...words.slice(1).map((w, i) => `${words[i]}_${w}`)]
      for (const f of feats) {
        const h = fnv1a(f)
        v[h % this.#dim]! += h & 0x80000000 ? -1 : 1
      }
      return l2(v)
    })
  }
}

/** A crude suffix stripper so "decided"/"decision"/"decide" meet (hashing embedder only). */
function stem(w: string): string {
  return w.length > 4 ? w.replace(/(ations?|ing|ed|es|s|ly|ion)$/, '') : w
}

function fnv1a(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** Memoises embeddings by text (agenda items and option descriptions repeat on every segment). */
export class CachedEmbedder implements Embedder {
  readonly id: string
  readonly #inner: Embedder
  readonly #cache = new Map<string, Float32Array>()
  readonly #max: number
  constructor(inner: Embedder, max = 5_000) {
    this.#inner = inner
    this.id = inner.id
    this.#max = max
  }
  async embed(texts: readonly string[]): Promise<Float32Array[]> {
    const missing = [...new Set(texts.filter((t) => !this.#cache.has(t)))]
    if (missing.length) {
      const vecs = await this.#inner.embed(missing)
      missing.forEach((t, i) => {
        if (this.#cache.size >= this.#max) this.#cache.delete(this.#cache.keys().next().value!)
        this.#cache.set(t, vecs[i]!)
      })
    }
    return texts.map((t) => this.#cache.get(t)!)
  }
}
