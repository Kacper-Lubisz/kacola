import type { NoteTemplate, NoteVersion } from '@kacola/protocol'
import { formatClockTime } from '@kacola/ui-core/format'
import { _, fmt } from '@kacola/ui-core/i18n'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useServices } from '../../data/services.tsx'
import { Button, Dialog, NavigationList, Spinner } from '../../design/primitives/index.ts'

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

  const items = newestFirst.map((v) => {
    const title = versionTitle(v, templates)
    const label = fmt(_('Version {n}'), { n: v.version })
    return {
      id: String(v.version),
      textValue: `${label} ${title}`,
      content: (
        <div className="flex flex-col gap-0.5 px-3 py-2">
          <span className="flex items-baseline gap-2">
            <span className="type-body-strong">{label}</span>
            {v.version === headVersion ? (
              <span className="rounded-pill bg-bg-sidebar px-2 type-caption text-text-secondary">
                {_('Current')}
              </span>
            ) : null}
          </span>
          <span className="flex min-w-0 gap-2 type-caption whitespace-nowrap text-text-secondary">
            <span className="min-w-0 truncate">{title}</span>
            <span aria-hidden="true">·</span>
            <time dateTime={v.createdAt} className="shrink-0 font-mono text-[12px] tabular-nums">
              {formatClockTime(v.createdAt)}
            </time>
          </span>
        </div>
      ),
    }
  })

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={_('Version history')}
      size="lg"
      footer={
        <>
          {failed ? (
            <p
              role="alert"
              className="m-0 min-w-[12rem] flex-1 self-center type-callout text-status-danger-text"
            >
              {fmt(_('The version could not be restored: {reason}'), { reason: failed })}
            </p>
          ) : (
            <p className="m-0 min-w-[12rem] flex-1 self-center type-caption text-text-secondary">
              {_('Restoring adds a new version; nothing in this list is ever removed.')}
            </p>
          )}
          <Button
            variant="primary"
            icon="restore"
            isDisabled={!selected || busy || selected.version === headVersion}
            onPress={() => selected && void restore(selected)}
          >
            {_('Restore this version')}
          </Button>
        </>
      }
    >
      {/* side by side; a narrow window stacks the list above the text */}
      <div className="flex h-[min(60vh,520px)] min-h-0 overflow-hidden rounded-lg border border-border-subtle max-sm:h-[min(70vh,560px)] max-sm:flex-col">
        <div className="w-60 shrink-0 overflow-y-auto border-r border-border-subtle py-1 max-sm:max-h-[40%] max-sm:w-full max-sm:border-r-0 max-sm:border-b">
          {!versions && !error ? (
            <div className="p-3">
              <Spinner label={_('Loading…')} size={20} />
            </div>
          ) : null}
          {error ? (
            <p className="m-3 type-callout text-status-danger-text">{(error as Error).message}</p>
          ) : null}
          {versions && versions.length === 0 ? (
            <p className="m-3 type-callout text-text-secondary">{_('Nothing written yet')}</p>
          ) : null}
          {versions?.length ? (
            <NavigationList
              label={_('Versions')}
              items={items}
              selected={selected ? String(selected.version) : null}
              onSelect={(id) => setPicked(Number(id))}
              className="px-1"
            />
          ) : null}
        </div>
        {selected ? (
          <section
            aria-label={fmt(_('Text of version {n}'), { n: selected.version })}
            // a scrolling preview must be reachable from the keyboard (axe scrollable-region-focusable)
            // biome-ignore lint/a11y/noNoninteractiveTabindex: a named, scrollable region
            tabIndex={0}
            className="min-w-0 flex-1 overflow-y-auto px-5 py-4"
          >
            <h3 className="m-0 mb-2 font-display text-[15px] font-semibold">
              {fmt(_('Version {n}'), { n: selected.version })} · {versionTitle(selected, templates)}
            </h3>
            <pre className="m-0 whitespace-pre-wrap break-words font-sans type-body text-text-primary">
              {selected.markdown || _('(empty)')}
            </pre>
          </section>
        ) : null}
      </div>
    </Dialog>
  )
}
