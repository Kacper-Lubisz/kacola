import type { NoteTemplate } from '@gnomeola/protocol'
import { _, fmt } from '@gnomeola/ui-core/i18n'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Plus, Trash } from 'lucide-react'
import { useState } from 'react'
import { useServices } from '../../data/services.tsx'
import { KButton, KDialog, KListBox, KListItem, KTextField } from './kit.tsx'
import { deleteTemplateMutation, parseKeywords, putTemplateMutation, templateIdFor } from './notes-data.ts'

// N-3 — custom templates: the built-ins (read-only, shown for reference and to copy from) and the
// user's own, which are durable (template.upserted / template.deleted) and offered in every meeting's
// template menu. Keywords pick a template automatically when they appear in a meeting's title or its
// calendar event's.

type Draft = { id: string | null; name: string; keywords: string; body: string }

const blank: Draft = { id: null, name: '', keywords: '', body: '' }
const draftOf = (t: NoteTemplate): Draft => ({
  id: t.id,
  name: t.name,
  keywords: t.keywords.join(', '),
  body: t.body,
})

const NEW = '__new__'

export function TemplateEditor({
  sessionId,
  isOpen,
  onOpenChange,
}: {
  sessionId: string
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { api, queries, queryClient } = useServices()
  const { data } = useQuery({ ...queries.templates(sessionId), enabled: isOpen })
  const put = useMutation(putTemplateMutation(api, queryClient, sessionId))
  const del = useMutation(deleteTemplateMutation(api, queryClient, sessionId))
  const templates = data?.templates ?? []
  const [selected, setSelected] = useState<string>(NEW)
  const [draft, setDraft] = useState<Draft>(blank)
  const current = templates.find((t) => t.id === selected) ?? null
  const readOnly = current?.builtIn === true
  const error = put.error ?? del.error

  const pick = (id: string) => {
    setSelected(id)
    const t = templates.find((x) => x.id === id)
    setDraft(t ? draftOf(t) : blank)
    put.reset()
    del.reset()
  }
  const startFrom = (t: NoteTemplate | null) => {
    setSelected(NEW)
    setDraft(
      t ? { id: null, name: fmt(_('{name} (copy)'), { name: t.name }), keywords: '', body: t.body } : blank,
    )
  }
  const save = () => {
    const id =
      draft.id ??
      templateIdFor(
        draft.name,
        templates.map((t) => t.id),
      )
    put.mutate(
      { id, name: draft.name.trim(), keywords: parseKeywords(draft.keywords), body: draft.body },
      {
        onSuccess: () => {
          setSelected(id)
          setDraft((d) => ({ ...d, id }))
        },
      },
    )
  }
  const remove = () => {
    if (!current || current.builtIn) return
    del.mutate(current.id, { onSuccess: () => startFrom(null) })
  }
  const valid = draft.name.trim() !== '' && draft.body.trim() !== ''

  return (
    <KDialog isOpen={isOpen} onOpenChange={onOpenChange} title={_('Notes Templates')} wide>
      <div className="flex min-h-0 flex-1 border-t border-border-subtle">
        <div className="flex w-64 shrink-0 flex-col gap-2 overflow-y-auto border-r border-border-subtle p-2">
          <KButton size="sm" icon={Plus} onPress={() => startFrom(null)} className="self-start">
            {_('New Template')}
          </KButton>
          <KListBox
            label={_('Templates')}
            items={[{ id: NEW, name: _('New template'), builtIn: false }, ...templates].filter(
              (t) => t.id !== NEW || selected === NEW,
            )}
            selected={selected}
            onSelect={(k) => pick(String(k))}
          >
            {(t) => (
              <KListItem id={t.id} textValue={t.name}>
                <span className="text-body-strong">{t.name}</span>
                <span className="text-caption text-text-secondary">
                  {t.id === NEW ? _('Not saved yet') : t.builtIn ? _('Built-in') : _('Custom')}
                </span>
              </KListItem>
            )}
          </KListBox>
        </div>
        <form
          className="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (valid && !readOnly) save()
          }}
        >
          {readOnly ? (
            <p className="m-0 text-callout text-text-secondary">
              {_('Built-in templates cannot be changed. Duplicate one to make it your own.')}
            </p>
          ) : null}
          <KTextField
            label={_('Name')}
            value={draft.name}
            onChange={(name) => setDraft((d) => ({ ...d, name }))}
            isDisabled={readOnly}
          />
          <KTextField
            label={_('Keywords')}
            description={_(
              'Comma-separated. A meeting whose title (or calendar event) contains one gets this template.',
            )}
            value={draft.keywords}
            onChange={(keywords) => setDraft((d) => ({ ...d, keywords }))}
            isDisabled={readOnly}
          />
          <KTextField
            label={_('Template')}
            description={_('The structure and guidance the notes should follow, in Markdown.')}
            multiline
            rows={12}
            mono
            value={draft.body}
            onChange={(body) => setDraft((d) => ({ ...d, body }))}
            isDisabled={readOnly}
          />
          {error ? (
            <p role="alert" className="m-0 text-callout text-status-danger">
              {fmt(_('The template could not be saved: {reason}'), { reason: (error as Error).message })}
            </p>
          ) : null}
          <div className="flex items-center gap-2">
            {current && !current.builtIn ? (
              <KButton variant="destructive" icon={Trash} isDisabled={del.isPending} onPress={remove}>
                {_('Delete Template')}
              </KButton>
            ) : null}
            {readOnly && current ? (
              <KButton onPress={() => startFrom(current)}>{_('Duplicate')}</KButton>
            ) : null}
            <span className="flex-1" />
            <KButton variant="ghost" onPress={() => onOpenChange(false)}>
              {_('Close')}
            </KButton>
            {!readOnly ? (
              <KButton type="submit" variant="primary" isDisabled={!valid || put.isPending}>
                {_('Save Template')}
              </KButton>
            ) : null}
          </div>
        </form>
      </div>
    </KDialog>
  )
}
