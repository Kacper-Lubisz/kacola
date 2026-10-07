import type { ModelInfo, Settings } from '@kacola/protocol'
import { missingModels } from '@kacola/ui-core/settings'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { UiState } from '../../../shared/bridge.ts'
import { useServices } from '../../data/services.tsx'

/**
 * Open onboarding by itself? On first run, and afterwards whenever a required model is missing that
 * was not already missing when the user skipped (a newly required model, or one that went corrupt).
 * `missing` is null when the model list could not be fetched (an older daemon): then the flow has
 * nothing to offer and does not open by itself. (The GTK app's rule, kept at the cut-over.)
 */
export function shouldOnboard(state: UiState, missing: readonly ModelInfo[] | null): boolean {
  if (!missing) return false
  if (!state.onboardingDone) return true
  return missing.some((m) => !state.skippedMissing.includes(m.id))
}

/**
 * Onboarding bookkeeping for the window: ui-state.json through the bridge, the models query, and
 * whether the flow is due. `done(skippedMissing)` remembers the outcome (null = finished, nothing
 * skipped).
 */
export function useOnboarding(live: boolean) {
  const { bridge, queries } = useServices()
  const qc = useQueryClient()
  const [uiState, setUiState] = useState<UiState | null>(null)
  useEffect(() => {
    let alive = true
    bridge.getUiState().then(
      (s) => alive && setUiState(s),
      () => alive && setUiState({ version: 1, onboardingDone: true, skippedMissing: [] }),
    )
    return () => {
      alive = false
    }
  }, [bridge])
  const models = useQuery({ ...queries.models(), enabled: live, retry: false })
  const settings = useQuery({ ...queries.settings(), enabled: live })
  const missing = models.data
    ? missingModels(models.data, (settings.data as Settings | undefined) ?? null)
    : null
  const due =
    live && uiState !== null && models.isFetched && shouldOnboard(uiState, models.isError ? null : missing)

  const done = useCallback(
    (skippedMissing: string[] | null) => {
      const next: UiState = { version: 1, onboardingDone: true, skippedMissing: skippedMissing ?? [] }
      setUiState(next)
      // read fresh and merge: the sidebar's extension card keeps its dismissal in the same file.
      // Not fatal if it fails: onboarding simply shows again next time
      bridge
        .getUiState()
        .catch(() => null)
        .then((cur) => bridge.setUiState({ ...cur, ...next }))
        .catch(() => {})
      void qc.invalidateQueries({ queryKey: queries.models().queryKey })
    },
    [bridge, qc, queries],
  )
  return { due, missing: missing ?? [], done }
}

/** How many required speech models are missing (the window provides it; home's banner and readiness read it). */
export const MissingModelsContext = createContext(0)
export const useMissingModels = (): number => useContext(MissingModelsContext)
