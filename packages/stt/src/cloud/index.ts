// @kacola/stt/cloud — cloud STT providers (H-8). Native-free: safe for the hosted bundle.
export type { FinalResult, FinalTranscriber, TimedWord } from '../types.ts'
export { type DeepgramOptions, DeepgramProvider } from './deepgram.ts'
export { type BatchAudio, type BatchTranscriber, CloudSttError, type DiarizedUtterance } from './types.ts'
export { decodeWav, encodeWav, float32ToS16 } from './wav.ts'

import { DeepgramProvider } from './deepgram.ts'
import type { BatchTranscriber } from './types.ts'

/** The cloud provider configured in the environment, if any (DEEPGRAM_API_KEY; DEEPGRAM_URL for tests). */
export function cloudSttFromEnv(env: Record<string, string | undefined>): BatchTranscriber | null {
  if (!env.DEEPGRAM_API_KEY) return null
  return new DeepgramProvider({
    apiKey: env.DEEPGRAM_API_KEY,
    ...(env.DEEPGRAM_URL ? { baseUrl: env.DEEPGRAM_URL } : {}),
    ...(env.DEEPGRAM_MODEL ? { model: env.DEEPGRAM_MODEL } : {}),
  })
}
