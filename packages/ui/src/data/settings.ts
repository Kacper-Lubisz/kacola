import type { AudioDevice, ModelInfo, Settings, StoredSettings } from '@gnomeola/protocol'
import { _, fmt } from '../i18n/index.ts'

// The Preferences dialog's model: option lists for the combo rows, and index ↔ value mapping. Pure.
// Lists are functions so their labels are translated when used, not when this module loads.

export type Choice<T extends string> = { value: T; label: string }

export const providers = (): Choice<Settings['llm']['provider']>[] => [
  { value: 'anthropic', label: _('Anthropic (Claude)') },
  { value: 'openai', label: _('OpenAI (GPT)') },
  { value: 'ollama', label: _('Ollama (on this computer)') },
  { value: 'none', label: _('None (questions off)') },
]

export const finalPasses = (): Choice<Settings['stt']['finalPass']>[] => [
  { value: 'during', label: _('During the recording') },
  { value: 'after', label: _('After the recording') },
  { value: 'off', label: _('Off (live transcript only)') },
]

export const retentions = (): Choice<Settings['retention']['audio']>[] => [
  { value: 'keep', label: _('Keep') },
  { value: 'delete-after-transcription', label: _('Delete once transcribed') },
  { value: 'delete-after-days', label: _('Delete after some days') },
]

export const indexOf = <T extends string>(choices: readonly Choice<T>[], value: T): number =>
  Math.max(
    0,
    choices.findIndex((c) => c.value === value),
  )

export const valueAt = <T extends string>(choices: readonly Choice<T>[], i: number): T | undefined =>
  choices[i]?.value

/**
 * Device choices for one capture slot: "Default" first, then the matching devices. The microphone
 * records a PipeWire *source*; system audio records the monitor of a *sink*. A configured device that
 * is not present (unplugged) is kept as a choice so the setting is never silently rewritten.
 */
export function deviceChoices(
  devices: readonly AudioDevice[],
  kind: AudioDevice['kind'],
  current: string,
): Choice<string>[] {
  const out: Choice<string>[] = [{ value: 'default', label: _('Default') }]
  for (const d of devices) {
    if (d.kind !== kind) continue
    out.push({
      value: d.name,
      label: d.isDefault ? fmt(_('{device} (default)'), { device: d.description }) : d.description,
    })
  }
  if (current !== 'default' && !out.some((c) => c.value === current)) {
    out.push({ value: current, label: fmt(_('{device} (not connected)'), { device: current }) })
  }
  return out
}

/** A `settings.updated` event carries StoredSettings: keep the derived key flag we already know. */
export function withStored(prev: Settings | null, stored: StoredSettings): Settings {
  return { ...stored, llm: { ...stored.llm, apiKeyConfigured: prev?.llm.apiKeyConfigured ?? false } }
}

/** Models the configured pipeline needs: live + VAD always, the final model unless the pass is off. */
export function requiredModels(models: readonly ModelInfo[], settings: Settings | null): ModelInfo[] {
  const finalOff = settings?.stt.finalPass === 'off'
  return models.filter((m) => !(finalOff && m.role === 'final'))
}

export const missingModels = (models: readonly ModelInfo[], settings: Settings | null): ModelInfo[] =>
  requiredModels(models, settings).filter((m) => m.state !== 'ready')

/** "1.2 GB", "75 MB", "900 kB" — decimal units, as GNOME's file manager shows sizes. */
export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return ''
  const units = ['bytes', 'kB', 'MB', 'GB', 'TB']
  let i = 0
  let v = n
  while (v >= 1000 && i < units.length - 1) {
    v /= 1000
    i++
  }
  if (i === 0) return `${v} bytes`
  return `${v >= 100 || Number.isInteger(v) ? Math.round(v) : v.toFixed(1)} ${units[i]}`
}

export const roleLabel = (role: ModelInfo['role']): string =>
  ({
    live: _('Live transcription'),
    final: _('Accurate transcription'),
    vad: _('Voice detection'),
    segmentation: _('Speaker turns'),
    embedding: _('Speaker recognition'),
  })[role]
