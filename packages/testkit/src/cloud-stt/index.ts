// @kacola/testkit/cloud-stt — a fake Deepgram pre-recorded API (POST /v1/listen) for H-8 tests. There
// is no Deepgram key on the dev machine, so every non-live test runs against this. Its responses copy
// the shape of a recorded Deepgram response (RECORDED_DEEPGRAM_RESPONSE below, from the API reference's
// pre-recorded example, trimmed): metadata + results.channels[].alternatives[] + results.utterances[],
// times in seconds, `speaker` present only when diarize=true, errors as {err_code, err_msg}.
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'

export const RECORDED_DEEPGRAM_RESPONSE = {
  metadata: {
    transaction_key: 'deprecated',
    request_id: '2479c8c8-8185-40ac-9ac6-f0874419f793',
    sha256: '154e291ecfa8be6ab8343560bcc109008fa7853eb5372533e8efdefc9b504c33',
    created: '2024-02-06T19:56:16.180Z',
    duration: 25.933313,
    channels: 1,
    models: ['30089e05-99d1-4376-b32e-c263170674af'],
    model_info: {
      '30089e05-99d1-4376-b32e-c263170674af': {
        name: '2-general-nova',
        version: '2024-01-09.29447',
        arch: 'nova-3',
      },
    },
  },
  results: {
    channels: [
      {
        alternatives: [
          {
            transcript: "Yeah. As as much as, it's worth celebrating",
            confidence: 0.9980469,
            words: [
              {
                word: 'yeah',
                start: 0.08,
                end: 0.32,
                confidence: 0.9975586,
                speaker: 0,
                speaker_confidence: 0.5419922,
                punctuated_word: 'Yeah.',
              },
              {
                word: 'as',
                start: 0.32,
                end: 0.79999995,
                confidence: 0.9921875,
                speaker: 0,
                speaker_confidence: 0.5419922,
                punctuated_word: 'As',
              },
            ],
          },
        ],
      },
    ],
    utterances: [
      {
        start: 0.08,
        end: 3.2,
        confidence: 0.97143555,
        channel: 0,
        transcript: "Yeah. As as much as, it's worth celebrating",
        words: [
          {
            word: 'yeah',
            start: 0.08,
            end: 0.32,
            confidence: 0.9975586,
            speaker: 0,
            speaker_confidence: 0.5419922,
            punctuated_word: 'Yeah.',
          },
        ],
        speaker: 0,
        id: 'a6f7ad86-0e39-4b5f-a1b9-8a8c06d6a2e6',
      },
    ],
  },
}

export type FakeUtterance = {
  start: number
  end: number
  transcript: string
  speaker: number
  confidence?: number
}

export type FakeDeepgramRequest = {
  query: Record<string, string>
  authorization: string | undefined
  contentType: string | undefined
  bytes: number
  durationSec: number
}

export type FakeDeepgram = {
  url: string
  requests: FakeDeepgramRequest[]
  /** Status codes to answer the next requests with (then back to normal). */
  failNext: number[]
  /** Utterances to answer with instead of the generated ones (clipped to the audio's duration). */
  script: FakeUtterance[] | null
  close(): Promise<void>
}

/**
 * Default transcript: one utterance per 4 s of audio, "utterance N", speakers alternating 0/1. Plus a
 * silent-audio rule: all-zero PCM transcribes to nothing, as the real service does.
 */
export async function startFakeDeepgram(opts: { apiKey?: string } = {}): Promise<FakeDeepgram> {
  const key = opts.apiKey ?? 'dg-test-key'
  const fake: FakeDeepgram = {
    url: '',
    requests: [],
    failNext: [],
    script: null,
    close: async () => {},
  }
  const server: Server = createServer(async (req, res) => {
    const chunks: Buffer[] = []
    for await (const c of req) chunks.push(c as Buffer)
    const body = Buffer.concat(chunks)
    const url = new URL(req.url ?? '/', 'http://x')
    const send = (status: number, json: unknown) => {
      res.writeHead(status, { 'content-type': 'application/json' })
      res.end(JSON.stringify(json))
    }
    const query = Object.fromEntries(url.searchParams)
    const isWav =
      body.length >= 44 && body.toString('ascii', 0, 4) === 'RIFF' && body.toString('ascii', 8, 12) === 'WAVE'
    const rate = isWav ? body.readUInt32LE(24) : 0
    const pcm = isWav ? body.subarray(44) : Buffer.alloc(0)
    const durationSec = rate ? pcm.length / (rate * 2) : 0
    fake.requests.push({
      query,
      authorization: req.headers.authorization,
      contentType: req.headers['content-type'],
      bytes: body.length,
      durationSec,
    })
    if (req.method !== 'POST' || url.pathname !== '/v1/listen')
      return send(404, { err_code: 'NOT_FOUND', err_msg: 'Not Found' })
    if (req.headers.authorization !== `Token ${key}`)
      return send(401, { err_code: 'INVALID_AUTH', err_msg: 'Invalid credentials.', request_id: 'fake' })
    const fail = fake.failNext.shift()
    if (fail) return send(fail, { err_code: 'FAKE_FAILURE', err_msg: `injected ${fail}` })
    if (!isWav)
      return send(400, {
        err_code: 'Bad Request',
        err_msg: 'Bad Request: failed to process audio: corrupt or unsupported data',
      })
    const diarize = query.diarize === 'true'
    const silent = pcm.every((b) => b === 0)
    let utts: FakeUtterance[] = []
    if (!silent) {
      if (fake.script)
        utts = fake.script
          .filter((u) => u.start < durationSec)
          .map((u) => ({ ...u, end: Math.min(u.end, durationSec) }))
      else
        for (let i = 0; i * 4 < durationSec; i++)
          utts.push({
            start: i * 4 + 0.1,
            end: Math.min(i * 4 + 3.6, durationSec),
            transcript: `utterance ${i + 1}`,
            speaker: i % 2,
          })
    }
    const toWords = (u: FakeUtterance) =>
      u.transcript.split(/\s+/).map((w, i, all) => {
        const step = (u.end - u.start) / all.length
        return {
          word: w.toLowerCase().replace(/[^\p{L}\p{N}']/gu, ''),
          start: u.start + i * step,
          end: u.start + (i + 1) * step,
          confidence: 0.98,
          ...(diarize ? { speaker: u.speaker, speaker_confidence: 0.6 } : {}),
          punctuated_word: w,
        }
      })
    send(200, {
      metadata: {
        ...RECORDED_DEEPGRAM_RESPONSE.metadata,
        duration: durationSec,
        request_id: `fake-${fake.requests.length}`,
      },
      results: {
        channels: [
          {
            alternatives: [
              {
                transcript: utts.map((u) => u.transcript).join(' '),
                confidence: 0.98,
                words: utts.flatMap(toWords),
              },
            ],
          },
        ],
        utterances: utts.map((u, i) => ({
          start: u.start,
          end: u.end,
          confidence: u.confidence ?? 0.97,
          channel: 0,
          transcript: u.transcript,
          words: toWords(u),
          ...(diarize ? { speaker: u.speaker } : {}),
          id: `fake-utt-${i}`,
        })),
      },
    })
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  fake.url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  fake.close = () => new Promise((r) => server.close(() => r()))
  return fake
}
