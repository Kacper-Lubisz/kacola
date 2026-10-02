import type { AgendaView } from '@gnomeola/protocol'
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

// The agenda's actions beyond editing and sending (send.tsx): markdown export / copy / import, and delete.

/** File names from titles: one path component, no odd characters (main sanitizes again). */
const fileName = (title: string) => `${title.replace(/[^\p{L}\p{N} ._-]+/gu, ' ').trim() || 'agenda'}.md`

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
