import type { Settings, SettingsPatch } from '@gnomeola/protocol'
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
      ? { speakers: { diarize: true, voiceprints: false, ...s.speakers, ...p.speakers } }
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

/**
 * Store (or clear, with null) the current provider's API key. The key goes straight to the daemon's
 * keyring and is never cached or shown; only `apiKeyConfigured` changes here, and the settings are
 * refetched afterwards (a key change is not a settings.updated event).
 */
export function setApiKeyMutation(api: Api, qc: QueryClient) {
  return {
    mutationKey: ['setApiKey'],
    mutationFn: (v: string | null | { key: string | null; provider: 'anthropic' | 'openai' | 'typesafe' }) =>
      api.call('setApiKey', {
        body: v !== null && typeof v === 'object' ? { key: v.key, provider: v.provider } : { key: v },
      }),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: keys.health(), exact: true })
      return qc.invalidateQueries({ queryKey: keys.settings(), exact: true })
    },
  }
}
