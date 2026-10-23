import type { Settings, SettingsPatch } from '@kacola/protocol'
import type { QueryClient } from '@tanstack/react-query'
import { keys } from '../../data/keys.ts'
import { optimistic } from '../../data/mutations.ts'
import type { Api } from '../../data/queries.ts'

// Settings mutations (docs/desktop-app.md, "Add a mutation"). A change applies at once (no OK button,
// as in GNOME): the ['settings'] cache is patched optimistically, the daemon's settings.updated echo
// replaces it, an error restores it.

/** A settings patch applied to the full settings (each group is shallow-merged, like the daemon does). */
export function applyPatch(s: Settings, p: SettingsPatch): Settings {
  return {
    ...s,
    llm: { ...s.llm, ...p.llm },
    stt: { ...s.stt, ...p.stt },
    capture: { ...s.capture, ...p.capture },
    retention: { ...s.retention, ...p.retention },
    autoRecord: { ...s.autoRecord, ...p.autoRecord },
    ...(p.speakers || s.speakers
      ? { speakers: { diarize: true, voiceprints: true, ...s.speakers, ...p.speakers } }
      : {}),
  }
}

export function updateSettingsMutation(api: Api, qc: QueryClient) {
  return {
    mutationKey: ['updateSettings'],
    mutationFn: (patch: SettingsPatch) => api.call('updateSettings', { body: patch }),
    ...optimistic<SettingsPatch>(qc, (patch) => [
      { key: keys.settings(), update: (prev) => applyPatch(prev as Settings, patch) },
    ]),
  }
}
