import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { CONFIG_TEMPLATE } from '@kacola/protocol'
import { afterAll, describe, expect, it } from 'vitest'
import { applyConfigFile, parseConfigFile, watchConfigFile } from '../src/config-file.ts'
import { settingsOverrides } from '../src/settings.ts'

// kacola.env: what Preferences no longer shows (providers, models, keys), read into the environment.

const dir = mkdtempSync(join(tmpdir(), 'kacola-config-file-'))
afterAll(() => rmSync(dir, { recursive: true, force: true }))

describe('kacola.env', () => {
  it('parses KEY=value lines, comments, quotes and export prefixes', () => {
    expect(
      parseConfigFile(
        [
          '# a comment',
          'ANTHROPIC_API_KEY=sk-ant-123',
          'export KACOLA_LLM_MODEL="claude-opus-5"',
          "KACOLA_OLLAMA_URL='http://h:1'",
          'KACOLA_DECISIONS_PROVIDER=jev   # trailing comment',
          'not a setting',
          '',
        ].join('\n'),
      ),
    ).toEqual({
      ANTHROPIC_API_KEY: 'sk-ant-123',
      KACOLA_LLM_MODEL: 'claude-opus-5',
      KACOLA_OLLAMA_URL: 'http://h:1',
      KACOLA_DECISIONS_PROVIDER: 'jev',
    })
  })

  it('the template sets nothing until a line is uncommented', () => {
    expect(parseConfigFile(CONFIG_TEMPLATE)).toEqual({})
  })

  it('fills the environment under what is already set, skipping empty values', () => {
    const f = join(dir, 'a.env')
    writeFileSync(f, 'TYPESAFE_API_KEY=ts-1\nANTHROPIC_API_KEY=from-file\nOPENAI_API_KEY=\n')
    const env: NodeJS.ProcessEnv = { ANTHROPIC_API_KEY: 'from-shell' }
    expect(applyConfigFile(f, env)).toEqual(['TYPESAFE_API_KEY'])
    expect(env).toEqual({ ANTHROPIC_API_KEY: 'from-shell', TYPESAFE_API_KEY: 'ts-1' })
    expect(applyConfigFile(join(dir, 'missing.env'), env)).toEqual([])
  })

  it('notices a save', async () => {
    const f = join(dir, 'b.env')
    writeFileSync(f, '')
    let changes = 0
    const stop = watchConfigFile(f, () => changes++, 50)
    await new Promise((r) => setTimeout(r, 120))
    writeFileSync(f, 'KACOLA_LLM_PROVIDER=openai\n')
    await new Promise((r) => setTimeout(r, 400))
    stop()
    expect(changes).toBe(1)
  })
})

describe('settingsOverrides', () => {
  it('pins providers and models, and a TypeSafe key alone means Jev', () => {
    expect(settingsOverrides({ TYPESAFE_API_KEY: 'k' }).overrides).toEqual({ decisions: { provider: 'jev' } })
    expect(
      settingsOverrides({
        KACOLA_LLM_PROVIDER: 'openai',
        KACOLA_LLM_MODEL: 'gpt-5.5',
        KACOLA_DECISIONS_PROVIDER: 'local',
        TYPESAFE_API_KEY: 'k',
        KACOLA_VOICEPRINTS: 'off',
      }).overrides,
    ).toEqual({
      llm: { provider: 'openai', model: 'gpt-5.5' },
      decisions: { provider: 'local' },
      speakers: { voiceprints: false },
    })
  })

  it('reports values it does not know and ignores them', () => {
    expect(settingsOverrides({ KACOLA_LLM_PROVIDER: 'gemini', KACOLA_VOICEPRINTS: 'maybe' })).toEqual({
      overrides: {},
      invalid: ['KACOLA_LLM_PROVIDER', 'KACOLA_VOICEPRINTS'],
    })
  })
})
