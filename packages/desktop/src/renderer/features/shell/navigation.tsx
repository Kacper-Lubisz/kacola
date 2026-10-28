import { useNavigate } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import type { AppNavigation } from '../../../shared/bridge.ts'
import { useServices } from '../../data/services.tsx'
import { useDialogs } from './dialogs.tsx'

// Where main sends the window (a notification's click, the menu bar's "Allow Calendar Access…"): a
// recording, or a step of setup. The same handshake as deep links: subscribe first, then take once.

let took = false

export function NavigationHandler() {
  const { bridge } = useServices()
  const navigate = useNavigate()
  const dialogs = useDialogs()
  const go = useRef<(to: AppNavigation) => void>(() => {})
  go.current = (to) => {
    if (to.to === 'session')
      void navigate({ to: '/sessions/$sessionId', params: { sessionId: to.sessionId } })
    else dialogs.open('onboarding', { step: to.step })
  }
  useEffect(() => {
    const off = bridge.onNavigate((to) => go.current(to))
    if (!took) {
      took = true
      void bridge.takeNavigation().then((to) => {
        if (to) go.current(to)
      })
    }
    return off
  }, [bridge])
  return null
}

/** Tests only: a fresh window takes again. */
export function resetNavigationForTests(): void {
  took = false
}
