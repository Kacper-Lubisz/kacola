import type { ModelManager } from '../models/manager.ts'
import { type SherpaFinalOptions, SherpaFinalTranscriber } from './final.ts'
import { type SherpaLiveOptions, SherpaLiveRecognizer } from './live.ts'
import { sherpa } from './native.ts'
import { SherpaTts } from './tts.ts'
import { type SileroOptions, SileroVad } from './vad.ts'

// Factories that resolve a catalog id to an installed model and build the sherpa engine for it. They
// never download: a model that is not `ready` is an error the caller surfaces (see ModelManager.ensure).

export async function createLiveRecognizer(models: ModelManager, id: string, opts?: SherpaLiveOptions) {
  return new SherpaLiveRecognizer(models.entry(id), await models.require(id), opts)
}

export async function createFinalTranscriber(models: ModelManager, id: string, opts?: SherpaFinalOptions) {
  return SherpaFinalTranscriber.create(models.entry(id), await models.require(id), opts)
}

export async function createVad(models: ModelManager, id: string, opts?: SileroOptions) {
  return new SileroVad(models.entry(id), await models.require(id), opts)
}

export async function createTts(models: ModelManager, id: string) {
  return new SherpaTts(models.entry(id), await models.require(id))
}

export function sherpaVersion(): { version: string; gitSha1: string } {
  const s = sherpa()
  return { version: s.version, gitSha1: s.gitSha1 }
}

export { cleanFinalText } from './final.ts'
export { displayText, wordsFromTokens } from './live.ts'
export { SherpaFinalTranscriber, SherpaLiveRecognizer, SherpaTts, SileroVad }
