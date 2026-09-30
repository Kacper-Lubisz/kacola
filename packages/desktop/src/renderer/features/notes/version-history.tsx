import type { NoteTemplate, NoteVersion } from '@gnomeola/protocol'
import { formatClockTime } from '@gnomeola/ui-core/format'
import { _, fmt } from '@gnomeola/ui-core/i18n'
import { useQuery } from '@tanstack/react-query'
import { RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { useServices } from '../../data/services.tsx'
import { KButton, KDialog, KListBox, KListItem, KSpinner } from './kit.tsx'

// N-1 — the notes' history: every version ever written (each autosave, each enhancement, each applied
// review, each restore), newest first, with a preview and "Restore This Version". Restoring appends a
// new version (history is never rewritten), so restoring is itself undoable from this same list. The
// list is the ['noteVersions', id] query, kept current by the EventBridge folding note.version events.

export function versionTitle(v: NoteVersion, templates: readonly NoteTemplate[]): string {
  switch (v.kind) {
    case 'user':
      return _('Typed')
    case 'enhanced': {
      const id = v.enhancement?.templateId ?? ''
      const name = templates.find((t) => t.id === id)?.name ?? id
      return name ? fmt(_('Enhanced ({template})'), { template: name }) : _('Enhanced')
    }
    case 'merge':
      return _('Review applied')
    case 'restore':
      return fmt(_('Restored version {n}'), { n: v.restoredFrom ?? '?' })
  }
}

export function VersionHistory({
  sessionId,
  isOpen,
  onOpenChange,
  headVersion,
  templates,
  onRestore,
}: {
  sessionId: string
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  headVersion: number
  templates: readonly NoteTemplate[]
  onRestore: (version: number) => Promise<void>
}) {
  const { queries } = useServices()
  const { data: versions, error } = useQuery({ ...queries.noteVersions(sessionId), enabled: isOpen })
  const [picked, setPicked] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)
  const newestFirst = [...(versions ?? [])].reverse()
  const selected =
    newestFirst.find((v) => v.version === picked) ??
    newestFirst.find((v) => v.version === headVersion) ??
    newestFirst[0]

  const restore = async (v: NoteVersion) => {
    setBusy(true)
    setFailed(null)
    try {
      await onRestore(v.version)
      onOpenChange(false)
    } catch (err) {
      setFailed((err as Error).message ?? String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <KDialog isOpen={isOpen} onOpenChange={onOpenChange} title={_('Version History')} wide>
      <div className="flex min-h-0 flex-1 gap-0 border-t border-border-subtle">
        <div className="w-72 shrink-0 overflow-y-auto border-r border-border-subtle p-2">
          {!versions && !error ? <KSpinner label={_('Loading…')} /> : null}
          {error ? <p className="m-2 text-callout text-status-danger">{(error as Error).message}</p> : null}
          {versions && versions.length === 0 ? (
            <p className="m-2 text-callout text-text-secondary">{_('Nothing written yet')}</p>
          ) : null}
          {versions?.length ? (
            <KListBox
              label={_('Versions')}
              items={newestFirst.map((v) => ({ ...v, id: v.version }))}
              selected={selected?.version ?? null}
              onSelect={(k) => setPicked(Number(k))}
            >
              {(v) => {
                const title = versionTitle(v, templates)
                const current = v.version === headVersion
                const time = formatClockTime(v.createdAt)
                return (
                  <KListItem id={v.version} textValue={`${fmt(_('Version {n}'), { n: v.version })} ${title}`}>
                    <span className="flex items-baseline gap-2">
                      <span className="text-body-strong">{fmt(_('Version {n}'), { n: v.version })}</span>
                      {current ? (
                        <span className="rounded-pill bg-bg-sidebar px-2 text-caption text-text-secondary">
                          {_('Current')}
                        </span>
                      ) : null}
                    </span>
                    <span className="flex gap-2 text-caption text-text-secondary">
                      <span>{title}</span>
                      <span aria-hidden="true">·</span>
                      <time dateTime={v.createdAt} className="font-mono text-[12px] tabular-nums">
                        {time}
                      </time>
                    </span>
                  </KListItem>
                )
              }}
            </KListBox>
          ) : null}
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          {selected ? (
            <section
              aria-label={fmt(_('Text of version {n}'), { n: selected.version })}
              className="min-h-0 flex-1 overflow-y-auto px-6 py-4"
            >
              <h3 className="m-0 mb-2 font-display text-[15px] font-semibold">
                {fmt(_('Version {n}'), { n: selected.version })} · {versionTitle(selected, templates)}
              </h3>
              <pre className="m-0 whitespace-pre-wrap break-words font-sans text-body text-text-primary">
                {selected.markdown || _('(empty)')}
              </pre>
            </section>
          ) : null}
        </div>
      </div>
      <div className="flex items-center gap-2 border-t border-border-subtle px-6 py-3">
        {failed ? (
          <p role="alert" className="m-0 flex-1 text-callout text-status-danger">
            {fmt(_('The version could not be restored: {reason}'), { reason: failed })}
          </p>
        ) : (
          <p className="m-0 flex-1 text-caption text-text-secondary">
            {_('Restoring adds a new version; nothing in this list is ever removed.')}
          </p>
        )}
        <KButton variant="ghost" onPress={() => onOpenChange(false)}>
          {_('Close')}
        </KButton>
        <KButton
          variant="primary"
          icon={RotateCcw}
          isDisabled={!selected || busy || selected.version === headVersion}
          onPress={() => selected && void restore(selected)}
        >
          {_('Restore This Version')}
        </KButton>
      </div>
    </KDialog>
  )
}
