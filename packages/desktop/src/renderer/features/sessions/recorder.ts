import type { Session } from '@kacola/protocol'
import { elapsedMs } from '@kacola/ui-core/format'
import { useNow } from '@kacola/ui-core/hooks'
import { _, fmt } from '@kacola/ui-core/i18n'
import { activeSession, type SessionsState } from '@kacola/ui-core/sessions'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { keys } from '../../data/keys.ts'
import { patchSessionIn } from '../../data/mutations.ts'
import { useServices } from '../../data/services.tsx'
import { type RecordState, useToast } from '../../design/primitives/index.ts'
import { useMeetingUi } from '../meeting/meeting-ui.ts'
import { createRequestGate, type RequestKind } from './request-gate.ts'

// The record flow: one hook home's New recording, the meeting header and the keyboard shortcuts share.
//
//   record   create a session, start it, select it (POST /sessions, POST /sessions/:id/start)
//   pause / resume / stop  on the live session
//
// Status changes come back as session.upserted through the EventBridge (the list and the page update
// from the echo); the only local state is "a request is in flight", which draws starting / stopping.
// A failure is a toast with the daemon's reason. Overlapping presses: ./request-gate.ts.

const reason = (e: unknown) => (e instanceof Error ? e.message : String(e))

export type Recorder = {
  /** The session recording or paused, if any. */
  active: Session | undefined
  state: RecordState
  elapsedMs: number
  record: () => void
  stop: () => void
  pause: () => void
  resume: () => void
}

export function useRecorder(): Recorder {
  const { api, queries, queryClient } = useServices()
  const toast = useToast()
  const navigate = useNavigate()
  const { data } = useQuery({ ...queries.sessions(), enabled: false })
  const active = activeSession(data?.ordered ?? [])
  const [busy, setBusy] = useState<RequestKind | null>(null)
  const [gate] = useState(() => createRequestGate(setBusy))
  const now = useNow(active?.status === 'recording' ? 1000 : 60_000)

  const run = (kind: RequestKind, failure: string, fn: () => Promise<void>) =>
    gate.run(kind, () =>
      fn().catch((e: unknown) => {
        toast(fmt(failure, { reason: reason(e) }), { tone: 'error' })
      }),
    )

  /** Put the daemon's answer in the cache at once (its event will say the same, and wins if newer). */
  const settle = (s: Session) => {
    queryClient.setQueryData<SessionsState>(keys.sessions(), (st) =>
      st?.byId.has(s.id) ? patchSessionIn(st, s.id, (cur) => (cur.status === s.status ? cur : s)) : st,
    )
  }

  const state: RecordState =
    busy === 'starting'
      ? 'starting'
      : busy === 'stopping'
        ? 'stopping'
        : active?.status === 'recording'
          ? 'recording'
          : active?.status === 'paused'
            ? 'paused'
            : 'idle'

  return {
    active,
    state,
    elapsedMs: active ? elapsedMs(active, now) : 0,
    record: () =>
      void run('starting', _('Could not start recording: {reason}'), async () => {
        const created = await api.call('createSession', { body: {} })
        useMeetingUi.getState().markStarted(created.id)
        const started = await api.call('startSession', { params: { id: created.id } })
        settle(started)
        await navigate({ to: '/sessions/$sessionId', params: { sessionId: started.id } })
      }),
    stop: () => {
      if (!active) return
      void run('stopping', _('Could not stop recording: {reason}'), async () => {
        settle(await api.call('stopSession', { params: { id: active.id } }))
      })
    },
    pause: () => {
      if (!active) return
      void run('pausing', _('Could not pause recording: {reason}'), async () => {
        settle(await api.call('pauseSession', { params: { id: active.id } }))
      })
    },
    resume: () => {
      if (!active) return
      void run('pausing', _('Could not resume recording: {reason}'), async () => {
        settle(await api.call('resumeSession', { params: { id: active.id } }))
      })
    },
  }
}
