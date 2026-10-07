import { parseShareLink } from '@kacola/protocol'
import { _, fmt } from '@kacola/ui-core/i18n'
import { useNavigate } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import { keys } from '../../data/keys.ts'
import { useServices } from '../../data/services.tsx'
import { useToast } from '../../design/primitives/index.ts'
import { refusal } from './agenda-data.ts'
import { useFollow } from './follow.tsx'

// kacola:// links (main validates them: `kacola://agenda/<id>`, `kacola://meeting/<uid>[?start=]`) open
// the agenda: the daemon resolves the link — creating the agenda for a known meeting that has none — and
// the window shows it; for a meeting in progress the agenda page offers Join and record. The handshake
// with main (docs/desktop-app.md, "Deep links"): subscribe first, then take the pending link once.
// A shared agenda's web link (`https://<host>/a/<token>`, team sharing) opens "Follow a Shared Agenda"
// with the link filled in: following asks for an email and a code, so nothing happens without the user.

let took = false

export function DeepLinkHandler() {
  const { bridge, api, queryClient } = useServices()
  const navigate = useNavigate()
  const toast = useToast()
  const open = useRef<(url: string) => void>(() => {})
  open.current = (link: string) => {
    if (parseShareLink(link)) {
      useFollow.getState().show(link)
      return
    }
    void api
      .call('resolveAgendaLink', { body: { link, create: true, includePrivate: true } })
      .then((r) => {
        if (r.agenda) {
          queryClient.setQueryData(keys.agenda(r.agenda.agenda.id), (cur: unknown) => cur ?? r.agenda)
          void navigate({ to: '/agendas/$agendaId', params: { agendaId: r.agenda.agenda.id } })
        } else
          toast(_('That meeting is not in your calendar, so there is no agenda to open.'), { tone: 'error' })
      })
      .catch((err: unknown) =>
        toast(fmt(_('Could not open the link: {reason}'), { reason: refusal(err) }), { tone: 'error' }),
      )
  }
  useEffect(() => {
    const off = bridge.onDeepLink((url) => open.current(url))
    if (!took) {
      took = true
      void bridge.takeDeepLink().then((url) => {
        if (url) open.current(url)
      })
    }
    return off
  }, [bridge])
  return null
}

/** Tests only: a fresh window takes again. */
export function resetDeepLinksForTests(): void {
  took = false
}
