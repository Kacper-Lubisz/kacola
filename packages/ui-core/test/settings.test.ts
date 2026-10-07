import type { AudioDevice, ModelInfo, Settings } from '@kacola/protocol'
import { afterEach, describe, expect, it } from 'vitest'
import { _, fmt, ngettext, setTranslator } from '../src/i18n.ts'
import {
  deviceChoices,
  finalPasses,
  formatBytes,
  indexOf,
  missingModels,
  providers,
  valueAt,
  withStored,
} from '../src/settings.ts'

// The settings view model and the i18n shim (from the GTK app's view-logic tests, kept at the cut-over).

describe('settings model', () => {
  it('maps combo indexes and values both ways', () => {
    expect(indexOf(providers(), 'openai')).toBe(1)
    expect(indexOf(providers(), 'ollama')).toBe(2)
    expect(valueAt(finalPasses(), 2)).toBe('off')
    expect(valueAt(finalPasses(), 9)).toBeUndefined()
  })
  it('lists default first, keeps an unplugged configured device instead of rewriting it', () => {
    const devices: AudioDevice[] = [
      { name: 'mic.a', description: 'USB mic', kind: 'source', isDefault: true },
      { name: 'spk', description: 'Speakers', kind: 'sink', isDefault: true },
    ]
    expect(deviceChoices(devices, 'source', 'default').map((c) => c.value)).toEqual(['default', 'mic.a'])
    expect(deviceChoices(devices, 'source', 'gone.mic').map((c) => c.label)).toEqual([
      'Default',
      'USB mic (default)',
      'gone.mic (not connected)',
    ])
  })
  it('keeps the key flag when a settings.updated event (which never carries it) arrives', () => {
    const prev = { llm: { apiKeyConfigured: true } } as Settings
    const { apiKeyConfigured: _k, ...llm } = {
      provider: 'none',
      model: 'm',
      ollamaUrl: 'u',
      apiKeyConfigured: false,
    } as const
    const next = withStored(prev, {
      llm,
      stt: { liveModel: 'l', finalModel: 'f', finalPass: 'off' },
      capture: { micDevice: 'default', systemDevice: 'default' },
      retention: { audio: 'keep', days: 30, archive: false },
      autoRecord: { calendar: false, micActivity: false },
    })
    expect(next.llm.apiKeyConfigured).toBe(true)
    expect(next.llm.provider).toBe('none')
  })
  it('requires the final model unless the accurate pass is off', () => {
    const m = (id: string, role: ModelInfo['role'], state: ModelInfo['state']): ModelInfo => ({
      id,
      role,
      title: id,
      sizeBytes: 1,
      state,
      progress: null,
    })
    const models = [m('live', 'live', 'ready'), m('final', 'final', 'missing'), m('vad', 'vad', 'corrupt')]
    expect(missingModels(models, null).map((x) => x.id)).toEqual(['final', 'vad'])
    const off = { stt: { finalPass: 'off' } } as Settings
    expect(missingModels(models, off).map((x) => x.id)).toEqual(['vad'])
    // the decisions embedder is optional: never blocks onboarding
    expect(missingModels([...models, m('emb', 'text-embedding', 'missing')], null).map((x) => x.id)).toEqual([
      'final',
      'vad',
    ])
  })
  it('formats sizes like GNOME does', () => {
    expect(formatBytes(1_000_000)).toBe('1 MB')
    expect(formatBytes(466_000_000)).toBe('466 MB')
    expect(formatBytes(1_550_000_000)).toBe('1.6 GB')
    expect(formatBytes(900)).toBe('900 bytes')
  })
})

describe('i18n scaffolding', () => {
  afterEach(() => setTranslator(null))
  it('returns source strings until a translator is installed, then translates', () => {
    expect(_('Preferences')).toBe('Preferences')
    expect(ngettext('A model', 'Models', 2)).toBe('Models')
    setTranslator({ gettext: (s) => `[${s}]`, ngettext: (a, b, n) => (n === 1 ? `[${a}]` : `[${b}]`) })
    expect(_('Preferences')).toBe('[Preferences]')
    expect(ngettext('A model', 'Models', 1)).toBe('[A model]')
  })
  it('fills named placeholders after translation', () => {
    expect(fmt('{speaker} at {time}', { speaker: 'Me', time: '1:06' })).toBe('Me at 1:06')
    expect(fmt('{missing} stays', {})).toBe('{missing} stays')
  })
})
