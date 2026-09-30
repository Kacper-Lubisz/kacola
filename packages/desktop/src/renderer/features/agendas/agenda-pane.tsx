import { _, fmt } from '@gnomeola/ui-core/i18n'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useServices } from '../../data/services.tsx'
import { Button, EmptyState, Spinner, useToast } from '../../design/primitives/index.ts'
import type { PaneProps } from '../sessions/pane.ts'
import { refusal, useAgenda } from './agenda-data.ts'
import { LivePanel } from './live-panel.tsx'

// The session page's Agenda tab: the agenda linked to this recording — live while it records, the recap
// and the settled items in review after. A recording without one offers to make one (for its calendar
// meeting; the daemon links it to a recording under way).

export function AgendaPane({ session }: PaneProps) {
  const { queries, api } = useServices()
  const toast = useToast()
  const navigate = useNavigate()
  const link = useQuery(queries.sessionAgenda(session.id))
  const { data: view } = useAgenda(link.data)
  const [busy, setBusy] = useState(false)
  if (link.isPending || (link.data && !view))
    return (
      <div className="flex justify-center p-8">
        <Spinner label={_('Loading the agenda…')} />
      </div>
    )
  if (view)
    return (
      <div className="min-h-0 flex-1 overflow-y-auto pt-1">
        <LivePanel view={view} session={session} />
      </div>
    )
  const m = session.meeting
  const create = async () => {
    setBusy(true)
    try {
      const v = await api.call('createAgenda', {
        body: m
          ? { eventUid: m.uid, start: m.start, ifExists: 'reuse' }
          : { title: fmt(_('Agenda for {title}'), { title: session.title || _('this meeting') }) },
      })
      void navigate({ to: '/agendas/$agendaId', params: { agendaId: v.agenda.id } })
    } catch (err) {
      toast(fmt(_('Could not create the agenda: {reason}'), { reason: refusal(err) }), { tone: 'error' })
    } finally {
      setBusy(false)
    }
  }
  return (
    <EmptyState
      icon="agenda"
      headingLevel={2}
      title={_('No Agenda')}
      description={
        m
          ? _('Plan what this meeting should cover, and follow it live while you record.')
          : _('This recording is not linked to a calendar meeting. You can still write an agenda for it.')
      }
    >
      <Button variant="primary" icon="add" onPress={() => void create()} isDisabled={busy}>
        {_('Create Agenda')}
      </Button>
    </EmptyState>
  )
}
