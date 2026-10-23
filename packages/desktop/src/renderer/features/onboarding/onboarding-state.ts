import type { ModelInfo, Settings } from '@kacola/protocol'
import { missingModels, requiredModels } from '@kacola/ui-core/settings'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { UiState } from '../../../shared/bridge.ts'
import { keys } from '../../data/keys.ts'
import { useServices } from '../../data/services.tsx'

/**
 * Open setup by itself? Only on first run. `missing` is null when the model list could not be fetched
 * (an older daemon): then setup has nothing to download and does not open by itself.
 */
export function shouldOnboard(state: UiState, missing: readonly ModelInfo[] | null): boolean {
  return missing !== null && !state.onboardingDone
}

/**
 * After setup, the required models that should download by themselves without asking: newly required
 * (another model chosen in Preferences, a new default) or damaged ones. Models the user skipped in the
 * old setup dialog (skippedMissing) stay theirs to start.
 */
export function backgroundDownloads(state: UiState, missing: readonly ModelInfo[] | null): ModelInfo[] {
  if (!missing || !state.onboardingDone) return []
  return missing.filter((m) => m.state !== 'downloading' && !state.skippedMissing.includes(m.id))
}

/** How far the required models are, by size: ready ones count whole, downloading ones by progress. */
export function downloadProgress(required: readonly ModelInfo[]): {
  totalBytes: number
  fraction: number
  done: boolean
} {
  const totalBytes = required.reduce((n, m) => n + m.sizeBytes, 0)
  const got = required.reduce(
    (n, m) =>
      n +
      (m.state === 'ready' ? m.sizeBytes : m.state === 'downloading' ? m.sizeBytes * (m.progress ?? 0) : 0),
    0,
  )
  return {
    totalBytes,
    fraction: totalBytes ? got / totalBytes : 1,
    done: required.every((m) => m.state === 'ready'),
  }
}

/** The required models and a way to start downloading them through the daemon. */
export function useModelDownloads(enabled = true) {
  const { api, queries } = useServices()
  const qc = useQueryClient()
  const models = useQuery({ ...queries.models(), enabled, retry: false })
  const settings = useQuery({ ...queries.settings(), enabled })
  const [error, setError] = useState<string | null>(null)
  const s = (settings.data as Settings | undefined) ?? null
  const list = models.isError ? null : (models.data ?? null)

  const start = useCallback(
    (want: readonly ModelInfo[]) => {
      for (const m of want) {
        qc.setQueryData<ModelInfo[]>(keys.models(), (cur) =>
          cur?.map((x) => (x.id === m.id ? { ...x, state: 'downloading', progress: 0 } : x)),
        )
        api
          .call('downloadModel', { params: { id: m.id } })
          .then((next) =>
            qc.setQueryData<ModelInfo[]>(keys.models(), (cur) =>
              cur?.map((x) => (x.id === next.id && x.state !== 'ready' ? { ...x, ...next } : x)),
            ),
          )
          .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      }
    },
    [api, qc],
  )

  return {
    list,
    isFetched: models.isFetched,
    required: list ? requiredModels(list, s) : [],
    missing: list ? missingModels(list, s) : null,
    start,
    error,
  }
}

/**
 * Setup bookkeeping for the window: ui-state.json through the bridge, whether setup is due (first run),
 * and the background downloads after it. `done()` remembers that setup ran.
 */
export function useOnboarding(live: boolean) {
  const { bridge } = useServices()
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
  const models = useModelDownloads(live)
  const due = live && uiState !== null && models.isFetched && shouldOnboard(uiState, models.missing)

  // each model at most once per window: a download that fails is not retried in a loop
  const started = useRef(new Set<string>())
  const { start } = models
  const pending = useRef<ModelInfo[]>([])
  pending.current = live && uiState ? backgroundDownloads(uiState, models.missing) : []
  const pendingIds = pending.current.map((m) => m.id).join(',')
  useEffect(() => {
    if (!pendingIds) return
    const fresh = pending.current.filter((m) => !started.current.has(m.id))
    for (const m of fresh) started.current.add(m.id)
    if (fresh.length) start(fresh)
  }, [pendingIds, start])

  const done = useCallback(() => {
    const next: UiState = { version: 1, onboardingDone: true, skippedMissing: [] }
    setUiState(next)
    // read fresh and merge: the sidebar's extension card keeps its dismissal in the same file.
    // Not fatal if it fails: setup simply shows again next time
    bridge
      .getUiState()
      .catch(() => null)
      .then((cur) => bridge.setUiState({ ...cur, ...next }))
      .catch(() => {})
  }, [bridge])
  return { due, missing: models.missing ?? [], done }
}

/** How many required speech models are missing (the window provides it; home's banner and readiness read it). */
export const MissingModelsContext = createContext(0)
export const useMissingModels = (): number => useContext(MissingModelsContext)
