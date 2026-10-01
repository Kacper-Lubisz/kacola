import { parseShareLink } from '@gnomeola/protocol'
import { formatClockTime } from '@gnomeola/ui-core/format'
import { _, fmt } from '@gnomeola/ui-core/i18n'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { create } from 'zustand'
import { keys } from '../../data/keys.ts'
import { useServices } from '../../data/services.tsx'
import { Banner, Button, Dialog, TextField, useToast } from '../../design/primitives/index.ts'
import { refusal } from './agenda-data.ts'

// Following someone else's shared agenda (team sharing, docs/sharing.md): paste the web link and your
// email; the host emails a code (only to an address the organiser listed); enter it and your daemon
// keeps a local copy of the agenda, linked to your own calendar's occurrence, in step with everyone's.
// Opened from the sidebar's Coming up, the main menu, or a `https://…/a/<token>` link handed to the app.

type FollowState = { open: boolean; link: string; show: (link?: string) => void; hide: () => void }

export const useFollow = create<FollowState>((set) => ({
  open: false,
  link: '',
  show: (link = '') => set({ open: true, link }),
  hide: () => set({ open: false, link: '' }),
}))

export function FollowDialogHost() {
  const open = useFollow((s) => s.open)
  const link = useFollow((s) => s.link)
  // a new link (from a deep link) starts the dialog over
  return open ? <FollowDialog key={link} initialLink={link} /> : null
}

function FollowDialog({ initialLink }: { initialLink: string }) {
  const { api, queryClient } = useServices()
  const hide = useFollow((s) => s.hide)
  const navigate = useNavigate()
  const toast = useToast()
  const [link, setLink] = useState(initialLink)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState<{ expiresAt: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const linkOk = parseShareLink(link.trim()) !== null
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const send = async () => {
    setBusy(true)
    setError(null)
    try {
      const r = await api.call('followAgenda', {
        body: {
          link: link.trim(),
          email: email.trim(),
          ...(name.trim() ? { name: name.trim() } : {}),
        },
      })
      setSent({ expiresAt: r.expiresAt })
    } catch (err) {
      setError(refusal(err))
    } finally {
      setBusy(false)
    }
  }
  const confirm = async () => {
    setBusy(true)
    setError(null)
    try {
      const st = await api.call('confirmFollowAgenda', {
        body: { link: link.trim(), email: email.trim(), code: code.trim() },
      })
      queryClient.setQueryData(keys.agendaShare(st.agendaId), st)
      const view = await api.call('getAgenda', {
        params: { id: st.agendaId },
        query: { includePrivate: true },
      })
      queryClient.setQueryData(keys.agenda(st.agendaId), (cur: unknown) => cur ?? view)
      toast(fmt(_('Following “{title}”'), { title: view.agenda.title }))
      hide()
      void navigate({ to: '/agendas/$agendaId', params: { agendaId: st.agendaId } })
    } catch (err) {
      const e = err as { status?: number }
      setError(
        e.status === 403
          ? _('That code is wrong or has expired, or this address may not follow the agenda.')
          : refusal(err),
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog
      title={_('Follow a Shared Agenda')}
      isOpen
      onOpenChange={(o) => {
        if (!o) hide()
      }}
      footer={
        sent ? (
          <>
            <Button
              onPress={() => {
                setSent(null)
                setCode('')
                setError(null)
              }}
              className="mr-auto"
            >
              {_('Back')}
            </Button>
            <Button
              variant="primary"
              onPress={() => void confirm()}
              isDisabled={busy || code.trim().length < 4}
            >
              {_('Follow')}
            </Button>
          </>
        ) : (
          <>
            <Button onPress={hide}>{_('Cancel')}</Button>
            <Button
              variant="primary"
              icon="send"
              onPress={() => void send()}
              isDisabled={busy || !linkOk || !emailOk}
            >
              {_('Send Code')}
            </Button>
          </>
        )
      }
    >
      <div className="flex flex-col gap-3">
        {sent ? (
          <>
            <p className="m-0 type-body text-text-primary" data-share-time>
              {fmt(
                _('If {email} may follow this agenda, a code is on its way there. It works until {time}.'),
                {
                  email: email.trim(),
                  time: formatClockTime(sent.expiresAt),
                },
              )}
            </p>
            <TextField
              label={_('Code')}
              placeholder="ABCD-EFGH"
              value={code}
              onChange={(c) => {
                setCode(c)
                setError(null)
              }}
              autoFocus
              autoComplete="one-time-code"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && code.trim().length >= 4) void confirm()
              }}
            />
          </>
        ) : (
          <>
            <p className="m-0 type-callout text-text-secondary">
              {_(
                'Someone shared a meeting’s agenda with you. Your kacola keeps a copy in step with theirs: your status changes and the items you add go to everyone following it.',
              )}
            </p>
            <TextField
              label={_('Link')}
              type="url"
              placeholder="https://…/a/…"
              value={link}
              onChange={setLink}
              autoFocus={!initialLink}
              errorMessage={
                link.trim() && !linkOk
                  ? fmt(_('That is not a shared agenda link ({example}).'), { example: 'https://…/a/…' })
                  : undefined
              }
            />
            <TextField
              label={_('Your email')}
              type="email"
              description={_('The address the organizer invited.')}
              value={email}
              onChange={setEmail}
              autoFocus={Boolean(initialLink)}
            />
            <TextField label={_('Your name (optional)')} value={name} onChange={setName} />
          </>
        )}
        {error ? <Banner tone="danger" title={error} /> : null}
      </div>
    </Dialog>
  )
}
