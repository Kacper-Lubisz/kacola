import type { AudioDevice, ModelInfo, Settings, StoredSettings } from '@gnomeola/protocol'

// The Preferences dialog's model: option lists for the combo rows, and index ↔ value mapping. Pure.

export type Choice<T extends string> = { value: T; label: string }

export const PROVIDERS: readonly Choice<Settings['llm']['provider']>[] = [
  { value: 'anthropic', label: 'Anthropic (Claude)' },
  { value: 'ollama', label: 'Ollama (on this computer)' },
  { value: 'none', label: 'None (questions off)' },
]

export const FINAL_PASS: readonly Choice<Settings['stt']['finalPass']>[] = [
  { value: 'during', label: 'During the recording' },
  { value: 'after', label: 'After the recording' },
  { value: 'off', label: 'Off (live transcript only)' },
]

export const RETENTION: readonly Choice<Settings['retention']['audio']>[] = [
  { value: 'keep', label: 'Keep' },
  { value: 'delete-after-transcription', label: 'Delete after transcription' },
  { value: 'delete-after-days', label: 'Delete after a number of days' },
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
  const out: Choice<string>[] = [{ value: 'default', label: 'Default' }]
  for (const d of devices) {
    if (d.kind !== kind) continue
    out.push({ value: d.name, label: d.isDefault ? `${d.description} (default)` : d.description })
  }
  if (current !== 'default' && !out.some((c) => c.value === current)) {
    out.push({ value: current, label: `${current} (not connected)` })
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

export const ROLE_LABEL: Record<ModelInfo['role'], string> = {
  live: 'Live transcription',
  final: 'Accurate transcription',
  vad: 'Voice detection',
}
