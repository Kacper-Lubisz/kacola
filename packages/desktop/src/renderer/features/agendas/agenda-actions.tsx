import type { AgendaView, InviteBlockResult } from '@gnomeola/protocol'
import { _, fmt } from '@gnomeola/ui-core/i18n'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { keys } from '../../data/keys.ts'
import { useServices } from '../../data/services.tsx'
import {
  AlertDialog,
  Banner,
  Button,
  Dialog,
  IconButton,
  Menu,
  MenuItem,
  MenuSeparator,
  Select,
  TextArea,
  useToast,
} from '../../design/primitives/index.ts'
import { refusal } from './agenda-data.ts'

// The agenda's actions beyond editing: "Add link to invite" (the daemon writes a marked block into the
// calendar event through the calendar's write path — or says why it can't, and then the block is copied
// instead), markdown export / copy / import, and delete.

/** File names from titles: one path component, no odd characters (main sanitizes again). */
const fileName = (title: string) => `${title.replace(/[^\p{L}\p{N} ._-]+/gu, ' ').trim() || 'agenda'}.md`

export function InviteButton({ view }: { view: AgendaView }) {
  const { api, bridge } = useServices()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [refused, setRefused] = useState<InviteBlockResult | null>(null)
  const linked = view.agenda.meeting !== null
  const run = async () => {
    setBusy(true)
    try {
      const r = await api.call('agendaInviteBlock', {
        params: { id: view.agenda.id },
        body: { write: linked },
      })
      if (r.written) toast(_('Added the agenda link to the invitation'))
      else setRefused(r)
    } catch (err) {
      toast(fmt(_('Could not add the link: {reason}'), { reason: refusal(err) }), { tone: 'error' })
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <Button icon="link" onPress={() => void run()} isDisabled={busy}>
        {linked ? _('Add Link to Invite') : _('Copy Agenda Link')}
      </Button>
      {refused ? (
        <Dialog
          title={linked ? _('Couldn’t Edit the Invitation') : _('Agenda Link')}
          isOpen
          onOpenChange={(o) => {
            if (!o) setRefused(null)
          }}
          footer={
            <>
              <Button onPress={() => setRefused(null)}>{_('Close')}</Button>
              <Button
                variant="primary"
                icon="copy"
                onPress={() => {
                  void bridge.copyText(refused.block).then(() => toast(_('Copied the agenda link')))
                  setRefused(null)
                }}
              >
                {_('Copy')}
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-3">
            {linked && refused.reason ? <Banner tone="warning" title={refused.reason} /> : null}
            <p className="m-0 type-callout text-text-secondary">
              {_('Paste this into the invitation yourself:')}
            </p>
            <pre className="m-0 overflow-x-auto rounded-md border border-border-subtle bg-bg-surface p-3 font-mono text-[13px] whitespace-pre-wrap text-text-primary select-text">
              {refused.block}
            </pre>
          </div>
        </Dialog>
      ) : null}
    </>
  )
}

export function AgendaMenu({ view, onImport }: { view: AgendaView; onImport: () => void }) {
  const { api, bridge } = useServices()
  const toast = useToast()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const markdown = async () =>
    (
      await api.call('exportAgendaMarkdown', {
        params: { id: view.agenda.id },
        query: { includePrivate: true },
      })
    ).markdown
  const fail = (what: string) => (err: unknown) =>
    toast(fmt(_('{what}: {reason}'), { what, reason: refusal(err) }), { tone: 'error' })
  return (
    <>
      <Menu
        label={_('Agenda actions')}
        trigger={<IconButton icon="more" label={_('Agenda actions')} variant="secondary" />}
      >
        <MenuItem
          icon="download"
          onAction={() =>
            void markdown()
              .then((text) =>
                bridge.saveTextFile({
                  title: _('Export Agenda'),
                  defaultName: fileName(view.agenda.title),
                  text,
                }),
              )
              .then((r) => {
                if (r.saved) toast(_('Exported the agenda'))
              })
              .catch(fail(_('Could not export the agenda')))
          }
        >
          {_('Export as Markdown…')}
        </MenuItem>
        <MenuItem
          icon="copy"
          onAction={() =>
            void markdown()
              .then((text) => bridge.copyText(text))
              .then(() => toast(_('Copied the agenda as Markdown')))
              .catch(fail(_('Could not copy the agenda')))
          }
        >
          {_('Copy as Markdown')}
        </MenuItem>
        <MenuItem icon="import" onAction={onImport}>
          {_('Import Markdown…')}
        </MenuItem>
        <MenuSeparator />
        <MenuItem icon="delete" destructive onAction={() => setConfirmDelete(true)}>
          {_('Delete Agenda…')}
        </MenuItem>
      </Menu>
      <AlertDialog
        isOpen={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={_('Delete this agenda?')}
        confirmLabel={_('Delete')}
        destructive
        onConfirm={() => {
          void api
            .call('deleteAgenda', { params: { id: view.agenda.id } })
            .then(() => {
              qc.removeQueries({ queryKey: keys.agenda(view.agenda.id) })
              void navigate({ to: '/' })
            })
            .catch(fail(_('Could not delete the agenda')))
        }}
      >
        {_('Its items, context cards and history go with it. The meeting and its recording stay.')}
      </AlertDialog>
    </>
  )
}

export function ImportMarkdownDialog({ view, onClose }: { view: AgendaView; onClose: () => void }) {
  const { api } = useServices()
  const toast = useToast()
  const [text, setText] = useState('')
  const [mode, setMode] = useState<'merge' | 'replace'>('merge')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const run = async () => {
    setBusy(true)
    setError(null)
    try {
      await api.call('importAgendaMarkdown', {
        params: { id: view.agenda.id },
        body: { markdown: text, baseVersion: view.agenda.version, mode },
      })
      toast(_('Imported the agenda'))
      onClose()
    } catch (err) {
      setError(
        (err as { status?: number }).status === 409
          ? _('The agenda changed while you were importing. Check it and import again.')
          : refusal(err),
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog
      title={_('Import Markdown')}
      size="lg"
      isOpen
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
      footer={
        <>
          <Button onPress={onClose}>{_('Cancel')}</Button>
          <Button variant="primary" onPress={() => void run()} isDisabled={!text.trim() || busy}>
            {_('Import')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="m-0 type-callout text-text-secondary">
          {_(
            'One item per line, like “- [ ] Promo timeline (10m, @ana) [must-cover]”. Goals go under “## Goals”.',
          )}
        </p>
        <TextArea label={_('Markdown')} value={text} onChange={setText} rows={10} autoFocus />
        <Select
          label={_('Items not in the text')}
          options={[
            { value: 'merge', label: _('Keep them') },
            { value: 'replace', label: _('Remove them') },
          ]}
          value={mode}
          onChange={setMode}
        />
        {error ? <Banner tone="danger" title={error} /> : null}
      </div>
    </Dialog>
  )
}
