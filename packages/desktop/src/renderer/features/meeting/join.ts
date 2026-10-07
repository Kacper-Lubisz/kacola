import type { MeetingProvider } from '@kacola/protocol'
import { _, fmt } from '@kacola/ui-core/i18n'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { keys } from '../../data/keys.ts'
import { useServices } from '../../data/services.tsx'
import { useToast } from '../../design/primitives/index.ts'
import { refusal } from '../agendas/agenda-data.ts'
import { useMeetingUi } from './meeting-ui.ts'

// Opening a calendar meeting from home or its prep page: "Join and record" (the daemon creates the
// session linked to the occurrence and starts recording; the window opens the call's link and moves to
// the live page), and "Open prep" (the occurrence's agenda — created on first open, seeded by carry-over
// for a recurring meeting).

const PROVIDER: Record<MeetingProvider, string> = {
  meet: 'Google Meet',
  zoom: 'Zoom',
  teams: 'Teams',
  webex: 'Webex',
  jitsi: 'Jitsi',
  whereby: 'Whereby',
  other: '',
}

export const providerLabel = (p: MeetingProvider | null | undefined): string => (p ? PROVIDER[p] : '')

export function useJoin() {
  const { api, bridge } = useServices()
  const navigate = useNavigate()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const join = async (meetingId: string) => {
    setBusy(true)
    try {
      const r = await api.call('joinMeeting', { params: { id: meetingId }, body: {} })
      useMeetingUi.getState().markStarted(r.session.id)
      if (r.joinUrl) void bridge.openExternal(r.joinUrl)
      await navigate({ to: '/sessions/$sessionId', params: { sessionId: r.session.id } })
    } catch (err) {
      toast(fmt(_('Could not start recording: {reason}'), { reason: refusal(err) }), { tone: 'error' })
    } finally {
      setBusy(false)
    }
  }
  return { join, busy }
}

/** Open a calendar occurrence's prep page, making its agenda on first open. */
export function useOpenPrep() {
  const { api, queryClient } = useServices()
  const navigate = useNavigate()
  const toast = useToast()
  const [busy, setBusy] = useState<string | null>(null)
  const open = async (m: { id: string; uid: string; start: string }, known?: string | null) => {
    if (known) {
      void navigate({ to: '/agendas/$agendaId', params: { agendaId: known } })
      return
    }
    setBusy(m.id)
    try {
      const r = await api.call('resolveAgendaLink', {
        body: { eventUid: m.uid, start: m.start, create: true, includePrivate: true },
      })
      if (r.agenda) {
        queryClient.setQueryData(keys.agenda(r.agenda.agenda.id), r.agenda)
        void queryClient.invalidateQueries({ queryKey: keys.agendas() })
        void navigate({ to: '/agendas/$agendaId', params: { agendaId: r.agenda.agenda.id } })
      }
    } catch (err) {
      toast(fmt(_('Could not open the agenda: {reason}'), { reason: refusal(err) }), { tone: 'error' })
    } finally {
      setBusy(null)
    }
  }
  return { open, busy }
}
