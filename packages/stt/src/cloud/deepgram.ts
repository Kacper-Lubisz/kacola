import type { FinalResult, FinalTranscriber, TimedWord } from '../types.ts'
import { SAMPLE_RATE } from '../types.ts'
import { type BatchAudio, type BatchTranscriber, CloudSttError, type DiarizedUtterance } from './types.ts'
import { encodeWav, float32ToS16 } from './wav.ts'

// Deepgram pre-recorded transcription (POST /v1/listen) with provider-side diarization. Chosen for
// full offload because one request returns utterances already split by speaker with word timings,
// which maps 1:1 onto segments. Response shapes are pinned by a recorded fixture in the tests
// (test/fixtures/deepgram-prerecorded.json); a live test runs only with DEEPGRAM_API_KEY.

export type DeepgramOptions = {
  apiKey: string
  /** Override for tests (the fake server) or a regional endpoint. */
  baseUrl?: string
  model?: string
  language?: string
  fetch?: typeof fetch
  /** Attempts for retryable failures (429, 5xx, network). */
  attempts?: number
  timeoutMs?: number
  /** Backoff before retry n (1-based); tests shorten it. */
  backoffMs?: (attempt: number) => number
}

type DgWord = {
  word: string
  punctuated_word?: string
  start: number
  end: number
  confidence?: number
  speaker?: number
}
type DgUtterance = {
  start: number
  end: number
  confidence?: number
  transcript: string
  speaker?: number
  words?: DgWord[]
}
type DgResponse = {
  results?: {
    channels?: { alternatives?: { transcript?: string; confidence?: number; words?: DgWord[] }[] }[]
    utterances?: DgUtterance[]
  }
}

const ms = (s: number) => Math.max(0, Math.round(s * 1000))
const words = (ws: DgWord[] | undefined): TimedWord[] =>
  (ws ?? []).map((w) => ({ text: w.punctuated_word ?? w.word, startMs: ms(w.start), endMs: ms(w.end) }))

export class DeepgramProvider implements BatchTranscriber, FinalTranscriber {
  readonly id: string
  readonly modelId: string
  private readonly o: Required<Omit<DeepgramOptions, 'language'>> & { language?: string }

  constructor(opts: DeepgramOptions) {
    if (!opts.apiKey) throw new CloudSttError('Deepgram API key is missing', null, false)
    this.o = {
      baseUrl: 'https://api.deepgram.com',
      model: 'nova-3',
      fetch: globalThis.fetch,
      attempts: 3,
      timeoutMs: 600_000,
      backoffMs: (n) => 500 * 2 ** (n - 1),
      ...opts,
    }
    this.id = `deepgram:${this.o.model}`
    this.modelId = this.id
  }

  private url(diarize: boolean): string {
    const q = new URLSearchParams({
      model: this.o.model,
      smart_format: 'true',
      punctuate: 'true',
      utterances: 'true',
      diarize: diarize ? 'true' : 'false',
    })
    if (this.o.language) q.set('language', this.o.language)
    return `${this.o.baseUrl.replace(/\/$/, '')}/v1/listen?${q}`
  }

  private async request(body: Uint8Array, diarize: boolean, signal?: AbortSignal): Promise<DgResponse> {
    let last: CloudSttError | null = null
    for (let attempt = 1; attempt <= this.o.attempts; attempt++) {
      const t = AbortSignal.timeout(this.o.timeoutMs)
      let res: Response
      try {
        res = await this.o.fetch(this.url(diarize), {
          method: 'POST',
          headers: { authorization: `Token ${this.o.apiKey}`, 'content-type': 'audio/wav' },
          body: new Blob([body as Uint8Array<ArrayBuffer>]),
          signal: signal ? AbortSignal.any([signal, t]) : t,
        })
      } catch (err) {
        if (signal?.aborted) throw err
        last = new CloudSttError(`Deepgram unreachable: ${(err as Error).message}`, null, true)
        await this.wait(attempt, null)
        continue
      }
      if (res.ok) return (await res.json()) as DgResponse
      const text = await res.text()
      let detail = text.slice(0, 300)
      try {
        const j = JSON.parse(text) as { err_msg?: string; err_code?: string }
        if (j.err_msg) detail = `${j.err_code ?? res.status}: ${j.err_msg}`
      } catch {}
      const retryable = res.status === 429 || res.status >= 500
      last = new CloudSttError(`Deepgram ${res.status}: ${detail}`, res.status, retryable)
      if (!retryable) throw last
      await this.wait(attempt, res.headers.get('retry-after'))
    }
    throw last!
  }

  private async wait(attempt: number, retryAfter: string | null): Promise<void> {
    if (attempt >= this.o.attempts) return
    const hinted = retryAfter && /^\d+$/.test(retryAfter) ? Number(retryAfter) * 1000 : 0
    await new Promise((r) => setTimeout(r, Math.max(hinted, this.o.backoffMs(attempt))))
  }

  /** Whole recording → utterances; speaker indices when `diarize`. */
  async transcribe(
    audio: BatchAudio,
    opts?: { diarize?: boolean; signal?: AbortSignal },
  ): Promise<DiarizedUtterance[]>
  /** FinalTranscriber: one closed segment (16 kHz float32) → text. */
  async transcribe(samples: Float32Array, opts?: { signal?: AbortSignal }): Promise<FinalResult>
  async transcribe(
    input: BatchAudio | Float32Array,
    opts: { diarize?: boolean; signal?: AbortSignal } = {},
  ): Promise<DiarizedUtterance[] | FinalResult> {
    if (input instanceof Float32Array) {
      const utts = await this.batch({ pcm: float32ToS16(input), sampleRate: SAMPLE_RATE }, false, opts.signal)
      const conf = utts.map((u) => u.confidence).filter((c): c is number => c !== null)
      return {
        text: utts
          .map((u) => u.text)
          .join(' ')
          .trim(),
        confidence: conf.length ? conf.reduce((a, b) => a + b, 0) / conf.length : null,
      }
    }
    return this.batch(input, opts.diarize ?? true, opts.signal)
  }

  private async batch(
    audio: BatchAudio,
    diarize: boolean,
    signal?: AbortSignal,
  ): Promise<DiarizedUtterance[]> {
    if (audio.pcm.length === 0) return []
    const r = await this.request(encodeWav(audio.pcm, audio.sampleRate), diarize, signal)
    const utts = r.results?.utterances
    if (utts) {
      return utts
        .filter((u) => u.transcript.trim() !== '')
        .map((u) => ({
          startMs: ms(u.start),
          endMs: Math.max(ms(u.start), ms(u.end)),
          text: u.transcript.trim(),
          speaker: diarize && typeof u.speaker === 'number' ? u.speaker : null,
          confidence: typeof u.confidence === 'number' ? u.confidence : null,
          words: words(u.words),
        }))
    }
    // No utterances block (older API / option ignored): fall back to one utterance per channel.
    const alt = r.results?.channels?.[0]?.alternatives?.[0]
    if (!alt?.transcript?.trim()) return []
    const ws = alt.words ?? []
    return [
      {
        startMs: ms(ws[0]?.start ?? 0),
        endMs: ms(ws.at(-1)?.end ?? 0),
        text: alt.transcript.trim(),
        speaker: null,
        confidence: alt.confidence ?? null,
        words: words(ws),
      },
    ]
  }
}
