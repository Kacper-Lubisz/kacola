import { join } from 'node:path'
import { type Cassette, normaliseRequest, replayResponse } from '@gnomeola/testkit/cassettes'
import { AnthropicProvider } from '../../src/anthropic.ts'
import type { TranscriptInput } from '../../src/types.ts'
import { fixtureTranscripts, type Scenario } from './scenarios.ts'

export const CASSETTE_DIR = join(import.meta.dirname, 'cassettes')
export const cassettePath = (name: string): string => join(CASSETTE_DIR, `${name}.json`)

/**
 * Build a hand-authored cassette: drive the real provider + real SDK against the authored responses and
 * record the requests it actually sends. Deterministic (no clock, no randomness in the request path).
 */
export async function buildCassette(
  s: Omit<Scenario, 'drive'> & { drive(p: AnthropicProvider, t: TranscriptInput[]): Promise<unknown> },
): Promise<Cassette> {
  const cassette: Cassette = {
    version: 1,
    name: s.name,
    source: 'hand-authored',
    note: s.note,
    interactions: [],
  }
  let i = 0
  const fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const response = s.responses[i++]
    if (!response) throw new Error(`scenario ${s.name}: more requests than authored responses`)
    cassette.interactions.push({ request: normaliseRequest(input, init), response })
    return replayResponse(response, init?.signal)
  }) as typeof globalThis.fetch
  const provider = new AnthropicProvider({ apiKey: 'sk-ant-cassette-placeholder', fetch, ...s.provider })
  await s.drive(provider, fixtureTranscripts())
  if (i !== s.responses.length)
    throw new Error(`scenario ${s.name}: ${s.responses.length - i} response(s) unused`)
  return cassette
}
