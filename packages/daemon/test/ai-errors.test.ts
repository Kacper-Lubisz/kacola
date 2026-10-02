import { LlmError, type LlmProvider } from '@gnomeola/llm'
import { aiErrorCopy, isLoopbackUrl, isOnDeviceDecisions, isOnDeviceLlm } from '@gnomeola/protocol'
import { describe, expect, it } from 'vitest'
import { agendaLlm } from '../src/agendas/tracker-wiring.ts'
import { toWireError } from '../src/engines/llm.ts'
import { apiErrorBody, DaemonError } from '../src/errors.ts'
import { mayLeave, notReadyError, privateMeetingError } from '../src/privacy.ts'
import type { SettingsService } from '../src/settings.ts'

// Provider error copy: a stable reason, the one action that fixes it, the provider by name, and never the
// raw provider body. And the on-device test that decides whether a private meeting may be sent.

const OVERLOADED_BODY = '529 {"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}'

const wire = (err: LlmError, provider = 'anthropic') => {
  const e = toWireError(err, provider, 'Ask')
  expect(e).toBeInstanceOf(DaemonError)
  return apiErrorBody(e as DaemonError).error
}

describe('provider errors on the wire', () => {
  it('overloaded (529): retry, no "API key" advice, no raw JSON', () => {
    const e = wire(new LlmError('overloaded', OVERLOADED_BODY, { status: 529 }))
    expect(e).toEqual({
      code: 'unavailable',
      message: 'Anthropic is busy right now. Try again in a minute.',
      reason: 'overloaded',
      action: 'retry',
      provider: 'Anthropic',
    })
    expect(JSON.stringify(e)).not.toMatch(/API key|overloaded_error|\{"type"/)
  })

  it('no credits: names the provider and links to its billing page', () => {
    const a = wire(new LlmError('quota', 'credit balance is too low', { status: 400 }))
    expect(a).toMatchObject({
      reason: 'no-credits',
      action: 'add-credits',
      provider: 'Anthropic',
      link: 'https://console.anthropic.com/settings/billing',
    })
    expect(a.message).toMatch(/Your Anthropic account has no credits left/)
    const o = wire(new LlmError('quota', 'insufficient_quota'), 'openai')
    expect(o).toMatchObject({ provider: 'OpenAI', link: expect.stringContaining('platform.openai.com') })
  })

  it('rate limited carries the wait; bad key asks to check it; outages say retry', () => {
    expect(wire(new LlmError('rate_limited', 'x', { retryAfterMs: 12_000 }))).toMatchObject({
      reason: 'rate-limited',
      action: 'retry',
      retryAfterMs: 12_000,
      message: 'Anthropic is limiting requests right now. Try again in 12 s.',
    })
    expect(wire(new LlmError('auth', 'x', { status: 401 }))).toMatchObject({
      code: 'unauthorized',
      reason: 'bad-key',
      action: 'set-up-provider',
    })
    for (const code of ['server', 'network', 'timeout'] as const)
      expect(wire(new LlmError(code, 'socket hang up'))).toMatchObject({
        reason: 'provider-down',
        action: 'retry',
        message: "Couldn't reach Anthropic. Check your connection and try again.",
      })
  })

  it('"the none provider is not ready" is gone: no-provider / no-key, typed', () => {
    const none = apiErrorBody(notReadyError({ provider: 'none', ollamaUrl: '' }, false, 'Ask')).error
    expect(none).toEqual({
      code: 'unavailable',
      message: 'Ask needs an AI provider. Set one up in Preferences.',
      reason: 'no-provider',
      action: 'set-up-provider',
    })
    const noKey = apiErrorBody(notReadyError({ provider: 'openai', ollamaUrl: '' }, false, 'Enhance')).error
    expect(noKey).toMatchObject({ reason: 'no-key', provider: 'OpenAI', action: 'set-up-provider' })
    expect(noKey.message).toBe('OpenAI needs an API key. Add it in Preferences.')
    for (const e of [none, noKey]) expect(e.message).not.toMatch(/none|not ready|\?/)
  })
})

describe('what counts as on this computer', () => {
  it('loopback URLs only', () => {
    for (const u of [
      'http://127.0.0.1:11434',
      'http://localhost:11434',
      'http://[::1]:11434',
      'http://127.1.2.3',
    ])
      expect(isLoopbackUrl(u)).toBe(true)
    for (const u of [
      'http://192.168.1.20:11434',
      'https://ollama.example.com',
      'http://10.0.0.1',
      'nonsense',
      '',
    ])
      expect(isLoopbackUrl(u)).toBe(false)
  })

  it('Ollama on loopback (or its default) is on-device; every other provider is the cloud', () => {
    expect(isOnDeviceLlm({ provider: 'ollama', ollamaUrl: 'http://127.0.0.1:11434' })).toBe(true)
    expect(isOnDeviceLlm({ provider: 'ollama', ollamaUrl: '' })).toBe(true)
    expect(isOnDeviceLlm({ provider: 'ollama', ollamaUrl: 'http://gpu-box.lan:11434' })).toBe(false)
    expect(isOnDeviceLlm({ provider: 'anthropic', ollamaUrl: 'http://127.0.0.1:11434' })).toBe(false)
    expect(isOnDeviceLlm({ provider: 'openai' })).toBe(false)
    expect(isOnDeviceDecisions('local')).toBe(true)
    expect(isOnDeviceDecisions('jev', 'http://127.0.0.1:11434')).toBe(false)
    expect(isOnDeviceDecisions('ollama', 'http://127.0.0.1:11434')).toBe(true)
  })

  it('a private meeting may only leave for an on-device provider; the refusal is typed', () => {
    const cloud = { provider: 'anthropic' as const, ollamaUrl: '' }
    expect(mayLeave({ private: false }, cloud)).toBe(true)
    expect(mayLeave({ private: true }, cloud)).toBe(false)
    expect(mayLeave({ private: true }, { provider: 'ollama', ollamaUrl: 'http://localhost:11434' })).toBe(
      true,
    )
    const e = privateMeetingError(cloud, 'Enhance')
    expect(e.status).toBe(409)
    expect(apiErrorBody(e).error).toMatchObject({ reason: 'private-meeting', provider: 'Anthropic' })
    expect(e.message).toMatch(/won't send it to Anthropic\. Enhance on private meetings works with/)
    expect(aiErrorCopy('private-meeting', {}).message).toMatch(/a cloud AI provider/)
  })

  it('the recap and bridge-line LLM is withheld for a private recording unless on-device', async () => {
    let llm = { provider: 'anthropic', model: '', ollamaUrl: 'http://127.0.0.1:11434' }
    const settings = { get: () => ({ llm }), apiKey: async () => 'sk-test' } as unknown as SettingsService
    const fake = { id: 'fake' } as unknown as LlmProvider
    const forSession = agendaLlm(settings, async () => fake)
    expect((await forSession({ private: false })).provider).toBe(fake)
    const priv = await forSession({ private: true })
    expect(priv.provider).toBeNull()
    expect(priv.reason).toMatch(/private, so kacola won't send it to Anthropic/)
    llm = { ...llm, provider: 'ollama' }
    expect((await forSession({ private: true })).provider).toBe(fake)
  })
})
