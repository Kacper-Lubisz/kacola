import type { AgendaView, SendAgendaResult, ShareStatus } from '@kacola/protocol'
import { _, fmt, ngettext } from '@kacola/ui-core/i18n'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { keys } from '../../data/keys.ts'
import { useServices } from '../../data/services.tsx'
import { Banner, Button, Dialog, Icon, Switch, useToast } from '../../design/primitives/index.ts'
import { useDialogs } from '../shell/dialogs.tsx'
import { refusal } from './agenda-data.ts'
import { ShareButton } from './share.tsx'

// "Send the agenda": ONE action (POST /agendas/:id/send) in place of "Add link to invite" then
// "Share…", whose order could put a kacola:// link nobody without kacola can open into an invitation.
// First a preview of exactly what attendees get (and what never leaves: private context), then the
// daemon shares the agenda, writes the invitation text into the calendar event when it can, and hands
// back the text to paste when it could not. Without a sharing server it says so, with one action.

export function SendAgendaButton({ view, status }: { view: AgendaView; status: ShareStatus | undefined }) {
  const [open, setOpen] = useState(false)
  // once shared (or for a followed copy) the button is the share's state and its options; the send
  // dialog stays open across that switch, so its result (the text to paste) is not lost
  const shared = Boolean(status && (status.shared || status.role === 'member' || status.state === 'revoked'))
  return (
    <>
      {shared ? (
        <ShareButton view={view} status={status} />
      ) : (
        <Button icon="send" onPress={() => setOpen(true)} isDisabled={view.agenda.private}>
          {_('Send the agenda')}
        </Button>
      )}
      {open ? <SendDialog view={view} onClose={() => setOpen(false)} /> : null}
    </>
  )
}

function SendDialog({ view, onClose }: { view: AgendaView; onClose: () => void }) {
  const { api, bridge } = useServices()
  const qc = useQueryClient()
  const toast = useToast()
  const dialogs = useDialogs()
  const [shareGoals, setShareGoals] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<SendAgendaResult | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const items = [...view.items].sort((a, b) => a.order - b.order)
  const privateCards = view.context.filter((c) => c.visibility === 'private').length
  const sharedCards = view.context.filter((c) => c.visibility === 'shared')
  const send = async () => {
    setBusy(true)
    setFailed(null)
    try {
      const r = await api.call('sendAgenda', {
        params: { id: view.agenda.id },
        body: { shareGoals, writeInvite: true },
      })
      setResult(r)
      if (r.share) qc.setQueryData(keys.agendaShare(view.agenda.id), r.share)
    } catch (err) {
      setFailed(refusal(err))
    } finally {
      setBusy(false)
    }
  }
  const copy = (text: string) => void bridge.copyText(text).then(() => toast(_('Copied the invitation text')))
  return (
    <Dialog
      title={_('Send the agenda')}
      isOpen
      onOpenChange={(o) => !o && onClose()}
      footer={
        result ? (
          <>
            {result.state === 'ready' && !result.written && result.inviteText ? (
              <Button icon="copy" onPress={() => copy(result.inviteText!)}>
                {_('Copy invitation text')}
              </Button>
            ) : null}
            {result.state === 'no-share-host' ? (
              <Button
                onPress={() => {
                  onClose()
                  dialogs.open('preferences')
                }}
              >
                {_('Set up sharing')}
              </Button>
            ) : null}
            <Button variant="primary" onPress={onClose}>
              {_('Done')}
            </Button>
          </>
        ) : (
          <>
            <Button onPress={onClose}>{_('Cancel')}</Button>
            <Button variant="primary" icon="send" isDisabled={busy} onPress={() => void send()}>
              {busy ? _('Sending…') : _('Send')}
            </Button>
          </>
        )
      }
    >
      {result ? (
        <div className="flex flex-col gap-3">
          <Banner tone={result.state === 'ready' ? 'success' : 'warning'} title={result.message} />
          {result.state === 'ready' ? (
            result.written ? (
              <p className="m-0 type-callout text-text-secondary">
                {_('The link is in the calendar invitation now.')}
              </p>
            ) : (
              <div className="flex flex-col gap-1">
                <p className="m-0 type-callout font-semibold text-text-primary">
                  {_('Paste this into the invitation:')}
                </p>
                {result.writeReason ? (
                  <p className="m-0 type-caption text-text-secondary">{result.writeReason}</p>
                ) : null}
              </div>
            )
          ) : null}
          {result.inviteText ? (
            <pre className="m-0 overflow-x-auto rounded-md border border-border-subtle bg-bg-surface p-3 font-mono text-[13px] whitespace-pre-wrap text-text-primary select-text">
              {result.inviteText}
            </pre>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="m-0 type-callout text-text-secondary">
            {_('Attendees get a page anyone can open, with exactly this:')}
          </p>
          <section
            aria-label={_('What attendees see')}
            className="flex flex-col gap-2 rounded-lg border border-border-subtle bg-bg-surface p-4"
          >
            <h3 className="m-0 type-headline text-text-primary">{view.agenda.title}</h3>
            {shareGoals && view.agenda.goals.length ? (
              <ul className="m-0 flex list-none flex-col gap-0.5 p-0 type-callout text-text-secondary">
                {view.agenda.goals.map((g) => (
                  <li key={g}>{fmt(_('Goal: {goal}'), { goal: g })}</li>
                ))}
              </ul>
            ) : null}
            <ol className="m-0 flex list-decimal flex-col gap-1 pl-5 type-body text-text-primary marker:font-mono marker:text-[13px] marker:text-text-tertiary">
              {items.map((i) => (
                <li key={i.id}>{i.text}</li>
              ))}
            </ol>
            {sharedCards.map((c) => (
              <p key={c.id} className="m-0 type-callout text-text-secondary">
                {c.title}
              </p>
            ))}
          </section>
          <Switch isSelected={shareGoals} onChange={setShareGoals}>
            <span className="type-callout">{_('Include the goals')}</span>
          </Switch>
          {privateCards ? (
            <p className="m-0 flex items-center gap-1.5 type-callout text-text-secondary">
              <Icon name="lock" size={14} />
              {fmt(
                ngettext(
                  '{n} private note stays on this computer: attendees never see it.',
                  '{n} private notes stay on this computer: attendees never see them.',
                  privateCards,
                ),
                { n: privateCards },
              )}
            </p>
          ) : null}
          {failed ? (
            <Banner tone="danger" title={fmt(_('The agenda was not sent: {reason}'), { reason: failed })} />
          ) : null}
        </div>
      )}
    </Dialog>
  )
}
