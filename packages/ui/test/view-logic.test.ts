import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AudioDevice, ModelInfo, Settings } from '@gnomeola/protocol'
import { afterEach, describe, expect, it } from 'vitest'
import { Follow } from '../src/data/follow.ts'
import { applySplice, diffKeys } from '../src/data/list-diff.ts'
import { noticesText, parseNotices } from '../src/data/notices.ts'
import {
  deviceChoices,
  FINAL_PASS,
  formatBytes,
  indexOf,
  missingModels,
  PROVIDERS,
  valueAt,
  withStored,
} from '../src/data/settings.ts'
import { readUiState, shouldOnboard, uiStatePath, writeUiState } from '../src/data/ui-state.ts'
import { _, fmt, ngettext, setTranslator } from '../src/i18n/index.ts'

describe('list diff (one splice per model update)', () => {
  const cases: [string[], string[]][] = [
    [[], ['a', 'b']],
    [
      ['a', 'b'],
      ['a', 'b', 'c'],
    ],
    [
      ['a', 'b', 'c'],
      ['a', 'c'],
    ],
    [
      ['a', 'b', 'c'],
      ['a', 'x', 'b', 'c'],
    ],
    [['a', 'b'], []],
    [
      ['a', 'b', 'c'],
      ['c', 'b', 'a'],
    ],
    [['p:mic'], ['s1', 'p:mic']],
  ]
  it.each(cases)('%j → %j', (prev, next) => {
    expect(applySplice(prev, diffKeys(prev, next))).toEqual(next)
  })
  it('is minimal for an append and a no-op for no change', () => {
    expect(diffKeys(['a'], ['a', 'b'])).toEqual({ position: 1, removed: 0, added: ['b'] })
    expect(diffKeys(['a', 'b'], ['a', 'b'])).toBeNull()
  })
})

describe('Follow (autoscroll intent)', () => {
  it('stays attached while content grows and pins to the new bottom', () => {
    const f = new Follow(true)
    f.scrolled(400, 1000, 600)
    expect(f.resized(400, 1400, 600)).toBe(800)
  })
  it('does not detach on small drift from row re-measurement, only on user intent', () => {
    const f = new Follow(true)
    f.scrolled(800, 1400, 600)
    expect(f.scrolled(760, 1500, 600)).toBe(true) // re-estimated rows above the anchor
    f.userKey(0xff50) // Home
    expect(f.following).toBe(false)
    expect(f.resized(0, 2000, 600)).toBeNull()
    f.attach()
    expect(f.resized(0, 2000, 600)).toBe(1400)
  })
  it('re-attaches on reaching the bottom, detaches on wheel up or a page-sized drag', () => {
    const f = new Follow(false)
    expect(f.scrolled(1390, 2000, 600)).toBe(true)
    f.userScrolled(3)
    expect(f.following).toBe(true)
    f.userScrolled(-1)
    expect(f.following).toBe(false)
    const g = new Follow(true)
    g.scrolled(1400, 2000, 600)
    expect(g.scrolled(200, 2000, 600)).toBe(false)
  })
})

describe('settings model', () => {
  it('maps combo indexes and values both ways', () => {
    expect(indexOf(PROVIDERS, 'ollama')).toBe(1)
    expect(valueAt(FINAL_PASS, 2)).toBe('off')
    expect(valueAt(FINAL_PASS, 9)).toBeUndefined()
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
  })
  it('formats sizes like GNOME does', () => {
    expect(formatBytes(1_000_000)).toBe('1 MB')
    expect(formatBytes(466_000_000)).toBe('466 MB')
    expect(formatBytes(1_550_000_000)).toBe('1.6 GB')
    expect(formatBytes(900)).toBe('900 bytes')
  })
})

describe('UI state file (onboarding)', () => {
  let dir: string | null = null
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true })
    dir = null
  })
  it('lives under XDG_STATE_HOME, with an override', () => {
    expect(uiStatePath({ XDG_STATE_HOME: '/s', HOME: '/h' })).toBe('/s/gnomeola/ui-state.json')
    expect(uiStatePath({ HOME: '/h' })).toBe('/h/.local/state/gnomeola/ui-state.json')
    expect(uiStatePath({ GNOMEOLA_UI_STATE_FILE: '/x.json' })).toBe('/x.json')
  })
  it('round-trips atomically and survives a missing or corrupt file', () => {
    dir = mkdtempSync(join(tmpdir(), 'gnomeola-ui-state-'))
    const p = join(dir, 'nested', 'ui-state.json')
    expect(readUiState(p)).toEqual({ version: 1, onboardingDone: false, skippedMissing: [] })
    writeUiState(p, { version: 1, onboardingDone: true, skippedMissing: ['whisper'] })
    expect(JSON.parse(readFileSync(p, 'utf8'))).toMatchObject({ onboardingDone: true })
    expect(readUiState(p).skippedMissing).toEqual(['whisper'])
    writeFileSync(p, '{not json')
    expect(readUiState(p).onboardingDone).toBe(false)
  })
  it('opens on first run and for newly missing models, not again for ones skipped', () => {
    const missing = [{ id: 'whisper' }] as ModelInfo[]
    const fresh = { version: 1 as const, onboardingDone: false, skippedMissing: [] }
    expect(shouldOnboard(fresh, [])).toBe(true)
    expect(shouldOnboard(fresh, null)).toBe(false) // daemon cannot list models: nothing to offer
    const skipped = { version: 1 as const, onboardingDone: true, skippedMissing: ['whisper'] }
    expect(shouldOnboard(skipped, missing)).toBe(false)
    expect(shouldOnboard(skipped, [...missing, { id: 'vad' } as ModelInfo])).toBe(true)
  })
})

describe('third-party notices for the About dialog', () => {
  it('parses the generated file’s tables', () => {
    const md = readFileSync(join(import.meta.dirname, '..', '..', '..', 'THIRD_PARTY_NOTICES.md'), 'utf8')
    const notices = parseNotices(md)
    expect(notices.length).toBeGreaterThan(20)
    expect(notices.find((n) => n.name === '@gtkx/react')).toMatchObject({ licence: 'MPL-2.0' })
    expect(noticesText(notices)).toContain('react ')
    for (const n of notices) expect(n.name).not.toMatch(/^-+$/)
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
