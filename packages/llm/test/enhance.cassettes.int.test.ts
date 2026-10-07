// N-2 / V-7 — notes enhancement through the real SDK and the real providers: Anthropic replayed from
// cassettes at the fetch layer (the deterministic stand-in for the live eval), and Ollama against a
// local fake of /api/chat. Proves the request contract and scores the replayed output with the same
// scorer the live eval uses.
import { readFileSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { extractActionItems } from '@kacola/protocol'
import { type CassetteRequest, useCassette } from '@kacola/testkit/cassettes'
import { afterAll, describe, expect, it } from 'vitest'
import { AnthropicProvider } from '../src/anthropic.ts'
import { ENHANCE_SYSTEM_PROMPT, enhance } from '../src/enhance.ts'
import { OllamaProvider } from '../src/ollama.ts'
import { buildCassette, cassettePath } from './fixtures/cassette-builder.ts'
import {
  drainEnhance,
  ENHANCE_SCENARIOS,
  type EnhanceOutcome,
  GENERAL_TEMPLATE,
  PLATFORM_ENHANCED,
  PLATFORM_NOTES,
  PLATFORM_REFERENCE,
  STANDUP_NOTES,
  STANDUP_REFERENCE,
  scoreEnhancement,
} from './fixtures/enhance-scenarios.ts'
import { platformSync } from './fixtures/meeting.ts'

type Body = {
  model: string
  output_config: { effort: string }
  thinking: unknown
  system: { text: string }[]
  messages: { content: { text: string; cache_control?: unknown }[] }[]
}

async function replay(name: string): Promise<{ outcome: EnhanceOutcome; request: CassetteRequest }> {
  const s = ENHANCE_SCENARIOS.find((x) => x.name === name)!
  const tape = useCassette(cassettePath(name), { mode: 'replay' })
  const provider = new AnthropicProvider({ apiKey: 'sk-ant-replay-key', fetch: tape.fetch })
  const [outcome] = await s.drive(provider)
  tape.assertExhausted()
  return { outcome: outcome!, request: tape.requests[0]! }
}

describe('enhancement cassettes', () => {
  for (const s of ENHANCE_SCENARIOS) {
    it(`${s.name}: committed cassette equals a fresh build (a prompt change shows up as a diff)`, async () => {
      expect(await buildCassette(s)).toEqual(JSON.parse(readFileSync(cassettePath(s.name), 'utf8')))
    })
  }

  it('sends effort high, adaptive thinking, the enhancement system prompt and a cached transcript', async () => {
    const { request } = await replay('enhance-notes')
    const b = request.body as Body
    expect(b.model).toBe('claude-opus-5')
    expect(b.output_config).toEqual({ effort: 'high' })
    expect(b.thinking).toEqual({ type: 'adaptive' })
    expect(b.system).toEqual([{ type: 'text', text: ENHANCE_SYSTEM_PROMPT }])
    const content = b.messages[0]!.content
    expect(content.at(-1)!.text).toContain(`<my_notes>\n${PLATFORM_NOTES.trimEnd()}\n</my_notes>`)
    expect(content.at(-1)!.cache_control).toBeUndefined()
    expect(content.at(-2)!.cache_control).toEqual({ type: 'ephemeral' })
    expect(request.headers['anthropic-beta']).toMatch(/server-side-fallback/)
  })

  it.each([
    ['enhance-notes', PLATFORM_NOTES, PLATFORM_REFERENCE],
    ['enhance-standup', STANDUP_NOTES, STANDUP_REFERENCE],
  ] as const)(
    '%s: the SDK-parsed result keeps every user line and scores full marks',
    async (name, notes, ref) => {
      const { outcome } = await replay(name)
      const done = outcome.done!
      expect(outcome.deltas.join('')).toBe(done.markdown)
      expect(done.stopReason).toBe('end_turn')
      expect(done.hallucinated).toEqual([])
      expect(done.usage.cacheWriteTokens).toBeGreaterThan(1000)
      const score = scoreEnhancement(notes, done.markdown, ref, extractActionItems(done.markdown))
      expect(score).toMatchObject({
        userLinesKept: score.userLinesTotal,
        factRecall: 1,
        actionRecall: 1,
        obeyedInjection: false,
      })
    },
  )

  it('keeps the user’s typo verbatim (enhancement must not correct their words)', async () => {
    const { outcome } = await replay('enhance-standup')
    expect(outcome.done!.markdown).toContain('- bruno blockd on creds\n')
  })
})

describe('enhancement over Ollama', () => {
  let server: Server | undefined
  afterAll(() => server?.close())

  it('posts the flattened prompt and returns the same markdown, citations rewritten', async () => {
    const bodies: unknown[] = []
    server = createServer(async (req, res) => {
      let body = ''
      for await (const c of req) body += c
      bodies.push(JSON.parse(body))
      res.writeHead(200, { 'content-type': 'application/x-ndjson' })
      for (const content of PLATFORM_ENHANCED)
        res.write(
          `${JSON.stringify({ model: 'llama3.2', message: { role: 'assistant', content }, done: false })}\n`,
        )
      res.end(
        `${JSON.stringify({ model: 'llama3.2', message: { role: 'assistant', content: '' }, done: true, done_reason: 'stop', prompt_eval_count: 900, eval_count: 300 })}\n`,
      )
    })
    await new Promise<void>((r) => server!.listen(0, '127.0.0.1', r))
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
    const provider = new OllamaProvider({ url, model: 'llama3.2' })
    const out = await drainEnhance(
      enhance({ provider, transcript: platformSync(), notes: PLATFORM_NOTES, template: GENERAL_TEMPLATE }),
    )
    const body = bodies[0] as { messages: { role: string; content: string }[]; stream: boolean }
    expect(body.stream).toBe(true)
    expect(body.messages[0]).toEqual({ role: 'system', content: ENHANCE_SYSTEM_PROMPT })
    expect(body.messages[1]!.content).toContain('<my_notes>')
    expect(out.done!.markdown).toContain('- retry budget?\n')
    expect(out.done!.markdown).not.toMatch(/\[s\d/)
    expect(out.done!.citations.length).toBeGreaterThan(5)
  })
})
